import { test } from "node:test";
import assert from "node:assert/strict";
import { corpus } from "../src/fixtures.js";
import { checkString } from "../src/locale.js";

const ARABIC = /[؀-ۿ]/;
const HARAKAT = /[ً-ْ]/;

test("corpus has every category from the PRD", () => {
  for (const key of ["names", "phones", "prices", "dates", "addresses", "urls", "codeSwitched", "diacritics"] as const) {
    assert.ok(corpus[key].length >= 3, key);
  }
  assert.ok(corpus.dates.some((d) => d.calendar === "hijri"));
  assert.ok(corpus.dates.some((d) => d.calendar === "gregorian"));
  assert.ok(corpus.prices.some((p) => p.currency === "SAR"));
  assert.ok(corpus.prices.some((p) => p.currency === "AED"));
  assert.ok(corpus.names.every((n) => ARABIC.test(n)));
  assert.ok(corpus.diacritics.every((d) => HARAKAT.test(d)));
  assert.ok(corpus.phones.every((p) => /^\+?[\d ]{9,}$/.test(p)));
});

test("every code-switched sentence trips the bidi check, and isolating fixes it", () => {
  for (const s of corpus.codeSwitched) {
    const findings = checkString(s);
    assert.ok(findings.length > 0, s);
    let fixed = s;
    for (const f of [...findings].reverse()) {
      fixed = fixed.slice(0, f.index) + "⁦" + f.run + "⁩" + fixed.slice(f.index + f.run.length);
    }
    assert.deepEqual(checkString(fixed), [], fixed);
  }
});
