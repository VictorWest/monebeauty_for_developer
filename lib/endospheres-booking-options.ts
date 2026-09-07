export type EndospheresPublicOption = {
  key: string;
  type: "APPOINTMENT" | "COURSE" | "INFORMATIONAL_PACKAGE";
  bookable: boolean;
  group: string | null;
  name: string;
  summary?: string;
  durationLabel: string | null;
  priceLabel: string | null;
  offerRequiresAccount?: boolean;
};

const SINGLE_IDENTITIES = [
  { canonical: "intro-75", aliases: ["endospheres-intro-75"] },
  { canonical: "30", aliases: ["endospheres-30"] },
  { canonical: "45", aliases: ["endospheres-45"] },
  { canonical: "60", aliases: ["endospheres-60"] },
  { canonical: "75", aliases: ["endospheres-75"] },
] as const;

const PACKAGE_DURATIONS = [30, 45, 60, 75] as const;

export type EndospheresPackageRow = {
  duration: (typeof PACKAGE_DURATIONS)[number];
  six: EndospheresPublicOption | null;
  twelve: EndospheresPublicOption | null;
};

/**
 * The Endospheres parent temporarily contains both legacy and normalized
 * single-treatment rows. Prefer the normalized parent keys while retaining a
 * legacy fallback so a partially migrated database still remains bookable.
 */
export function normalizeEndospheresBookingOptions(
  options: EndospheresPublicOption[],
) {
  const byKey = new Map(options.map((option) => [option.key, option]));
  const singles = SINGLE_IDENTITIES.flatMap(({ canonical, aliases }) => {
    const option =
      byKey.get(canonical) ??
      aliases.map((key) => byKey.get(key)).find(Boolean);
    return option?.bookable && option.type === "APPOINTMENT" ? [option] : [];
  });

  const packages: EndospheresPackageRow[] = PACKAGE_DURATIONS.map(
    (duration) => {
      const course = (count: 6 | 12) => {
        const option = byKey.get(`package-${duration}-${count}`) ?? null;
        return option?.bookable && option.type === "COURSE" ? option : null;
      };
      return { duration, six: course(6), twelve: course(12) };
    },
  ).filter((row) => row.six || row.twelve);

  return { singles, packages };
}
