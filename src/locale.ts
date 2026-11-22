import { parseDocument, isMap, isScalar, isSeq } from "yaml";
import { applyIgnores, lineCol, type Issue } from "./issue.js";

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ]/;
const LRI = "⁦";
const FSI = "⁨";
const PDI = "⁩";

// One LTR token: URL, email, {placeholder}/{{placeholder}}, printf %s, or a Latin/digit word.
const TOKEN = String.raw`(?:https?:\/\/|www\.)[^\s؀-ۿ‎‏‪-‮⁦-⁩]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\{\{?[^{}\s]+\}\}?|%[sd@]|[+$€£]?[A-Za-z0-9][A-Za-z0-9$€£@&.,_\/#+-]*`;
// A run is tokens joined by spaces: "+966 50 123 4567", "100 SAR", "iPhone 15 Pro".
const RUN = new RegExp(`(?:${TOKEN})(?:[ \\t]+(?:${TOKEN}))*`, "g");
// Bidi-neutral punctuation that gets pulled to the wrong side of an LTR run. \x22 and \x27 are quotes.
const PUNCT = /[:;,.!?()[\]\/+\-%#\x22\x27«»،]/;
const DIGITS_ONLY = /^\d[\d.,]*%?$/;

export interface BidiFinding {
  run: string;
  index: number;
  reason: string;
  suggestion: string;
}

function complexReason(run: string): string | undefined {
  if (/^(https?:|www\.)/i.test(run)) return "URL";
  if (run.includes("@")) return "email";
  if (/^[+-]\d/.test(run)) return "signed number or phone";
  if (/\s/.test(run) && /\d/.test(run)) return "number group, phone or price";
  return undefined;
}

/** Find LTR runs in a mixed Arabic string that will reorder in RTL because they are not isolated. */
export function checkString(s: string): BidiFinding[] {
  if (!ARABIC.test(s)) return [];
  const out: BidiFinding[] = [];
  for (const m of s.matchAll(RUN)) {
    const run = m[0].replace(/[.,;:!?)\]]+$/, "");
    const start = m.index!;
    const end = start + run.length;
    const before = s[start - 1];
    if ((before === LRI || before === FSI) && s[end] === PDI) continue;

    let reason = complexReason(run);
    if (!reason && !DIGITS_ONLY.test(run)) {
      const prev = s.slice(0, start).trimEnd().slice(-1);
      const rest = s.slice(end).trimStart();
      const next = rest[0] ?? "";
      const finalPunct = /^[.!?]+\s*$/.test(rest);
      if (PUNCT.test(prev) || (PUNCT.test(next) && !finalPunct)) reason = "next to bidi-sensitive punctuation";
    }
    // A placeholder's value may be Arabic, so let it pick its own direction (FSI) instead of forcing LTR (LRI).
    const open = /\{|%[sd@]/.test(run) ? "\\u2068" : "\\u2066";
    if (reason) out.push({ run, index: start, reason, suggestion: `${open}${run}\\u2069` });
  }
  return out;
}

const AR = String.raw`ar(?:[-_][A-Za-z]{2})?`;
const AR_FILE = new RegExp(String.raw`^(?:.*\.)?${AR}\.(?:json|ya?ml)$`, "i");
const AR_DIR = new RegExp(`^${AR}$`, "i");
/** Arabic locale files: ar.json, ar-SA.json, messages.ar.json, app.ar_EG.yaml, and JSON/YAML in an ar/ folder (locales/ar/common.json). */
export function isLocaleFile(path: string): boolean {
  const parts = path.split(/[\\/]/);
  const base = parts.pop() ?? "";
  return AR_FILE.test(base) || (/\.(?:json|ya?ml)$/i.test(base) && AR_DIR.test(parts.pop() ?? ""));
}

/** Scan a JSON or YAML locale file (JSON is parsed as YAML 1.2 so both get line numbers). */
export function scanLocale(file: string, text: string): Issue[] {
  const doc = parseDocument(text, { uniqueKeys: false });
  if (doc.errors.length) {
    const err = doc.errors[0];
    const pos = err.linePos?.[0] ?? { line: 1, col: 1 };
    return [{ file, line: pos.line, column: pos.col, rule: "locale-parse-error", message: err.message.split("\n")[0] }];
  }
  const issues: Issue[] = [];
  const walk = (node: unknown, path: string[]): void => {
    if (isMap(node)) {
      for (const item of node.items) walk(item.value, [...path, String(isScalar(item.key) ? item.key.value : item.key)]);
    } else if (isSeq(node)) {
      node.items.forEach((item, i) => walk(item, [...path, String(i)]));
    } else if (isScalar(node) && typeof node.value === "string") {
      const at = lineCol(text, node.range?.[0] ?? 0);
      for (const f of checkString(node.value)) {
        issues.push({
          file,
          ...at,
          rule: "locale-bidi-unisolated",
          message: `${path.join(".")}: "${f.run}" (${f.reason}) is not wrapped in Unicode isolates and can reorder in RTL`,
          suggestion: f.suggestion,
        });
      }
    }
  };
  walk(doc.contents, []);
  return applyIgnores(text, issues);
}
