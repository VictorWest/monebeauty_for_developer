import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("every direct session consumer declares its audience", () => {
  for (const path of [
    ...sourceFiles("app"),
    ...sourceFiles("components"),
    ...sourceFiles("lib"),
  ]) {
    const contents = source(path);
    assert.doesNotMatch(contents, /currentUser\(\)/, path);
    assert.doesNotMatch(contents, /destroySession\(\)/, path);
    assert.doesNotMatch(contents, /createSession\([^,()]+\)/, path);
  }
});

test("client login, verification, account actions, and public commerce use the client audience", () => {
  const actions = source("lib/client-account-actions.ts");
  assert.equal(
    (actions.match(/createSession\(user\.id, "client"\)/g) ?? []).length,
    2,
  );
  assert.match(actions, /currentUser\("client"\)/);
  assert.match(actions, /destroySession\("client"\)/);

  for (const path of [
    "app/api/booking/route.ts",
    "app/api/checkout/route.ts",
    "app/(public)/[locale]/ajanvaraus/page.tsx",
    "app/(public)/[locale]/kassa/page.tsx",
    "app/(public)/[locale]/oma-tili/page.tsx",
    "app/(public)/[locale]/tilaus/[id]/page.tsx",
  ]) {
    assert.match(source(path), /currentUser\("client"\)/, path);
  }
});

test("admin and staff login, password rotation, pages, and logout use back-office", () => {
  const adminActions = source("lib/admin-actions.ts");
  const staffActions = source("lib/staff-account-actions.ts");
  const adminRouter = source("components/admin/AdminRouter.tsx");
  assert.match(adminActions, /createSession\(user\.id, "backoffice"\)/);
  assert.match(adminActions, /destroySession\("backoffice"\)/);
  assert.match(staffActions, /createSession\(user\.id, "backoffice"\)/);
  assert.match(staffActions, /destroySession\("backoffice"\)/);
  assert.match(adminRouter, /currentUser\("backoffice"\)/);

  for (const path of [
    "app/(admin)/admin/logout/route.ts",
    "app/(admin)/admin/ulos/route.ts",
    "app/(admin)/[locale]/admin/logout/route.ts",
    "app/(admin)/[locale]/admin/ulos/route.ts",
  ]) {
    assert.match(source(path), /destroySession\("backoffice"\)/, path);
  }
});

test("client and back-office API role guards stay exclusive", () => {
  assert.match(
    source("app/api/booking/cancel/route.ts"),
    /requireApiUser\(\["CLIENT"\]\)/,
  );
  assert.match(
    source("app/api/booking/reschedule/route.ts"),
    /requireApiUser\(\["CLIENT"\]\)/,
  );
  assert.match(
    source("app/api/calendar/route.ts"),
    /requireApiUser\(\["ADMIN", "STAFF"\]\)/,
  );
  assert.match(
    source("app/api/admin/audit/export/route.ts"),
    /requireApiUser\(\["ADMIN"\]\)/,
  );
});
