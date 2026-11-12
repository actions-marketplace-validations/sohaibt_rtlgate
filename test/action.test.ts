import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import * as api from "../src/index.js";

test("action.yml is a composite action that runs the CLI with the inputs", () => {
  const action = parse(readFileSync(new URL("../../action.yml", import.meta.url), "utf8"));
  assert.equal(action.runs.using, "composite");
  for (const input of ["paths", "max-issues", "sarif-file"]) assert.ok(action.inputs[input], input);
  const script = action.runs.steps.map((s: { run?: string }) => s.run ?? "").join("\n");
  assert.match(script, /npm ci/);
  assert.match(script, /dist\/src\/cli\.js/);
  assert.match(script, /--max-issues/);
});

test("package entry exports the scanners, formatters and corpus", () => {
  for (const name of ["scanCss", "scanMarkup", "scanLocale", "checkString", "scanPaths", "formatSarif", "checkUrl", "corpus"]) {
    assert.ok(name in api, name);
  }
});
