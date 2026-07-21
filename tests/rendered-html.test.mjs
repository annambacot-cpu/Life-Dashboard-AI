import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("ships the Life Dashboard product experience", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", templateRoot), "utf8"),
    readFile(new URL("app/layout.tsx", templateRoot), "utf8"),
    readFile(new URL("package.json", templateRoot), "utf8"),
  ]);
  assert.match(layout, /Life Dashboard AI/);
  assert.match(page, /Good morning, Anna/);
  assert.match(page, /What should I focus on today/);
  assert.match(page, /life-dashboard-ai/);
  assert.match(page, /localStorage/);
  assert.match(page, /Daily thoughts/);
  assert.match(page, /WHAT YOUR WORDS ARE SHOWING/);
  assert.match(page, /Upload files/);
  assert.match(page, /apple-calendar/);
  assert.match(page, /Add another task/);
  assert.match(page, /Steps to achieve this goal/);
  assert.doesNotMatch(page, /Decision journal|\["decisions"/);
  assert.doesNotMatch(page, /Skill tracker|Finance pulse/);
  assert.doesNotMatch(`${page}${layout}${packageJson}`, /codex-preview|react-loading-skeleton/i);
});

test("starter preview has been removed", async () => {
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot)));
});
