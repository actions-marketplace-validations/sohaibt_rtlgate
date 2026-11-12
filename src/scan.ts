import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { scanCss } from "./css.js";
import { scanMarkup } from "./markup.js";
import { isLocaleFile, scanLocale } from "./locale.js";
import type { Issue } from "./issue.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", ".next", ".nuxt", "coverage", "vendor"]);
const CSS = new Set([".css", ".scss"]);
const MARKUP = new Set([".html", ".htm", ".jsx", ".tsx", ".vue"]);

/** Pick the scanner for a file by name; undefined when rtlgate does not check this file type. */
export function scannerFor(file: string): ((file: string, text: string) => Issue[]) | undefined {
  if (isLocaleFile(file)) return scanLocale;
  const ext = extname(file).toLowerCase();
  if (CSS.has(ext)) return scanCss;
  if (MARKUP.has(ext)) return scanMarkup;
  return undefined;
}

function walk(abs: string, out: string[]): void {
  if (statSync(abs).isDirectory()) {
    for (const name of readdirSync(abs)) {
      if (!SKIP_DIRS.has(name)) walk(join(abs, name), out);
    }
  } else if (scannerFor(abs)) {
    out.push(abs);
  }
}

/** Scan files and directories (relative to cwd). Throws if a path does not exist. */
export function scanPaths(paths: string[], cwd = process.cwd()): Issue[] {
  const files: string[] = [];
  for (const p of paths) {
    const abs = resolve(cwd, p);
    if (!existsSync(abs)) throw new Error(`no such file or directory: ${p}`);
    walk(abs, files);
  }
  const issues: Issue[] = [];
  for (const abs of [...new Set(files)].sort()) {
    const file = relative(cwd, abs).split(sep).join("/");
    issues.push(...scannerFor(abs)!(file, readFileSync(abs, "utf8")));
  }
  return issues;
}
