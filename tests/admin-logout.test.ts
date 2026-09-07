import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync("components/admin/AdminShell.tsx", "utf8");
const actions = readFileSync("lib/admin-actions.ts", "utf8");

test("admin logout is a server action and cannot be prefetched as a GET link", () => {
  assert.match(shell, /<form action=\{adminLogoutAction\}>/);
  assert.match(shell, /<button\s+type="submit"/);
  assert.doesNotMatch(shell, /href=\{`\$\{adminBase\(locale\)\}\/ulos`\}/);
  assert.match(actions, /export async function adminLogoutAction/);
  assert.match(actions, /await destroySession\("backoffice"\)/);
});
