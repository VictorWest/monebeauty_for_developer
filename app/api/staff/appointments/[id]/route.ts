import { NextResponse, type NextRequest } from "next/server";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          fullName: true,
          email: true,
          phone: true,
          contraindications: true,
        },
      },
      service: { select: { id: true, slug: true } },
      serviceOption: { select: { key: true } },
      practitioner: { select: { name: true } },
      room: { select: { id: true, name: true } },
      device: { select: { id: true, name: true } },
    },
  });
  if (!appointment) {
    await auditForUser(
      user,
      "appointment_sensitive_access_denied",
      "Appointment",
      id,
      { outcome: "DENIED", request: req },
    );
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (user.role === "STAFF")
    await auditForUser(
      user,
      "appointment_sensitive_details_viewed",
      "Appointment",
      id,
      { request: req },
    );
  return NextResponse.json({
    id: appointment.id,
    version: appointment.version,
    status: appointment.status,
    client: {
      fullName: appointment.contactName,
      email: appointment.contactEmail,
      phone: appointment.contactPhone,
      contraindications: appointment.client.contraindications,
    },
    clientId: appointment.clientId,
    serviceId: appointment.serviceId,
    procedureIndex: appointment.procedureIndex,
    serviceOptionKey: appointment.serviceOption?.key ?? null,
    procedure: appointment.procedureTitle ?? appointment.service.slug,
    start: appointment.start.toISOString(),
    end: appointment.end.toISOString(),
    notes: appointment.notes,
    practitionerId: appointment.practitionerId,
    practitionerName: appointment.practitioner.name,
    room: appointment.room?.name ?? null,
    roomId: appointment.roomId,
    device: appointment.device?.name ?? null,
    deviceId: appointment.deviceId,
    locale: appointment.locale,
  });
}
