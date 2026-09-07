import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/booking";
import { clinicDateFromInstant } from "@/lib/clinic-time";

export async function POST(req: NextRequest) {
  const user = await requireApiUser(["CLIENT"]);
  if (!user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const appointmentId = String(
    payload?.appointmentId ?? payload?.reference ?? "",
  ).trim();
  const start = String(payload?.start ?? "");
  if (!start || Number.isNaN(Date.parse(start)))
    return NextResponse.json({ error: "invalid_start" }, { status: 400 });
  const client = await prisma.client.findUnique({ where: { userId: user.id } });
  const appointment = client
    ? await prisma.appointment.findFirst({
        where: { id: appointmentId, clientId: client.id },
        include: { service: true, serviceOption: true },
      })
    : null;
  if (!appointment)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (appointment.start <= new Date() || appointment.status === "CANCELLED")
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const available = await openSlots({
    dateStr: clinicDateFromInstant(new Date(start)),
    serviceKey: appointment.service.slug,
    optionKey: appointment.serviceOption?.key,
    specialistId: appointment.practitionerId,
  });
  if (!available.some((slot) => slot.start === start))
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  try {
    const change = await prisma.appointmentChangeRequest.create({
      data: {
        appointmentId,
        clientId: client!.id,
        type: "RESCHEDULE",
        requestedStart: new Date(start),
      },
    });
    await auditForUser(
      user,
      "appointment_change_requested",
      "AppointmentChangeRequest",
      change.id,
      { request: req, metadata: { appointmentId, type: "RESCHEDULE" } },
    );
    return NextResponse.json(
      { id: change.id, status: change.status },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      return NextResponse.json({ error: "request_exists" }, { status: 409 });
    throw error;
  }
}
