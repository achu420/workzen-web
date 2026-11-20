type Listener = () => void;

export type GridRowSelectionStore = {
  getSelectedIds: () => readonly string[];
  getCount: () => number;
  isSelected: (rowId: string) => boolean;
  toggle: (rowId: string) => void;
  /** Selects every row between the last toggled row and `rowId` (inclusive) in `orderedRowIds`. */
  selectRange: (rowId: string, orderedRowIds: readonly string[]) => void;
  clear: () => void;
  /** Drops selected rows that are not in `validRowIds`. */
  prune: (validRowIds: ReadonlySet<string>) => void;
  subscribe: (listener: Listener) => () => void;
};

const EMPTY: readonly string[] = Object.freeze([]);

// External store (same subscribe/snapshot style as the grid interaction store) so a
// selection change only re-renders rows whose own selected flag flipped.
export function createGridRowSelectionStore(): GridRowSelectionStore {
  let selected = new Set<string>();
  let snapshot: readonly string[] = EMPTY;
  let anchorId: string | undefined;
  const listeners = new Set<Listener>();

  const commit = (next: Set<string>) => {
    selected = next;
    snapshot = next.size === 0 ? EMPTY : Object.freeze([...next]);
    listeners.forEach((listener) => listener());
  };

  return {
    getSelectedIds: () => snapshot,
    getCount: () => selected.size,
    isSelected: (rowId) => selected.has(rowId),
    toggle: (rowId) => {
      const next = new Set(selected);

      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      anchorId = rowId;
      commit(next);
    },
    selectRange: (rowId, orderedRowIds) => {
      const to = orderedRowIds.indexOf(rowId);
      const from = anchorId === undefined ? -1 : orderedRowIds.indexOf(anchorId);

      if (to === -1) return;

      const next = new Set(selected);

      if (from === -1) {
        next.add(rowId);
      } else {
        const [start, end] = from <= to ? [from, to] : [to, from];

        for (let index = start; index <= end; index += 1) next.add(orderedRowIds[index]);
      }

      anchorId = rowId;
      commit(next);
    },
    clear: () => {
      anchorId = undefined;
      if (selected.size === 0) return;
      commit(new Set());
    },
    prune: (validRowIds) => {
      let changed = false;
      const next = new Set<string>();

      selected.forEach((rowId) => {
        if (validRowIds.has(rowId)) next.add(rowId);
        else changed = true;
      });

      if (anchorId !== undefined && !validRowIds.has(anchorId)) anchorId = undefined;
      if (changed) commit(next);
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
