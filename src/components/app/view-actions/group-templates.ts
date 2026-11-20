/** Built-in templates first (no category), then one group per category; order inside a group is kept. */
export function groupByCategory<T extends { category?: string | null }>(templates: T[]): Array<{ category: string | null; items: T[] }> {
  const groups = new Map<string | null, T[]>();

  for (const template of templates) {
    const key = template.category ?? null;

    groups.set(key, [...(groups.get(key) ?? []), template]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b)))
    .map(([category, items]) => ({ category, items }));
}
