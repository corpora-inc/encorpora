/**
 * Sample props for the /design gallery: a fictional Model 40 utility pump in
 * diesel and electric variants, the same machine as the engine's test
 * fixture. Data only. No logic lives here: every value is what an engine
 * response would carry, written out by hand.
 */
import type {
  ActiveCode,
  AskAnswer,
  Citation,
  FieldNote,
  JobSummary,
  Lesson,
  PackInfo,
  Procedure,
  SignalMatch,
  ResolveResult,
  StepView,
  SymptomHit,
  Unit,
  UnitHistory,
  Variant,
} from "../engine/types.ts";
import pageSvg from "./assets/page-4-17.svg";
import figureSvg from "./assets/figure-4-6.svg";

const MANUAL = "Model 40 Utility Pump Operator and Field Maintenance Manual";
const EDITION = "Rev. C";

const cite = (section_id: string, section_path: string[], page: string, figure: string | null = null): Citation => ({
  manual: MANUAL,
  edition: EDITION,
  section_id,
  section_path,
  page,
  figure,
});

const TS = "4 Troubleshooting";
const LOW = "4.3 Low discharge pressure";

export const C = {
  strainer: cite("4.3.2", [TS, LOW, "4.3.2 Suction strainer"], "4-17", "Figure 4-6"),
  suction: cite("4.3.3", [TS, LOW, "4.3.3 Suction pressure test"], "4-18"),
  impeller: cite("4.3.4", [TS, LOW, "4.3.4 Impeller and wear ring"], "4-19"),
  wearRing: cite("5.4.2", ["5 Field maintenance", "5.4 Pump end", "5.4.2 Replace the wear ring"], "5-22", "Figure 5-9"),
  safety: cite("1.2", ["1 Safety", "1.2 Pressure and hot surfaces"], "1-3"),
  symptoms: cite("4.1", [TS, "4.1 Symptom index"], "4-2"),
  casing: cite("4.3.5", [TS, LOW, "4.3.5 Casing inspection"], "4-20"),
  codes: cite("4.2", [TS, "4.2 Controller fault codes"], "4-6"),
};

export const DIESEL: Variant = { equip_id: "m40-d", title: "Model 40 utility pump, diesel", short: "40D", attrs: { drive: "Diesel", serial_range: "40D-4000 to 40D-4999" } };
export const ELECTRIC: Variant = { equip_id: "m40-e", title: "Model 40 utility pump, electric", short: "40E", attrs: { drive: "Electric, 460 V", serial_range: "40E-7000 to 40E-7999" } };

export const PACK: PackInfo = {
  pack_id: "model40-us",
  title: "Model 40 utility pump",
  version: "2026.11.3",
  built_at: "2026-11-21",
  signed_by: "Pack signing key 7F3A",
  sources: [{ manual: MANUAL, edition: EDITION, date: "2026-03-01" }],
  levels: [
    { id: "detailed", label: "Detailed" },
    { id: "experienced", label: "Experienced" },
  ],
};

export const UNITS: Unit[] = [
  {
    asset_id: "u-0172",
    name: "P40-0172",
    serial: "40D-4172",
    variant: DIESEL,
    resolved_by: [{ kind: "serial_range", pattern: "40D-4000 to 40D-4999", observed: "40D-4172" }],
    meter: { value: 1842, unit: "hours" },
    location: "Bay 3",
    created_at: "2026-10-02",
  },
  {
    asset_id: "u-0219",
    name: "P40-0219",
    serial: "40E-7219",
    variant: ELECTRIC,
    resolved_by: [{ kind: "serial_range", pattern: "40E-7000 to 40E-7999", observed: "40E-7219" }],
    meter: { value: 611, unit: "hours" },
    location: "Pier 2",
    created_at: "2026-10-14",
  },
  {
    asset_id: "u-0188",
    name: "P40-0188",
    serial: "40D-4188",
    variant: DIESEL,
    resolved_by: [{ kind: "serial_range", pattern: "40D-4000 to 40D-4999", observed: "40D-4188" }],
    meter: { value: 2310, unit: "hours" },
    location: "Bay 1",
    created_at: "2026-09-20",
  },
];

