import { NextResponse, type NextRequest } from "next/server";
import { auditForUser, requireApiUser } from "@/lib/auth";
import {
  ConfigurationError,
  getStaffConfiguration,
  updateStaffConfiguration,
  type ConfigurationPatch,
} from "@/lib/staff-configuration";

function responseError(error: unknown) {
  const known = error instanceof ConfigurationError ? error : null;
  return NextResponse.json(
    { error: known?.code ?? "configuration_failed", detail: known?.detail },
    { status: known?.status ?? 500 },
  );
}

function displayLocale(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  return locale === "fi" || locale === "en" || locale === "ru" ? locale : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const locale = displayLocale(request);
  if (!locale)
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  try {
    return NextResponse.json(
      await getStaffConfiguration((await context.params).userId, locale),
    );
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const locale = displayLocale(request);
  if (!locale)
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  const patch = (await request
    .json()
    .catch(() => null)) as ConfigurationPatch | null;
  if (!patch)
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  try {
    const targetUserId = (await context.params).userId;
    return NextResponse.json(
      await updateStaffConfiguration({
        actor: user,
        targetUserId,
        administrative: true,
        patch,
        displayLocale: locale,
        request,
      }),
    );
  } catch (error) {
    const targetUserId = (await context.params).userId;
    await auditForUser(
      user,
      "staff_configuration_denied",
      "User",
      targetUserId,
      {
        outcome: "DENIED",
        request,
        metadata: {
          reason:
            error instanceof Error ? error.message.slice(0, 120) : "unknown",
        },
      },
    );
    return responseError(error);
  }
}
