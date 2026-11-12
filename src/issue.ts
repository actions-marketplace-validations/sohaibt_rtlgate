export interface Issue {
  file: string;
  line: number;
  column: number;
  rule: string;
  message: string;
  suggestion?: string;
}

export function lineCol(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const nl = before.lastIndexOf("\n");
  return { line: before.split("\n").length, column: offset - nl };
}

const MARK = "rtlgate-ignore";
// A line that is only a comment (CSS, JS, JSX, HTML, YAML) carrying the marker.
const COMMENT_ONLY = /^\s*(\/\*|\/\/|<!--|#|\{\s*\/\*)/;

/** Drop issues on a line that carries `rtlgate-ignore`, or right below a comment-only line that does. */
export function applyIgnores<T extends { line: number }>(text: string, issues: T[]): T[] {
  if (!text.includes(MARK)) return issues;
  const lines = text.split("\n");
  return issues.filter((i) => {
    const here = lines[i.line - 1] ?? "";
    const prev = lines[i.line - 2] ?? "";
    return !(here.includes(MARK) || (prev.includes(MARK) && COMMENT_ONLY.test(prev)));
  });
}
