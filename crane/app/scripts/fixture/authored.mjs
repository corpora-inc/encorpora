/**
 * FIXTURE CONTENT. Hand-written sample rows in the pack schema
 * (harvest/CONTRACT.md) so the app runs end to end before the real pack
 * lands. Every quote is checked verbatim against the eCFR text by
 * scripts/build-fixture.mjs; the build fails on any mismatch. Replace with
 * the baked pack from harvest/pipeline when it ships.
 */

const T = (text) => ({ t: "text", text });
const Q = (section_id, text) => ({ t: "quote", section_id, text });
const C = (section_id) => ({ t: "cite", section_id });

const S1408 = "29cfr1926.1408";
const S1409A = "29cfr1926.1409(a)";
/** 1926.1409(a): over 350 kV up to 1,000 kV, every "20 feet" in 1926.1407-1408 becomes 50 feet. */
const Q1409A = "For power lines at or below 1000 kV, wherever the distance “20 feet” is specified, the distance “50 feet” must be substituted; and";

export const topics = [
  { topic_id: "power-lines", parent_id: null, ord: 1, title: "Power lines", summary: "Work zones, clearance distances and the precautions that keep the boom, load line and load away from energized lines." },
  { topic_id: "inspections", parent_id: null, ord: 2, title: "Inspections", summary: "What a competent person checks each shift, each month and each year, and what happens when a deficiency is found." },
  { topic_id: "ground", parent_id: null, ord: 3, title: "Ground conditions", summary: "Firm, drained and graded ground, supporting materials, and who is responsible for the set-up area." },
  { topic_id: "signals", parent_id: null, ord: 4, title: "Signals", summary: "When a signal person is required, the types of signals, and the Standard Method for hand signals." },
  { topic_id: "operations", parent_id: null, ord: 5, title: "Operations", summary: "Rated capacity, wind and weather, the fall zone and swing radius hazards." },
  { topic_id: "load-charts", parent_id: null, ord: 6, title: "Load charts", summary: "Reading rated capacity by radius, boom length and configuration, and what must be deducted from it." },
];

export const skills = [
  { skill_id: "pl.zone", topic_id: "power-lines", title: "Identify the work zone and the 20-foot check" },
  { skill_id: "pl.tablea", topic_id: "power-lines", title: "Table A minimum clearance distances" },
  { skill_id: "pl.precautions", topic_id: "power-lines", title: "Encroachment precautions" },
  { skill_id: "insp.shift", topic_id: "inspections", title: "Shift inspection items" },
  { skill_id: "insp.deficiency", topic_id: "inspections", title: "Acting on a deficiency" },
  { skill_id: "insp.periodic", topic_id: "inspections", title: "Monthly and annual inspections" },
  { skill_id: "ground.reqs", topic_id: "ground", title: "Ground condition requirements" },
  { skill_id: "sig.when", topic_id: "signals", title: "When a signal person is required" },
  { skill_id: "sig.types", topic_id: "signals", title: "Types of signals and the stop signal" },
  { skill_id: "ops.capacity", topic_id: "operations", title: "Rated capacity and load weight" },
  { skill_id: "ops.zones", topic_id: "operations", title: "Fall zone and swing radius" },
  { skill_id: "lc.read", topic_id: "load-charts", title: "Read a capacity from a load chart" },
];

/** Prerequisites inside a topic (practice frontiers). */
export const prereqs = {
  "pl.tablea": ["pl.zone"],
  "pl.precautions": ["pl.zone"],
  "insp.deficiency": ["insp.shift"],
  "insp.periodic": ["insp.shift"],
  "sig.types": ["sig.when"],
};

export const equipment = [
  { equip_id: "mobile", parent_id: null, name: "Mobile crane", aliases: ["mobile crane"] },
  { equip_id: "mobile.telescopic", parent_id: "mobile", name: "Telescopic boom crane", aliases: ["hydraulic crane", "telescopic"] },
  { equip_id: "mobile.lattice", parent_id: "mobile", name: "Lattice boom crawler crane", aliases: ["crawler", "lattice"] },
  { equip_id: "articulating", parent_id: null, name: "Articulating crane", aliases: ["knuckle boom"] },
  { equip_id: "tower", parent_id: null, name: "Tower crane", aliases: ["tower"] },
];

const D = "29cfr1926.1401";
export const terms = [
  ["competent-person", "Competent person", "Someone who can spot existing and predictable hazards and is authorized to correct them right away.", "Competent person means one who is capable of identifying existing and predictable hazards in the surroundings or working conditions which are unsanitary, hazardous, or dangerous to employees, and who has authorization to take prompt corrective measures to eliminate them."],
  ["qualified-person", "Qualified person", "Someone with a recognized degree, certificate or standing, or extensive knowledge and experience, who has shown they can solve problems in the subject.", "Qualified person means a person who, by possession of a recognized degree, certificate, or professional standing, or who by extensive knowledge, training and experience, successfully demonstrated the ability to solve/resolve problems relating to the subject matter, the work, or the project."],
  ["fall-zone", "Fall zone", "The area where suspended materials could foreseeably fall in an accident, including directly under the load.", "Fall zone means the area (including but not limited to the area directly beneath the load) in which it is reasonably foreseeable that partially or completely suspended materials could fall in the event of an accident."],
  ["rated-capacity", "Rated capacity", "The most the manufacturer allows the crane to lift in a given configuration, radius and boom length.", "Rated capacity means the maximum working load permitted by the manufacturer under specified working conditions. Such working conditions typically include a specific combination of factors such as equipment configuration, radii, boom length, and other parameters of use."],
  ["encroachment", "Encroachment", "Any part of the crane, load line or load getting closer to a power line than the required clearance.", "Encroachment is where any part of the crane, load line or load (including rigging and lifting accessories) breaches a minimum clearance distance that this subpart requires to be maintained from a power line."],
  ["operational-aids", "Operational aids", "Devices that give the operator information or take control of a crane function to help operate safely.", "Operational aids are devices that assist the operator in the safe operation of the crane by providing information or automatically taking control of a crane function."],
  ["range-control-warning-device", "Range control warning device", "A device the operator sets to warn when the boom or jib tip reaches a set plane.", "Range control warning device is a device that can be set by an equipment operator to warn that the boom or jib tip is at a plane or multiple planes."],
  ["tagline", "Tagline", "A rope, usually fiber, used to control a load's spin and swing.", "Tagline means a rope (usually fiber) attached to a lifted load for purposes of controlling load spinning and pendular motions or used to stabilize a bucket or magnet during material handling operations."],
].map(([term_id, term, definition, quote]) => ({ term_id, term, definition, section_id: D, quote }));

