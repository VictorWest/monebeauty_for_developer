import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  sharedLoginAuditAction,
  sharedLoginDestination,
} from "../lib/shared-login";

const adminActions = readFileSync("lib/admin-actions.ts", "utf8");
const adminRouter = readFileSync("components/admin/AdminRouter.tsx", "utf8");
const staffActions = readFileSync("lib/staff-account-actions.ts", "utf8");
const auth = readFileSync("lib/auth.ts", "utf8");

test("shared login classifies known staff attempts under the staff limiter", () => {
  assert.equal(sharedLoginAuditAction("STAFF"), "staff_login");
  assert.equal(sharedLoginAuditAction("ADMIN"), "admin_login");
  assert.equal(sharedLoginAuditAction("CLIENT"), "admin_login");
  assert.equal(sharedLoginAuditAction(undefined), "admin_login");
  assert.match(
    adminActions,
    /authRateLimited\(email, loginAction, context\.ipAddress\)/,
  );
  assert.match(adminActions, /action: loginAction/);
  assert.match(staffActions, /authRateLimited\([\s\S]*?"staff_login"/);
});

test("shared login routes admins and staff by locale and password state", () => {
  assert.equal(
    sharedLoginDestination("fi", {
      role: "ADMIN",
      mustChangePassword: false,
    }),
    "/admin",
  );
  assert.equal(
    sharedLoginDestination("en", {
      role: "STAFF",
      mustChangePassword: true,
    }),
    "/en/henkilosto/vaihda-salasana",
  );
  assert.equal(
    sharedLoginDestination("ru", {
      role: "STAFF",
      mustChangePassword: false,
    }),
    "/ru/admin",
  );
  assert.equal(
    sharedLoginDestination("fi", {
      role: "CLIENT",
      mustChangePassword: false,
    }),
    null,
  );
  assert.match(adminActions, /redirect\(destination\)/);
  assert.match(adminRouter, /sharedLoginDestination\(locale, user\)/);
});

test("forced staff password replacement rotates sessions and remains API-gated", () => {
  assert.match(staffActions, /passwordError\(nextPassword\)/);
  assert.match(staffActions, /currentPassword === nextPassword/);
  assert.match(staffActions, /mustChangePassword: false/);
  assert.match(staffActions, /prisma\.session\.deleteMany/);
  assert.match(staffActions, /await createSession\(user\.id, "backoffice"\)/);
  assert.match(auth, /user\.role === "STAFF" && user\.mustChangePassword/);
  assert.match(
    auth,
    /process\.env\.NODE_ENV === "production"[\s\S]*?"__Host-mone_backoffice_session_v3"/,
  );
});
