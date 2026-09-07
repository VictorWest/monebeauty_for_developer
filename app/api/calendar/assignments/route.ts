import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calendarAssignmentCandidates } from "@/lib/calendar-assignments";
import { clinicTimeFromInstant } from "@/lib/clinic-time";

function response(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return response("forbidden", 403);

  const serviceId = String(req.nextUrl.searchParams.get("serviceId") ?? "");
  const start = new Date(String(req.nextUrl.searchParams.get("start") ?? ""));
  const excludeAppointmentId =
    String(req.nextUrl.searchParams.get("excludeAppointmentId") ?? "") ||
    undefined;
  if (
    !serviceId ||
    Number.isNaN(start.getTime()) ||
    start.getTime() <= Date.now() ||
    Number(clinicTimeFromInstant(start).slice(3)) % 15 !== 0
  )
    return response("invalid_request", 400);

  let durationMin: number | null = null;
  if (excludeAppointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: excludeAppointmentId },
      select: {
        serviceId: true,
        practitionerId: true,
        start: true,
        end: true,
      },
    });
    if (!appointment) return response("not_found", 404);
    if (appointment.serviceId === serviceId) {
      durationMin = Math.round(
        (appointment.end.getTime() - appointment.start.getTime()) / 60_000,
      );
    }
  }
  if (durationMin === null) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, bookable: true, archivedAt: null },
      select: { durationMin: true },
    });
    if (!service) return response("unknown_service", 404);
    durationMin = service.durationMin;
  }
  if (durationMin < 15 || durationMin > 12 * 60 || durationMin % 15 !== 0)
    return response("invalid_duration", 400);

  const assignments = await calendarAssignmentCandidates({
    serviceId,
    start,
    end: new Date(start.getTime() + durationMin * 60_000),
    excludeAppointmentId,
  });
  if (assignments === null) return response("unknown_service", 404);
  return NextResponse.json({ assignments });
}
