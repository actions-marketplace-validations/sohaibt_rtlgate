import { test } from "node:test";
import assert from "node:assert/strict";
import { scanMarkup } from "../src/markup.js";

const rules = (text: string, file = "a.html") => scanMarkup(file, text).map((i) => i.rule);

test("root <html> needs dir and lang", () => {
  const issues = scanMarkup("a.html", "<!doctype html>\n<html>\n<body></body></html>");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, "html-root-dir-lang");
  assert.equal(issues[0].line, 2);
  assert.match(issues[0].message, /dir.*lang/);
  assert.deepEqual(rules('<html lang="ar">'), ["html-root-dir-lang"]);
  assert.deepEqual(rules('<html lang="ar" dir="rtl">'), []);
  assert.deepEqual(rules("<html lang={locale} dir={dir}>", "layout.tsx"), []);
  assert.deepEqual(rules("<div>no root here</div>", "C.tsx"), []);
});

test("directional Tailwind utilities get logical suggestions", () => {
  const html = '<div class="flex ml-4 md:pr-2 !text-left -left-1 rounded-tl-lg border-l-2 border-lime-500 prose">';
  const issues = scanMarkup("a.html", html);
  assert.deepEqual(issues.map((i) => i.suggestion), ["ms-4", "md:pe-2", "!text-start", "-start-1", "rounded-ss-lg", "border-s-2"]);
  assert.ok(issues.every((i) => i.rule === "tw-directional-utility"));
  assert.equal(issues[0].column, html.indexOf("ml-4") + 1);
});

test("className in JSX, template literals and Vue static class", () => {
  assert.deepEqual(rules('<a className="pl-2" />', "A.jsx"), ["tw-directional-utility"]);
  assert.deepEqual(rules("<a className={`mr-1 ${x}`} />", "A.tsx"), ["tw-directional-utility"]);
  assert.deepEqual(rules('<template><p class="float-right"></p></template>', "A.vue"), ["tw-directional-utility"]);
  assert.deepEqual(rules("<p :class=\"{ 'ml-2': on }\"></p>", "A.vue"), []);
});

test("tel/email/url inputs need dir=ltr", () => {
  const html = '<input type="tel" name="p">\n<input type="email" dir="ltr">\n<input type="text">\n<input\n  type="url"\n/>';
  const issues = scanMarkup("a.html", html);
  assert.deepEqual(issues.map((i) => [i.rule, i.line]), [["input-ltr-dir", 1], ["input-ltr-dir", 4]]);
  assert.deepEqual(rules("<input type='tel' dir='ltr' />", "A.tsx"), []);
});

test("rtlgate-ignore works in HTML and JSX comments", () => {
  assert.deepEqual(rules('<!-- rtlgate-ignore -->\n<div class="ml-2"></div>'), []);
  assert.deepEqual(rules('{/* rtlgate-ignore */}\n<div className="ml-2" />', "A.tsx"), []);
});

test("rtl:/ltr: overrides are not flagged", () => {
  const issues = scanMarkup("a.tsx", `<div className="rtl:mr-4 ltr:ml-4 md:rtl:pl-2">x</div>`);
  assert.deepEqual(issues, []);
});

test("class strings inside cn()/clsx()/cva() are scanned with positions", () => {
  const text = `<div className={cn("w-[calc(100%-1rem)] pl-2", active && 'text-left')}>\n<b className={clsx(\`mr-1\`)} />`;
  const issues = scanMarkup("a.tsx", text);
  assert.deepEqual(issues.map((i) => [i.line, i.column, i.suggestion]), [[1, 41, "ps-2"], [1, 59, "text-start"], [2, 21, "me-1"]]);
});