export const JOBS: JobSummary[] = [
  { job_id: "j-31", asset_id: "u-0172", unit_name: "P40-0172", symptom: "Low discharge pressure", started_at: "Today 08:12", step_no: 3, status: "open" },
  { job_id: "j-29", asset_id: "u-0219", unit_name: "P40-0219", symptom: "Motor hums but does not turn", started_at: "Yesterday 15:40", step_no: 2, status: "open" },
];

export const HISTORY: UnitHistory = {
  unit: [
    { event_id: "h1", date: "2026-11-09", text: "Low discharge pressure. Suction strainer cleaned.", system: "Pump end", job_id: "j-22" },
    { event_id: "h2", date: "2026-10-28", text: "250-hour service completed.", system: null, job_id: null },
    { event_id: "h3", date: "2026-10-11", text: "Low discharge pressure. Suction hose clamp tightened.", system: "Suction", job_id: "j-14" },
  ],
  open_discrepancies: [{ id: "d1", text: "Seal weep at shaft, within limits at last check.", opened_at: "2026-11-09", job_id: null }],
  repeats: [{ symptom: "Low discharge pressure", count: 3, window_days: 30, last: "2026-11-09" }],
  fleet: {
    reports: 12,
    modes: [
      { mode_id: "f1", title: "Worn impeller wear ring", count: 5, share: 0.42, tree_id: "t-low" },
      { mode_id: "f2", title: "Blocked suction strainer", count: 4, share: 0.33, tree_id: "t-low" },
      { mode_id: "f3", title: "Air leak at suction hose", count: 3, share: 0.25, tree_id: "t-low" },
    ],
  },
};

export const HISTORY_EMPTY: UnitHistory = { unit: [], open_discrepancies: [], repeats: [], fleet: { reports: 0, modes: [] } };

export const CODES: ActiveCode[] = [
  { code: "F214", title: "Suction pressure low", source: "Controller" },
  { code: "F031", title: "Coolant temperature high", source: "Engine" },
];

export const RESOLVED: ResolveResult = {
  status: "resolved",
  candidates: [{ variant: DIESEL, reasons: [{ kind: "serial_range", pattern: "40D-4000 to 40D-4999", observed: "40D-4172" }] }],
};

export const AMBIGUOUS: ResolveResult = {
  status: "ambiguous",
  candidates: [
    { variant: DIESEL, reasons: [{ kind: "model", pattern: "MODEL 40", observed: "MODEL 40" }] },
    { variant: ELECTRIC, reasons: [{ kind: "model", pattern: "MODEL 40", observed: "MODEL 40" }] },
  ],
};

export const NO_MATCH: ResolveResult = { status: "none", candidates: [] };

export const HITS: SymptomHit[] = [
  {
    symptom_id: "s-low",
    tree_id: "t-low",
    title: "Low discharge pressure",
    system: "Pump end",
    why: [
      { kind: "words", text: "pressure" },
      { kind: "synonym", text: "weak flow" },
      { kind: "code", text: "F214" },
    ],
    citation: C.symptoms,
  },
  {
    symptom_id: "s-prime",
    tree_id: "t-prime",
    title: "Pump loses prime",
    system: "Suction",
    why: [{ kind: "synonym", text: "weak flow" }],
    citation: C.symptoms,
  },
  {
    symptom_id: "s-cav",
    tree_id: "t-cav",
    title: "Noise or vibration at the pump end",
    system: "Pump end",
    why: [{ kind: "history", text: "Reported on this variant 4 times" }],
    citation: C.symptoms,
  },
];

const NOTES: FieldNote[] = [
  {
    note_id: "n1",
    text: "On units past 1,500 hours the strainer gasket often hardens and leaks air. Check it while the cover is off.",
    cause: "Hardened strainer gasket",
    times_seen: 7,
    approved_at: "12 Nov 2026",
    reviewer: "hub engineering",
  },
];

