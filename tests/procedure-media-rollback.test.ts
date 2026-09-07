import assert from "node:assert/strict";
import test from "node:test";
import { PROCEDURE_MEDIA_SEED } from "../content/procedure-media";
import {
  buildProcedureMediaRollbackTargets,
  runProcedureMediaRollback,
} from "../lib/procedure-media-rollback";

test("procedure media rollback targets only registry service/key pairs", () => {
  const services = [
    { id: "service-facial", slug: "facial" },
    { id: "service-body", slug: "body" },
  ];
  const { targets, missingServices } = buildProcedureMediaRollbackTargets(
    services,
    PROCEDURE_MEDIA_SEED,
  );

  assert.deepEqual(
    targets.map((target) => target.serviceSlug),
    ["facial", "body"],
  );
  assert.equal(
    targets.every(
      (target) =>
        target.keys.length > 0 &&
        new Set(target.keys).size === target.keys.length,
    ),
    true,
  );
  assert.deepEqual(missingServices, [
    "brows",
    "laser",
    "packages",
    "rf",
    "trichology",
  ]);
});

test("procedure media rollback is dry-run by default", async () => {
  let applied = false;
  const result = await runProcedureMediaRollback(
    {
      inspect: async () => ({ matched: 61, remaining: 63 }),
      apply: async () => {
        applied = true;
        return { matched: 61, deleted: 61, remaining: 2 };
      },
    },
    false,
  );

  assert.equal(applied, false);
  assert.deepEqual(result, { matched: 61, deleted: 0, remaining: 63 });
});

test("applied procedure media rollback is idempotent and preserves unrelated rows", async () => {
  let registryOwned = 61;
  const unrelated = 2;
  const store = {
    inspect: async () => ({
      matched: registryOwned,
      remaining: registryOwned + unrelated,
    }),
    apply: async () => {
      const matched = registryOwned;
      registryOwned = 0;
      return { matched, deleted: matched, remaining: unrelated };
    },
  };

  assert.deepEqual(await runProcedureMediaRollback(store, true), {
    matched: 61,
    deleted: 61,
    remaining: 2,
  });
  assert.deepEqual(await runProcedureMediaRollback(store, true), {
    matched: 0,
    deleted: 0,
    remaining: 2,
  });
});
