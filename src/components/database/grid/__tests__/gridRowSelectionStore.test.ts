import { createGridRowSelectionStore } from '@/components/database/grid/gridRowSelectionStore';

const order = ['a', 'b', 'c', 'd', 'e'];

describe('createGridRowSelectionStore', () => {
  it('toggles rows on and off and notifies subscribers', () => {
    const store = createGridRowSelectionStore();
    const listener = jest.fn();

    store.subscribe(listener);
    store.toggle('b');
    expect(store.isSelected('b')).toBe(true);
    expect(store.getCount()).toBe(1);
    store.toggle('b');
    expect(store.isSelected('b')).toBe(false);
    expect(store.getCount()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps the snapshot identity stable until the selection changes', () => {
    const store = createGridRowSelectionStore();

    store.toggle('a');
    const first = store.getSelectedIds();

    expect(store.getSelectedIds()).toBe(first);
    store.toggle('b');
    expect(store.getSelectedIds()).not.toBe(first);
    expect(store.getSelectedIds()).toEqual(['a', 'b']);
  });

  it('selects an inclusive range from the last toggled row, in either direction', () => {
    const store = createGridRowSelectionStore();

    store.toggle('b');
    store.selectRange('d', order);
    expect([...store.getSelectedIds()].sort()).toEqual(['b', 'c', 'd']);

    store.clear();
    store.toggle('d');
    store.selectRange('b', order);
    expect([...store.getSelectedIds()].sort()).toEqual(['b', 'c', 'd']);
  });

  it('extends from the new anchor on consecutive range selections', () => {
    const store = createGridRowSelectionStore();

    store.toggle('a');
    store.selectRange('b', order);
    store.selectRange('e', order);
    expect([...store.getSelectedIds()].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('selects just the target when there is no anchor, and ignores unknown rows', () => {
    const store = createGridRowSelectionStore();

    store.selectRange('c', order);
    expect(store.getSelectedIds()).toEqual(['c']);
    store.selectRange('zzz', order);
    expect(store.getSelectedIds()).toEqual(['c']);
  });

  it('clear empties the selection and is a no-op when already empty', () => {
    const store = createGridRowSelectionStore();
    const listener = jest.fn();

    store.subscribe(listener);
    store.clear();
    expect(listener).not.toHaveBeenCalled();
    store.toggle('a');
    store.clear();
    expect(store.getCount()).toBe(0);
    expect(store.getSelectedIds()).toEqual([]);
  });

  it('prune drops rows that no longer exist and only notifies on change', () => {
    const store = createGridRowSelectionStore();
    const listener = jest.fn();

    store.toggle('a');
    store.toggle('b');
    store.subscribe(listener);
    store.prune(new Set(['a', 'b', 'c']));
    expect(listener).not.toHaveBeenCalled();
    store.prune(new Set(['a']));
    expect(store.getSelectedIds()).toEqual(['a']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('forgets a pruned anchor so a later range starts fresh', () => {
    const store = createGridRowSelectionStore();

    store.toggle('b');
    store.prune(new Set(['a', 'c', 'd']));
    store.selectRange('d', order);
    expect(store.getSelectedIds()).toEqual(['d']);
  });
});
