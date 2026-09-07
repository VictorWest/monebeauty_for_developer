import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { audit, requireApiUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (payload.confirm !== "ERASE") {
    return NextResponse.json(
      { error: "confirmation_required" },
      { status: 400 },
    );
  }

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.$transaction([
    prisma.chatSession.updateMany({
      where: { clientId: id },
      data: {
        clientId: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        messages: [],
      },
    }),
    prisma.order.updateMany({
      where: { clientId: id },
      data: {
        email: `erased-${id}@privacy.local`,
        phone: null,
        normalizedEmail: null,
        normalizedPhone: null,
        notes: null,
        cancellationReason: null,
      },
    }),
    prisma.appointment.updateMany({
      where: { clientId: id },
      data: {
        notes: null,
        cancellationReason: null,
        normalizedContactEmail: null,
        normalizedContactPhone: null,
      },
    }),
    prisma.appointmentEvent.updateMany({
      where: { appointment: { clientId: id } },
      data: { reason: null, actor: "privacy-erased" },
    }),
    prisma.outboundMessage.updateMany({
      where: {
        OR: [{ order: { clientId: id } }, { appointment: { clientId: id } }],
      },
      data: {
        recipient: "privacy-erased",
        subject: null,
        body: "[redacted]",
        html: null,
        actor: "privacy-erased",
      },
    }),
    prisma.cart.deleteMany({ where: { clientId: id } }),
    prisma.consultationProfile.deleteMany({ where: { clientId: id } }),
    prisma.consent.updateMany({
      where: { clientId: id },
      data: {
        clientId: null,
        appointmentId: null,
        linkageRedacted: true,
      },
    }),
    prisma.consent.create({
      data: { type: "gdpr_erasure", granted: true, linkageRedacted: true },
    }),
    prisma.client.update({
      where: { id },
      data: {
        userId: null,
        fullName: "Erased client",
        firstName: null,
        lastName: null,
        phone: `erased-${id}`,
        email: `erased-${id}@privacy.local`,
        notes: null,
        contraindications: null,
        consentGdpr: false,
        consentMarketing: false,
      },
    }),
  ]);

  await audit({
    actor: user.email,
    action: "client_data_erased",
    entity: "Client",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
