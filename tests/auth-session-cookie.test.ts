import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("lib/auth.ts", "utf8");

function functionBody(name: string) {
  const start = auth.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = auth.indexOf("\nexport ", start + 1);
  return auth.slice(start, next === -1 ? undefined : next);
}

test("client and back-office sessions use distinct versioned cookie names", () => {
  assert.match(auth, /"__Host-mone_client_session_v3"/);
  assert.match(auth, /"mone_client_session_v3"/);
  assert.match(auth, /"__Host-mone_backoffice_session_v3"/);
  assert.match(auth, /"mone_backoffice_session_v3"/);
  assert.match(auth, /"__Host-mone_session_v2"/);
  assert.match(auth, /"mone_session_v2"/);
  assert.match(auth, /httpOnly: true/);
  assert.match(auth, /sameSite: "lax"/);
  assert.match(auth, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(auth, /path: "\/"/);
  assert.match(auth, /const SESSION_DAYS = 14/);
});

test("currentUser never mutates response cookies while rendering", () => {
  const currentUser = functionBody("currentUser");
  assert.match(currentUser, /jar\.get\(SESSION_COOKIES\[audience\]\)/);
  assert.match(currentUser, /jar\.get\(SHARED_SESSION_COOKIE\)/);
  assert.doesNotMatch(currentUser, /jar\.set\(/);
  assert.doesNotMatch(currentUser, /clearCookie|clearObsoleteSessionCookies/);
});

test("session resolution validates audience, status, and expiry", () => {
  assert.match(auth, /roleMatchesAudience\(session\.user\.role, audience\)/);
  assert.match(auth, /session\.user\.status !== "ACTIVE"/);
  assert.match(auth, /session\.expiresAt <= new Date\(\)/);
  assert.match(auth, /session\s*\.deleteMany/);
  assert.match(auth, /\.catch\(\(\) => undefined\)/);
  assert.match(
    auth,
    /if \(scopedToken\) return userForSessionToken\(scopedToken, audience\);[\s\S]*?SHARED_SESSION_COOKIE/,
  );
});

test("login preserves the shared compatibility cookie and logout is audience-safe", () => {
  const createSession = functionBody("createSession");
  const destroySession = functionBody("destroySession");
  assert.match(createSession, /clearObsoleteSessionCookies\(jar\)/);
  assert.match(createSession, /SESSION_COOKIES\[audience\]/);
  assert.doesNotMatch(createSession, /SHARED_SESSION_COOKIE/);
  assert.match(destroySession, /clearObsoleteSessionCookies\(jar\)/);
  assert.match(destroySession, /SESSION_COOKIES\[audience\]/);
  assert.match(destroySession, /SHARED_SESSION_COOKIE/);
  assert.match(
    destroySession,
    /roleMatchesAudience\(sharedSession\.user\.role, audience\)/,
  );
  assert.match(
    auth,
    /PREVIOUS_PRODUCTION_SESSION_COOKIE = "__Host-mone_session"/,
  );
  assert.match(auth, /LEGACY_SESSION_COOKIE = "mone_session"/);
  assert.match(auth, /clearCookie\(jar, LEGACY_SESSION_COOKIE, "\/admin"\)/);
});

test("API role guards infer only one unambiguous audience", () => {
  assert.match(auth, /roles\.length === 0/);
  assert.match(auth, /includesClient === includesBackoffice/);
  assert.match(auth, /const audience = sessionAudienceForRoles\(roles\)/);
  assert.match(auth, /if \(!audience\) return null/);
});
