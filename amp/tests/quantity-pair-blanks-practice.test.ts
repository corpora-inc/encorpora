import { test } from "node:test";
import assert from "node:assert/strict";
import { num, view } from "./fixtures/multi-part-view";

const SEEDS = 150;
const seeds = (p: string) =>
  Array.from({ length: SEEDS }, (_, i) => `${p}:${i}`);
const nums = (text: string) =>
  [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => num(m[0]));

test("division, distances and interest follow the givens", () => {
  for (const seed of seeds("qr")) {
    const { prompt, chosen } = view("quotient-remainder-blanks", seed);
    const [total, size] = nums(prompt);
    assert.equal(num(chosen.full!) * size! + num(chosen.left!), total);
    assert.ok(num(chosen.left!) < size!);
  }
  for (const seed of seeds("km")) {
    const { prompt, chosen } = view("meters-to-kilometers-blanks", seed);
    const parts = [...prompt.matchAll(/(\d+) meters/g)].map((m) =>
      Number(m[1]),
    );
    assert.equal(parts.length, 3);
    assert.equal(
      num(chosen.km!) * 1000 + num(chosen.m!),
      parts.reduce((s, v) => s + v, 0),
    );
    assert.ok(num(chosen.m!) < 1000);
  }
  for (const seed of seeds("si")) {
    const { prompt, chosen } = view("simple-interest-blanks", seed);
    const m = prompt.match(
      /earns (\d+)% .* ([\d,]+) dollars is deposited and left for (\d+) years/,
    )!;
    const interest = (num(m[2]!) * Number(m[1]) * Number(m[3])) / 100;
    assert.equal(num(chosen.interest!), interest);
    assert.equal(num(chosen.total!), num(m[2]!) + interest);
  }
  for (const seed of seeds("loan")) {
    const { prompt, chosen } = view("loan-offer-compare-blanks", seed);
    const principal = num(prompt.match(/borrows ([\d,]+) dollars/)![1]!);
    const cost = (bank: string) => {
      const m = prompt.match(
        new RegExp(
          `${bank} charges (\\d+)% simple interest per year for (\\d+) years`,
        ),
      )!;
      return (principal * Number(m[1]) * Number(m[2])) / 100;
    };
    const [h, s] = [cost("Harbor Bank"), cost("Summit Bank")];
    assert.equal(chosen.bank, h < s ? "Harbor Bank" : "Summit Bank");
    assert.equal(num(chosen.diff!), Math.abs(h - s));
  }
});

test("dilation, spinner, rates and ratios follow the givens", () => {
  for (const seed of seeds("sc")) {
    const { prompt, chosen } = view("scale-factor-effects-blanks", seed);
    const m = prompt.match(
      /is (\d+) units long and (\d+) units wide\. It is dilated by a scale factor of (?:(\d+)|\$\\frac\{1\}\{(\d+)\}\$)/,
    )!;
    const [l, w] = [Number(m[1]), Number(m[2])];
    const k = m[3] ? Number(m[3]) : 1 / Number(m[4]);
    const ratio = (label: string) => {
      const f = label.match(/\\frac\{(\d+)\}\{(\d+)\}/);
      return f ? Number(f[1]) / Number(f[2]) : Number(label);
    };
    assert.ok(
      Math.abs(2 * (l * k + w * k) - 2 * (l + w) * ratio(chosen.perim!)) < 1e-9,
    );
    assert.ok(Math.abs(l * k * w * k - l * w * ratio(chosen.area!)) < 1e-9);
  }
  for (const seed of seeds("ex")) {
    const { prompt, chosen } = view("expected-count-blanks", seed);
    const list = prompt
      .match(/numbers: ([\d, ]+)\./)![1]!
      .split(", ")
      .map(Number);
    const spins = Number(prompt.match(/spun (\d+) times/)![1]);
    const target = Number(
      chosen.prob!.length
        ? view("expected-count-blanks", seed).sentence.match(
            /landing on (\d+) is/,
          )![1]
        : 0,
    );
    const c = list.filter((v) => v === target).length;
    const frac = chosen.prob!.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    const p = frac ? Number(frac[1]) / Number(frac[2]) : Number(chosen.prob);
    assert.ok(Math.abs(p - c / 10) < 1e-9);
    assert.equal(num(chosen.count!), (spins * c) / 10);
  }
  for (const seed of seeds("rate")) {
    const { prompt, chosen } = view("unit-rate-pair-blanks", seed);
    const [p1, m1, p2, m2] = [
      ...prompt.matchAll(/(\d+) \w+ in (\d+) minutes/g),
    ].flatMap((m) => [Number(m[1]), Number(m[2])]);
    assert.ok(Math.abs(num(chosen.first!) - p1! / m1!) < 1e-9);
    assert.ok(Math.abs(num(chosen.second!) - p2! / m2!) < 1e-9);
  }
  for (const seed of seeds("ratio")) {
    const { prompt, chosen } = view("ratio-pair-blanks", seed);
    const m = prompt.match(
      /ratio of (blue|yellow) gumballs to (?:blue|yellow) gumballs in a jar is (\d+) to (\d+)\. There are (\d+) yellow/,
    )!;
    const [blueParts, yellowParts] =
      m[1] === "blue"
        ? [Number(m[2]), Number(m[3])]
        : [Number(m[3]), Number(m[2])];
    const yellow = Number(m[4]);
    const blue = (yellow * blueParts) / yellowParts;
    assert.equal(num(chosen.blue!), blue);
    assert.equal(num(chosen.all!), blue + yellow);
  }
});

