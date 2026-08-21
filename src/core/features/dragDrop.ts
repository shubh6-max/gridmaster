export function moveRow<T>(
  rows: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (fromIndex === toIndex) return rows;
  const next = [...rows];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function moveColumn<T>(
  columns: T[],
  fromKey: string,
  toKey: string
): T[] {
  const fromIndex = columns.findIndex((c) => (c as { key: string }).key === fromKey);
  const toIndex = columns.findIndex((c) => (c as { key: string }).key === toKey);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return columns;
  const next = [...columns];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
