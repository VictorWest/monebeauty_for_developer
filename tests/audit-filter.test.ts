import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { auditFilterQuery, normalizeAuditFilters } from "../lib/audit-filter";

const controls = readFileSync("components/admin/AuditLogFilter.tsx", "utf8");
const auditLogs = readFileSync("components/admin/AuditLogs.tsx", "utf8");

test("audit filter query is canonical and pagination-aware", () => {
  const filters = normalizeAuditFilters({
    staff: " staff-1 ",
    action: "  appointment_viewed  ",
    outcome: "SUCCESS",
  });
  assert.deepEqual(filters, {
    staff: "staff-1",
    action: "appointment_viewed",
    outcome: "SUCCESS",
  });
  assert.equal(
    auditFilterQuery(filters),
    "staff=staff-1&action=appointment_viewed&outcome=SUCCESS",
  );
  assert.equal(
    auditFilterQuery(filters, 3),
    "staff=staff-1&action=appointment_viewed&outcome=SUCCESS&page=3",
  );
  assert.equal(normalizeAuditFilters({ outcome: "INVALID" }).outcome, "");
});

test("audit controls update automatically without a filter button", () => {
  assert.match(
    controls,
    /actionTimer\.current = window\.setTimeout\(\(\) => replace\(filters\), 350\)/,
  );
  assert.match(controls, /window\.clearTimeout\(actionTimer\.current\)/);
  assert.match(controls, /onValueChange=\{\(staff\) => changeImmediate/);
  assert.match(controls, /onValueChange=\{\(outcome\) =>/);
  assert.match(controls, /router\.replace/);
  assert.match(controls, /aria-live="polite"/);
  assert.doesNotMatch(controls, /type="submit"|<form|labels\.filter\b/);
  assert.match(auditLogs, /<AuditLogFilter/);
  assert.doesNotMatch(auditLogs, /t\.filter\b|<form/);
});
