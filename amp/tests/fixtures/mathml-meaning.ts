import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Meaning = string | Meaning[];
const children = (node: Node) => ("childNodes" in node ? node.childNodes : []);
const attribute = (node: Node, name: string) =>
  "attrs" in node ? node.attrs.find((a) => a.name === name)?.value : undefined;
const tag = (node: Node) => ("tagName" in node ? node.tagName : "");
const text = (node: Node): string =>
  node.nodeName === "#text"
    ? (node as DefaultTreeAdapterMap["textNode"]).value
    : children(node).map(text).join("");

/** MathML structure, with presentation wrappers/spacing removed. Structured
 * operands remain separate arrays: flattening them would hide scope changes.
 * Sentence punctuation is prose, not an arithmetic operand. */
export function mathmlMeaning(html: string): string {
  function visit(node: Node, math = false): Meaning[] {
    const name = tag(node);
    if (name === "annotation" || name === "annotation-xml") return [];
    if (attribute(node, "aria-hidden") === "true") return [];
    if (name === "math") return children(node).flatMap((n) => visit(n, true));
    if (!math) {
      // Include prose so a formula falling back to raw source cannot disappear
      // unnoticed. Strip whitespace only; prose sentence punctuation is omitted
      // by the caller when comparing a display's mathematical suffix.
      if (node.nodeName === "#text") {
        const value = text(node).replace(/\s/g, "");
        return value ? [["prose", value]] : [];
      }
      return children(node).flatMap((n) => visit(n));
    }
    if (name === "mspace" || node.nodeName === "#text") return [];
    // Only attributes which affect notation survive (e.g. an overline accent,
    // vector's bold mathvariant, fraction bar or enclosing box).
    const layout =
      /^(?:xmlns|display|displaystyle|scriptlevel|stretchy|fence|separator|lspace|rspace|minsize|maxsize|columnalign|rowspacing|columnspacing|rowalign)$/;
    const attrs =
      "attrs" in node
        ? node.attrs
            .filter((a) => !layout.test(a.name))
            .map((a) => `${a.name}=${a.value}`)
            .sort()
        : [];
    if (["semantics", "mrow", "mstyle"].includes(name) && !attrs.length)
      return children(node).flatMap((n) => visit(n, true));
    if (["mn", "mi", "mo", "mtext"].includes(name)) {
      const value = text(node).replace(/\s/g, "");
      return value ? [[name, attrs, value]] : [];
    }
    // Display style moves a large operator's limits above/below it. Preserve
    // both bounds and their order, but not that placement difference.
    const operands = children(node);
    const limits =
      ["msubsup", "munderover"].includes(name) &&
      operands.length === 3 &&
      tag(operands[0]!) === "mo" &&
      /^[∑∏∐]$/.test(text(operands[0]!));
    return [
      [limits ? "limits" : name, attrs, ...operands.map((n) => visit(n, true))],
    ];
  }
  return JSON.stringify(visit(parseFragment(html)));
}
