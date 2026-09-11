import { NextResponse, type NextRequest } from "next/server";
import { openGroupSlots, openPublicSlots } from "@/lib/booking";
import { routing, type Locale } from "@/i18n/routing";

/** GET /api/booking/slots?date=YYYY-MM-DD&service=<key> → { slots }. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const service = searchParams.get("service") ?? "";
  const option = searchParams.get("option") ?? undefined;
  // Multi-procedure cart: comma-separated option keys, additive to `option`.
  const optionKeys = searchParams.get("options")?.split(",").filter(Boolean);
  const specialist = searchParams.get("specialist") ?? "";
  const localeParam = searchParams.get("locale");
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale;

  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (!option && !optionKeys?.length) ||
    !specialist
  ) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  // "any" means the client will let the clinic assign a specialist; the
  // underlying lookup already returns the union across every qualified
  // specialist when no specific one is given.
  const specialistId = specialist === "any" ? undefined : specialist;
  try {
    const slots =
      optionKeys && optionKeys.length > 1
        ? await openGroupSlots({
            dateStr: date,
            serviceKey: service,
            locale,
            optionKeys,
            specialistId,
          })
        : await openPublicSlots({
            dateStr: date,
            serviceKey: service,
            locale,
            optionKey: option ?? optionKeys?.[0],
            specialistId,
          });
    return NextResponse.json(
      {
        slots: slots.map(({ start, end, label }) => ({ start, end, label })),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (err) {
    // DB unavailable: empty slots so the wizard shows its call/email fallback.
    console.error("[booking/slots] failed", err);
    return NextResponse.json(
      { slots: [], degraded: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
