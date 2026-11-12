import { describe, expect, it } from "vitest";
import { checkLine } from "./mathcheck";
describe("checkLine", () => {
  it.each(["19\\cdot 6=114", "\\ca{7}+\\cw{3}=10", "\\frac{1}{2.5-2}=\\frac{1}{\\cw{0.5}}=\\cg{2}", "m=\\dfrac{-6}{2}=-3", "1{,}012=1012", "88\\%\\times 43=37.84", "3^{2}+4^{2}=5^{2}", "26\\div 5=5.2", "16/20>5/20", "x=6", "5x+3=18", "\\cw{10}\\text{ ones}=\\cg{1}\\text{ ten}+\\cw{0}", "50\\%\\ \\text{of}\\ 80=40"])("true or skipped: %s", (t) => expect(checkLine(t)).toBeNull());
  it.each(["19\\cdot 6=104", "\\ca{7}+\\cw{3}=11", "\\frac{1}{4-2}=3", "5/20>16/20", "4\\times 5=25"])("false: %s", (t) => expect(checkLine(t)).not.toBeNull());
});
import { mathProblems } from "./mathcheck";
const col = (...tex: string[]) => ({ id: "t", title: "t", shots: [{ beats: [{ say: "a", do: tex.map((t, i) => ({ do: i === tex.length - 1 ? "answer" : "write", tex: t })) }] }] }) as any;
describe("mathProblems", () => {
  it("passes a right chain", () => expect(mathProblems(col("11x+16=-50", "11x=-66", "x=-6"))).toEqual([]));
  it("catches a slip", () => expect(mathProblems(col("11x+16=-50", "11x=-34", "x=-6")).length).toBe(1));
  it("handles two roots", () => expect(mathProblems(col("(x-2)(x+3)=0", "x-2=0", "x+3=0", "x=2\\ \\text{or}\\ x=-3"))).toEqual([]));
  it("skips a line that is struck out, and still catches the same line left standing", () => {
    const beats = (strike: boolean) => [
      { say: "a", do: [{ do: "write", tex: "4+4+2=12", id: "slip" }] },
      { say: "b", do: [...(strike ? [{ do: "strike", target: "slip" }] : []), { do: "write", tex: "4+4+2=10" }] },
    ];
    expect(mathProblems({ id: "t", title: "t", shots: [{ beats: beats(true) }] } as any)).toEqual([]);
    expect(mathProblems({ id: "t", title: "t", shots: [{ beats: beats(false) }] } as any).length).toBe(1);
  });
});
