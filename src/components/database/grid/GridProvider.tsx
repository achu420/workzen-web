import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useDatabaseContext } from '@/application/database-yjs';
import type { GridGrouping } from '@/application/database-yjs';
import GridSelectionBar from '@/components/database/components/grid/controls/GridSelectionBar';
import {
  EMBEDDED_GRID_INITIAL_ROW_LIMIT,
  EMBEDDED_GRID_LOAD_MORE_INCREMENT,
  useRenderRows,
 RenderRowType } from '@/components/database/components/grid/grid-row';
import type { RenderRow } from '@/components/database/components/grid/grid-row';
import { useDatabaseHistoryScopeContext } from '@/components/database/DatabaseHistoryScope';
import { useDatabaseHistoryScope } from '@/components/database/databaseHistoryScopeCoordinator';
import { createGridRowSelectionStore } from '@/components/database/grid/gridRowSelectionStore';
import {
  createGridInteractionStore,
  GridContext,
  GridInteractionContext,
  GridRowSelectionContext,
} from '@/components/database/grid/useGridContext';

type GridProviderProps = {
  children: ReactNode;
  grouping: GridGrouping;
};

type GridProviderContentProps = GridProviderProps & {
  activateHistoryScope: () => void;
  clearHistoryScope?: () => void;
  historyScopeId: string;
  ownsHistoryScope: boolean;
};

export const GridProvider = (props: GridProviderProps) => {
  const inheritedHistoryScope = useDatabaseHistoryScopeContext();

  if (inheritedHistoryScope) {
    return (
      <GridProviderContent
        {...props}
        activateHistoryScope={inheritedHistoryScope.activateHistoryScope}
        historyScopeId={inheritedHistoryScope.historyScopeId}
        ownsHistoryScope={false}
      />
    );
  }

  return <StandaloneGridProvider {...props} />;
};

function StandaloneGridProvider(props: GridProviderProps) {
  const { readOnly } = useDatabaseContext();
  const { activateHistoryScope, clearHistoryScope, historyScopeId } = useDatabaseHistoryScope({ enabled: !readOnly });

  return (
    <GridProviderContent
      {...props}
      activateHistoryScope={activateHistoryScope}
      clearHistoryScope={clearHistoryScope}
      historyScopeId={historyScopeId}
      ownsHistoryScope
    />
  );
}

