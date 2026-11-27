/**
 * Exact grading against the baked key. No model is involved: mc compares the
 * choice index, numeric compares within the key's stated tolerance, and
 * free text is checked against a baked keyword rubric (a model grader can
 * replace that one path later; everything else stays exact).
 */

import type { Item } from "./types.ts";

export type Response = number | string;

export interface Grade {
  correct: boolean;
  /** 0..1. mc and numeric are 0 or 1; free text is the share of rubric points met. */
  score: number;
  /** Free text only: the rubric point ids that were met. */
  matched?: string[];
}

export interface NumericKey {
  value: number;
  tolerance: number;
}

/** "25", "25±0.5", "25 +/- 0.5", "1,200". */
export function parseNumericKey(answer: string): NumericKey {
  const m = /^\s*([^±+]+?)\s*(?:(?:±|\+\/-|\+-)\s*(.+?))?\s*$/.exec(answer);
  if (!m) throw new Error(`Bad numeric key: ${answer}`);
  const value = parseNumber(m[1] ?? "");
  const tolerance = m[2] === undefined ? 0 : parseNumber(m[2]);
  if (value === null || tolerance === null || tolerance < 0) throw new Error(`Bad numeric key: ${answer}`);
  return { value, tolerance };
}

/** A plain decimal number with optional thousands commas. Returns null when it is not one. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface RubricPoint {
  id: string;
  /** Any of these phrases, matched as whole words, case-insensitive. */
  any: string[];
}

export interface Rubric {
  points: RubricPoint[];
  /** Points needed to count as correct. Defaults to all of them. */
  pass?: number;
}

export function parseRubric(answer: string): Rubric {
  const data = JSON.parse(answer) as Rubric;
  if (!Array.isArray(data.points) || data.points.length === 0) throw new Error("Rubric needs points");
  for (const p of data.points) {
    if (typeof p.id !== "string" || !Array.isArray(p.any) || p.any.length === 0) throw new Error("Bad rubric point");
  }
  if (data.pass !== undefined && (!Number.isInteger(data.pass) || data.pass < 1 || data.pass > data.points.length)) {
    throw new Error("Bad rubric pass count");
  }
  return data;
}

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

export function grade(item: Item, response: Response | null | undefined): Grade {
  if (response === null || response === undefined || response === "") return { correct: false, score: 0 };
  switch (item.kind) {
    case "mc": {
      const key = Number(item.answer);
      if (!Number.isInteger(key)) throw new Error(`Bad mc key for ${item.id}`);
      const chosen = typeof response === "number" ? response : Number(response);
      const correct = chosen === key;
      return { correct, score: correct ? 1 : 0 };
    }
    case "numeric": {
      const key = parseNumericKey(item.answer);
      const value = typeof response === "number" ? response : parseNumber(response);
      if (value === null || !Number.isFinite(value)) return { correct: false, score: 0 };
      // A relative epsilon absorbs binary rounding (0.1 + 0.2) without loosening the key.
      const eps = 1e-9 * Math.max(1, Math.abs(key.value));
      const correct = Math.abs(value - key.value) <= key.tolerance + eps;
      return { correct, score: correct ? 1 : 0 };
    }
    case "free_text": {
      const rubric = parseRubric(item.answer);
      const text = normalize(String(response));
      const matched = rubric.points
        .filter((p) => p.any.some((phrase) => {
          const n = normalize(phrase).trim();
          return n.length > 0 && text.includes(` ${n} `);
        }))
        .map((p) => p.id);
      const need = rubric.pass ?? rubric.points.length;
      return { correct: matched.length >= need, score: matched.length / rubric.points.length, matched };
    }
  }
}