const PATH_SO_FAR = [
  { node_id: "n0", kind: "symptom" as const, text: "Low discharge pressure", result: null },
  { node_id: "n1", kind: "check" as const, text: "Is the discharge valve fully open?", result: "Yes" },
];

/** A yes/no check at the detailed level: guards, facets, test steps, field notes. */
export const STEP_CHECK: StepView = {
  job_id: "j-31",
  node_id: "n2",
  kind: "check",
  step_no: 3,
  text: "Remove the suction strainer basket and inspect it. Is the basket clear of debris, with no more than one quarter of the screen area blocked?",
  citation: C.strainer,
  guards: [
    { kind: "warning", text: "Shut down the pump and relieve system pressure before you open the strainer housing. Water under pressure can cause serious injury.", citation: C.safety },
    { kind: "caution", text: "Do not run the pump with the strainer basket removed. Debris will damage the impeller.", citation: C.strainer },
    { kind: "note", text: "The basket lifts out after the cover clamp is released. A light film of rust on the screen is normal.", citation: C.strainer },
  ],
  setup: {
    conditions: [{ kind: "condition", text: "Pump shut down, engine off, system pressure at zero", ident: null, qty: null, citation: C.safety }],
    tools: [],
    references: [],
    personnel: [],
  },
  requirements: [
    { kind: "tool", text: "Strainer cover wrench", ident: "T-40-11", qty: "1", citation: C.strainer },
    { kind: "part", text: "Strainer cover gasket", ident: "40-2215", qty: "1", citation: C.strainer },
  ],
  assets: [
    { asset_id: "a-page-4-17", role: "page", url: pageSvg, media_type: "image/svg+xml", width: 850, height: 1100, label: "Page 4-17" },
    { asset_id: "a-fig-4-6", role: "figure", url: figureSvg, media_type: "image/svg+xml", width: 640, height: 420, label: "Figure 4-6. Suction strainer" },
  ],
  expect: { kind: "yes_no" },
  branches: [
    { outcome: "yes", label: "Yes", range: null },
    { outcome: "no", label: "No", range: null },
  ],
  facets: [
    { facet: "reason", label: "Why this check", texts: ["A blocked strainer starves the pump of water, which lowers discharge pressure at every speed."], citation: C.strainer, shown: true },
    { facet: "possible", label: "Possible problems still open", texts: ["Blocked suction strainer", "Air leak on the suction side", "Worn impeller or wear ring", "Cracked pump casing"], citation: C.strainer, shown: true },
    { facet: "known", label: "Known so far", texts: ["Discharge valve is fully open."], citation: C.strainer, shown: true },
  ],
  test_steps: [
    { n: 1, text: "Release the cover clamp and lift off the strainer cover.", guards: [] },
    { n: 2, text: "Lift the basket straight up out of the housing.", guards: [] },
    { n: 3, text: "Hold the basket to the light and estimate the blocked screen area.", guards: [] },
  ],
  test_steps_fold: "expanded",
  path: PATH_SO_FAR,
  field_notes: NOTES,
  level: "detailed",
  levels: PACK.levels,
  target: null,
};

/** The same step at the experienced level: question, branches, guards. */
export const STEP_CHECK_BRIEF: StepView = {
  ...STEP_CHECK,
  level: "experienced",
  facets: STEP_CHECK.facets.map((f) => ({ ...f, shown: f.facet === "possible" })),
  test_steps_fold: "collapsed",
};

