"""A synthetic maintenance log for the fictional Model 40 pump fleet, with a known truth table.

    python maint/content/proof/fleet/make_fleet_logs.py [OUT_DIR]

The fleet (8 diesel and 4 electric units) works for 18 months. Its true service events follow the
pump manual's two troubleshooting trees (an action is always one the manual prints) plus routine
service the manual does not cover, with repeat discrepancies planted (the same unit and symptom
again within 30 days). Each event is written down the way shops write: two CSV exports in
different house styles, free-text shift-log and after-action narratives, and a handful of
handwriting-style scans. Noise is injected per record and labelled, in the classes a study of
maintenance-log cleaning used, so results compare in kind: identifier misalignment (another
unit's id), out-of-fleet units, invalid values, missing values, test or training records, wrong
dates; and always the abbreviations, misspellings and shorthand technicians use.

Writes: registry.json (harvest-assets/1, the fleet without events), parts.json (catalog),
logs/shop-a.csv, logs/shop-b.csv, logs/narratives.txt, logs/scans/*.png, truth.json.
Everything is invented. Deterministic (seeded).
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import random
import sys
from pathlib import Path

SEED = 40
START, END = dt.date(2025, 3, 1), dt.date(2026, 9, 30)
TECHS = ["J. Ruiz", "A. Patel", "M. Chen", "K. Osei", "D. Novak"]
UNITS = ([{"asset_id": f"unit-{100 + k}", "serial": f"P40D-{2300 + k}", "name": f"Pump {100 + k}",
           "equip_id": "model-40-diesel", "hours0": 600 + 137 * k} for k in range(1, 9)]
         + [{"asset_id": f"unit-{200 + k}", "serial": f"P40E-{1400 + k}", "name": f"Pump {200 + k}",
             "equip_id": "model-40-electric", "hours0": 900 + 211 * k} for k in range(1, 5)])
PARTS = {"P40-118": "Battery, 12 V, 100 Ah", "P40-207": "Starter relay K1", "P40-015": "Fuse F2, 15 A",
         "P40-311": "Cooling fan belt", "P40-402": "Intake strainer screen", "P40-501": "Oil filter"}

NOCRANK, HOT = "s-engine-will-not-crank", "s-pump-overheats"
# (symptom, action as the manual prints it, part, weight, diesel only, phrasings of the action)
ACTIONS = [
    (NOCRANK, "Replace starter relay K1.", "P40-207", 35, True,
     ["R&R K1", "replaced start relay K1", "changed relay K1", "K1 relay swapped out", "new start relay"]),
    (NOCRANK, "Replace the battery. Refer to task 4-3.", "P40-118", 20, True,
     ["replaced batt", "new battery installed", "R&R battery", "batt replaced, old one dead"]),
    (NOCRANK, "Charge the battery, then repeat the voltage test.", None, 20, True,
     ["charged batt, retest ok", "batt on charger overnight", "charged battery", "low batt - charged"]),
    (NOCRANK, "Turn the battery switch ON or replace fuse F2, then try to start. Does the engine crank now?", "P40-015", 15,
     True, ["F2 blown, replaced", "replaced fuse F2", "start fuse out, new F2"]),
    (NOCRANK, "Key switch or wiring fault. Refer to field maintenance for wiring repair.", None, 10, True,
     ["sent to field mx - wiring", "wiring fault, referred up", "key sw wiring bad, to field maint"]),
    (HOT, "Clean the intake strainer.", None, 45, False,
     ["cleaned strainer", "strainer clogged w/ silt, cleaned", "clnd intake strnr", "intake screen cleared"]),
    (HOT, "Adjust the belt tension.", None, 20, False, ["adj belt tension", "tightened fan belt", "belt loose - adjusted"]),
    (HOT, "Replace the cooling fan belt.", "P40-311", 25, False, ["new fan belt", "R&R fan belt", "belt broken, replaced"]),
    (HOT, "Internal cooling fault. Report to the field maintenance shop.", None, 10, False,
     ["internal cooling fault, sent to shop", "cooling internal - reported to field shop"]),
]
SYMPTOM_TEXT = {
    NOCRANK: ["no crank", "eng wont crank", "ENGINE NO CRANK", "wouldn't start - no crank", "starter does nothing",
              "dead on key", "no crnk", "would not crank on key"],
    HOT: ["running hot", "HI TEMP lamp", "overheating", "temp light on", "overheated, shut down", "temp lite on",
          "high temp shutdown"],
    None: ["PM service due", "scheduled service", "250 hr service"],
}
ROUTINE = [("oil & filter chg", "P40-501"), ("PM service, oil + filter", "P40-501"), ("greased bearings", None)]
NOISE_RATES = {"id_misalign": 0.07, "out_of_fleet": 0.03, "invalid": 0.05, "missing": 0.08, "wrong_date": 0.05}


def true_events(rng: random.Random) -> list[dict]:
    events = []
    hours = {u["asset_id"]: float(u["hours0"]) for u in UNITS}
    day = START
    while day <= END:
        for u in UNITS:
            hours[u["asset_id"]] += rng.uniform(4, 9)
        for u in UNITS:
            p = 0.022
            if rng.random() < p:
                events.append(_event(rng, u, day, hours[u["asset_id"]]))
        day += dt.timedelta(days=1)
    # repeats: the same unit and symptom again within 30 days, often after a cheap first fix
    planted = 0
    for e in list(events):
        if e["symptom_id"] and planted < 30 and rng.random() < 0.12:
            d = e["date"] + dt.timedelta(days=rng.randint(4, 26))
            if d <= END:
                u = next(x for x in UNITS if x["asset_id"] == e["asset_id"])
                h = e["hours"] + (d - e["date"]).days * 6.5
                events.append(_event(rng, u, d, h, symptom=e["symptom_id"]))
                planted += 1
    events.sort(key=lambda e: (e["date"], e["asset_id"]))
    for k, e in enumerate(events, 1):
        e["event"] = f"E{k:04d}"
    return events


def _event(rng, u, day, h, symptom=None) -> dict:
    diesel = u["equip_id"].endswith("diesel")
    if symptom is None and rng.random() < 0.15:
        text, part = rng.choice(ROUTINE)
        return {"asset_id": u["asset_id"], "date": day, "hours": round(h, 1), "symptom_id": None, "action": None,
                "part": part, "tech": rng.choice(TECHS), "action_text": text}
    opts = [a for a in ACTIONS if (symptom is None or a[0] == symptom) and (diesel or not a[4])]
    a = rng.choices(opts, weights=[x[3] for x in opts])[0]
    part = a[2] if a[2] and (a[2] != "P40-015" or rng.random() < 0.6) else None
    return {"asset_id": u["asset_id"], "date": day, "hours": round(h, 1), "symptom_id": a[0], "action": a[1],
            "part": part, "tech": rng.choice(TECHS), "action_text": rng.choice(a[5])}


def repeats(events: list[dict], window: int = 30) -> set[str]:
    """Events that repeat an earlier one: same unit, same symptom, within the window."""
    out = set()
    for e in events:
        if not e["symptom_id"]:
            continue
        for f in events:
            if f is not e and f["asset_id"] == e["asset_id"] and f["symptom_id"] == e["symptom_id"] \
                    and 0 < (e["date"] - f["date"]).days <= window:
                out.add(e["event"])
    return out


def unit_label(rng, u: dict) -> str:
    n = u["asset_id"].split("-")[1]
    return rng.choice([u["asset_id"], f"Pump {n}", n, f"#{n}", u["serial"]])


def render(rng: random.Random, events: list[dict]) -> tuple[dict, list[dict]]:
    """Write each event into one source with house style and noise; return files and the truth."""
    a_rows, b_rows, narr, scans, truth = [], [], [], [], []
    by_id = {u["asset_id"]: u for u in UNITS}
    for e in events:
        r = rng.random()
        src = "A" if r < 0.42 else "B" if r < 0.72 else "N" if r < 0.965 else "S"
        noise = [k for k, p in NOISE_RATES.items() if rng.random() < p]
        if "out_of_fleet" in noise and "id_misalign" in noise:
            noise.remove("id_misalign")
        u = by_id[e["asset_id"]]
        shown_unit, true_unit = u, e["asset_id"]
        if "id_misalign" in noise:
            shown_unit = rng.choice([x for x in UNITS if x["asset_id"] != u["asset_id"]])
        unit_txt = unit_label(rng, shown_unit)
        if "out_of_fleet" in noise:
            unit_txt = rng.choice(["unit-109", "Pump 115", "P40D-2399", "unit-310"])
            true_unit = None
        date = e["date"]
        shown_date = date
        if "wrong_date" in noise:
            if date.day <= 12 and date.day != date.month and rng.random() < 0.5:
                shown_date = dt.date(date.year, date.day, date.month)
            else:
                shown_date = dt.date(date.year + rng.choice([10, 27]), date.month, date.day)
        hours = e["hours"]
        shown_hours: float | str | None = hours
        true_hours = hours
        if "invalid" in noise:
            shown_hours = rng.choice([-hours, hours * 100, 0.0])
            true_hours = None
        missing_field = None
        if "missing" in noise:
            missing_field = rng.choice(["hours", "action", "part"]) if e["part"] else rng.choice(["hours", "action"])
        if missing_field == "hours":
            shown_hours, true_hours = None, None
        sym_txt = rng.choice(SYMPTOM_TEXT[e["symptom_id"]])
        act_txt = e["action_text"] if missing_field != "action" else ""
        part = e["part"] if missing_field != "part" else None
        true_action = e["action"] if missing_field != "action" else None
        rec = {"source": src, "event": e["event"], "noise": noise,
               "truth": {"asset_id": true_unit, "date": date.isoformat(), "hours": true_hours,
                         "symptom_id": e["symptom_id"], "action": true_action, "part": part, "tech": e["tech"]},
               "test_record": False}
        line = {"A": _row_a, "B": _row_b, "N": _narr, "S": _narr}[src](rng, unit_txt, shown_date, shown_hours, sym_txt,
                                                                         act_txt, part, e["tech"])
        {"A": a_rows, "B": b_rows, "N": narr, "S": scans}[src].append((rec, line))
        truth.append(rec)
    # test and training records, written into the same sources
    for k in range(8):
        u = rng.choice(UNITS)
        d = START + dt.timedelta(days=rng.randint(0, (END - START).days))
        src = rng.choice("ABN")
        txt = rng.choice(["TEST ENTRY - ignore", "training demo, do not use", "test record for new tablet", "TRAINING"])
        tech = rng.choice(["trainee", "J. Ruiz", "admin"])
        rec = {"source": src, "event": f"T{k + 1:03d}", "noise": ["test_record"], "truth": None, "test_record": True}
        line = {"A": _row_a, "B": _row_b, "N": _narr}[src](rng, unit_label(rng, u), d, 1000.0, txt, "", None, tech)
        {"A": a_rows, "B": b_rows, "N": narr}[src].append((rec, line))
        truth.append(rec)
    files = {}
    for name, rows, header in (("shop-a.csv", a_rows, ["Unit", "Date", "Hours", "Complaint", "Action", "Part", "Tech"]),
                               ("shop-b.csv", b_rows, ["date", "equipment", "meter_hrs", "problem / work done",
                                                       "parts used", "mechanic"])):
        rows.sort(key=lambda x: x[0]["event"])
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(header)
        for k, (rec, line) in enumerate(rows, 1):
            rec["rec_id"] = f"{name}:{k + 1}"   # line number, header is line 1
            w.writerow(line)
        files[name] = buf.getvalue()
    narr.sort(key=lambda x: x[0]["event"])
    blocks = []
    for k, (rec, text) in enumerate(narr, 1):
        rec["rec_id"] = f"narratives.txt:{k}"
        blocks.append(text)
    files["narratives.txt"] = "\n\n".join(blocks) + "\n"
    for k, (rec, text) in enumerate(scans, 1):
        rec["rec_id"] = f"scans/scan-{k:02d}.png"
        files[f"scans/scan-{k:02d}.png"] = text
    return files, truth


def _hours(h) -> str:
    return "" if h is None else (f"{h:.0f}" if isinstance(h, float) else str(h))


def _row_a(rng, unit, d, h, sym, act, part, tech):
    return [unit, d.strftime("%m/%d/%Y"), _hours(h), sym, act, part or "", tech]


def _row_b(rng, unit, d, h, sym, act, part, tech):
    work = f"{sym}; {act}" if act else sym
    return [d.isoformat(), unit, (_hours(h) + " hrs") if h is not None else "", work, part or "",
            tech.split()[-1].upper() if " " in tech else tech]


def _narr(rng, unit, d, h, sym, act, part, tech):
    initials = "".join(w[0] for w in tech.replace(".", "").split())
    style = rng.choice(["shift", "aar"])
    hrs = f" {_hours(h)} hrs." if h is not None else ""
    pt = f" ({part})" if part else ""
    if style == "shift":
        return f"{d.strftime('%d %b %y')} - {unit}: {sym}. {act}{pt}.{hrs} -{initials}".replace("..", ".")
    return (f"After action, {d.strftime('%d %B %Y')}. {unit} reported {sym}. {act or 'No action recorded'}{pt}."
            f"{hrs} Reported by {tech}.").replace("..", ".")


def scan_png(text: str, rng: random.Random) -> bytes:
    """A handwriting-style note photographed slightly skewed (a system handwriting font when present)."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    font = None
    for f in ("/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf", "/System/Library/Fonts/Noteworthy.ttc",
              "/System/Library/Fonts/MarkerFelt.ttc"):
        try:
            font = ImageFont.truetype(f, 34)
            break
        except OSError:
            continue
    font = font or ImageFont.load_default()
    img = Image.new("L", (1700, 360), 245)
    dr = ImageDraw.Draw(img)
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) > 70:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    lines.append(cur)
    for k, ln in enumerate(lines):
        dr.text((40 + rng.randint(-6, 6), 40 + k * 60), ln, fill=30, font=font)
    img = img.rotate(rng.uniform(-1.5, 1.5), fillcolor=245, expand=False).filter(ImageFilter.GaussianBlur(0.6))
    b = io.BytesIO()
    img.save(b, "PNG", optimize=True)
    return b.getvalue()


