# rtlgate

A release gate for Arabic and RTL web apps. rtlgate runs locally or in CI and catches the RTL bugs that usually slip through to manual QA:

- **CSS/SCSS**: physical properties (`margin-left`, `padding-right`, `left`, `border-left`, `border-top-left-radius`, `float: left`, `text-align: right` ...) with the logical replacement.
- **Markup** (HTML, JSX/TSX, Vue): root `<html>` without `dir`/`lang`, directional Tailwind utilities (`ml-4`, `pr-2`, `left-0`, `text-left`, `rounded-l` ...), and `tel`/`email`/`url` inputs without `dir="ltr"`.
- **Arabic locale files** (`ar.json`, `ar.yml`, `ar-SA.json`, `*.ar.json` ...): LTR runs (phones, prices, URLs, emails, Latin names, `{placeholders}`) that are not wrapped in Unicode isolates and will reorder in RTL, with an LRI/PDI fix.
- **Runtime check** (optional): load a page in your installed Chrome with `dir="rtl" lang="ar"` forced, at mobile and desktop widths; flag horizontal overflow and clipped text; save screenshots.
- **Arabic fixture corpus**: names, phones, SAR/AED prices, Hijri and Gregorian dates, addresses, URLs, code-switched sentences and diacritics, as JSON for your own tests.

Output is text, JSON or SARIF. Nothing is uploaded anywhere.

## Install

```sh
npm install rtlgate
```

Node 18.3 or newer. For the runtime check, also `npm install playwright-core` (no browser download; rtlgate uses the Chrome you already have).

## Usage

```sh
npx rtlgate                       # scan the current folder
npx rtlgate src locales           # scan some paths
npx rtlgate --max-issues 10       # pass while there are 10 issues or fewer
npx rtlgate --format sarif --output rtlgate.sarif
npx rtlgate url http://localhost:3000 --out-dir shots
npx rtlgate fixtures > ar-corpus.json
```

Exit codes: `0` pass, `1` more than `--max-issues` issues (default 0), `2` usage error.
`node_modules`, `.git`, `dist`, `build`, `out`, `.next`, `.nuxt`, `coverage` and `vendor` are skipped.

Example output:

```
src/app.scss:3:3  css-physical-property  margin-left is physical and does not flip in RTL  -> margin-inline-start: 8px
src/locales/ar.json:4:14  locale-bidi-unisolated  cart.total: "1,250.00 SAR" (number group, phone or price) is not wrapped in Unicode isolates and can reorder in RTL  -> ⁦1,250.00 SAR⁩
rtlgate: 2 issues
```

### Deliberate exceptions

Put `rtlgate-ignore` in a comment on the same line, or on its own comment line just above:

```css
.logo { margin-left: 4px; } /* rtlgate-ignore: brand mark stays left */
```

```html
<!-- rtlgate-ignore -->
<div class="ml-2">...</div>
```

YAML locale files take `# rtlgate-ignore`. JSON has no comments, so isolate the string instead.

### Runtime check

`rtlgate url <url>` needs `playwright-core` and an installed Chrome or Chromium. Set `RTLGATE_CHROME` to a browser path to pick one. If no browser or no `playwright-core` is found, it prints a skip message and exits 0.

### GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: sohaibt/rtlgate@main
  with:
    paths: src locales
    max-issues: 0
    sarif-file: rtlgate.sarif     # optional
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: rtlgate.sarif
```

The action uses the Node on the runner.

### Library

```js
import { scanPaths, checkString, corpus, formatSarif } from "rtlgate";

checkString("اتصل على +966 50 123 4567");   // [{ run: "+966 50 123 4567", reason: ..., suggestion: ... }]
corpus.codeSwitched;                         // Arabic test strings for your own tests
```

The corpus JSON is also exported as `rtlgate/fixtures/ar-corpus.json`.

## Rules

| Rule | What it flags |
| --- | --- |
| `css-physical-property` | `margin-left`, `padding-right`, `left`, `right`, `border-left*`, corner radii, `scroll-margin/padding-left/right` |
| `css-physical-value` | `float`, `clear`, `text-align` set to `left`/`right` |
| `tw-directional-utility` | `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l/r`, `rounded-l/r/tl/tr/bl/br`, `text-left/right`, `float-left/right`, `clear-left/right`, `scroll-m/p-l/r` (with variants, `!` and `-`) |
| `html-root-dir-lang` | `<html>` without `dir` or `lang` |
| `input-ltr-dir` | `<input type="tel/email/url">` without `dir="ltr"` |
| `locale-bidi-unisolated` | URLs, emails, phones, `+`/`-` numbers, number groups and prices, always; Latin words and placeholders when next to bidi-sensitive punctuation; never plain numbers |
| `runtime-overflow` / `runtime-clipped-text` | from `rtlgate url` |

The locale check is a heuristic based on how the Unicode bidi algorithm treats neutral characters next to LTR runs. It flags what usually breaks. It is not a full UBA implementation.

## How it is different

- **rtl-lint**, **stylelint-use-logical**: check CSS (and Tailwind) only. rtlgate also checks Arabic locale strings for bidi problems and can run a real-browser check.
- **Hosted crawlers** (e.g. RTL Web Layout Auditor): run in someone else's cloud. rtlgate runs on your machine or CI runner, and nothing is uploaded.
- **Agent skills and guides** (raqeeb, rtl-rendering-tester): advice and workflows. rtlgate is a deterministic gate with an exit code and SARIF for code scanning.
- It ships an open Arabic fixture corpus you can reuse in your own tests.

## License

MIT
