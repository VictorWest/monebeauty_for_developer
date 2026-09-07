import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit, requireApiUser } from "@/lib/auth";
import {
  decryptSensitiveJson,
  decryptSensitiveText,
} from "@/lib/sensitive-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      appointments: {
        include: {
          service: { select: { slug: true, category: true } },
          practitioner: { select: { name: true, role: true } },
          events: true,
          messages: { include: { attempts: true } },
        },
      },
      orders: {
        include: { items: true, messages: { include: { attempts: true } } },
      },
      carts: { include: { items: true } },
      chatSessions: true,
      savedAddresses: true,
      consultationProfile: true,
    },
  });
  if (!client)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const consents = await prisma.consent.findMany({
    where: { clientId: id },
    orderBy: { at: "desc" },
  });

  await audit({
    actor: user.email,
    action: "client_data_exported",
    entity: "Client",
    entityId: id,
  });

  const consultation = client.consultationProfile
    ? {
        completedVersion: client.consultationProfile.completedVersion,
        locale: client.consultationProfile.locale,
        updatedAt: client.consultationProfile.updatedAt,
        dateOfBirth: decryptSensitiveText(
          client.consultationProfile.dateOfBirthEncrypted,
        ),
        answers: decryptSensitiveJson(
          client.consultationProfile.answersEncrypted,
        ),
      }
    : null;
  const readableClient = Object.fromEntries(
    Object.entries(client).filter(([key]) => key !== "consultationProfile"),
  );

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      client: readableClient,
      consultation,
      consents,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="monebeauty-client-${id}.json"`,
      },
    },
  );
}
