import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
const healthRoute = readFileSync("app/api/health/route.ts", "utf8");
const readme = readFileSync("README.md", "utf8");

test("deployment maps, writes, and validates the durable encryption key before mutation", () => {
  assert.match(
    workflow,
    /SENSITIVE_DATA_ENCRYPTION_KEY: \$\{\{ secrets\.SENSITIVE_DATA_ENCRYPTION_KEY \}\}/,
  );
  assert.match(
    workflow,
    /printf 'SENSITIVE_DATA_ENCRYPTION_KEY=%s\\n' "\$SENSITIVE_DATA_ENCRYPTION_KEY"/,
  );
  assert.match(workflow, /chmod 600 "\$env_file"/);

  const validation = workflow.indexOf(
    "Validate sensitive-data encryption configuration",
  );
  assert.ok(validation > workflow.indexOf("Write environment file"));
  assert.ok(validation < workflow.indexOf("Run database migrations"));
  assert.ok(validation < workflow.indexOf("Build"));
  assert.ok(validation < workflow.indexOf("Restart app with PM2"));
  assert.match(workflow, /assertSensitiveDataEncryptionConfigured/);
});

test("health fails generically when encryption configuration validation fails", () => {
  assert.match(healthRoute, /assertSensitiveDataEncryptionConfigured\(\)/);
  assert.match(healthRoute, /catch \{[\s\S]*response\("unavailable", 503\)/);
  assert.doesNotMatch(healthRoute, /error\.message|String\(error\)/);
});

test("operations documentation forbids direct production key rotation", () => {
  assert.match(readme, /required, durable production secret/);
  assert.match(readme, /do not rotate this key without a[\s\S]*migration/);
});
