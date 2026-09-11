import { NextResponse, type NextRequest } from "next/server";
import {
  qualifiedSpecialistsForDate,
  qualifiedSpecialistsForGroupDate,
} from "@/lib/booking";
import { routing, type Locale } from "@/i18n/routing";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/booking/specialists?service&option&date&locale
 *
 * The public flow is Treatment -> Date -> Specialist: only specialists who
 * both perform the option and are actually on the schedule for the given
 * clinic date are returned, so `date` is required. A multi-procedure cart
 * passes `options` (comma-separated) instead of a single `option`, and only
 * specialists qualified for every selected procedure are returned.
 */
export async function GET(req: NextRequest) {
  const service = req.nextUrl.searchParams.get("service")?.trim() ?? "";
  const option = req.nextUrl.searchParams.get("option")?.trim() ?? "";
  const optionKeys = req.nextUrl.searchParams
    .get("options")
    ?.split(",")
    .filter(Boolean);
  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  const requestedLocale = req.nextUrl.searchParams.get("locale");
  const locale = routing.locales.includes(requestedLocale as Locale)
    ? (requestedLocale as Locale)
    : routing.defaultLocale;
  if (!service || (!option && !optionKeys?.length) || !DATE_RE.test(date))
    return NextResponse.json(
      { error: "invalid_procedure" },
      {
        status: 400,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  try {
    return NextResponse.json(
      {
        specialists:
          optionKeys && optionKeys.length > 1
            ? await qualifiedSpecialistsForGroupDate({
                serviceKey: service,
                optionKeys,
                dateStr: date,
                locale,
              })
            : await qualifiedSpecialistsForDate({
                serviceKey: service,
                optionKey: option || optionKeys![0],
                dateStr: date,
                locale,
              }),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { specialists: [], degraded: true },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
