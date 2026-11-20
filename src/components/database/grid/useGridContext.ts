import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import type { Row } from '@/application/database-yjs';
import type { RenderRow } from '@/components/database/components/grid/grid-row';
import type { GridRowSelectionStore } from '@/components/database/grid/gridRowSelectionStore';

export type GridActiveCell = {
  rowId: string;
  rowKey: string;
  fieldId: string;
};

type GridInteractionListener = () => void;

export type GridInteractionStore = {
  getActiveCell: () => GridActiveCell | undefined;
  getHoverRowKey: () => string | undefined;
  setActiveCell: (activeCell?: GridActiveCell) => void;
  setHoverRowKey: (hoverRowKey?: string) => void;
  subscribeActiveCell: (listener: GridInteractionListener) => () => void;
  subscribeHoverRowKey: (listener: GridInteractionListener) => () => void;
  subscribe: (listener: GridInteractionListener) => () => void;
};

export function createGridInteractionStore(initial?: {
  activeCell?: GridActiveCell;
  hoverRowKey?: string;
}): GridInteractionStore {
  let activeCell = initial?.activeCell;
  let hoverRowKey = initial?.hoverRowKey;
  const activeCellListeners = new Set<GridInteractionListener>();
  const hoverRowKeyListeners = new Set<GridInteractionListener>();
  const interactionListeners = new Set<GridInteractionListener>();
  const subscribe = (listeners: Set<GridInteractionListener>, listener: GridInteractionListener) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getActiveCell: () => activeCell,
    getHoverRowKey: () => hoverRowKey,
    setActiveCell: (nextActiveCell) => {
      if (
        activeCell?.rowId === nextActiveCell?.rowId &&
        activeCell?.rowKey === nextActiveCell?.rowKey &&
        activeCell?.fieldId === nextActiveCell?.fieldId
      ) {
        return;
      }

      activeCell = nextActiveCell;
      activeCellListeners.forEach((listener) => listener());
      interactionListeners.forEach((listener) => listener());
    },
    setHoverRowKey: (nextHoverRowKey) => {
      if (hoverRowKey === nextHoverRowKey) return;

      hoverRowKey = nextHoverRowKey;
      hoverRowKeyListeners.forEach((listener) => listener());
      interactionListeners.forEach((listener) => listener());
    },
    subscribeActiveCell: (listener) => subscribe(activeCellListeners, listener),
    subscribeHoverRowKey: (listener) => subscribe(hoverRowKeyListeners, listener),
    subscribe: (listener) => subscribe(interactionListeners, listener),
  };
}

const subscribeToNothing = () => () => undefined;

type GridInteractionContextType = {
  historyScopeId: string;
  restoreHistoryFocus: () => void;
  setActiveCell: GridInteractionStore['setActiveCell'];
  setHoverRowKey: GridInteractionStore['setHoverRowKey'];
  store: GridInteractionStore;
};

export const GridInteractionContext = createContext<GridInteractionContextType | undefined>(undefined);

function useGridInteractionContext() {
  const context = useContext(GridInteractionContext);

  if (!context) throw new Error('Grid interaction hooks must be used within GridProvider');

  return context;
}

export function useGridInteractionActions() {
  const { setActiveCell, setHoverRowKey } = useGridInteractionContext();

  return { setActiveCell, setHoverRowKey };
}

export function useGridHistoryScopeId() {
  return useContext(GridInteractionContext)?.historyScopeId;
}

export function useRestoreGridHistoryFocus() {
  return useContext(GridInteractionContext)?.restoreHistoryFocus;
}

export function useIsGridRowHovered(rowKey: string, enabled = true) {
  const { store } = useGridInteractionContext();
  const getSnapshot = useCallback(() => enabled && store.getHoverRowKey() === rowKey, [enabled, rowKey, store]);
  const subscribe = enabled ? store.subscribeHoverRowKey : subscribeToNothing;

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useIsGridRowActive(rowKey: string) {
  const { store } = useGridInteractionContext();
  const getSnapshot = useCallback(() => store.getActiveCell()?.rowKey === rowKey, [rowKey, store]);

  return useSyncExternalStore(store.subscribeActiveCell, getSnapshot, getSnapshot);
}

export function useIsGridCellActive(rowKey: string, fieldId: string) {
  const { store } = useGridInteractionContext();
  const getSnapshot = useCallback(() => {
    const activeCell = store.getActiveCell();

    return activeCell?.rowKey === rowKey && activeCell.fieldId === fieldId;
  }, [fieldId, rowKey, store]);

  return useSyncExternalStore(store.subscribeActiveCell, getSnapshot, getSnapshot);
}

export type GridContextType = {
  rowOrders?: Row[];
  rows: RenderRow[];
  setRows: (rows: RenderRow[]) => void;
  activePropertyId?: string;
  setActivePropertyId: (activePropertyId?: string) => void;
  remainingRowCount: number;
  lastVisibleRowId?: string;
  loadMoreRows: () => void;
  revealCreatedRow: () => void;
  showStickyHeader: boolean;
  setShowStickyHeader: (show: boolean) => void;
  isGrouped: boolean;
};

export const GridContext = createContext<GridContextType | undefined>(undefined);

export function useGridContext() {
  const context = useContext(GridContext);

  if (!context) {
    throw new Error('useGridContext must be used within the context');
  }

  return context;
}

type GridRowSelectionContextType = {
  store: GridRowSelectionStore;
  /** Row ids in current visual order (first occurrence only; grouped grids can repeat a row). */
  getOrderedRowIds: () => readonly string[];
};

export const GridRowSelectionContext = createContext<GridRowSelectionContextType | undefined>(undefined);

export function useGridRowSelection() {
  return useContext(GridRowSelectionContext);
}

const noopSubscribe = () => () => undefined;

export function useIsGridRowSelected(rowId: string) {
  const store = useGridRowSelection()?.store;
  const getSnapshot = useCallback(() => store?.isSelected(rowId) ?? false, [rowId, store]);

  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, getSnapshot, getSnapshot);
}

export function useGridSelectedRowIds(): readonly string[] {
  const store = useGridRowSelection()?.store;
  const getSnapshot = useCallback(() => store?.getSelectedIds() ?? NO_SELECTED_ROWS, [store]);

  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, getSnapshot, getSnapshot);
}

export function useHasGridRowSelection() {
  const store = useGridRowSelection()?.store;
  const getSnapshot = useCallback(() => (store?.getCount() ?? 0) > 0, [store]);

  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, getSnapshot, getSnapshot);
}

const NO_SELECTED_ROWS: readonly string[] = Object.freeze([]);
