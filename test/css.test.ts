import { test } from "node:test";
import assert from "node:assert/strict";
import { scanCss } from "../src/css.js";

test("flags physical properties with logical suggestions and line numbers", () => {
  const css = ".a {\n  margin-left: 4px;\n  padding-right: 2px;\n  border-left-width: 1px;\n  border-top-right-radius: 3px;\n  left: 0;\n}";
  const issues = scanCss("a.css", css);
  assert.deepEqual(
    issues.map((i) => [i.line, i.suggestion]),
    [
      [2, "margin-inline-start: 4px"],
      [3, "padding-inline-end: 2px"],
      [4, "border-inline-start-width: 1px"],
      [5, "border-start-end-radius: 3px"],
      [6, "inset-inline-start: 0"],
    ],
  );
  assert.equal(issues[0].rule, "css-physical-property");
  assert.equal(issues[0].column, 3);
});

test("flags physical values of float, clear and text-align", () => {
  const css = "a { float: right; text-align: left; clear: left; text-align: center; float: none }";
  const issues = scanCss("a.css", css);
  assert.deepEqual(issues.map((i) => i.suggestion), ["float: inline-end", "text-align: start", "clear: inline-start"]);
  assert.ok(issues.every((i) => i.rule === "css-physical-value"));
});

test("logical properties and unrelated props are clean", () => {
  assert.deepEqual(scanCss("a.css", "a { margin-inline-start: 1px; margin: 0; color: red; top: 0 }"), []);
});

test("parses SCSS with // comments and nesting", () => {
  const scss = "// header\n.nav {\n  .item { margin-right: $gap; }\n}";
  const issues = scanCss("a.scss", scss);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].line, 3);
  assert.equal(issues[0].suggestion, "margin-inline-end: $gap");
});

test("rtlgate-ignore comment keeps a deliberate exception", () => {
  const css = "a {\n  /* rtlgate-ignore */\n  margin-left: 0;\n  padding-left: 0; /* rtlgate-ignore */\n}";
  assert.deepEqual(scanCss("a.css", css), []);
});

test("[dir] and :dir() overrides are not flagged, including nested SCSS", () => {
  const css = `[dir="rtl"] .icon { margin-right: 8px; }\n.x:dir(rtl) { float: right; }\nhtml[dir=rtl] { .nav { .item { padding-left: 0; } } }\n.y { margin-left: 1px; }`;
  assert.deepEqual(scanCss("a.scss", css).map((i) => i.line), [4]);
});
