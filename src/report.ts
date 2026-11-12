import type { Issue } from "./issue.js";

export const RULES: [string, string][] = [
  ["css-physical-property", "Physical CSS property (left/right) that does not flip in RTL; use the logical property."],
  ["css-physical-value", "Physical value for float, clear or text-align; use the logical value."],
  ["tw-directional-utility", "Directional Tailwind utility (ml-, pr-, left-, text-left, rounded-l ...); use the logical utility."],
  ["html-root-dir-lang", "Root <html> element is missing dir and/or lang."],
  ["input-ltr-dir", "tel/email/url input without dir=ltr; values reorder in RTL."],
  ["locale-bidi-unisolated", "LTR run (number, phone, price, URL, email, Latin name, placeholder) in an Arabic string without Unicode isolates."],
  ["locale-parse-error", "Locale file could not be parsed."],
  ["runtime-overflow", "Page scrolls horizontally when forced to dir=rtl lang=ar."],
  ["runtime-clipped-text", "Text is clipped by its box when forced to dir=rtl lang=ar."],
];

const VERSION = "0.1.0";

export function formatText(issues: Issue[]): string {
  const lines = issues.map(
    (i) => `${i.file}:${i.line}:${i.column}  ${i.rule}  ${i.message}${i.suggestion ? `  -> ${i.suggestion}` : ""}`,
  );
  lines.push(`rtlgate: ${issues.length} ${issues.length === 1 ? "issue" : "issues"}`);
  return lines.join("\n") + "\n";
}

export function formatJson(issues: Issue[]): string {
  return JSON.stringify(issues, null, 2) + "\n";
}

export function formatSarif(issues: Issue[]): string {
  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "rtlgate",
            version: VERSION,
            informationUri: "https://github.com/sohaibt/rtlgate",
            rules: RULES.map(([id, text]) => ({ id, shortDescription: { text } })),
          },
        },
        results: issues.map((i) => ({
          ruleId: i.rule,
          level: "warning",
          message: { text: i.suggestion ? `${i.message}. Suggested: ${i.suggestion}` : i.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: i.file },
                region: { startLine: i.line, startColumn: i.column },
              },
            },
          ],
        })),
      },
    ],
  };
  return JSON.stringify(sarif, null, 2) + "\n";
}
