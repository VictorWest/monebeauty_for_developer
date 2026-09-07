import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const status =
    req.nextUrl.searchParams.get("status") === "RESOLVED" ? "RESOLVED" : "OPEN";
  const sessions = await prisma.chatSession.findMany({
    where: {
      handoffRequested: true,
      status,
      archivedAt: null,
      anonymizedAt: null,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      locale: true,
      status: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(
    { sessions, canArchive: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
