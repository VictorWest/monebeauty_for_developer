export function groupBy<T, K>(rows: readonly T[], keyFor: (row: T) => K) {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}
