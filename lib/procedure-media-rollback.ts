import type { ProcedureMediaSeed } from "../content/procedure-media";

export type ProcedureMediaRollbackTarget = {
  serviceId: string;
  serviceSlug: string;
  keys: string[];
};

export type ProcedureMediaRollbackCounts = {
  matched: number;
  deleted: number;
  remaining: number;
};

export type ProcedureMediaRollbackStore = {
  inspect: () => Promise<Omit<ProcedureMediaRollbackCounts, "deleted">>;
  apply: () => Promise<ProcedureMediaRollbackCounts>;
};

export function buildProcedureMediaRollbackTargets(
  services: Array<{ id: string; slug: string }>,
  registry: ProcedureMediaSeed[],
) {
  const serviceIds = new Map(
    services.map((service) => [service.slug, service.id]),
  );
  const keysByService = new Map<string, Set<string>>();

  for (const item of registry) {
    const keys = keysByService.get(item.serviceSlug) ?? new Set<string>();
    keys.add(item.key);
    keysByService.set(item.serviceSlug, keys);
  }

  const targets: ProcedureMediaRollbackTarget[] = [];
  const missingServices: string[] = [];
  for (const [serviceSlug, keys] of keysByService) {
    const serviceId = serviceIds.get(serviceSlug);
    if (!serviceId) {
      missingServices.push(serviceSlug);
      continue;
    }
    targets.push({ serviceId, serviceSlug, keys: [...keys].sort() });
  }

  return { targets, missingServices: missingServices.sort() };
}

export async function runProcedureMediaRollback(
  store: ProcedureMediaRollbackStore,
  apply: boolean,
): Promise<ProcedureMediaRollbackCounts> {
  if (apply) return store.apply();
  const counts = await store.inspect();
  return { ...counts, deleted: 0 };
}
