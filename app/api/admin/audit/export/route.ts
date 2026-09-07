import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser, auditForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeAuditFilters } from "@/lib/audit-filter";

function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(req: NextRequest) {
  const admin = await requireApiUser(["ADMIN"]);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { staff, action, outcome } = normalizeAuditFilters({
    staff: req.nextUrl.searchParams.get("staff"),
    action: req.nextUrl.searchParams.get("action"),
    outcome: req.nextUrl.searchParams.get("outcome"),
  });
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(staff ? { actorUserId: staff } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(outcome ? { outcome } : {}),
    },
    orderBy: { at: "desc" },
    take: 10_000,
    include: { actorUser: { select: { name: true, email: true } } },
  });
  await auditForUser(admin, "audit_exported", "AuditLog", null, {
    request: req,
    metadata: { count: rows.length },
  });
  const header = [
    "time",
    "actor",
    "email",
    "role",
    "action",
    "outcome",
    "entity",
    "entityId",
    "ipAddress",
    "userAgent",
  ];
  const body = rows.map((row) =>
    [
      row.at.toISOString(),
      row.actorUser?.name ?? row.actor,
      row.actorUser?.email ?? row.actor,
      row.actorRole ?? "",
      row.action,
      row.outcome,
      row.entity,
      row.entityId ?? "",
      row.ipAddress ?? "",
      row.userAgent ?? "",
    ]
      .map(csv)
      .join(","),
  );
  return new NextResponse(`\uFEFF${header.join(",")}\n${body.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mone-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
