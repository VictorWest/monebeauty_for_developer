import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appointmentIcs, validAppointmentCalendarToken } from "@/lib/appointment-calendar";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!validAppointmentCalendarToken(id, token)) return NextResponse.json({ error: "invalid_link" }, { status: 403 });
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { service: { select: { slug: true } } },
  });
  if (!appointment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const content = appointmentIcs({ id: appointment.id, start: appointment.start, end: appointment.end, title: appointment.procedureTitle ?? appointment.service.slug, description: appointment.procedurePrice ? `${appointment.procedureTitle ?? appointment.service.slug} · ${appointment.procedurePrice}` : undefined, status: appointment.status });
  return new NextResponse(content, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="mone-beauty-${id.slice(-8)}.ics"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