def main(argv=None) -> int:
    out = Path((argv or sys.argv[1:] or [Path(__file__).resolve().parent])[0])
    rng = random.Random(SEED)
    events = true_events(rng)
    files, truth = render(rng, events)
    rep = repeats(events)
    for rec in truth:
        rec["repeat"] = rec["event"] in rep
    (out / "logs" / "scans").mkdir(parents=True, exist_ok=True)
    for old in (out / "logs" / "scans").glob("scan-*.png"):   # this script owns the folder
        old.unlink()
    for name, content in files.items():
        p = out / "logs" / name
        if name.endswith(".png"):
            p.write_bytes(scan_png(content, rng))
        else:
            p.write_text(content)
    reg = {"format": "harvest-assets/1", "assets": [
        {"asset_id": u["asset_id"], "equip_id": u["equip_id"], "serial": u["serial"], "name": u["name"],
         "attrs": {}, "hours": None, "events": []} for u in UNITS]}
    (out / "registry.json").write_text(json.dumps(reg, indent=1) + "\n")
    (out / "parts.json").write_text(json.dumps(PARTS, indent=1) + "\n")
    (out / "truth.json").write_text(json.dumps({"format": "maint-log-truth/1", "events": len(events),
                                                "records": truth}, indent=1, default=str) + "\n")
    from collections import Counter
    c = Counter(n for r in truth for n in r["noise"])
    print(f"{len(events)} events, {len(truth)} records, sources {dict(Counter(r['source'] for r in truth))}, "
          f"noise {dict(c)}, repeats {sum(r['repeat'] for r in truth)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
