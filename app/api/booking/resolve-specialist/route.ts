import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnySpecialist, resolveAnySpecialistForGroup } from "@/lib/booking";
import { clinicDateFromInstant } from "@/lib/clinic-time";
import { routing, type Locale } from "@/i18n/routing";

/**
 * POST /api/booking/resolve-specialist
 * Resolves an "Any Specialist" choice to one concrete practitioner for an
 * exact slot, so the client can see who they'll get before confirming (the
 * final POST /api/booking still re-validates that specialist + slot). A
 * multi-procedure cart sends `options` (array) instead of a single `option`.
 */
export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const service = String(payload.service ?? "");
  const option = String(payload.option ?? "");
  const optionKeys = Array.isArray(payload.options)
    ? payload.options.filter((item): item is string => typeof item === "string")
    : undefined;
  const start = String(payload.start ?? "");
  const localeParam = payload.locale;
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale;
  if (
    !service ||
    (!option && !optionKeys?.length) ||
    !start ||
    Number.isNaN(Date.parse(start))
  )
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const dateStr = clinicDateFromInstant(new Date(start));

  try {
    const resolved =
      optionKeys && optionKeys.length > 1
        ? await resolveAnySpecialistForGroup({
            dateStr,
            serviceKey: service,
            optionKeys,
            locale,
            start,
          })
        : await resolveAnySpecialist({
            dateStr,
            serviceKey: service,
            optionKey: option || optionKeys![0],
            locale,
            start,
          });
    if (!resolved)
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    const practitioner = await prisma.practitioner.findUnique({
      where: { id: resolved.practitionerId },
      select: { name: true, publicName: true },
    });
    if (!practitioner)
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    return NextResponse.json({
      specialist: {
        id: resolved.practitionerId,
        name: practitioner.publicName?.trim() || practitioner.name.split(/\s+/)[0],
      },
    });
  } catch (error) {
    console.error("[booking/resolve-specialist] failed", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
