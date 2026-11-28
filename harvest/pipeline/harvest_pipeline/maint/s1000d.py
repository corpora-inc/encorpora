"""S1000D data modules -> the same structure the page extraction returns, by the schema, no model.

A data module is already structured, so this is a mapping, not an extraction. Each module becomes a
virtual page model: one region per text-bearing element in document order (its words are the
element's text, so spans verify exactly as on a PDF page), and its structure is derived from the
elements:

  fault isolation (`faultIsolation`): `isolationStep` with an `action` and one plain choice is the
      symptom; with an `isolationStepQuestion` it is a check; `yesNoAnswer` gives Yes/No branches
      and `listOfChoices` choice branches, each by `nextActionRefId`; `isolationProcedureEnd` is an
      action (or escalate / end, by the same wording rules as pages); `warningRefs` /
      `cautionRefs` on the procedure guard the tree;
  procedural (`procedure`): `techName` is the title, `preliminaryRqmts` give the setup
      (`reqPersons` personnel, `supportEquipDescr` tools, `supplyDescr` consumables, `spareDescr`
      parts with `partRef/@partNumberValue` as the part number and `reqQuantity`), each
      `proceduralStep` a step, guarded by the warnings and cautions its `warningRefs` /
      `cautionRefs` name;
  applicability: `dmStatus/applic` and `referencedApplicGroup/applic` (by `applicRefId`): the
      `displayText` is the printed statement, the `assert` model values say which variants (matched
      against the corpus's equipment `ident.model`).

What does not map: S1000D isolation steps carry no reason / known-info / possible-problem facets;
test procedures for a question are separate modules referenced by `dmRef` (followed when present).
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from .layout import PageModel, Region, Word
from .rules import DEFAULTS

TEXT_EL = {"techName", "simplePara", "warningAndCautionPara", "action", "isolationStepQuestion", "choice", "para",
           "personnelDescr", "name", "reqQuantity", "title"}


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def page_model(data: bytes, source_id: str, index: int, label: str) -> tuple[PageModel, dict]:
    """The module as a virtual page (regions = text elements) and the element -> region map."""
    root = ET.fromstring(data)
    pm = PageModel(source_id, index, 1000.0, 1000.0, label=label)
    reg_of: dict[int, str] = {}
    y = 0.0
    for el in root.iter():
        name = _local(el.tag)
        if name not in TEXT_EL:
            continue
        text = " ".join("".join(el.itertext()).split())
        if not text:
            continue
        idxs = []
        x = 0.0
        for w in text.split():
            k = len(pm.words)
            pm.words.append(Word(k, w, x, y, x + 6 * len(w), y + 10, 10.0, False))
            idxs.append(k)
            x += 6 * len(w) + 4
        rid = f"p{index}.r{len(pm.regions) + 1}"
        pm.regions.append(Region(rid, "text", (0.0, y, min(x, 1000.0), y + 10), words=idxs, lines=[idxs]))
        reg_of[id(el)] = rid
        y += 12
    return pm, {"root": root, "reg": reg_of}


def _sp(ctx, el) -> dict | None:
    if el is None:
        return None
    rid = ctx["reg"].get(id(el))
    if rid is None:
        return None
    return {"region": rid, "text": " ".join("".join(el.itertext()).split())}


def _find(el, name):
    return next((e for e in el.iter() if _local(e.tag) == name), None)


def _findall(el, name):
    return [e for e in el.iter() if _local(e.tag) == name]


def derive(ctx: dict, equipment: list[dict]) -> dict:
    root = ctx["root"]
    out = {"headings": [], "trees": [], "procedures": [], "symptoms": [], "codes": [], "equipment": []}
    models = {}
    for e in equipment:
        for m in (e.get("ident") or {}).get("model", []):
            models[m.upper()] = e["id"]
    applics = {a.get("id"): a for a in _findall(root, "applic") if a.get("id")}

    def applies(applic_el) -> list[dict]:
        if applic_el is None:
            return []
        vals = sorted({v for a in _findall(applic_el, "assert") for v in (a.get("applicPropertyValues") or "").split("|")})
        ids = sorted({models[v.upper()] for v in vals if v.upper() in models})
        if not ids or set(ids) == set(models.values()):
            return []           # all variants
        sp = _sp(ctx, _find(applic_el, "simplePara"))
        return [dict(sp, _equip=ids, _ev=[f"S1000D applic assert model {vals}"])] if sp else []

    status_applic = next((a for a in _findall(root, "applic") if not a.get("id")), None)
    wc = {}
    for kind in ("warning", "caution", "note"):
        for w in _findall(root, kind):
            if w.get("id"):
                p = _find(w, "warningAndCautionPara")
                p = p if p is not None else _find(w, "notePara")
                wc[w.get("id")] = {"kind": kind, "text": _sp(ctx, p),
                                   "applies": applies(applics.get(w.get("applicRefId"))),
                                   "_ev": [f"S1000D {kind} {w.get('id')}"], "_typed": True}

    def guards_of(el) -> list[dict]:
        refs = (el.get("warningRefs") or "").split() + (el.get("cautionRefs") or "").split()
        return [dict(wc[r]) for r in refs if r in wc and wc[r]["text"]]

    title_el = _find(root, "techName")
    fi = _find(root, "faultIsolation")
    if fi is not None:
        proc = _find(fi, "isolationProcedure")
        steps = {}
        order = []
        for st in _findall(fi, "isolationStep") + _findall(fi, "isolationProcedureEnd"):
            steps[st.get("id")] = st
            order.append(st)
        nodes = []
        esc, end = re.compile(DEFAULTS["escalate"]), re.compile(DEFAULTS["end"])
        for k, st in enumerate(order, 1):
            q = _find(st, "isolationStepQuestion")
            act = _find(st, "action")
            el = q if q is not None else act
            sp = _sp(ctx, el)
            ans = _find(st, "isolationStepAnswer")
            branches, expect = [], None
            if ans is not None:
                yn = _find(ans, "yesNoAnswer")
                if yn is not None:
                    expect = {"kind": "yes_no", "unit": None, "options": []}
                    for tag, outc in (("yesAnswer", "yes"), ("noAnswer", "no")):
                        a = _find(yn, tag)
                        if a is not None:
                            branches.append({"label": None, "outcome": outc, "cond": None, "to": a.get("nextActionRefId"),
                                             "retry": False, "_ev": f"S1000D {tag}"})
                else:
                    choices = _findall(ans, "choice")
                    if len(choices) == 1 and q is None:
                        expect = {"kind": "ack", "unit": None, "options": []}
                        branches.append({"label": None, "outcome": "done", "cond": None,
                                         "to": choices[0].get("nextActionRefId"), "retry": False, "_ev": "S1000D choice"})
                    else:
                        expect = {"kind": "choice", "unit": None,
                                  "options": [" ".join("".join(c.itertext()).split()) for c in choices]}
                        for c in choices:
                            lab = _sp(ctx, c)
                            branches.append({"label": lab, "outcome": lab["text"].lower() if lab else "",
                                             "cond": None, "to": c.get("nextActionRefId"), "retry": False,
                                             "_ev": "S1000D choice"})
            if q is not None:
                kind = "check"
            elif _local(st.tag) == "isolationProcedureEnd":
                txt = sp["text"] if sp else ""
                kind = "escalate" if esc.search(txt) else "end" if end.search(txt) else "action"
            else:
                kind = "symptom" if k == 1 else "action"
            nodes.append({"id": st.get("id"), "kind": kind, "number": None, "text": sp, "expect": expect, "facets": [],
                          "branches": branches, "test_procedure": None, "target": None, "guards": [],
                          "_ev": [f"S1000D {_local(st.tag)} {st.get('id')}"]})
        fault = _find(fi, "fault")
        out["trees"].append({"ref": (fault.get("faultCode") if fault is not None else None) or "fault isolation",
                             "title": _sp(ctx, title_el), "applies": applies(status_applic), "setup": [],
                             "guards": guards_of(proc) if proc is not None else [], "nodes": nodes,
                             "_ev": ["S1000D faultIsolation"]})
    pr = _find(root, "procedure")
    if pr is not None:
        setup = []
        for pd in _findall(pr, "personnelDescr"):
            setup.append({"kind": "personnel", "text": _sp(ctx, pd), "ident": None, "qty": None})
        for se in _findall(pr, "supportEquipDescr"):
            setup.append({"kind": "tool", "text": _sp(ctx, _find(se, "name")), "ident": None, "qty": None})
        for su in _findall(pr, "supplyDescr"):
            setup.append({"kind": "consumable", "text": _sp(ctx, _find(su, "name")), "ident": None, "qty": None})
        for sp_ in _findall(pr, "spareDescr"):
            pref = _find(sp_, "partRef")
            q = _find(sp_, "reqQuantity")
            setup.append({"kind": "part", "text": _sp(ctx, _find(sp_, "name")),
                          "ident": pref.get("partNumberValue") if pref is not None else None,
                          "qty": " ".join("".join(q.itertext()).split()) if q is not None else None})
        steps = []
        main = _find(pr, "mainProcedure")
        for ps in _findall(main if main is not None else pr, "proceduralStep"):
            para = _find(ps, "para")
            txt = " ".join("".join(para.itertext()).split()) if para is not None else ""
            ck = "value" if re.match(r"(?i)^(read|measure)\b", txt) else "note" if txt.lower().startswith("record") \
                else "pass_fail"
            steps.append({"text": _sp(ctx, para), "check_kind": ck, "guards": guards_of(ps),
                          "_ev": [f"S1000D proceduralStep {ps.get('id')}"]})
        out["procedures"].append({"key": "proc", "ref": None, "kind": "maintenance", "title": _sp(ctx, title_el),
                                  "applies": applies(status_applic), "setup": [s for s in setup if s["text"]],
                                  "guards": guards_of(pr), "steps": steps, "_ev": ["S1000D procedure"]})
    return out
