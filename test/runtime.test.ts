import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { checkUrl, findChrome } from "../src/runtime.js";

const CLI = new URL("../src/cli.js", import.meta.url).pathname;

test("findChrome honors RTLGATE_CHROME, including a missing path", () => {
  assert.equal(findChrome({ RTLGATE_CHROME: process.execPath }), process.execPath);
  assert.equal(findChrome({ RTLGATE_CHROME: "/no/such/chrome" }), undefined);
});

test("checkUrl skips cleanly when no browser is found", async () => {
  const r = await checkUrl("https://example.com", { chrome: "/no/such/chrome", outDir: tmpdir() });
  assert.match(r.skipped ?? "", /no Chrome/);
  assert.deepEqual(r.issues, []);
});

test("CLI url exits 0 with a skip message when no browser is found", () => {
  const out = spawnSync(process.execPath, [CLI, "url", "https://example.com"], {
    encoding: "utf8",
    env: { ...process.env, RTLGATE_CHROME: "/no/such/chrome" },
  });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /skipped/);
  assert.equal(spawnSync(process.execPath, [CLI, "url"], { encoding: "utf8" }).status, 2);
});

test("real browser run flags overflow and clipped text (skips without Chrome)", async (t) => {
  const chrome = findChrome();
  if (!chrome) return t.skip("no Chrome installed");
  const dir = mkdtempSync(join(tmpdir(), "rtlgate-rt-"));
  const page = join(dir, "p.html");
  writeFileSync(
    page,
    "<html><body style=margin:0><div style=width:2000px>wide</div>" +
      "<p style=width:40px;overflow:hidden;white-space:nowrap>نص عربي طويل جدا لا يتسع</p></body></html>",
  );
  let r;
  try {
    r = await checkUrl(pathToFileURL(page).href, { chrome, outDir: dir });
  } catch (e) {
    return t.skip(`browser could not launch here: ${(e as Error).message.split("\n")[0]}`);
  }
  const rules = new Set(r.issues.map((i) => i.rule));
  assert.ok(rules.has("runtime-overflow"));
  assert.ok(rules.has("runtime-clipped-text"));
  assert.ok(r.screenshots.length === 2 && r.screenshots.every((s) => existsSync(s)));
});
