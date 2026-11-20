import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useReadOnly } from '@/application/database-yjs';
import { CommittedRowActivationError } from '@/application/database-yjs/creation/create-row';
import { useDuplicateRowDispatch } from '@/application/database-yjs/dispatch';
import { ReactComponent as CloseIcon } from '@/assets/icons/close.svg';
import { ReactComponent as DeleteIcon } from '@/assets/icons/delete.svg';
import { ReactComponent as DuplicateIcon } from '@/assets/icons/duplicate.svg';
import DeleteRowConfirm from '@/components/database/components/database-row/DeleteRowConfirm';
import { useGridRowSelection, useGridSelectedRowIds } from '@/components/database/grid/useGridContext';
import { useRowCreationAction } from '@/components/database/hooks/useRowCreationAction';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/utils/errors';

export function GridSelectionBar() {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const selection = useGridRowSelection();
  const selectedIds = useGridSelectedRowIds();
  const duplicateRow = useDuplicateRowDispatch();
  const { pending: duplicating, run } = useRowCreationAction();
  // The confirm stays mounted after the selection clears so an in-flight delete is never cut short.
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  const orderedSelection = useCallback(() => {
    const selected = new Set(selectedIds);

    return (selection?.getOrderedRowIds() ?? []).filter((id) => selected.has(id));
  }, [selectedIds, selection]);

  const onDuplicate = useCallback(async () => {
    const rowIds = orderedSelection();

    if (rowIds.length === 0) return;
    const loadingToastId = toast.loading(t('grid.row.duplicating', { defaultValue: 'Duplicating rows…', count: rowIds.length }));
    let duplicated = 0;

    try {
      const result = await run(async () => {
        for (const rowId of rowIds) {
          try {
            await duplicateRow(rowId);
          } catch (error) {
            // The row was created but could not be activated; it still counts.
            if (!(error instanceof CommittedRowActivationError)) {
              throw new Error(
                t('grid.row.duplicateFailedAfter', {
                  defaultValue: 'Duplicated {{done}} of {{total}} rows: {{message}}',
                  done: duplicated,
                  total: rowIds.length,
                  message: getErrorMessage(error),
                })
              );
            }
          }

          duplicated += 1;
        }
      });

      if (result.ok) {
        toast.success(
          t('grid.row.duplicatedRows', { defaultValue: 'Duplicated {{count}} rows', count: duplicated })
        );
        selection?.store.clear();
      }
    } finally {
      toast.dismiss(loadingToastId);
    }
  }, [duplicateRow, orderedSelection, run, selection, t]);

  if (readOnly || !selection) return null;

  return createPortal(
    <>
      {selectedIds.length > 0 && (
      <div
        role='toolbar'
        data-testid='grid-selection-bar'
        className='fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border-primary bg-surface-primary px-2 py-1.5 shadow-lg'
      >
        <span data-testid='grid-selection-count' className='px-2 text-sm font-medium text-text-primary'>
          {t('grid.row.selectedCount', { defaultValue: '{{count}} selected', count: selectedIds.length })}
        </span>
        <Button
          variant='ghost'
          size='sm'
          data-testid='grid-selection-duplicate'
          loading={duplicating}
          disabled={duplicating}
          onClick={() => void onDuplicate()}
        >
          <DuplicateIcon className='h-4 w-4' />
          {t('grid.row.duplicate')}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          className='text-text-error'
          data-testid='grid-selection-delete'
          disabled={duplicating}
          onClick={() => setDeleteIds(orderedSelection())}
        >
          <DeleteIcon className='h-4 w-4' />
          {t('grid.row.delete')}
        </Button>
        <Button
          variant='ghost'
          size='icon-sm'
          data-testid='grid-selection-clear'
          aria-label={t('grid.row.clearSelection', { defaultValue: 'Clear selection' })}
          onClick={() => selection.store.clear()}
        >
          <CloseIcon className='h-4 w-4' />
        </Button>
      </div>
      )}
      <DeleteRowConfirm
        open={deleteIds.length > 0}
        onClose={() => setDeleteIds([])}
        rowIds={deleteIds}
        onDeleted={() => selection.store.clear()}
      />
    </>,
    document.body
  );
}

export default GridSelectionBar;