/** A measured value with a unit. */
export const STEP_VALUE: StepView = {
  ...STEP_CHECK,
  node_id: "n3",
  step_no: 4,
  text: "With the pump at rated speed, read the suction gauge at test port TP-1. Record suction pressure.",
  citation: C.suction,
  guards: [{ kind: "warning", text: "Keep hands and tools clear of the drive belt guard while the pump is running.", citation: C.safety }],
  requirements: [{ kind: "tool", text: "Compound gauge, -100 to 300 kPa", ident: "T-40-30", qty: "1", citation: C.suction }],
  assets: [],
  expect: { kind: "value", unit: "kPa", min: -100, max: 300 },
  branches: [
    { outcome: "low", label: "Below -35 kPa", range: "less than -35 kPa" },
    { outcome: "ok", label: "-35 kPa or higher", range: "-35 kPa or higher" },
  ],
  facets: [
    { facet: "reason", label: "Why this check", texts: ["High suction vacuum means the pump is pulling against a restriction on the suction side."], citation: C.suction, shown: true },
    { facet: "possible", label: "Possible problems still open", texts: ["Air leak on the suction side", "Worn impeller or wear ring", "Cracked pump casing"], citation: C.suction, shown: true },
  ],
  test_steps: [
    { n: 1, text: "Connect the compound gauge to test port TP-1.", guards: [] },
    { n: 2, text: "Start the pump and bring it to rated speed (1,800 rpm).", guards: [] },
    { n: 3, text: "Let the reading settle for 30 seconds, then read the gauge.", guards: [] },
  ],
  path: [...PATH_SO_FAR, { node_id: "n2", kind: "check", text: "Is the strainer basket clear of debris?", result: "Yes" }],
  field_notes: [],
};

/** Pass or fail. */
export const STEP_PASSFAIL: StepView = {
  ...STEP_CHECK,
  node_id: "n4",
  step_no: 5,
  text: "Measure the clearance between the impeller and the wear ring with a feeler gauge at four points. The clearance must be 0.25 to 0.50 mm at every point.",
  citation: C.impeller,
  guards: [{ kind: "caution", text: "Do not pry against the impeller vanes. Bent vanes cause vibration.", citation: C.impeller }],
  requirements: [{ kind: "tool", text: "Feeler gauge set, metric", ident: "T-40-07", qty: "1", citation: C.impeller }],
  assets: [],
  expect: { kind: "pass_fail" },
  branches: [
    { outcome: "pass", label: "Within limits", range: null },
    { outcome: "fail", label: "Out of limits", range: null },
  ],
  facets: [{ facet: "possible", label: "Possible problems still open", texts: ["Worn impeller or wear ring", "Cracked pump casing"], citation: C.impeller, shown: true }],
  test_steps: [],
  path: [...STEP_VALUE.path, { node_id: "n3", kind: "check", text: "Suction pressure at TP-1", result: "-12 kPa" }],
  field_notes: [],
};

/** The corrective action the manual prescribes. */
export const STEP_ACTION: StepView = {
  ...STEP_CHECK,
  node_id: "n5",
  kind: "action",
  step_no: 6,
  text: "Replace the impeller wear ring.",
  citation: C.impeller,
  guards: [],
  requirements: [
    { kind: "part", text: "Wear ring, front", ident: "40-3108", qty: "1", citation: C.wearRing },
    { kind: "part", text: "Casing O-ring", ident: "40-3112", qty: "1", citation: C.wearRing },
    { kind: "tool", text: "Wear ring puller", ident: "T-40-19", qty: "1", citation: C.wearRing },
  ],
  assets: [],
  expect: { kind: "ack" },
  branches: [{ outcome: "done", label: "Done", range: null }],
  facets: [],
  test_steps: [],
  path: [...STEP_PASSFAIL.path, { node_id: "n4", kind: "check", text: "Impeller to wear ring clearance", result: "Out of limits" }],
  field_notes: [],
  target: { kind: "procedure", id: "p-wear-ring", title: "5.4.2 Replace the wear ring" },
};

/** Beyond this level of maintenance. */
export const STEP_ESCALATE: StepView = {
  ...STEP_ACTION,
  node_id: "n6",
  kind: "escalate",
  text: "A cracked casing cannot be repaired at field level. Tag the pump out of service and refer it to depot maintenance.",
  citation: C.casing,
  requirements: [],
  target: null,
};

/** Recorded answers attached to the current step. */
export const ATTACHMENTS = [
  { kind: "photo" as const, id: "ph1" },
  { kind: "note" as const, id: "nt1", text: "Basket clear. Gasket hard at the clamp side." },
];

