export type TreatmentGroup<T> = {
  name: string;
  options: T[];
  isOther: boolean;
};

/** Groups localized options, then orders larger published groups first. */
export function groupTreatmentOptions<T extends { group?: string | null }>(
  options: T[],
  otherLabel: string,
): TreatmentGroup<T>[] {
  const groups = new Map<
    string,
    TreatmentGroup<T> & { originalIndex: number }
  >();

  for (const option of options) {
    const sourceGroup = option.group?.trim();
    const name = sourceGroup || otherLabel;
    const isOther = !sourceGroup || name === otherLabel;
    const existing = groups.get(name);
    if (existing) {
      existing.options.push(option);
      if (isOther) existing.isOther = true;
      continue;
    }
    groups.set(name, {
      name,
      options: [option],
      isOther,
      originalIndex: groups.size,
    });
  }

  return [...groups.values()]
    .sort((left, right) => {
      if (left.isOther !== right.isOther) return left.isOther ? 1 : -1;
      return (
        right.options.length - left.options.length ||
        left.originalIndex - right.originalIndex
      );
    })
    .map((group) => ({
      name: group.name,
      options: group.options,
      isOther: group.isOther,
    }));
}
