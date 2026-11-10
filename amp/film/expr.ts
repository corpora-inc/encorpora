/**
 * y = f(x) from a plain expression: numbers, x, + - * / ^, parentheses, implied
 * multiplication (2x, 3(x+1), x(x-2)), pi, e, and sqrt abs sin cos tan exp ln log.
 * No eval: a small parser builds the function.
 */
type Fn = (x: number) => number;
const FUNCS: Record<string, (v: number) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, ln: Math.log, log: Math.log10,
};

export function compile(src: string): Fn {
  const toks = src.replace(/\s+/g, "").match(/\d+\.?\d*|\.\d+|[a-z]+|[-+*/^()]/gi);
  if (!toks || toks.join("") !== src.replace(/\s+/g, "")) throw new Error(`Cannot read the expression "${src}"`);
  let i = 0;
  const peek = () => toks[i];
  const take = () => toks[i++]!;
  const startsTerm = (t: string | undefined) => !!t && (/^[\d.]/.test(t) || /^[a-z]/i.test(t) || t === "(");
  // sum := product (('+'|'-') product)*
  const sum = (): Fn => {
    let f = product();
    while (peek() === "+" || peek() === "-") {
      const op = take(), g = product(), a = f;
      f = op === "+" ? (x) => a(x) + g(x) : (x) => a(x) - g(x);
    }
    return f;
  };
  // product := unary (('*'|'/'|implied) unary)*
  const product = (): Fn => {
    let f = unary();
    for (;;) {
      if (peek() === "*" || peek() === "/") {
        const op = take(), g = unary(), a = f;
        f = op === "*" ? (x) => a(x) * g(x) : (x) => a(x) / g(x);
      } else if (startsTerm(peek())) {
        const g = power(), a = f;
        f = (x) => a(x) * g(x);
      } else return f;
    }
  };
  const unary = (): Fn => {
    if (peek() === "-") { take(); const g = unary(); return (x) => -g(x); }
    if (peek() === "+") { take(); return unary(); }
    return power();
  };
  // power := atom ('^' unary)?   (right-associative)
  const power = (): Fn => {
    const b = atom();
    if (peek() === "^") { take(); const e = unary(); return (x) => b(x) ** e(x); }
    return b;
  };
  const atom = (): Fn => {
    const t = take();
    if (t === undefined) throw new Error(`"${src}" ends too soon`);
    if (t === "(") {
      const f = sum();
      if (take() !== ")") throw new Error(`"${src}" is missing a closing parenthesis`);
      return f;
    }
    if (/^[\d.]/.test(t)) { const v = Number(t); return () => v; }
    const w = t.toLowerCase();
    if (w === "x") return (x) => x;
    if (w === "pi") return () => Math.PI;
    if (w === "e") return () => Math.E;
    const fn = FUNCS[w];
    if (fn) {
      const arg = peek() === "(" ? atom() : power();
      return (x) => fn(arg(x));
    }
    throw new Error(`Unknown name "${t}" in "${src}"`);
  };
  const f = sum();
  if (i !== toks.length) throw new Error(`Cannot read "${src}" after "${toks.slice(0, i).join("")}"`);
  return f;
}
