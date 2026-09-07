export type AuditOutcomeFilter = "SUCCESS" | "FAILURE" | "DENIED" | "";

export type AuditFilters = {
  staff: string;
  action: string;
  outcome: AuditOutcomeFilter;
};

export function normalizeAuditFilters({
  staff,
  action,
  outcome,
}: {
  staff?: string | null;
  action?: string | null;
  outcome?: string | null;
}): AuditFilters {
  const normalizedOutcome: AuditOutcomeFilter = [
    "SUCCESS",
    "FAILURE",
    "DENIED",
  ].includes(outcome ?? "")
    ? (outcome as AuditOutcomeFilter)
    : "";
  return {
    staff: (staff ?? "").trim(),
    action: (action ?? "").trim().slice(0, 80),
    outcome: normalizedOutcome,
  };
}

export function auditFilterQuery(filters: AuditFilters, page?: number) {
  const normalized = normalizeAuditFilters(filters);
  const query = new URLSearchParams();
  if (normalized.staff) query.set("staff", normalized.staff);
  if (normalized.action) query.set("action", normalized.action);
  if (normalized.outcome) query.set("outcome", normalized.outcome);
  if (page && page > 1) query.set("page", String(page));
  return query.toString();
}
