import type { Locale } from "@/i18n/routing";
import type { Procedure } from "@/lib/procedures";
import {
  bootstrapProcedureMedia,
  type ProcedureIdentity,
} from "@/content/procedure-media";

export type ProcedureMediaRecord = {
  key: string;
  image: string;
  identities: unknown;
};

function identitiesFor(value: unknown, locale: Locale): ProcedureIdentity[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const localized = (value as Record<string, unknown>)[locale];
  if (!Array.isArray(localized)) return [];
  return localized.flatMap((identity) => {
    if (!identity || typeof identity !== "object" || Array.isArray(identity))
      return [];
    const group = (identity as Record<string, unknown>).group;
    const title = (identity as Record<string, unknown>).title;
    if (
      (group !== null && typeof group !== "string") ||
      typeof title !== "string"
    )
      return [];
    return [{ group, title }];
  });
}

function matches(identities: ProcedureIdentity[], procedure: Procedure) {
  return identities.some(
    (identity) =>
      identity.group === procedure.group && identity.title === procedure.title,
  );
}

export function resolveProcedureImage({
  serviceSlug,
  locale,
  procedure,
  records,
}: {
  serviceSlug: string;
  locale: Locale;
  procedure: Procedure;
  records: ProcedureMediaRecord[];
}) {
  const saved = records.find((record) =>
    matches(identitiesFor(record.identities, locale), procedure),
  );
  if (saved) return saved.image;

  return bootstrapProcedureMedia(serviceSlug).find((record) =>
    matches(record.identities[locale], procedure),
  )?.image;
}
