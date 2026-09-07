import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_SIDEBAR_COOKIE,
  isAdminSidebarCollapsed,
} from "../lib/admin-sidebar";

const shell = readFileSync("components/admin/AdminShell.tsx", "utf8");
const router = readFileSync("components/admin/AdminRouter.tsx", "utf8");

test("admin sidebar preference defaults to expanded and accepts only collapsed", () => {
  assert.equal(isAdminSidebarCollapsed(undefined), false);
  assert.equal(isAdminSidebarCollapsed("expanded"), false);
  assert.equal(isAdminSidebarCollapsed("collapsed"), true);
  assert.equal(ADMIN_SIDEBAR_COOKIE, "mone_admin_sidebar");
});

test("desktop admin sidebar is collapsible, accessible, and persisted", () => {
  assert.match(shell, /initialCollapsed: boolean/);
  assert.match(shell, /<SidebarSimple/);
  assert.match(shell, /aria-expanded=\{!collapsed\}/);
  assert.match(shell, /document\.cookie/);
  assert.match(shell, /\[@media\(min-width:900px\)\]:w-\[76px\]/);
  assert.match(shell, /\[@media\(min-width:900px\)\]:ml-\[76px\]/);
  assert.match(router, /await cookies\(\)/);
  assert.match(router, /initialCollapsed=\{initialSidebarCollapsed\}/);
});

test("calendar keeps the icon rail offset while the expanded sidebar overlays", () => {
  assert.match(shell, /overlaySidebar = false/);
  assert.match(shell, /overlaySidebar \|\| collapsed/);
  assert.match(shell, /overlaySidebar && !collapsed/);
  assert.match(router, /overlaySidebar=\{adminModule === "calendar"\}/);
  assert.match(router, /wide=\{adminModule === "calendar"\}/);
});