function GridProviderContent({
  activateHistoryScope,
  children,
  clearHistoryScope,
  grouping,
  historyScopeId,
  ownsHistoryScope,
}: GridProviderContentProps) {
  const { rowOrders } = grouping;
  const [activePropertyId, setActivePropertyId] = useState<string | undefined>();
  const { isDocumentBlock, activeViewId } = useDatabaseContext();
  // Each database view owns independent transient interaction state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const interactionStore = useMemo(() => createGridInteractionStore(), [activeViewId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectionStore = useMemo(() => createGridRowSelectionStore(), [activeViewId]);
  const [visibleRowLimit, setVisibleRowLimit] = useState(EMBEDDED_GRID_INITIAL_ROW_LIMIT);
  const embeddedVisibleRowLimit = isDocumentBlock ? visibleRowLimit : undefined;
  const {
    rows: initialRows,
    remainingRowCount,
    lastVisibleRowId,
  } = useRenderRows(rowOrders, {
    grouping,
    visibleRowLimit: embeddedVisibleRowLimit,
  });
  const initialRowsRef = useRef(initialRows);

  // Publish the latest committed render rows for DnD callbacks. Updating this
  // ref during render would expose data from an interrupted concurrent render.
  useLayoutEffect(() => {
    initialRowsRef.current = initialRows;
  }, [initialRows]);
  const [optimisticRows, setOptimisticRows] = useState<{ base: RenderRow[]; value: RenderRow[] } | null>(null);
  const rows = grouping.isGrouped || optimisticRows?.base !== initialRows ? initialRows : optimisticRows.value;
  const setRows = useCallback((value: RenderRow[]) => {
    setOptimisticRows({ base: initialRowsRef.current, value });
  }, []);
  const orderedRowIdsRef = useRef<readonly string[]>([]);
  const orderedRowIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      if (row.type !== RenderRowType.Row || !row.rowId || seen.has(row.rowId)) continue;
      seen.add(row.rowId);
      ids.push(row.rowId);
    }

    return ids;
  }, [rows]);

  useLayoutEffect(() => {
    orderedRowIdsRef.current = orderedRowIds;
  }, [orderedRowIds]);

  // Selected rows that were deleted, filtered out or hidden can no longer be acted on.
  useEffect(() => {
    if (rowOrders === undefined) return;
    selectionStore.prune(new Set(orderedRowIds));
  }, [orderedRowIds, rowOrders, selectionStore]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || selectionStore.getCount() === 0) return;

      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'))
      ) {
        return;
      }

      selectionStore.clear();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectionStore]);

  const selectionContextValue = useMemo(
    () => ({ store: selectionStore, getOrderedRowIds: () => orderedRowIdsRef.current }),
    [selectionStore]
  );
  const isWheelingRef = useRef(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleRowLimit(EMBEDDED_GRID_INITIAL_ROW_LIMIT);
    clearHistoryScope?.();
  }, [activeViewId, clearHistoryScope, isDocumentBlock]);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    let timeoutId: NodeJS.Timeout | null = null;

    const onWheel = () => {
      timeoutId && clearTimeout(timeoutId);
      isWheelingRef.current = true;
      interactionStore.setHoverRowKey(undefined);

      timeoutId = setTimeout(() => {
        isWheelingRef.current = false;
      }, 300);
    };

    const listenerOptions: AddEventListenerOptions = { passive: true };

    element.addEventListener('wheel', onWheel, listenerOptions);

    return () => {
      element.removeEventListener('wheel', onWheel, listenerOptions);
      if (timeoutId) clearTimeout(timeoutId);
      isWheelingRef.current = false;
    };
  }, [interactionStore]);

  const handleHoverRowStart = useCallback(
    (rowKey?: string) => {
      if (isWheelingRef.current) {
        return;
      }

      interactionStore.setHoverRowKey(rowKey);
    },
    [interactionStore]
  );

  const handleSetActiveCell = useCallback(
    (nextActiveCell: ReturnType<typeof interactionStore.getActiveCell>) => {
      interactionStore.setActiveCell(nextActiveCell);

      if (nextActiveCell) activateHistoryScope();
    },
    [activateHistoryScope, interactionStore]
  );
  const restoreHistoryFocus = activateHistoryScope;

  const loadMoreRows = useCallback(() => {
    setVisibleRowLimit((prev) => prev + EMBEDDED_GRID_LOAD_MORE_INCREMENT);
  }, []);

  const revealCreatedRow = useCallback(() => {
    if (!isDocumentBlock) return;

    setVisibleRowLimit((prev) => prev + 1);
  }, [isDocumentBlock]);

  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const contextValue = useMemo(
    () => ({
      rowOrders,
      rows,
      setRows,
      activePropertyId,
      setActivePropertyId,
      remainingRowCount,
      lastVisibleRowId,
      loadMoreRows,
      revealCreatedRow,
      showStickyHeader,
      setShowStickyHeader,
      isGrouped: grouping.isGrouped,
    }),
    [
      rowOrders,
      rows,
      setRows,
      activePropertyId,
      remainingRowCount,
      lastVisibleRowId,
      loadMoreRows,
      revealCreatedRow,
      showStickyHeader,
      grouping.isGrouped,
    ]
  );
  const interactionContextValue = useMemo(
    () => ({
      historyScopeId,
      restoreHistoryFocus,
      setActiveCell: handleSetActiveCell,
      setHoverRowKey: handleHoverRowStart,
      store: interactionStore,
    }),
    [handleHoverRowStart, handleSetActiveCell, historyScopeId, interactionStore, restoreHistoryFocus]
  );

  return (
    <GridContext.Provider value={contextValue}>
      <GridInteractionContext.Provider value={interactionContextValue}>
        <GridRowSelectionContext.Provider value={selectionContextValue}>
        <div
          ref={ref}
          data-database-history-scope={ownsHistoryScope ? historyScopeId : undefined}
          className={'flex min-h-0 flex-1 flex-col'}
        >
          {children}
          <GridSelectionBar />
        </div>
        </GridRowSelectionContext.Provider>
      </GridInteractionContext.Provider>
    </GridContext.Provider>
  );
}
