import { NextResponse, type NextRequest } from "next/server";
import { qualifiedSpecialists } from "@/lib/booking-specialists";
import { routing, type Locale } from "@/i18n/routing";

export async function GET(req: NextRequest) {
  const service = req.nextUrl.searchParams.get("service")?.trim() ?? "";
  const option = req.nextUrl.searchParams.get("option")?.trim() ?? "";
  const requestedLocale = req.nextUrl.searchParams.get("locale");
  const locale = routing.locales.includes(requestedLocale as Locale)
    ? (requestedLocale as Locale)
    : routing.defaultLocale;
  if (!service || !option)
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
        specialists: await qualifiedSpecialists({
          serviceKey: service,
          optionKey: option,
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
