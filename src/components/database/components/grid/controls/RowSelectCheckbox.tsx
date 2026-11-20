import { MouseEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { ReactComponent as CheckedIcon } from '@/assets/icons/check_filled.svg';
import { ReactComponent as UncheckedIcon } from '@/assets/icons/uncheck.svg';
import {
  useGridRowSelection,
  useHasGridRowSelection,
  useIsGridRowHovered,
  useIsGridRowSelected,
} from '@/components/database/grid/useGridContext';
import { cn } from '@/lib/utils';

export function RowSelectCheckbox({ rowId, rowKey }: { rowId: string; rowKey: string }) {
  const { t } = useTranslation();
  const selection = useGridRowSelection();
  const selected = useIsGridRowSelected(rowId);
  const anySelected = useHasGridRowSelection();
  const hovered = useIsGridRowHovered(rowKey);
  const visible = selected || anySelected || hovered;

  const onClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      if (!selection) return;

      if (event.shiftKey) selection.store.selectRange(rowId, selection.getOrderedRowIds());
      else selection.store.toggle(rowId);
    },
    [rowId, selection]
  );

  if (!selection) return null;

  return (
    <button
      type='button'
      role='checkbox'
      aria-checked={selected}
      aria-label={t('grid.row.select', { defaultValue: 'Select row' })}
      data-testid={`row-select-checkbox-${rowId}`}
      tabIndex={-1}
      draggable={false}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={cn(
        'absolute left-2 top-[9px] z-10 flex h-[18px] w-[18px] items-center justify-center rounded text-icon-secondary',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      {selected ? <CheckedIcon className='h-[18px] w-[18px]' /> : <UncheckedIcon className='h-[18px] w-[18px]' />}
    </button>
  );
}

export default RowSelectCheckbox;
