import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  const reason =
    String(payload?.reason ?? "")
      .trim()
      .slice(0, 500) || null;
  const client = await prisma.client.findUnique({ where: { userId: user.id } });
  const appointment = client
    ? await prisma.appointment.findFirst({
        where: { id: appointmentId, clientId: client.id },
      })
    : null;
  if (!appointment)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (appointment.start <= new Date() || appointment.status === "CANCELLED")
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const change = await prisma.appointmentChangeRequest.create({
      data: { appointmentId, clientId: client!.id, type: "CANCEL", reason },
    });
    await auditForUser(
      user,
      "appointment_change_requested",
      "AppointmentChangeRequest",
      change.id,
      { request: req, metadata: { appointmentId, type: "CANCEL" } },
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
