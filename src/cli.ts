#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { corpusPath } from "./fixtures.js";
import { formatJson, formatSarif, formatText } from "./report.js";
import { scanPaths } from "./scan.js";
import type { Issue } from "./issue.js";

const HELP = `rtlgate - RTL release gate for Arabic web apps

Usage:
  rtlgate [paths...] [options]     scan CSS/SCSS, HTML/JSX/TSX/Vue and Arabic locale files (default: .)
  rtlgate fixtures                 print the Arabic fixture corpus (JSON)

Options:
  --format text|json|sarif   output format (default: text)
  --output <file>            write the report to a file instead of stdout
  --max-issues <n>           exit 1 when more than n issues are found (default: 0)
  -h, --help                 show this help

Ignore a deliberate exception with an rtlgate-ignore comment on the same line or the line above.
Exit codes: 0 pass, 1 too many issues, 2 usage error.`;

const FORMATS = new Map([["text", formatText], ["json", formatJson], ["sarif", formatSarif]]);

function fail(msg: string): never {
  process.stderr.write(`rtlgate: ${msg}\n`);
  process.exit(2);
}

function emit(report: string, output?: string): void {
  if (output) writeFileSync(output, report);
  else process.stdout.write(report);
}

function gate(issues: Issue[], max: number, format: string): void {
  if (format !== "text") process.stderr.write(`rtlgate: ${issues.length} issues (max ${max})\n`);
  process.exitCode = issues.length > max ? 1 : 0;
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        format: { type: "string", default: "text" },
        output: { type: "string" },
        "max-issues": { type: "string", default: "0" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (e) {
    fail((e as Error).message);
  }
  const { values, positionals } = parsed;
  if (values.help) return void process.stdout.write(HELP + "\n");

  const format = values.format!;
  const formatter = FORMATS.get(format);
  if (!formatter) fail(`unknown --format ${format} (use text, json or sarif)`);
  const max = Number(values["max-issues"]);
  if (!Number.isInteger(max) || max < 0) fail(`--max-issues must be a whole number, got ${values["max-issues"]}`);

  if (positionals[0] === "fixtures") return void process.stdout.write(readFileSync(corpusPath, "utf8"));

  let issues: Issue[];
  try {
    issues = scanPaths(positionals.length ? positionals : ["."]);
  } catch (e) {
    fail((e as Error).message);
  }
  emit(formatter(issues), values.output);
  gate(issues, max, format);
}

main();