export const facts = [
  { fact_id: "tablea-50", section_id: S1408, kind: "clearance", statement: "Lines up to 50 kV: at least 10 feet.", quote: "up to 50 10", value: "10", unit: "ft" },
  { fact_id: "20ft-check", section_id: "29cfr1926.1408(a)(2)", kind: "clearance", statement: "Up to 350 kV: if anything could get within 20 feet of a power line, choose Option 1, 2 or 3.", quote: "could get closer than 20 feet to a power line", value: "20", unit: "ft" },
  { fact_id: "50ft-over-350", section_id: S1409A, kind: "clearance", statement: "Over 350 kV up to 1,000 kV, every 20 feet in the power line rules becomes 50 feet.", quote: Q1409A, value: "50", unit: "ft" },
  { fact_id: "stop-signal", section_id: "29cfr1926.1417(y)", kind: "requirement", statement: "Obey any stop signal, whoever gives it.", quote: "The operator must obey a stop (or emergency stop) signal, irrespective of who gives it.", value: null, unit: null },
];

export const explanations = [
  { section_id: S1408, level: "trainee", body: "Before work starts, get the line's voltage and find out whether any part of the crane, the load line or the load could get within 20 feet of it (50 feet if the line is over 350 kV). If it could, the line is either deenergized and grounded, or you keep a set distance from it with planned precautions. Table A gives that distance by voltage." },
  { section_id: S1408, level: "operator", body: "Work zone and voltage first, then the 20-foot test (50 feet over 350 to 1,000 kV, 1926.1409), then one of three options: deenergize and ground, hold that 20 or 50 feet, or hold the Table A distance for the line's voltage. Options 2 and 3 bring the paragraph (b) precautions: planning meeting, non-conductive tag lines, an elevated warning line or barricade, and at least one more measure such as a dedicated spotter." },
  { section_id: S1408, level: "inspector", body: "Check the employer's work zone definition, the voltage determination from the utility, the option chosen and the paragraph (b) measures actually in place. A warning line the operator cannot see requires a dedicated spotter in addition to another (b)(4) measure." },
  { section_id: "29cfr1926.1412", level: "trainee", body: "A competent person looks the crane over before or during every shift. If something looks wrong, they decide whether it is a safety hazard. If it is, the crane is out of service until it is fixed." },
  { section_id: "29cfr1926.1412", level: "operator", body: "Shift inspection is visual: controls, drives, pressurized lines, hydraulic level, hooks and latches, reeving, wire rope, electrical, tires, ground, level, cab glass, rails and safety devices. Safety device and operational aid problems follow 1926.1415 and 1926.1416 before use." },
  { section_id: "29cfr1926.1412", level: "inspector", body: "Shift, monthly and annual inspections build on the same item list. The annual inspection is by a qualified person and uses the corrective actions of (f)(4) through (f)(6) in place of (d)(2) and (d)(3)." },
];

export const lessons = [
  {
    lesson_id: "power-lines-basics", topic_id: "power-lines", ord: 1, title: "The 20-foot question",
    body: [
      T("Every lift near overhead lines starts with one question: could any part of the crane, load line or load get within 20 feet of the line?"),
      Q("29cfr1926.1408(a)(2)", "Determine if any part of the equipment, load line or load (including rigging and lifting accessories), if operated up to the equipment's maximum working radius in the work zone, could get closer than 20 feet to a power line."),
      C("29cfr1926.1408(a)(2)"),
      T("That is the test up to 350 kV. For a line over 350 kV up to 1,000 kV, the 20 feet becomes 50 feet. So get the voltage from the utility first."),
      Q(S1409A, Q1409A),
      C(S1409A),
      T("The work zone is either a marked boundary the operator may not cross, or the full circle around the crane out to its maximum working radius."),
      Q("29cfr1926.1408(a)(1)(ii)", "Defining the work zone as the area 360 degrees around the equipment, up to the equipment's maximum working radius."),
      C("29cfr1926.1408(a)(1)(ii)"),
      T("If the answer is yes, pick one of three options: deenergize and ground the line, keep 20 feet (50 feet over 350 kV), or keep the Table A distance for the line's voltage."),
      C("29cfr1926.1408(a)(2)(i)"),
      C("29cfr1926.1408(a)(2)(ii)"),
      C("29cfr1926.1408(a)(2)(iii)"),
    ],
  },
  {
    lesson_id: "power-lines-table-a", topic_id: "power-lines", ord: 2, title: "Reading Table A",
    body: [
      T("Table A sets the minimum clearance by nominal voltage. The upper number in each band is included."),
      Q(S1408, "Note: The value that follows “to” is up to and includes that value. For example, over 50 to 200 means up to and including 200kV."),
      C(S1408),
      T("So a 200 kV line needs 15 feet, and a 201 kV line needs 20 feet. Above 1,000 kV, the distance is set by the utility owner/operator or a registered professional engineer."),
      { t: "diagram", diagram_id: "clearance-bands" },
    ],
  },
  {
    lesson_id: "shift-inspection", topic_id: "inspections", ord: 1, title: "The shift inspection",
    body: [
      T("A competent person starts a visual inspection before each shift. It can finish during the shift, and it is observation only."),
      Q("29cfr1926.1412(d)(1)", "A competent person must begin a visual inspection prior to each shift the equipment will be used, which must be completed before or during that shift."),
      C("29cfr1926.1412(d)(1)"),
      T("When something is found, the competent person decides right away whether it is a safety hazard."),
      Q("29cfr1926.1412(d)(2)", "If the deficiency is determined to constitute a safety hazard, the equipment must be taken out of service until it has been corrected."),
      C("29cfr1926.1412(d)(2)"),
    ],
  },
  {
    lesson_id: "signal-person", topic_id: "signals", ord: 1, title: "When you need a signal person",
    body: [
      T("Three situations require a signal person."),
      Q("29cfr1926.1419(a)(1)", "The point of operation, meaning the load travel or the area near or at load placement, is not in full view of the operator."),
      Q("29cfr1926.1419(a)(2)", "When the equipment is traveling, the view in the direction of travel is obstructed."),
      Q("29cfr1926.1419(a)(3)", "Due to site specific safety concerns, either the operator or the person handling the load determines that it is necessary."),
      C("29cfr1926.1419(a)"),
      T("And one rule holds whoever is signaling: stop means stop."),
      Q("29cfr1926.1417(y)", "The operator must obey a stop (or emergency stop) signal, irrespective of who gives it."),
      C("29cfr1926.1417(y)"),
    ],
  },
];

