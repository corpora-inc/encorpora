/**
 * Gate result types.
 *
 * A gate is `pending` when it is defined in GATES.md but has no implementation
 * here yet. Pending is printed, never counted as a pass — a gate table where an
 * unimplemented gate reads as green is worse than no table.
 */

export type Severity = "error" | "warn";

export type Finding = {
  readonly gate: string;
  readonly severity: Severity;
  readonly subject?: string;
  readonly message: string;
};

export type GateStatus = "pass" | "fail" | "warn" | "pending";

export type GateResult = {
  readonly gate: string;
  readonly title: string;
  readonly status: GateStatus;
  readonly findings: readonly Finding[];
  readonly notes: readonly string[];
};

export type Report = {
  readonly ok: boolean;
  readonly mode: "incremental" | "full";
  readonly seedsPerLevel: number;
  readonly results: readonly GateResult[];
  readonly stats: Readonly<Record<string, string | number>>;
};

export function fail(gate: string, message: string, subject?: string): Finding {
  return subject === undefined
    ? { gate, severity: "error", message }
    : { gate, severity: "error", message, subject };
}

export function warn(gate: string, message: string, subject?: string): Finding {
  return subject === undefined
    ? { gate, severity: "warn", message }
    : { gate, severity: "warn", message, subject };
}

export function resultOf(
  gate: string,
  title: string,
  findings: readonly Finding[],
  notes: readonly string[] = [],
): GateResult {
  const status: GateStatus = findings.some((f) => f.severity === "error")
    ? "fail"
    : findings.length > 0
      ? "warn"
      : "pass";
  return { gate, title, status, findings, notes };
}

export function pending(gate: string, title: string, owner: string): GateResult {
  return {
    gate,
    title,
    status: "pending",
    findings: [],
    notes: [`not implemented yet — owned by ${owner}`],
  };
}
