import scss from "postcss-scss";
import { applyIgnores, type Issue } from "./issue.js";

const PROPS: Record<string, string> = {
  left: "inset-inline-start",
  right: "inset-inline-end",
  "border-top-left-radius": "border-start-start-radius",
  "border-top-right-radius": "border-start-end-radius",
  "border-bottom-left-radius": "border-end-start-radius",
  "border-bottom-right-radius": "border-end-end-radius",
};
for (const base of ["margin", "padding", "scroll-margin", "scroll-padding"]) {
  PROPS[`${base}-left`] = `${base}-inline-start`;
  PROPS[`${base}-right`] = `${base}-inline-end`;
}
for (const suffix of ["", "-width", "-style", "-color"]) {
  PROPS[`border-left${suffix}`] = `border-inline-start${suffix}`;
  PROPS[`border-right${suffix}`] = `border-inline-end${suffix}`;
}

const VALUES: Record<string, Record<string, string>> = {
  float: { left: "inline-start", right: "inline-end" },
  clear: { left: "inline-start", right: "inline-end" },
  "text-align": { left: "start", right: "end" },
};

/** Scan CSS or SCSS for physical (left/right) properties and values. */
export function scanCss(file: string, text: string): Issue[] {
  const issues: Issue[] = [];
  scss.parse(text, { from: file }).walkDecls((d) => {
    const prop = d.prop.toLowerCase();
    const pos = d.source?.start ?? { line: 1, column: 1 };
    const at = { file, line: pos.line, column: pos.column };
    if (PROPS[prop]) {
      issues.push({
        ...at,
        rule: "css-physical-property",
        message: `${d.prop} is physical and does not flip in RTL`,
        suggestion: `${PROPS[prop]}: ${d.value}`,
      });
      return;
    }
    const logical = VALUES[prop]?.[d.value.trim().toLowerCase()];
    if (logical) {
      issues.push({
        ...at,
        rule: "css-physical-value",
        message: `${d.prop}: ${d.value} is physical and does not flip in RTL`,
        suggestion: `${d.prop}: ${logical}`,
      });
    }
  });
  return applyIgnores(text, issues);
}