export const diagrams = [
  {
    diagram_id: "clearance-bands",
    caption: "Table A minimum clearance by voltage band. The top of each band is included.",
    alt: "Bar chart: up to 50 kV, 10 ft; over 50 to 200 kV, 15 ft; over 200 to 350 kV, 20 ft; over 350 to 500 kV, 25 ft; over 500 to 750 kV, 35 ft; over 750 to 1,000 kV, 45 ft.",
    section_ids: [S1408],
    svg: (() => {
      const rows = [["up to 50 kV", 10], ["50 to 200", 15], ["200 to 350", 20], ["350 to 500", 25], ["500 to 750", 35], ["750 to 1,000", 45]];
      const bars = rows.map(([label, ft], i) => {
        const y = 12 + i * 34;
        const w = ft * 7;
        return `<text x="0" y="${y + 17}" class="dg-label">${label}</text><rect x="104" y="${y}" width="${w}" height="24" rx="4" class="dg-bar"/><text x="${112 + w}" y="${y + 17}" class="dg-value">${ft} ft</text>`;
      }).join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 216" role="img">${bars}</svg>`;
    })(),
  },
];

/** mc question helper: [stem, choices, answerIndex, rationales, section_ids, difficulty]. */
const mc = (q_id, skill_id, stem, choices, answer, rationales, section_ids, difficulty, variant_of = null) => ({
  q_id, skill_id, variant_of, kind: "mc", stem, choices, answer: String(answer), rationales, section_ids, difficulty,
});

