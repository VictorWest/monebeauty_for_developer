import type { Role } from "@prisma/client";
import type { Locale } from "@/i18n/routing";
import { staffHref } from "@/lib/account-routing";
import { adminBase } from "@/lib/admin-routing";

export type SharedLoginAuditAction = "admin_login" | "staff_login";

export function sharedLoginAuditAction(
  role?: Role | null,
): SharedLoginAuditAction {
  return role === "STAFF" ? "staff_login" : "admin_login";
}

export function sharedLoginDestination(
  locale: Locale,
  user: { role: Role; mustChangePassword: boolean },
) {
  if (user.role === "ADMIN") return adminBase(locale);
  if (user.role === "STAFF")
    return user.mustChangePassword
      ? staffHref(locale, "password")
      : adminBase(locale);
  return null;
}
