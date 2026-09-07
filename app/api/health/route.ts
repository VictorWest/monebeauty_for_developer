import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertSensitiveDataEncryptionConfigured } from "@/lib/sensitive-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function response(status: "ok" | "unavailable", code: number) {
  return NextResponse.json(
    { status },
    {
      status: code,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET() {
  try {
    assertSensitiveDataEncryptionConfigured();
    await prisma.$queryRaw`SELECT 1`;
    return response("ok", 200);
  } catch {
    return response("unavailable", 503);
  }
}
