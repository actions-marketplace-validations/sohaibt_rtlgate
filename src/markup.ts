import { applyIgnores, lineCol, type Issue } from "./issue.js";

// Tailwind physical utility -> logical utility. Matches the bare name or name-<value>.
const PREFIXES: [string, string][] = [
  ["rounded-tl", "rounded-ss"], ["rounded-tr", "rounded-se"],
  ["rounded-bl", "rounded-es"], ["rounded-br", "rounded-ee"],
  ["rounded-l", "rounded-s"], ["rounded-r", "rounded-e"],
  ["border-l", "border-s"], ["border-r", "border-e"],
  ["scroll-ml", "scroll-ms"], ["scroll-mr", "scroll-me"],
  ["scroll-pl", "scroll-ps"], ["scroll-pr", "scroll-pe"],
  ["ml", "ms"], ["mr", "me"], ["pl", "ps"], ["pr", "pe"],
];
const EXACT = new Map<string, string>([
  ["text-left", "text-start"], ["text-right", "text-end"],
  ["float-left", "float-start"], ["float-right", "float-end"],
  ["clear-left", "clear-start"], ["clear-right", "clear-end"],
]);

/** Return the logical replacement for a directional Tailwind class, or undefined. */
export function logicalUtility(token: string): string | undefined {
  const colon = token.lastIndexOf(":");
  const variant = token.slice(0, colon + 1);
  const [, flags, core] = /^(!?-?)(.*)$/.exec(token.slice(colon + 1))!;
  const out = (s: string) => variant + flags + s;
  const exact = EXACT.get(core);
  if (exact) return out(exact);
  for (const [phys, logical] of PREFIXES) {
    if (core === phys || core.startsWith(phys + "-")) return out(logical + core.slice(phys.length));
  }
  if (core.startsWith("left-")) return out("start" + core.slice(4));
  if (core.startsWith("right-")) return out("end" + core.slice(5));
  return undefined;
}

// Quote chars are written as \x22 (double), \x27 (single), \x60 (backtick).
// Static class attributes only: class="..", className="..", className={`..`}. Vue :class bindings are skipped.
const CLASS_ATTR = /(?<![:\w-])(?:class|className)\s*=\s*(?:\x22([^\x22]*)\x22|\x27([^\x27]*)\x27|\{\s*\x60([^\x60]*)\x60\s*\})/g;
const HTML_ROOT = /<html\b([^>]*)>/gi;
// ponytail: [^>]* stops at a JSX arrow (=>); attributes after it are not seen.
const INPUT = /<input\b[^>]*>/gi;
const LTR_TYPE = /\btype\s*=\s*\{?\s*[\x22\x27\x60]?(tel|email|url)\b/i;
const DIR_LTR = /\bdir\s*=\s*\{?\s*[\x22\x27\x60]?ltr\b/i;

/** Scan HTML, JSX/TSX or Vue markup for RTL problems. */
export function scanMarkup(file: string, text: string): Issue[] {
  const issues: Issue[] = [];
  const at = (offset: number) => ({ file, ...lineCol(text, offset) });

  for (const m of text.matchAll(HTML_ROOT)) {
    const missing = ["dir", "lang"].filter((a) => !new RegExp(`\\b${a}\\s*=`).test(m[1]));
    if (missing.length) {
      issues.push({
        ...at(m.index!),
        rule: "html-root-dir-lang",
        message: `root <html> is missing ${missing.join(" and ")}`,
        suggestion: '<html lang="ar" dir="rtl">',
      });
    }
  }

  for (const m of text.matchAll(CLASS_ATTR)) {
    const value = m[1] ?? m[2] ?? m[3] ?? "";
    const start = m.index! + m[0].indexOf(value, m[0].indexOf("="));
    for (const t of value.matchAll(/\S+/g)) {
      const suggestion = logicalUtility(t[0]);
      if (suggestion) {
        issues.push({
          ...at(start + t.index!),
          rule: "tw-directional-utility",
          message: `${t[0]} is a physical (left/right) utility and does not flip in RTL`,
          suggestion,
        });
      }
    }
  }

  for (const m of text.matchAll(INPUT)) {
    const type = LTR_TYPE.exec(m[0]);
    if (type && !DIR_LTR.test(m[0])) {
      issues.push({
        ...at(m.index!),
        rule: "input-ltr-dir",
        message: `<input type="${type[1]}"> without dir="ltr" shows ${type[1]} values reordered in RTL`,
        suggestion: 'add dir="ltr"',
      });
    }
  }

  issues.sort((a, b) => a.line - b.line || a.column - b.column);
  return applyIgnores(text, issues);
}