test("statistics, geometry and money keys follow the data shown", () => {
  const median = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    return s.length % 2
      ? s[s.length >> 1]!
      : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
  };
  for (const seed of seeds("mm")) {
    const { prompt, chosen } = view("mean-median-blanks", seed);
    const values = prompt
      .match(/seconds: ([\d., ]+)\./)![1]!
      .split(", ")
      .map(Number);
    assert.equal(values.length, 6);
    assert.ok(
      Math.abs(num(chosen.mean!) - values.reduce((s, v) => s + v, 0) / 6) <
        1e-9,
    );
    assert.ok(Math.abs(num(chosen.median!) - median(values)) < 1e-9);
  }
  for (const seed of seeds("cmp")) {
    const { prompt, chosen } = view("median-mode-compare-blanks", seed);
    const [x, y] = ["Hawks", "Owls"].map((t) =>
      prompt
        .match(new RegExp(`${t}: ([\\d, ]+)\\.`))![1]!
        .split(", ")
        .map(Number),
    );
    const mode = (v: number[]) => {
      const c = new Map<number, number>();
      v.forEach((n) => c.set(n, (c.get(n) ?? 0) + 1));
      const top = Math.max(...c.values());
      return [...c].filter(([, k]) => k === top).map(([n]) => n);
    };
    const d = median(x!) - median(y!);
    assert.equal(
      chosen.median,
      d < 0 ? "less than" : d > 0 ? "greater than" : "equal to",
    );
    assert.equal(
      chosen.mode,
      mode(x!).join() === mode(y!).join() ? "match" : "do not match",
    );
    assert.equal(mode(x!).length + mode(y!).length, 2);
  }
  for (const seed of seeds("rect")) {
    const { prompt, chosen } = view("rectangle-chain-blanks", seed);
    const [area, width] = nums(prompt);
    assert.equal(num(chosen.length!) * width!, area);
    assert.equal(num(chosen.perim!), 2 * (num(chosen.length!) + width!));
  }
  for (const seed of seeds("wage")) {
    const { rows, chosen } = view("wage-and-cost-blanks", seed);
    const hours = rows![0]!.slice(1).map(Number);
    const net = rows![1]!.slice(1).map(num);
    hours.forEach((h, i) =>
      assert.equal(net[i], num(chosen.wage!) * h - num(chosen.cost!)),
    );
    assert.ok(net[0]! < 0);
  }
  for (const seed of seeds("pct")) {
    const { prompt, chosen } = view("percent-amounts-blanks", seed);
    if ("first" in chosen) {
      const m = prompt.match(
        /holds (\d+) books\. (\d+)% of the books are fiction and (\d+)%/,
      )!;
      assert.equal(num(chosen.first!), (Number(m[1]) * Number(m[2])) / 100);
      assert.equal(num(chosen.second!), (Number(m[1]) * Number(m[3])) / 100);
    } else {
      const m = prompt.match(
        /earns ([\d,]+) dollars a month\. Rent is (\d+)%.*limit is ([\d,]+) dollars\. Insurance is (\d+)%.*limit is ([\d,]+) dollars/,
      )!;
      const income = num(m[1]!);
      assert.equal(num(chosen.rent!), (income * Number(m[2])) / 100);
      assert.equal(num(chosen.ins!), (income * Number(m[4])) / 100);
      assert.equal(
        chosen.rentv,
        num(chosen.rent!) <= num(m[3]!) ? "within" : "over",
      );
      assert.equal(
        chosen.insv,
        num(chosen.ins!) <= num(m[5]!) ? "within" : "over",
      );
    }
  }
  for (const seed of seeds("reg")) {
    const { rows, chosen } = view("check-register-blanks", seed);
    const bal = [num(rows![1]![2]!)];
    const amt: number[] = [];
    // Lines 1 and 3 show their amounts; lines 2 and 4 show their balances.
    const b1 = num(chosen.b1!);
    const a1 = num(rows![2]![1]!);
    assert.equal(b1, bal[0]! + a1);
    const a2 = num(chosen.a2!);
    assert.equal(b1 + a2, num(rows![3]![2]!));
    const a3 = num(rows![4]![1]!);
    const b3 = num(chosen.b3!);
    assert.equal(b3, num(rows![3]![2]!) + a3);
    assert.equal(b3 + num(chosen.a4!), num(rows![5]![2]!));
    void amt;
  }
});