export const questions = [
  mc("q.pl.20ft", "pl.zone", "Before operations near a 138 kV power line, what distance triggers the choice of Option 1, 2 or 3?", ["10 feet", "15 feet", "20 feet", "50 feet"], 2,
    ["10 feet is the Table A distance for lines up to 50 kV, not the trigger.", "15 feet is the Table A distance for over 50 to 200 kV.", "Correct. Up to 350 kV, if anything could get closer than 20 feet, one of the three options is required.", "50 feet replaces 20 feet only for lines over 350 kV (1926.1409(a))."], ["29cfr1926.1408(a)(2)", S1409A], 0.3),
  mc("q.pl.50ft", "pl.zone", "Before operations near a 500 kV power line, what distance triggers the choice of Option 1, 2 or 3?", ["20 feet", "25 feet", "45 feet", "50 feet"], 3,
    ["20 feet is the trigger only up to 350 kV.", "25 feet is the Table A clearance for over 350 to 500 kV, not the trigger.", "45 feet is the Table A clearance for over 750 to 1,000 kV.", "Correct. Over 350 kV up to 1,000 kV, every 20 feet becomes 50 feet."], [S1409A, "29cfr1926.1408(a)(2)"], 0.5, "q.pl.20ft"),
  mc("q.pl.20ft.v1", "pl.zone", "The employer finds the load line could come within 18 feet of a 69 kV line at maximum working radius. What is required?", ["Nothing; 18 feet is enough", "Meet Option 1, 2 or 3", "Only a planning meeting", "Lower the boom and proceed"], 1,
    ["18 feet is inside the 20-foot test.", "Correct. Closer than 20 feet means Option 1, 2 or 3.", "A planning meeting is one of the paragraph (b) precautions, not the whole requirement.", "Lowering the boom does not satisfy the rule by itself."], ["29cfr1926.1408(a)(2)"], 0.4, "q.pl.20ft"),
  mc("q.pl.zone", "pl.zone", "One way to define the work zone is the area 360 degrees around the equipment out to:", ["50 feet", "the boom tip at minimum radius", "the equipment's maximum working radius", "the nearest power line"], 2,
    ["No fixed distance is used.", "Minimum radius would understate the zone.", "Correct.", "The line is what is assessed against the zone, not its edge."], ["29cfr1926.1408(a)(1)(ii)"], 0.35),
  mc("q.pl.zone.v1", "pl.zone", "Demarcating work zone boundaries can be done with:", ["flags or a range limit device", "a verbal reminder", "the load chart", "outrigger pads"], 0,
    ["Correct. Flags, a range limit device or a range control warning device.", "A reminder does not mark a boundary.", "The load chart sets capacity, not the zone.", "Pads support the crane."], ["29cfr1926.1408(a)(1)(i)"], 0.4, "q.pl.zone"),
  mc("q.pl.ta.50", "pl.tablea", "Under Table A, what is the minimum clearance distance for a 45 kV line?", ["10 feet", "15 feet", "20 feet", "25 feet"], 0,
    ["Correct. Up to 50 kV: 10 feet.", "15 feet is for over 50 to 200 kV.", "20 feet is for over 200 to 350 kV.", "25 feet is for over 350 to 500 kV."], [S1408], 0.3),
  mc("q.pl.ta.200", "pl.tablea", "A line is exactly 200 kV. What does Table A require?", ["10 feet", "15 feet", "20 feet", "25 feet"], 1,
    ["10 feet is up to 50 kV.", "Correct. The value after \"to\" is included, so 200 kV falls in over 50 to 200.", "20 feet starts above 200 kV.", "25 feet is over 350 to 500 kV."], [S1408], 0.55, "q.pl.ta.50"),
  mc("q.pl.ta.345", "pl.tablea", "What is the Table A clearance for a 345 kV line?", ["15 feet", "20 feet", "25 feet", "35 feet"], 1,
    ["15 feet is for over 50 to 200 kV.", "Correct. Over 200 to 350 kV: 20 feet.", "25 feet is over 350 to 500 kV.", "35 feet is over 500 to 750 kV."], [S1408], 0.45, "q.pl.ta.50"),
  mc("q.pl.ta.765", "pl.tablea", "What is the Table A clearance for a 765 kV line?", ["25 feet", "35 feet", "45 feet", "Set by the utility"], 2,
    ["25 feet is over 350 to 500 kV.", "35 feet is over 500 to 750 kV.", "Correct. Over 750 to 1,000 kV: 45 feet.", "That applies over 1,000 kV."], [S1408], 0.6),
  mc("q.pl.ta.1100", "pl.tablea", "Who sets the clearance for a line over 1,000 kV?", ["The operator", "The utility owner/operator or a registered professional engineer who is a qualified person", "The signal person", "It is always 50 feet"], 1,
    ["The operator does not set it.", "Correct.", "The signal person does not set it.", "No fixed value is given."], [S1408], 0.65, "q.pl.ta.765"),
  mc("q.pl.tagline", "pl.precautions", "If tag lines are used during Option 2 or Option 3 work near power lines, they must be:", ["fiber", "non-conductive", "at least 20 feet long", "bright orange"], 1,
    ["Fiber can conduct when wet or dirty; the rule says non-conductive.", "Correct.", "No length is set.", "No color is set."], ["29cfr1926.1408(b)(2)"], 0.35),
  mc("q.pl.warning", "pl.precautions", "The operator cannot see the elevated warning line. What else is required?", ["Nothing more", "A dedicated spotter, plus one other listed measure", "Only a horn", "A second operator"], 1,
    ["The rule adds a spotter when the line is not visible.", "Correct.", "A horn is not listed.", "Not required."], ["29cfr1926.1408(b)(3)"], 0.6),
  mc("q.pl.meeting", "pl.precautions", "Who attends the planning meeting for power line precautions?", ["Only the operator", "The operator and other workers who will be in the area of the equipment or load", "The utility only", "The crane owner only"], 1,
    ["Others in the area attend too.", "Correct.", "The utility is not named for this meeting.", "Not as stated."], ["29cfr1926.1408(b)(1)"], 0.4),
  mc("q.insp.who", "insp.shift", "Who performs the shift inspection?", ["Any crew member", "A competent person", "A qualified person only", "The manufacturer"], 1,
    ["The rule names a competent person.", "Correct.", "The annual inspection uses a qualified person.", "Not required."], ["29cfr1926.1412(d)(1)"], 0.3),
  mc("q.insp.when", "insp.shift", "When must the shift inspection be completed?", ["Before the first lift of the week", "Before or during that shift", "Within 24 hours", "At the end of the shift"], 1,
    ["It is every shift.", "Correct. It begins before the shift and is completed before or during it.", "Not a 24-hour window.", "It begins before the shift."], ["29cfr1926.1412(d)(1)"], 0.4, "q.insp.who"),
  mc("q.insp.hooks", "insp.shift", "In the shift inspection, hooks and latches are checked for:", ["paint condition", "deformation, cracks, excessive wear, or damage such as from chemicals or heat", "manufacturer date", "weight"], 1,
    ["Paint is not listed.", "Correct.", "Not listed.", "Not listed."], ["29cfr1926.1412(d)(1)(v)"], 0.45),
  mc("q.insp.level", "insp.shift", "The equipment's level position is checked:", ["once a month", "before each shift and after each move and setup", "only after a move", "only at assembly"], 1,
    ["It is part of every shift inspection.", "Correct.", "Also before each shift.", "Not only at assembly."], ["29cfr1926.1412(d)(1)(xi)"], 0.5),
  mc("q.insp.hazard", "insp.deficiency", "A shift inspection finds a deficiency that is a safety hazard. What happens?", ["Note it and keep working", "Take the equipment out of service until it has been corrected", "Reduce the load by half", "Report it at the annual inspection"], 1,
    ["Not allowed for a safety hazard.", "Correct.", "Derating is not the rule here.", "It must be acted on now."], ["29cfr1926.1412(d)(2)"], 0.35),
  mc("q.insp.aids", "insp.deficiency", "A shift inspection finds an operational aid not working. Which sections govern what to do before use?", ["1926.1415 and 1926.1416", "1926.1408 and 1926.1409", "1926.1419 only", "None"], 0,
    ["Correct.", "Those are power line sections.", "That is signals.", "The rule names 1926.1415 and 1926.1416."], ["29cfr1926.1412(d)(3)"], 0.6),
  mc("q.insp.monthly", "insp.periodic", "The monthly inspection follows the procedure of:", ["the annual inspection", "the shift inspection, paragraph (d)", "the manufacturer only", "the assembly inspection"], 1,
    ["Annual is a separate, qualified-person inspection.", "Correct.", "Not as stated.", "Not as stated."], ["29cfr1926.1412(e)(1)"], 0.45),
  mc("q.insp.annual", "insp.periodic", "How often is the annual/comprehensive inspection, and by whom?", ["Every 6 months, competent person", "At least every 12 months, qualified person", "Every 24 months, manufacturer", "Each shift, operator"], 1,
    ["Wrong interval and person.", "Correct.", "Wrong interval.", "That is the shift inspection."], ["29cfr1926.1412(f)(1)"], 0.4),
  mc("q.ground.reqs", "ground.reqs", "Before the crane is assembled or used, ground conditions must be:", ["dry", "firm, drained, and graded", "paved", "level within 5 degrees"], 1,
    ["Dry is not the test.", "Correct, to the extent needed to meet the manufacturer's support specifications.", "Paving is not required.", "No such tolerance in this rule."], ["29cfr1926.1402(b)"], 0.3),
  mc("q.ground.def", "ground.reqs", "\"Supporting materials\" include:", ["blocking, mats, cribbing, marsh buggies", "outrigger cylinders", "counterweights", "the boom foot"], 0,
    ["Correct.", "Part of the crane.", "Part of the crane.", "Part of the crane."], ["29cfr1926.1402(a)(2)"], 0.3),
  mc("q.ground.who", "ground.reqs", "Who must ensure the ground preparations are provided?", ["The operator", "The controlling entity", "The signal person", "The rigger"], 1,
    ["Not as stated.", "Correct.", "Not as stated.", "Not as stated."], ["29cfr1926.1402(c)(1)"], 0.5),
  mc("q.sig.view", "sig.when", "A signal person must be provided when:", ["the load is over 10 tons", "the point of operation is not in full view of the operator", "it is windy", "the crane is new"], 1,
    ["No weight trigger.", "Correct.", "Not one of the listed situations.", "Not listed."], ["29cfr1926.1419(a)(1)"], 0.3),
  mc("q.sig.travel", "sig.when", "Which situation requires a signal person?", ["Traveling with the view in the direction of travel obstructed", "Any travel", "Night work only", "Lifts over 50 feet"], 0,
    ["Correct.", "Only when the view is obstructed.", "Not listed.", "Not listed."], ["29cfr1926.1419(a)(2)"], 0.4, "q.sig.view"),
  mc("q.sig.types", "sig.types", "Signals to operators must be by:", ["hand only", "hand, voice, audible, or new signals", "radio only", "horn only"], 1,
    ["Other types are allowed.", "Correct.", "Too narrow.", "Too narrow."], ["29cfr1926.1419(b)"], 0.35),
  mc("q.sig.stop", "sig.types", "Who may give a stop signal the operator must obey?", ["Only the signal person", "Only the lift director", "Anyone", "Only a competent person"], 2,
    ["Anyone.", "Anyone.", "Correct. Irrespective of who gives it.", "Anyone."], ["29cfr1926.1417(y)"], 0.3),
  mc("q.sig.standard", "sig.types", "When using hand signals, which method must be used?", ["Any agreed method", "The Standard Method in Appendix A", "The manufacturer's", "The signal person's own"], 1,
    ["Non-standard signals are the exception, agreed in advance.", "Correct.", "Not as stated.", "Not as stated."], ["29cfr1926.1419(c)(1)"], 0.35),
  mc("q.ops.capacity", "ops.capacity", "The equipment must not be operated:", ["in excess of its rated capacity", "above 75% of capacity", "at full capacity", "without a second operator"], 0,
    ["Correct.", "No such limit here.", "Rated capacity is allowed.", "Not required."], ["29cfr1926.1417(o)(1)"], 0.25),
  mc("q.ops.wind", "ops.capacity", "Who adjusts equipment and operations for wind, ice, and snow?", ["The competent person", "The signal person", "The owner", "Nobody; the chart covers it"], 0,
    ["Correct.", "Not as stated.", "Not as stated.", "The rule requires an adjustment."], ["29cfr1926.1417(n)"], 0.45),
  mc("q.ops.fallzone", "ops.zones", "While the operator is not moving a suspended load, who may be in the fall zone?", ["Anyone wearing a hard hat", "No employee, except the listed exceptions", "Only riggers", "Anyone more than 10 feet away"], 1,
    ["PPE is not the test.", "Correct.", "Only specific listed tasks.", "Not as stated."], ["29cfr1926.1425(b)"], 0.5),
  mc("q.ops.swing", "ops.zones", "To keep workers out of the swing radius hazard areas, the employer must train authorized personnel to recognize:", ["struck-by and pinch/crush hazard areas", "load chart notes", "power line voltages", "radio channels"], 0,
    ["Correct.", "Not this rule.", "Not this rule.", "Not this rule."], ["29cfr1926.1424(a)(2)(i)"], 0.45),
  mc("q.lc.rated", "lc.read", "Rated capacity depends on a combination of factors such as:", ["equipment configuration, radii, boom length", "paint and age", "operator's experience", "time of day"], 0,
    ["Correct.", "Not listed.", "Not listed.", "Not listed."], [D], 0.3),
];

