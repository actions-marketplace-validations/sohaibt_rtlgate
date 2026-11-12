import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { scanPaths } from "../src/scan.js";
import { formatSarif, formatText } from "../src/report.js";

const CLI = new URL("../src/cli.js", import.meta.url).pathname;

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "rtlgate-"));
  mkdirSync(join(dir, "src/locales"), { recursive: true });
  mkdirSync(join(dir, "node_modules/x"), { recursive: true });
  writeFileSync(join(dir, "src/app.css"), ".a { margin-left: 1px; }\n");
  writeFileSync(join(dir, "src/index.html"), "<html lang=\"ar\" dir=\"rtl\"><div class=\"pl-2\"></div></html>\n");
  writeFileSync(join(dir, "src/locales/ar.json"), JSON.stringify({ phone: "اتصل على +966 50 123 4567" }, null, 2));
  writeFileSync(join(dir, "src/locales/en.json"), JSON.stringify({ phone: "Call +966 50 123 4567" }));
  writeFileSync(join(dir, "node_modules/x/a.css"), ".b { padding-right: 0 }");
  return dir;
}

const run = (args: string[], cwd: string) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });

test("scanPaths walks the tree, skips node_modules, picks scanners by file type", () => {
  const dir = project();
  const issues = scanPaths(["."], dir);
  assert.deepEqual(
    issues.map((i) => [i.file, i.rule]),
    [
      ["src/app.css", "css-physical-property"],
      ["src/index.html", "tw-directional-utility"],
      ["src/locales/ar.json", "locale-bidi-unisolated"],
    ],
  );
});

test("text and SARIF output", () => {
  const issues = scanPaths(["."], project());
  const text = formatText(issues);
  assert.match(text, /src\/app\.css:1:6 +css-physical-property/);
  assert.match(text, /3 issues/);
  const sarif = JSON.parse(formatSarif(issues));
  assert.equal(sarif.version, "2.1.0");
  const r = sarif.runs[0];
  assert.equal(r.tool.driver.name, "rtlgate");
  assert.equal(r.results.length, 3);
  assert.equal(r.results[0].ruleId, "css-physical-property");
  assert.equal(r.results[0].locations[0].physicalLocation.artifactLocation.uri, "src/app.css");
  assert.equal(r.results[0].locations[0].physicalLocation.region.startLine, 1);
  assert.ok(r.tool.driver.rules.some((x: { id: string }) => x.id === "locale-bidi-unisolated"));
});

test("CLI gates on --max-issues", () => {
  const dir = project();
  const fail = run(["."], dir);
  assert.equal(fail.status, 1, fail.stderr);
  assert.match(fail.stdout, /3 issues/);
  assert.equal(run([".", "--max-issues", "3"], dir).status, 0);
  assert.equal(run(["src/app.css", "--max-issues", "0"], dir).status, 1);
});

test("CLI writes JSON and SARIF to --output", () => {
  const dir = project();
  const json = run([".", "--format", "json", "--max-issues", "99"], dir);
  assert.equal(JSON.parse(json.stdout).length, 3);
  run([".", "--format", "sarif", "--output", "out.sarif", "--max-issues", "99"], dir);
  assert.equal(JSON.parse(readFileSync(join(dir, "out.sarif"), "utf8")).runs[0].results.length, 3);
});

test("CLI usage errors exit 2", () => {
  const dir = project();
  assert.equal(run(["--format", "xml"], dir).status, 2);
  assert.equal(run(["missing-dir"], dir).status, 2);
  assert.equal(run(["--max-issues", "x"], dir).status, 2);
});

test("CLI fixtures prints the corpus", () => {
  const out = run(["fixtures"], project());
  assert.equal(out.status, 0);
  assert.ok(JSON.parse(out.stdout).codeSwitched.length > 0);
});