export const ASK: AskAnswer = {
  query: "What does a quarter of the screen area blocked look like?",
  passages: [
    { text: "Estimate the blocked area by holding the basket to the light. Count the screen panels that pass no light.", citation: C.strainer },
    { text: "The basket has eight screen panels. Two blocked panels are one quarter of the screen area.", citation: C.strainer },
  ],
  summary: null,
};

export const ASK_MODEL: AskAnswer = { ...ASK, summary: "Two of the eight panels passing no light is the limit." };

export const LESSON: Lesson = {
  lesson_id: "l-31",
  job_id: "j-31",
  unit_name: "P40-0172",
  variant: "40D",
  symptom: "Low discharge pressure",
  cause: "Worn impeller wear ring, clearance 0.9 mm",
  action: "Replaced the impeller wear ring (5.4.2)",
  parts: [
    { ident: "40-3108", text: "Wear ring, front", qty: "1" },
    { ident: "40-3112", text: "Casing O-ring", qty: "1" },
  ],
  minutes: 95,
  note: "",
  photos: 2,
  status: "local",
  saved_at: "Today 10:47",
};

export const PROCEDURE: Procedure = {
  task_id: "p-wear-ring",
  title: "5.4.2 Replace the wear ring",
  citation: C.wearRing,
  guards: [{ kind: "warning", text: "Lock out the engine starter before you remove the pump casing. An unexpected start can cause serious injury.", citation: C.safety }],
  setup: {
    conditions: [{ kind: "condition", text: "Pump drained, starter locked out", ident: null, qty: null, citation: C.wearRing }],
    tools: [],
    references: [],
    personnel: [{ kind: "personnel", text: "One technician", ident: null, qty: null, citation: C.wearRing }],
  },
  requirements: STEP_ACTION.requirements,
  steps: [
    { n: 1, text: "Remove the eight casing bolts and pull the pump casing straight back.", guards: [], citation: C.wearRing, expect: { kind: "ack" } },
    { n: 2, text: "Pull the old wear ring with the wear ring puller.", guards: [{ kind: "caution", text: "Do not score the casing bore. A scored bore lets water bypass the new ring.", citation: C.wearRing }], citation: C.wearRing, expect: { kind: "ack" } },
    { n: 3, text: "Press the new wear ring in until it seats against the shoulder.", guards: [], citation: C.wearRing, expect: { kind: "ack" } },
    { n: 4, text: "Fit a new casing O-ring and refit the casing. Torque the bolts to 45 N·m in a cross pattern.", guards: [], citation: C.wearRing, expect: { kind: "ack" } },
  ],
};

export const VERIFY = {
  text: "Run the pump at rated speed for five minutes. Discharge pressure must be 620 kPa or higher at the outlet gauge.",
  citation: cite("4.1.1", [TS, "4.1 Symptom index", "4.1.1 Operating check"], "4-3"),
};

export const INDEX = [
  {
    system: "Pump end",
    symptoms: [
      { symptom_id: "s-low", title: "Low discharge pressure" },
      { symptom_id: "s-cav", title: "Noise or vibration at the pump end" },
      { symptom_id: "s-seal", title: "Water leaks at the shaft seal" },
    ],
  },
  {
    system: "Suction",
    symptoms: [
      { symptom_id: "s-prime", title: "Pump loses prime" },
      { symptom_id: "s-noprime", title: "Pump will not prime" },
    ],
  },
  {
    system: "Engine, 40D",
    symptoms: [
      { symptom_id: "s-crank", title: "Engine cranks but does not start" },
      { symptom_id: "s-hot", title: "Engine overheats" },
    ],
  },
];

export const SIGNAL: SignalMatch = {
  code: "F214",
  title: "Suction pressure low",
  tree_id: "t-low",
  node_id: "n2",
  quote: "F214 is set when suction pressure stays below -35 kPa for 10 seconds. Begin at 4.3.2.",
  citation: C.codes,
};
