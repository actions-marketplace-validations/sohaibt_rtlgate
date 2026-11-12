import { test } from "node:test";
import assert from "node:assert/strict";
import { checkString, isLocaleFile, scanLocale } from "../src/locale.js";

const LRI = "⁦";
const PDI = "⁩";
const runs = (s: string) => checkString(s).map((f) => f.run);

test("phones, URLs, emails and prices are flagged unless isolated", () => {
  assert.deepEqual(runs("اتصل بنا على +966 50 123 4567"), ["+966 50 123 4567"]);
  assert.deepEqual(runs(`اتصل بنا على ${LRI}+966 50 123 4567${PDI}`), []);
  assert.deepEqual(runs("زر https://example.com/ar/2 للمزيد."), ["https://example.com/ar/2"]);
  assert.deepEqual(runs("راسلنا support@example.sa اليوم"), ["support@example.sa"]);
  assert.deepEqual(runs("السعر 100 SAR شامل الضريبة"), ["100 SAR"]);
  assert.deepEqual(runs("المجموع: 1,250.00 SAR"), ["1,250.00 SAR"]);
  assert.deepEqual(runs("المجموع 1,250 ريال"), []);
  assert.deepEqual(runs("اشترِ iPhone 15 Pro الآن"), ["iPhone 15 Pro"]);
});

test("simple runs are flagged only next to bidi-sensitive punctuation", () => {
  assert.deepEqual(runs("لديك 5 رسائل"), []);
  assert.deepEqual(runs("الخصم 20% اليوم"), []);
  assert.deepEqual(runs("مرحبا {name}"), []);
  assert.deepEqual(runs("مرحبا {name}!"), [], "sentence-final punctuation is fine");
  assert.deepEqual(runs("استخدم Google."), []);
  assert.deepEqual(runs("{name}: لديك رسالة"), ["{name}"]);
  assert.deepEqual(runs("استخدم (Google) الآن"), ["Google"]);
  assert.deepEqual(runs("تم الدفع عبر {{provider}} - شكرا"), ["{{provider}}"]);
  assert.deepEqual(runs(`${LRI}{name}${PDI}: لديك رسالة`), []);
});

test("strings without Arabic are ignored", () => {
  assert.deepEqual(runs("Call +966 50 123 4567"), []);
});

test("findings suggest an LRI/PDI wrap", () => {
  const [f] = checkString("اتصل على +966 50 123 4567");
  assert.equal(f.suggestion, "\\u2066+966 50 123 4567\\u2069");
});

test("scanLocale reports key path and line for JSON", () => {
  const json = JSON.stringify({ home: { title: "مرحبا" }, checkout: { phone: "اتصل على +966 50 123 4567" } }, null, 2);
  const issues = scanLocale("ar.json", json);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, "locale-bidi-unisolated");
  assert.equal(issues[0].line, 6);
  assert.match(issues[0].message, /checkout\.phone/);
});

test("scanLocale reads YAML, lists and honors # rtlgate-ignore", () => {
  const yml = [
    "ar:",
    "  links:",
    "    - زر https://example.com للمزيد",
    "    # rtlgate-ignore",
    "    - زر https://example.org للمزيد",
    "  ok: مرحبا {name}",
  ].join("\n");
  const issues = scanLocale("ar.yml", yml);
  assert.deepEqual(issues.map((i) => i.line), [3]);
  assert.match(issues[0].message, /ar\.links\.0/);
});

test("isLocaleFile matches Arabic locale file names", () => {
  for (const f of ["ar.json", "locales/ar.yml", "ar.yaml", "messages.ar.json", "ar-SA.json", "app.ar_EG.yml"]) {
    assert.ok(isLocaleFile(f), f);
  }
  for (const f of ["en.json", "bar.json", "ar.ts", "car.yml"]) assert.ok(!isLocaleFile(f), f);
});
