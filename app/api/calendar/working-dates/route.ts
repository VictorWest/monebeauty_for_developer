import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  dateFromYmd,
  generateStaffSlots,
  normalizeSlots,
  parseWorkingHours,
  ymdFromDate,
} from "@/lib/staff-schedule";

export async function GET(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const fromValue = req.nextUrl.searchParams.get("from") ?? "";
  const toValue = req.nextUrl.searchParams.get("to") ?? "";
  const from = dateFromYmd(fromValue);
  const to = dateFromYmd(toValue);
  if (
    !from ||
    !to ||
    to < from ||
    to.getTime() - from.getTime() > 62 * 86400000
  )
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });

  const requested = (req.nextUrl.searchParams.get("practitionerIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 50);
  const practitionerIds = requested;
  const through = new Date(to.getTime() + 86400000);
  const practitioners = await prisma.practitioner.findMany({
    where: {
      active: true,
      ...(practitionerIds.length ? { id: { in: practitionerIds } } : {}),
    },
    select: {
      id: true,
      workingHours: true,
      availabilities: {
        where: { date: { gte: from, lt: through } },
        select: { date: true, slots: true },
      },
    },
  });
  const dates = new Set<string>();
  for (const practitioner of practitioners) {
    const byDate = new Map(
      practitioner.availabilities.map((row) => [
        ymdFromDate(row.date),
        normalizeSlots(row.slots),
      ]),
    );
    const hours = parseWorkingHours(practitioner.workingHours);
    for (
      let cursor = new Date(from);
      cursor < through;
      cursor = new Date(cursor.getTime() + 86400000)
    ) {
      const date = ymdFromDate(cursor);
      const slots = byDate.get(date) ?? generateStaffSlots(date, hours);
      if (slots.some((slot) => slot.status === "open")) dates.add(date);
    }
  }
  return NextResponse.json({ dates: Array.from(dates).sort() });
}
