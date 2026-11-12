import { test } from "node:test";
import assert from "node:assert/strict";
import { applyIgnores, lineCol } from "../src/issue.js";

test("lineCol maps an offset to 1-based line and column", () => {
  assert.deepEqual(lineCol("ab\ncd", 4), { line: 2, column: 2 });
  assert.deepEqual(lineCol("x", 0), { line: 1, column: 1 });
});

test("rtlgate-ignore on the same or previous line drops the issue", () => {
  const src = "a\n/* rtlgate-ignore */\nb\nc // rtlgate-ignore\nd";
  const mk = (line: number) => ({ file: "f", line, column: 1, rule: "r", message: "m" });
  const kept = applyIgnores(src, [mk(1), mk(3), mk(4), mk(5)]);
  assert.deepEqual(kept.map((i) => i.line), [1, 5]);
});
