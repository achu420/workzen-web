import { groupByCategory } from '../group-templates';

describe('groupByCategory', () => {
  it('puts built-in templates (no category) first, then one group per category in alphabetical order', () => {
    const groups = groupByCategory([
      { id: 'a', category: 'Startups' },
      { id: 'b', category: null },
      { id: 'c', category: 'Engineering' },
      { id: 'd' },
      { id: 'e', category: 'Startups' },
    ]);

    expect(groups.map((group) => group.category)).toEqual([null, 'Engineering', 'Startups']);
    expect(groups[0].items.map((item) => item.id)).toEqual(['b', 'd']);
    expect(groups[2].items.map((item) => item.id)).toEqual(['a', 'e']);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