/** Baked answers. level null = all roles; a level-specific answer wins for that role. */
export const answers = [
  {
    answer_id: "a.powerline-clearance", question: "How close can I get to a power line?", level: null,
    aliases: ["power line clearance", "50 foot rule", "over 350 kv", "how far from power lines", "minimum distance from power lines", "clearance from energized lines", "how close to power lines", "distance from overhead lines", "20 foot rule", "i need to learn about clearance"],
    body: [
      T("Get the line's voltage first. Then the 20-foot test: if any part of the crane, load line or load could get closer than 20 feet at maximum working radius, you need one of three options."),
      Q("29cfr1926.1408(a)(2)", "could get closer than 20 feet to a power line. If so, the employer must meet the requirements in Option (1), Option (2), or Option (3) of this section"),
      C("29cfr1926.1408(a)(2)"),
      T("Over 350 kV up to 1,000 kV, the test is 50 feet."),
      Q(S1409A, Q1409A),
      C(S1409A),
      T("Option 3 uses Table A, by voltage."),
      { t: "diagram", diagram_id: "clearance-bands" },
      Q(S1408, "Note: The value that follows “to” is up to and includes that value."),
      C(S1408),
      T("Above 1,000 kV, the distance is set by the utility owner/operator or a registered professional engineer."),
    ],
  },
  {
    answer_id: "a.powerline-clearance.trainee", question: "How close can I get to a power line?", level: "trainee",
    aliases: [],
    body: [
      T("The rule starts at 20 feet. If any part of the crane, the load line or the load could come within 20 feet of a line, special steps are required before work starts."),
      Q("29cfr1926.1408(a)(2)", "could get closer than 20 feet to a power line"),
      C("29cfr1926.1408(a)(2)"),
      T("For a line over 350 kV, that 20 feet becomes 50 feet."),
      Q(S1409A, Q1409A),
      C(S1409A),
      T("One option uses Table A, which sets a distance by the line's voltage."),
      { t: "diagram", diagram_id: "clearance-bands" },
      C(S1408),
      T("Never guess the voltage. The utility confirms it."),
    ],
  },
  {
    answer_id: "a.warning-line", question: "What precautions are needed if I use the 20-foot or Table A option?", level: null,
    aliases: ["encroachment precautions", "power line precautions", "option 2 precautions", "warning line power line", "dedicated spotter"],
    body: [
      T("All of paragraph (b) applies: a planning meeting, non-conductive tag lines, and an elevated warning line or barricade the operator can see."),
      Q("29cfr1926.1408(b)(1)", "Conduct a planning meeting with the operator and the other workers who will be in the area of the equipment or load"),
      Q("29cfr1926.1408(b)(2)", "If tag lines are used, they must be non-conductive."),
      Q("29cfr1926.1408(b)(3)", "If the operator is unable to see the elevated warning line, a dedicated spotter must be used"),
      C("29cfr1926.1408(b)"),
      T("Then add at least one measure from (b)(4), such as a dedicated spotter in continuous contact with the operator."),
      C("29cfr1926.1408(b)(4)"),
    ],
  },
  {
    answer_id: "a.shift-inspection", question: "What does the shift inspection cover?", level: null,
    aliases: ["daily inspection", "shift inspection", "pre-shift inspection", "what do I inspect before a shift", "each shift inspection", "frequent inspection"],
    body: [
      T("A competent person begins a visual inspection before each shift and completes it before or during the shift."),
      Q("29cfr1926.1412(d)(1)", "A competent person must begin a visual inspection prior to each shift the equipment will be used, which must be completed before or during that shift."),
      C("29cfr1926.1412(d)(1)"),
      T("The list runs from control mechanisms through hooks, wire rope, tires, ground conditions and level, to safety devices and operational aids."),
      Q("29cfr1926.1412(d)(1)(v)", "Hooks and latches for deformation, cracks, excessive wear, or damage such as from chemicals or heat."),
      Q("29cfr1926.1412(d)(1)(xiv)", "Safety devices and operational aids for proper operation."),
      C("29cfr1926.1412(d)"),
      T("Open the shift inspection under Do to walk it step by step."),
    ],
  },
  {
    answer_id: "a.deficiency", question: "What happens if the inspection finds a deficiency?", level: null,
    aliases: ["found a deficiency", "inspection deficiency", "take crane out of service", "out of service", "crane failed inspection"],
    body: [
      T("The competent person decides right away whether it is a safety hazard. If it is, the crane is out of service until it is fixed."),
      Q("29cfr1926.1412(d)(2)", "an immediate determination must be made by the competent person as to whether the deficiency constitutes a safety hazard. If the deficiency is determined to constitute a safety hazard, the equipment must be taken out of service until it has been corrected."),
      C("29cfr1926.1412(d)(2)"),
      T("Safety devices and operational aids follow their own sections before use."),
      C("29cfr1926.1412(d)(3)"),
    ],
  },
  {
    answer_id: "a.signal-person", question: "When is a signal person required?", level: null,
    aliases: ["need a signal person", "signalman required", "when do I need a signal person", "signal person rules", "blind lift"],
    body: [
      T("In three situations."),
      Q("29cfr1926.1419(a)(1)", "The point of operation, meaning the load travel or the area near or at load placement, is not in full view of the operator."),
      Q("29cfr1926.1419(a)(2)", "When the equipment is traveling, the view in the direction of travel is obstructed."),
      Q("29cfr1926.1419(a)(3)", "Due to site specific safety concerns, either the operator or the person handling the load determines that it is necessary."),
      C("29cfr1926.1419(a)"),
    ],
  },
  {
    answer_id: "a.stop-signal", question: "Who can give a stop signal?", level: null,
    aliases: ["stop signal", "emergency stop", "who can stop the crane", "stop signal who"],
    body: [
      T("Anyone. The operator obeys it."),
      Q("29cfr1926.1417(y)", "The operator must obey a stop (or emergency stop) signal, irrespective of who gives it."),
      C("29cfr1926.1417(y)"),
    ],
  },
  {
    answer_id: "a.ground", question: "What ground conditions are required?", level: null,
    aliases: ["ground conditions", "ground prep", "soft ground", "cribbing", "mats under outriggers", "set up on soft soil"],
    body: [
      T("The ground must be firm, drained and graded enough, with supporting materials if needed, to meet the manufacturer's support and leveling specifications."),
      Q("29cfr1926.1402(b)", "The equipment must not be assembled or used unless ground conditions are firm, drained, and graded to a sufficient extent"),
      C("29cfr1926.1402(b)"),
      T("Supporting materials include blocking, mats and cribbing."),
      Q("29cfr1926.1402(a)(2)", "“Supporting materials” means blocking, mats, cribbing, marsh buggies (in marshes/wetlands), or similar supporting materials or devices."),
      C("29cfr1926.1402(a)(2)"),
    ],
  },
  {
    answer_id: "a.rated-capacity", question: "Can I lift more than the rated capacity?", level: null,
    aliases: ["rated capacity", "over capacity", "exceed load chart", "overload the crane", "how much can I lift"],
    body: [
      T("No."),
      Q("29cfr1926.1417(o)(1)", "The equipment must not be operated in excess of its rated capacity."),
      C("29cfr1926.1417(o)(1)"),
      T("Rated capacity depends on the configuration, radius and boom length in use, so read it from the chart for the exact setup."),
      Q(D, "Such working conditions typically include a specific combination of factors such as equipment configuration, radii, boom length, and other parameters of use."),
      C(D),
    ],
  },
  {
    answer_id: "a.wind", question: "What about wind?", level: null,
    aliases: ["wind", "wind speed", "high wind", "ice and snow", "weather limits"],
    body: [
      T("The competent person adjusts the equipment or the operation for wind, ice and snow. The manufacturer's limits for the crane apply."),
      Q("29cfr1926.1417(n)", "The competent person must adjust the equipment and/or operations to address the effect of wind, ice, and snow on equipment stability and rated capacity."),
      C("29cfr1926.1417(n)"),
    ],
  },
  {
    answer_id: "a.fall-zone", question: "Can anyone stand under the load?", level: null,
    aliases: ["fall zone", "under the load", "standing under a suspended load", "keep clear of the load"],
    body: [
      T("While the operator is not moving the load, no employee may be in the fall zone except for the tasks the rule lists."),
      Q("29cfr1926.1425(b)", "While the operator is not moving a suspended load, no employee must be within the fall zone, except for employees:"),
      C("29cfr1926.1425(b)"),
      T("The fall zone includes the area directly beneath the load."),
      Q(D, "Fall zone means the area (including but not limited to the area directly beneath the load)"),
      C(D),
    ],
  },
];

