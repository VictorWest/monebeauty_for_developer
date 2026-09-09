import { NextResponse, type NextRequest } from "next/server";
import { openPublicDates } from "@/lib/booking";
import { routing, type Locale } from "@/i18n/routing";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const service = searchParams.get("service") ?? "";
  const option = searchParams.get("option") ?? undefined;
  const specialist = searchParams.get("specialist") ?? "";
  const localeParam = searchParams.get("locale");
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (
    !DATE_RE.test(from) ||
    !DATE_RE.test(to) ||
    !service ||
    !option ||
    !specialist ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start ||
    end.getTime() - start.getTime() > 62 * 86400000
  ) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      {
        dates: await openPublicDates({
          fromDate: from,
          toDate: to,
          serviceKey: service,
          locale,
          optionKey: option,
          // "any" -> union of availability across every qualified specialist.
          specialistId: specialist === "any" ? undefined : specialist,
        }),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[booking/availability] failed", error);
    return NextResponse.json(
      { dates: [], degraded: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
