import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const router = readFileSync("components/admin/AdminRouter.tsx", "utf8");
const calendarSetup = readFileSync(
  "components/calendar/CalendarSetup.tsx",
  "utf8",
);

test("admin editor grids own their field spacing and alignment", () => {
  assert.match(
    router,
    /const alignedFieldGrid =\s*"grid items-start gap-x-\[14px\] gap-y-\[12px\] \[&>label\]:mt-0"/,
  );
  assert.match(
    router,
    /const globalGrid = `\$\{alignedFieldGrid\} sm:grid-cols-2 xl:grid-cols-3`/,
  );
  assert.match(
    router,
    /className=\{`\$\{alignedFieldGrid\} grid-cols-\[minmax\(0,1fr\)_120px\] gap-x-2\.5`\}/,
  );
  assert.doesNotMatch(
    router,
    /className="(?:mt-[^" ]+ )?grid gap-3 md:grid-cols-3"/,
  );
  assert.equal(
    router.match(/\$\{alignedFieldGrid\} (?:mt-[^ ]+ )?md:grid-cols-3/g)
      ?.length,
    6,
  );
});

test("calendar setup grids reset field margins without changing stack spacing", () => {
  assert.match(
    calendarSetup,
    /const alignedFieldGrid = "grid items-start gap-\[9px\] \[&>label\]:mt-0"/,
  );
  assert.match(
    calendarSetup,
    /\$\{alignedFieldGrid\} items-end sm:grid-cols-\[1fr_130px_auto\]/,
  );
  assert.match(
    calendarSetup,
    /\$\{alignedFieldGrid\} mt-\[10px\] sm:grid-cols-3/,
  );
  assert.match(
    calendarSetup,
    /\$\{alignedFieldGrid\} sm:grid-cols-\[1fr_90px_auto\]/,
  );
  assert.doesNotMatch(
    calendarSetup,
    /className="grid gap-\[9px\] sm:grid-cols-(?:2|3|\[1fr_90px_auto\])"/,
  );
});

test("client profile fields, actions, and history share responsive alignment", () => {
  assert.match(router, /className=\{`\$\{alignedFieldGrid\} md:grid-cols-3`\}/);
  assert.match(
    router,
    /className=\{`\$\{alignedFieldGrid\} mt-3\.5 lg:grid-cols-2`\}/,
  );
  assert.match(
    router,
    /<section className=\{`\$\{panelCls\} mt-5\.5`\}>[\s\S]*?<AdminForm action=\{saveClientAction\}>[\s\S]*?<form\s+action=\{anonymizeClientAction\}/,
  );
  assert.match(
    router,
    /sm:grid-cols-\[minmax\(155px,190px\)_minmax\(0,1fr\)_auto_auto\] sm:items-center/,
  );
  assert.match(
    router,
    /sm:grid-cols-\[minmax\(155px,190px\)_minmax\(0,1fr\)_auto\] sm:items-center/,
  );
});

test("stacked fields retain their own vertical spacing", () => {
  assert.match(router, /<label className="mt-3 block first:mt-0">/);
});