/** Starter questions shown on the Ask screen, by role. */
export const starters = {
  trainee: ["a.powerline-clearance", "a.signal-person", "a.shift-inspection", "a.fall-zone"],
  operator: ["a.powerline-clearance", "a.warning-line", "a.rated-capacity", "a.wind"],
  inspector: ["a.shift-inspection", "a.deficiency", "a.ground", "a.powerline-clearance"],
};

const step = (text, check_kind, section_ids, detail, deficiency = null) => ({ text, check_kind, section_ids, detail, deficiency });
const def = (guidance, action, section_id, quote) => ({ guidance, action, section_id, quote });
const OOS = def(
  "The competent person decides now whether this is a safety hazard.",
  "If it is a safety hazard, take the crane out of service until it is corrected.",
  "29cfr1926.1412(d)(2)",
  "If the deficiency is determined to constitute a safety hazard, the equipment must be taken out of service until it has been corrected.",
);
const sameDetail = (operator, trainee = operator, inspector = operator) => ({ trainee, operator, inspector });

export const procedures = [
  {
    proc_id: "shift-inspection", kind: "inspection", title: "Shift inspection",
    summary: "The visual inspection a competent person begins before each shift. Record each item; a deficiency gets the next step and its rule.",
    roles: ["trainee", "operator", "inspector"],
    steps: [
      step("Control mechanisms: check for maladjustments interfering with proper operation.", "pass_fail", ["29cfr1926.1412(d)(1)(i)"], sameDetail("Operate each control through its range with the engine running. Watch for sticking, lag or travel that does not match the function.", "Work each lever and pedal. Anything sticky or slow to respond is a finding."), OOS),
      step("Control and drive mechanisms: excessive wear, and contamination by lubricants, water or other foreign matter.", "pass_fail", ["29cfr1926.1412(d)(1)(ii)"], sameDetail("Look at linkages, clutches and brakes you can see without disassembly."), OOS),
      step("Air, hydraulic and other pressurized lines: deterioration or leakage, especially lines that flex.", "pass_fail", ["29cfr1926.1412(d)(1)(iii)"], sameDetail("Follow the hoses that move with the boom and outriggers. Wet spots, cracking and chafing are findings.", "Look along the hoses that bend when the boom or outriggers move. Wet or cracked hose is a finding."), OOS),
      step("Hydraulic system: proper fluid level.", "pass_fail", ["29cfr1926.1412(d)(1)(iv)"], sameDetail("Check the sight glass or dipstick in the manufacturer's stated boom position."), OOS),
      step("Hooks and latches: deformation, cracks, excessive wear, or damage from chemicals or heat.", "pass_fail", ["29cfr1926.1412(d)(1)(v)"], sameDetail("Check throat opening, twist and the latch closing fully. Compare against the manufacturer's criteria.", "Look for a bent or twisted hook and a latch that does not snap shut."), OOS),
      step("Wire rope reeving: matches the manufacturer's specifications.", "pass_fail", ["29cfr1926.1412(d)(1)(vi)"], sameDetail("Confirm parts of line and reeving pattern against the chart for today's configuration."), OOS),
      step("Wire rope: inspect in accordance with 1926.1413(a).", "pass_fail", ["29cfr1926.1412(d)(1)(vii)", "29cfr1926.1413(a)(1)"], sameDetail("Running and standing ropes likely to be used this shift. Look for broken wires, kinks, crushing and corrosion."), def(
        "Wire rope findings follow the removal-from-service rules in 1926.1413(a)(4). The competent person decides at once whether it is a safety hazard.",
        "If it is, do not use that rope until the conditions in 1926.1413(a)(4) are met.",
        "29cfr1926.1413(a)(4)(i)",
        "an immediate determination must be made by the competent person as to whether the deficiency constitutes a safety hazard",
      )),
      step("Electrical apparatus: malfunction, excessive deterioration, dirt or moisture.", "pass_fail", ["29cfr1926.1412(d)(1)(viii)"], sameDetail("Lights, horn, gauges and switches work; no moisture in panels."), OOS),
      step("Tires (when in use): proper inflation and condition.", "value", ["29cfr1926.1412(d)(1)(ix)"], sameDetail("Record the lowest tire pressure you measured, in psi. Compare with the manufacturer's value.", "Write down the lowest tire pressure you read, in psi."), OOS),
      step("Ground conditions around the equipment: proper support, settling under outriggers, standing water.", "pass_fail", ["29cfr1926.1412(d)(1)(x)", "29cfr1926.1402(b)"], sameDetail("Walk each outrigger and pad. Look for settling, soft spots and water."), def(
        "Ground must support the equipment to the manufacturer's specifications.",
        "Stop and fix the support before use: mats, blocking or cribbing as needed.",
        "29cfr1926.1402(b)",
        "The equipment must not be assembled or used unless ground conditions are firm, drained, and graded to a sufficient extent",
      )),
      step("Level: within the manufacturer's tolerance, before each shift and after each move and setup.", "pass_fail", ["29cfr1926.1412(d)(1)(xi)"], sameDetail("Read the level indicator after setup; relevel after any move."), OOS),
      step("Operator cab windows: no significant cracks or breaks that hamper the view.", "pass_fail", ["29cfr1926.1412(d)(1)(xii)"], sameDetail("Check every window the operator looks through for the lift."), OOS),
      step("Safety devices and operational aids: proper operation.", "pass_fail", ["29cfr1926.1412(d)(1)(xiv)"], sameDetail("Test anti-two-block, boom angle indicator and load moment indicator per the manufacturer.", "Ask a competent person to show you how each device is tested."), def(
        "Safety device and operational aid deficiencies follow 1926.1415 and 1926.1416.",
        "Take the action in 1926.1415 and 1926.1416 before using the equipment.",
        "29cfr1926.1412(d)(3)",
        "the action specified in §§ 1926.1415 and 1926.1416 must be taken prior to using the equipment.",
      )),
      step("Notes and photos for the record.", "note", ["29cfr1926.1412(d)"], sameDetail("Anything else you saw, with photos of any finding.")),
    ],
  },
  {
    proc_id: "power-line-check", kind: "planning", title: "Power line check before operations",
    summary: "Identify the work zone, get the voltage, apply the 20-foot test (50 feet over 350 kV), choose an option and put the precautions in place.",
    roles: ["operator", "inspector", "trainee"],
    steps: [
      step("Identify the work zone: marked boundaries, or 360 degrees out to maximum working radius.", "pass_fail", ["29cfr1926.1408(a)(1)"], sameDetail("Write down which method you used."), def("The work zone must be identified before operations.", "Mark boundaries or use the full 360-degree zone.", "29cfr1926.1408(a)(1)(ii)", "Defining the work zone as the area 360 degrees around the equipment, up to the equipment's maximum working radius.")),
      step("Line voltage, confirmed with the utility (kV).", "value", ["29cfr1926.1408(a)(2)(iii)"], sameDetail("Get it from the utility before anything else. The trigger distance and the Table A clearance both depend on it; the Tools tab looks them up.")),
      step("Could any part of the equipment, load line or load get closer than 20 feet to the line (50 feet if it is over 350 kV)?", "pass_fail", ["29cfr1926.1408(a)(2)", S1409A], sameDetail("Pass means no line within 20 feet of the work zone, or 50 feet for a line over 350 kV up to 1,000 kV. A finding means one of Option 1, 2 or 3 applies. Over 1,000 kV the utility or a registered professional engineer sets the distance."), def("Inside the trigger distance (20 feet, or 50 feet over 350 kV) requires Option 1, 2 or 3.", "Deenergize and ground, keep 20 feet (50 feet over 350 kV), or keep the Table A distance with the paragraph (b) precautions.", "29cfr1926.1408(a)(2)", "could get closer than 20 feet to a power line. If so, the employer must meet the requirements in Option (1), Option (2), or Option (3) of this section")),
      step("Planning meeting held with the operator and workers in the area.", "pass_fail", ["29cfr1926.1408(b)(1)"], sameDetail("Review the line's location and the steps to prevent encroachment."), def("A planning meeting is required for Option 2 or 3.", "Hold the meeting before operations.", "29cfr1926.1408(b)(1)", "Conduct a planning meeting with the operator and the other workers who will be in the area of the equipment or load")),
      step("Tag lines, if used, are non-conductive.", "pass_fail", ["29cfr1926.1408(b)(2)"], sameDetail("Check the tag line material."), def("Conductive tag lines are not allowed here.", "Replace with non-conductive tag lines.", "29cfr1926.1408(b)(2)", "If tag lines are used, they must be non-conductive.")),
      step("Elevated warning line, barricade or line of signs in view of the operator.", "photo", ["29cfr1926.1408(b)(3)"], sameDetail("Photograph it from the operator's seat if you can.")),
    ],
  },
  {
    proc_id: "ground-check", kind: "setup", title: "Ground conditions check",
    summary: "Before assembly or use: firm, drained and graded ground, supporting materials, and known hazards below.",
    roles: ["operator", "inspector", "trainee"],
    steps: [
      step("Ground is firm, drained and graded for the manufacturer's support and leveling specifications.", "pass_fail", ["29cfr1926.1402(b)"], sameDetail("Check each outrigger location."), def("Do not assemble or use the equipment on inadequate ground.", "Prepare the ground or add supporting materials, then recheck.", "29cfr1926.1402(b)", "The equipment must not be assembled or used unless ground conditions are firm, drained, and graded to a sufficient extent")),
      step("Supporting materials in place where needed (mats, blocking, cribbing).", "photo", ["29cfr1926.1402(a)(2)"], sameDetail("Photograph each pad.")),
      step("Hazards beneath the set-up area (voids, tanks, utilities) reviewed with the controlling entity.", "pass_fail", ["29cfr1926.1402(c)(2)"], sameDetail("Ask for site drawings and soil analyses."), def("The controlling entity must share known hazards below the set-up area.", "Get the information before setup.", "29cfr1926.1402(c)(2)", "Inform the user of the equipment and the operator of the location of hazards beneath the equipment set-up area (such as voids, tanks, utilities)")),
      step("Notes.", "note", ["29cfr1926.1402"], sameDetail("Anything else about the site.")),
    ],
  },
];

/** Exam blueprint for the simulator (fixture-sized). */
export const exams = [
  {
    id: "core-practice",
    title: "Written exam practice",
    minutes: 25,
    passPercent: 70,
    domains: [
      { id: "site", title: "Site", skillIds: ["ground.reqs", "pl.zone", "pl.tablea", "pl.precautions"], count: 8 },
      { id: "ops", title: "Operations", skillIds: ["sig.when", "sig.types", "ops.capacity", "ops.zones"], count: 6 },
      { id: "tech", title: "Technical knowledge", skillIds: ["insp.shift", "insp.deficiency", "insp.periodic", "lc.read"], count: 6 },
    ],
  },
];
