import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "./issue.js";

const CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];

const VIEWPORTS: [string, number, number][] = [
  ["mobile", 375, 812],
  ["desktop", 1280, 800],
];

/** Find an installed Chrome/Chromium. RTLGATE_CHROME or CHROME_PATH wins when set. */
export function findChrome(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const forced = env.RTLGATE_CHROME ?? env.CHROME_PATH;
  if (forced) return existsSync(forced) ? forced : undefined;
  return CANDIDATES.find((p) => existsSync(p));
}

export interface RuntimeResult {
  skipped?: string;
  issues: Issue[];
  screenshots: string[];
}

// Runs inside the page. Must be self-contained.
function inPage(): { overflow: number; clipped: string[] } {
  const root = document.documentElement;
  root.setAttribute("dir", "rtl");
  root.setAttribute("lang", "ar");
  const clipped: string[] = [];
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    if (clipped.length >= 20) break;
    const cs = getComputedStyle(el);
    const clips = cs.overflowX === "hidden" || cs.overflowX === "clip" || cs.textOverflow === "ellipsis";
    const text = (el.textContent ?? "").trim();
    if (clips && text && el.scrollWidth > el.clientWidth + 1) {
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : "";
      clipped.push(`${el.tagName.toLowerCase()}${id}${cls} "${text.slice(0, 40)}"`);
    }
  }
  return { overflow: root.scrollWidth - root.clientWidth, clipped };
}

/** Load a URL with dir=rtl lang=ar forced at mobile and desktop widths; flag overflow and clipped text. */
export async function checkUrl(url: string, opts: { outDir: string; chrome?: string }): Promise<RuntimeResult> {
  const chrome = opts.chrome ?? findChrome();
  if (!chrome || !existsSync(chrome)) {
    return { skipped: "no Chrome/Chromium found (install Chrome or set RTLGATE_CHROME)", issues: [], screenshots: [] };
  }
  const name = "playwright-core"; // optional peer dependency, loaded only here
  const pw = await import(name).catch(() => undefined);
  if (!pw) return { skipped: "playwright-core is not installed (npm install playwright-core)", issues: [], screenshots: [] };

  mkdirSync(opts.outDir, { recursive: true });
  const browser = await pw.chromium.launch({ executablePath: chrome, headless: true });
  const issues: Issue[] = [];
  const screenshots: string[] = [];
  try {
    for (const [label, width, height] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(url, { waitUntil: "load" });
      const found = await page.evaluate(inPage);
      await page.waitForTimeout(200);
      const shot = join(opts.outDir, `rtlgate-${label}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      screenshots.push(shot);
      const at = { file: url, line: 1, column: 1 };
      if (found.overflow > 1) {
        issues.push({ ...at, rule: "runtime-overflow", message: `${label} ${width}px: page is ${found.overflow}px wider than the viewport in RTL` });
      }
      for (const c of found.clipped) {
        issues.push({ ...at, rule: "runtime-clipped-text", message: `${label} ${width}px: clipped text in ${c}` });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return { issues, screenshots };
}
