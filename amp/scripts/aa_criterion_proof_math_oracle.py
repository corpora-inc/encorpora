"""Independent review of the aa-criterion-proof family (HSG.SRT.A.3).

Templates: aa-criterion-proof-build (structured-work proofs that establish
AA from a dilation and a rigid motion), aa-criterion-step-reason (which
property justifies a step) and aa-criterion-argument-check (first flaw of a
student argument, or the one complete argument).

Only the public payload is read: the givens (two angle pairs, the side
between them in each triangle, angle measures when stated) come from the
prompt; the figure is checked to scale (the second triangle has the same
angles and k times the sides; a dilated image is center + k·(P − center); a
rigid-first copy keeps the side lengths with its first side on the target
ray). The answer key and the private rule are values under test.

* Proofs: each statement is read into a fact of the construction (the image
  side equals the target side, angles kept by the dilation, angles matched
  with the given, the two congruent triangles, the rigid motion, the image
  rays and points of the rigid-first proof, the similarity). Every reason is
  a rule written here with the facts it needs; the AA criterion itself,
  proportional sides, "dilations preserve length", "dilations multiply
  angles" and congruent-triangles-are-similar never justify a line. Claims
  are checked both ways, as in the structured-work sweep.
* Step reasons: a finite inventory of the sentences a step can be justified
  by, with the property each one actually states; the names and numbers in
  an option must match the givens.
* Arguments: each sentence is classified and checked against what the
  sentences before it have established; the first one that fails is the
  flaw, and the complete argument is the one that never fails and reaches
  the similarity through a dilation followed by a rigid motion.
"""

import copy
import itertools
import json
import math
import re
from fractions import Fraction as F

BUILD = 'aa-criterion-proof-build'
STEP = 'aa-criterion-step-reason'
ARGUMENT = 'aa-criterion-argument-check'
SUPPORTED = frozenset({BUILD, STEP, ARGUMENT})
REVIEW_RETURNS_ANSWER = True

STATS = {'cases': 0, 'claimsChecked': 0, 'sentences': 0}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def frac(text):
    text = text.strip()
    m = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', text)
    return F(int(m[1]), int(m[2])) if m else F(text)


def frac_tex(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else f'\\frac{{{x.numerator}}}{{{x.denominator}}}'


# ======================================================================
# Givens

class Setup:
    """Triangle t1 = first two vertices carry the given angles; t2 lists the
    corresponding vertices in the same order; side s1 = t1[0]t1[1] maps to
    s2 = t2[0]t2[1]; k = |s2| / |s1|."""

    def __init__(self, public):
        p = public['prompt']
        m = re.search(r'\$\\angle ([A-Z])\\cong\\angle ([A-Z])\$ and \$\\angle ([A-Z])\\cong\\angle ([A-Z])\$', p)
        require(m, 'Two given angle pairs')
        a, d, b, e = m[1], m[2], m[3], m[4]
        tri = re.search(r'\$\\triangle ([A-Z]{3})\\sim\\triangle ([A-Z]{3})\$', p) or re.search(r'In \$\\triangle ([A-Z]{3})\$ and \$\\triangle ([A-Z]{3})\$', p)
        require(tri, 'Two named triangles')
        t1, t2 = tri[1], tri[2]
        require(t1[0] == a and t1[1] == b, 'The given angles are at the first two vertices')
        require(t2[0] == d and t2[1] == e, 'The second triangle lists the corresponding vertices')
        self.t1, self.t2 = t1, t2
        self.corr = dict(zip(t1, t2))
        lengths = {k: F(v) for k, v in re.findall(r'\$([A-Z]{2})=(\d+)\$', p)}
        require(t1[:2] in lengths and t2[:2] in lengths, 'Both included sides are given')
        self.s1, self.s2 = lengths[t1[:2]], lengths[t2[:2]]
        self.k = self.s2 / self.s1
        require(self.k != 1, 'The triangles differ in size')
        # The quotient of the given lengths, then k in lowest terms unless the
        # quotient already is k: 12/8 = 3/2, 16/8 = 2, but 3/4 alone.
        written = f'\\frac{{{self.s2}}}{{{self.s1}}}'
        self.ratio = written if written == frac_tex(self.k) else f'{written}={frac_tex(self.k)}'
        self.measure = {v: int(x) for v, x in re.findall(r'm\\angle ([A-Z])=(\d+)\^\\circ', p)}
        if self.measure:
            require(set(self.measure) == {a, b}, 'Measures of the two given angles')
            third = 180 - self.measure[a] - self.measure[b]
            require(third > 0, 'A triangle')
            self.measure[t1[2]] = third
        self.check_figure(public.get('figure'))

    def check_figure(self, figure):
        if not figure:
            return
        pts = {}
        for e in figure['scene']['elements']:
            if e.get('type') == 'text' and re.fullmatch(r"[A-Z][′″‴']*", e.get('text', '')):
                pts[e['text'].replace('′', "'").replace('″', "''").replace('‴', "'''")] = tuple(map(float, e['at']))
        self.pts = pts
        t1, t2 = self.t1, self.t2
        require(set(t1) <= set(pts) and set(t2) <= set(pts), 'Both triangles are labelled')
        d = lambda p, q: math.dist(pts[p], pts[q])
        k = float(self.k)
        for i, j in ((0, 1), (1, 2), (0, 2)):
            require(abs(d(t2[i], t2[j]) - k * d(t1[i], t1[j])) < 1e-3 * max(1, d(t2[i], t2[j])), 'The second triangle is the first scaled by k')
        for v in self.measure:
            i = t1.index(v)
            require(abs(self.angle(t1[i], t1[(i + 1) % 3], t1[(i + 2) % 3]) - self.measure[v]) < 0.5, f'Angle {v} drawn to measure')
        # A dilated image about the first vertex, when drawn.
        c = t1[0]
        for v in t1[1:]:
            if v + "'" in pts:
                want = tuple(pts[c][i] + k * (pts[v][i] - pts[c][i]) for i in range(2))
                require(math.dist(want, pts[v + "'"]) < 1e-2, f"{v}' is the image of {v}")
        # A rigid-first copy: first vertex on the target's, side kept, on the target ray.
        b2, c2 = t1[1] + "''", t1[2] + "''"
        if b2 in pts and c2 in pts:
            x, y = t2[0], t2[1]
            require(abs(d(x, b2) - d(t1[0], t1[1])) < 1e-2 and abs(d(x, c2) - d(t1[0], t1[2])) < 1e-2 and abs(d(b2, c2) - d(t1[1], t1[2])) < 1e-2,
                    'The rigid-first copy keeps every length')
            u, w = (pts[y][0] - pts[x][0], pts[y][1] - pts[x][1]), (pts[b2][0] - pts[x][0], pts[b2][1] - pts[x][1])
            require(abs(u[0] * w[1] - u[1] * w[0]) < 1e-2 * math.hypot(*u) * math.hypot(*w) and u[0] * w[0] + u[1] * w[1] > 0, 'The copy lies along the target ray')

    def angle(self, v, a, b):
        p = (self.pts[a][0] - self.pts[v][0], self.pts[a][1] - self.pts[v][1])
        q = (self.pts[b][0] - self.pts[v][0], self.pts[b][1] - self.pts[v][1])
        return math.degrees(math.acos(max(-1, min(1, (p[0] * q[0] + p[1] * q[1]) / (math.hypot(*p) * math.hypot(*q))))))


# ======================================================================
# Proofs

REASONS = {
    'A dilation multiplies every length by its scale factor': 'dil-length',
    'Dilations preserve angle measure': 'dil-angle',
    'Given, with the transitive property of congruence': 'given-trans',
    'ASA: two angles and the included side': 'asa',
    'Definition of congruence: a rigid motion maps one figure onto the other': 'def-cong',
    'Definition of similarity: rigid motions and dilations map one figure onto the other': 'def-sim',
    'Rigid motions and dilations preserve angle measure, with the given': 'angle-given',
    'A dilation maps every line through its center to itself': 'dil-line',
    'Two different lines meet in at most one point': 'two-lines',
    # Never a justification in this proof.
    'SAS congruence': 'never', 'Dilations preserve length': 'never', 'AA similarity': 'never',
    'Corresponding sides of similar triangles are proportional': 'never',
    'CPCTC (corresponding parts of congruent triangles)': 'never',
    'Dilations multiply angle measures by the scale factor': 'never',
    'Congruent triangles are similar': 'never',
    'The angles of a triangle add to $180^\\circ$': 'never',
}

# fact → reason → facts it needs (besides the construction and the givens)
RULES = {
    'len': {'dil-length': ()},
    'kept': {'dil-angle': ()},
    'matched': {'given-trans': ('kept',), 'angle-given': ()},
    'cong': {'asa': ('len', 'matched')},
    'rigid': {'def-cong': ('cong',)},
    'sim-dilate': {'def-sim': ('rigid',)},
    'ray-moved': {'angle-given': ()},
    'on-rays': {'dil-line': ('ray-moved',)},
    'lands-b': {'dil-length': ('on-rays',)},
    'ray-at-b': {'angle-given': ('lands-b', 'on-rays')},
    'lands-c': {'two-lines': ('on-rays', 'ray-at-b')},
    'sim-rigid': {'def-sim': ('lands-b', 'lands-c')},
}


def read_build_statement(label, s, rigid_first):
    """The fact a statement states for this setup, or 'false' when it states
    something untrue (no rule may justify it)."""
    a, b, c = s.t1
    d, e, f = s.t2
    if label == f'$\\triangle {s.t1}\\sim\\triangle {s.t2}$':
        return 'sim-rigid' if rigid_first else 'sim-dilate'
    if not rigid_first:
        if label == f"${a}{b}'=k\\cdot {a}{b}={d}{e}$":
            return 'len'
        if label == f"$\\angle {b}'{a}{c}'\\cong\\angle {b}{a}{c}$ and $\\angle {a}{b}'{c}'\\cong\\angle {a}{b}{c}$":
            return 'kept'
        if label == f"$\\angle {b}'{a}{c}'\\cong\\angle {d}$ and $\\angle {a}{b}'{c}'\\cong\\angle {e}$":
            return 'matched'
        if label == f"$\\triangle {a}{b}'{c}'\\cong\\triangle {s.t2}$":
            return 'cong'
        if label == f"A rigid motion maps $\\triangle {a}{b}'{c}'$ onto $\\triangle {s.t2}$":
            return 'rigid'
        if label == f"$m\\angle {a}{b}'{c}'=k\\cdot m\\angle {a}{b}{c}$":
            return 'false'      # dilations keep angle measure
        if label == f"${a}{b}'={a}{b}$ and ${b}'{c}'={b}{c}$":
            return 'false'      # k ≠ 1, so lengths change
    else:
        if label == f"Ray ${d}{c}''$ lies along ray ${d}{f}$":
            return 'ray-moved'
        if label == f"${b}'''$ lies on ray ${d}{e}$, and ${c}'''$ lies on ray ${d}{f}$":
            return 'on-rays'
        if label == f"${d}{b}'''=k\\cdot {d}{b}''={d}{e}$, so ${b}'''={e}$":
            return 'lands-b'
        if label == f"Ray ${e}{c}'''$ lies along ray ${e}{f}$":
            return 'ray-at-b'
        if label == f"${c}'''={f}$":
            return 'lands-c'
    raise ValueError(f'Unread statement {label!r}')


def read_construction(prompt, s):
    a, b, c = s.t1
    d, e, f = s.t2
    k = frac_tex(s.k)
    dilate = (f"let $k=\\frac{{{d}{e}}}{{{a}{b}}}={s.ratio}$, and dilate $\\triangle {s.t1}$ about center ${a}$ by the scale factor $k$; "
              f"call the image $\\triangle {a}{b}'{c}'$.")
    if dilate in prompt:
        return False
    rigid = (f"translate $\\triangle {s.t1}$ so ${a}$ lands on ${d}$, rotate it about ${d}$ so the image of ray ${a}{b}$ lies along ray ${d}{e}$, "
             f"and reflect it over line ${d}{e}$ if needed so the image of ${c}$ is on the same side as ${f}$; call the image $\\triangle {d}{b}''{c}''$. "
             f"Then dilate $\\triangle {d}{b}''{c}''$ about ${d}$ by $k=\\frac{{{d}{e}}}{{{d}{b}''}}={s.ratio}$; call the image $\\triangle {d}{b}'''{c}'''$.")
    require(rigid in prompt, 'A recognized construction with the right center, scale factor and names')
    return True


class BuildProof:
    def __init__(self, public):
        self.s = Setup(public)
        self.rigid_first = read_construction(public['prompt'], self.s)
        response = public['response']
        require(response['kind'] == 'structured-work' and response['layout'] == 'proof', 'Proof layout')
        banks = {b['id']: b for b in response['banks']}
        self.kind = {o['id']: read_build_statement(o['label'], self.s, self.rigid_first) for o in banks['statements']['options']}
        self.reasons = {}
        for o in banks['reasons']['options']:
            require(o['label'] in REASONS, f"Unknown reason {o['label']!r}")
            self.reasons[o['id']] = REASONS[o['label']]
        true_kinds = [k for k in self.kind.values() if k != 'false']
        require(len(true_kinds) == len(set(true_kinds)), 'No fact is stated twice')
        goal = [i for i, k in self.kind.items() if k.startswith('sim')]
        require(len(goal) == 1 and response['goal'] == next(o['label'] for o in banks['statements']['options'] if o['id'] == goal[0]), 'The goal')
        self.goal = goal[0]
        self.by_kind = {k: i for i, k in self.kind.items() if k != 'false'}

    def justifications(self, sid, rid, available):
        kind, reason = self.kind[sid], self.reasons[rid]
        if kind == 'false' or reason == 'never' or reason not in RULES.get(kind, {}):
            return []
        need = RULES[kind][reason]
        if not all(n in self.by_kind and self.by_kind[n] in available for n in need):
            return []
        return [frozenset(self.by_kind[n] for n in need)]

    def closure(self, banned=None):
        known, changed = set(), True
        while changed:
            changed = False
            for sid in self.kind:
                if sid not in known and sid != banned and any(any(m <= known for m in self.justifications(sid, rid, known)) for rid in self.reasons):
                    known.add(sid)
                    changed = True
        return known

    def valid(self, lines):
        seen = set()
        for sid, rid in lines:
            if not sid or not rid or sid in seen:
                return False
            if not any(m <= seen for m in self.justifications(sid, rid, seen)):
                return False
            seen.add(sid)
        return bool(lines) and lines[-1][0] == self.goal


def solve_build(public):
    proof = BuildProof(public)
    rows = public['response']['rows']
    solutions = []
    def walk(i, seen, cells):
        if i == len(rows):
            if rows[-1]['fields'][0].get('given', cells[-1][0]) == proof.goal:
                solutions.append([list(x) for x in cells])
            return
        s, t = rows[i]['fields']
        for sid in ([s['given']] if 'given' in s else list(proof.kind)):
            if sid in seen:
                continue
            for rid in ([t['given']] if 'given' in t else list(proof.reasons)):
                if any(m <= seen for m in proof.justifications(sid, rid, seen)):
                    cells[i] = ['' if 'given' in s else sid, '' if 'given' in t else rid]
                    walk(i + 1, seen | {sid}, cells)
    walk(0, frozenset(), [['', ''] for _ in rows])
    require(solutions, 'Some answer completes the proof')
    if public['response']['mode'] == 'fill':
        require(len(solutions) == 1, f'{len(solutions)} ways to fill the blanks')
    return json.dumps(solutions[0], separators=(',', ':')), solutions, proof


def review_build(problem):
    public = problem['public']
    _, solutions, proof = solve_build(public)
    rows = public['response']['rows']
    answer = json.loads(problem['answer'])
    require(answer in solutions, 'The key is a valid proof')
    closure = proof.closure()
    require(proof.goal in closure, 'The goal is provable')
    g = problem['workGrading']
    require(g['mode'] == 'proof' and g['goal'] == proof.goal, 'Grading names the goal')
    claims = {sid: {rid: {frozenset(p) for p in sets} for rid, sets in by.items()} for sid, by in g['claims'].items()}
    for sid, by in claims.items():
        for rid, sets in by.items():
            for prem in sets:
                derived = proof.justifications(sid, rid, set(proof.kind))
                require(any(prem >= m for m in derived), f'Claim {sid} by {rid} from {sorted(prem)} is not valid')
                require(prem <= closure, 'A claim rests on unprovable statements')
                STATS['claimsChecked'] += 1
    for r in rows:
        s, t = r['fields']
        for sid in ([s['given']] if 'given' in s else list(proof.kind)):
            for rid in ([t['given']] if 'given' in t else list(proof.reasons)):
                without = proof.closure(banned=sid)
                for m in proof.justifications(sid, rid, set(proof.kind)):
                    if m <= without:
                        require(any(c <= m for c in claims.get(sid, {}).get(rid, set())), f'Valid justification of {sid} by {rid} is not credited')
    return problem['answer']


# ======================================================================
# Which property justifies the step

def step_options(public, s):
    p = public['prompt']
    a, b, c = s.t1
    d, e, f = s.t2
    k = frac_tex(s.k)
    m = re.search(r'Step: (.+)$', p)
    require(m, 'A step')
    step = m[1]
    valid, invalid = {}, {}
    # Each entry: option text → why it is (in)valid for this step.
    if step == f"After the dilation about ${a}$ by $k={k}$, $m\\angle {a}{b}'{c}'=m\\angle {a}{b}{c}={s.measure[b]}^\\circ$. Which statement justifies this step?":
        valid['Dilations preserve angle measure.'] = 'angle measure is kept'
        invalid[f'Dilations multiply each angle measure by ${k}$.'] = 'false property'
        invalid[f"$\\triangle {a}{b}'{c}'\\sim\\triangle {a}{b}{c}$ by AA."] = 'uses the criterion being established'
        invalid[f'The dilation multiplies every length by ${k}$.'] = 'about lengths, not this angle'
    elif step == f"The proof chose $k=\\frac{{{d}{e}}}{{{a}{b}}}={s.ratio}$. Why this scale factor?":
        valid[f"So that ${a}{b}'=k\\cdot {a}{b}={d}{e}$: the congruent side between the angles that ASA needs."] = 'the included side'
        invalid['So that $k$ is a whole number, which a dilation requires.'] = 'false requirement'
        invalid[f'So that the angles of $\\triangle {s.t1}$ become the angles of $\\triangle {s.t2}$.'] = 'angles are already equal'
        invalid['So that the dilation enlarges, since a scale factor must be greater than 1.'] = 'false requirement'
    elif step == f"$\\triangle {a}{b}'{c}'\\cong\\triangle {s.t2}$. Which statement justifies this step?":
        valid[f"ASA: $\\angle {b}'{a}{c}'\\cong\\angle {d}$, ${a}{b}'={d}{e}$ and $\\angle {a}{b}'{c}'\\cong\\angle {e}$."] = 'two angles and the included side'
        invalid['AA: two pairs of angles are congruent.'] = 'AA gives similarity'
        invalid[f"SAS: ${a}{b}'={d}{e}$ and $\\angle {b}'{a}{c}'\\cong\\angle {d}$."] = 'only one pair of sides'
        invalid['SSS: a dilation keeps all three sides in proportion.'] = 'proportional, not equal'
    elif step == f'Therefore $\\triangle {s.t1}\\sim\\triangle {s.t2}$. Which statement justifies this step?':
        valid[f'A dilation followed by a rigid motion maps $\\triangle {s.t1}$ onto $\\triangle {s.t2}$.'] = 'definition of similarity'
        invalid[f'The angles of $\\triangle {s.t1}$ add to $180^\\circ$.'] = 'irrelevant'
        invalid[f"Congruent triangles are similar, and $\\triangle {a}{b}'{c}'\\cong\\triangle {s.t2}$."] = 'the wrong pair of triangles'
        invalid[f'Corresponding sides of $\\triangle {s.t1}$ and $\\triangle {s.t2}$ are proportional.'] = 'circular'
    elif step == f"After the dilation about ${a}$, ${b}'$ lies on ray ${a}{b}$ and ${c}'$ lies on ray ${a}{c}$. Which statement justifies this step?":
        valid[f'A dilation maps every line through its center to itself, so each image stays on its ray from ${a}$.'] = 'line through the center'
        invalid['A dilation maps each line to a different line parallel to it.'] = 'only for lines not through the center'
        invalid['Rigid motions preserve distance.'] = 'wrong transformation'
        invalid[f'Because $\\angle {a}\\cong\\angle {d}$.'] = 'irrelevant'
    elif step == f'The proof never uses $\\angle {c}\\cong\\angle {f}$. Why does AA need only two pairs of angles?':
        x, y = s.measure[a], s.measure[b]
        valid[f'The third pair is forced: $m\\angle {c}=180^\\circ-{x}^\\circ-{y}^\\circ={180 - x - y}^\\circ=m\\angle {f}$.'] = 'angle sum'
        invalid[f'$\\angle {c}$ and $\\angle {f}$ might differ, but the proof does not need them.'] = 'they cannot differ'
        invalid[f'Reflecting over line ${a}{b}$ makes $\\angle {c}$ match $\\angle {f}$.'] = 'nonsense'
        invalid[f'The dilation makes $\\angle {c}$ and $\\angle {f}$ congruent.'] = 'the dilation changes no angle'
    elif step == f'AA gives $\\triangle {s.t1}\\sim\\triangle {s.t2}$, but not $\\triangle {s.t1}\\cong\\triangle {s.t2}$. Why does AA not prove congruence?':
        valid['A dilation by any $k\\ne1$ keeps both angles and changes every side, so two angles fix shape, not size.'] = 'shape, not size'
        invalid['AA gives congruence whenever the triangles are drawn to scale.'] = 'picture reasoning'
        invalid['Rigid motions can change the size of a triangle.'] = 'false'
        invalid['Similar triangles always have different side lengths.'] = 'false: congruent triangles are similar'
    elif step == (f'A translation and a rotation, with a reflection if needed, move ${a}$ onto ${d}$ and ray ${a}{b}$ onto ray ${d}{e}$. '
                  f'Then the image of ray ${a}{c}$ lies along ray ${d}{f}$. Which statement justifies this step?'):
        valid[f'Rigid motions preserve angle measure, so the image of $\\angle {a}$ fits exactly on $\\angle {d}$.'] = 'angle kept and given'
        invalid[f'Because $\\angle {b}\\cong\\angle {e}$.'] = 'the other angle pair'
        invalid[f'Because the image of ${c}$ lands on ${f}$.'] = 'not yet shown'
        invalid[f'Rigid motions preserve length, so ${a}{c}={d}{f}$.'] = 'false: the sides differ by k'
    else:
        raise ValueError(f'Unknown step {step!r}')
    return valid, invalid


def solve_step(public):
    s = Setup(public)
    valid, invalid = step_options(public, s)
    good = []
    for o in public['response']['options']:
        require(o['label'] in valid or o['label'] in invalid, f"Unread option {o['label']!r}")
        if o['label'] in valid:
            good.append(o['id'])
    require(len(good) == 1, 'Exactly one option justifies the step')
    return good[0]


# ======================================================================
# Arguments

class Argument:
    """What the sentences so far have established."""

    def __init__(self, s):
        self.s = s
        self.facts = set()

    def step(self, sentence):
        """Apply one sentence; return whether it is justified."""
        STATS['sentences'] += 1
        s, f = self.s, self.facts
        a, b, c = s.t1
        d, e, g = s.t2
        k = frac_tex(s.k)
        T1, T2, IMG = s.t1, s.t2, f"{a}{b}'{c}'"
        m = re.fullmatch(r'We are given \$\\angle ([A-Z])\\cong\\angle ([A-Z])\$ and \$\\angle ([A-Z])\\cong\\angle ([A-Z])\$', sentence)
        if m:
            return [m[1], m[2], m[3], m[4]] == [a, d, b, e]
        if sentence == f'Dilate $\\triangle {T1}$ about ${a}$ by $k={k}$; call the image $\\triangle {IMG}$':
            f.add('dilated')
            return True
        if sentence == f"Dilate $\\triangle {T1}$ about ${a}$ by $k=\\frac{{{d}{e}}}{{{a}{b}}}={k}$, so ${a}{b}'=k\\cdot {a}{b}={d}{e}$":
            f.update({'dilated', 'len'})
            return True
        if sentence == f'Then ${a}{b}\'={k}\\cdot {s.s1}={s.s2}={d}{e}$':
            ok = 'dilated' in f and s.k * s.s1 == s.s2
            f.add('len')
            return ok
        if sentence == f"Then ${a}{b}'={d}{e}$, $\\angle {b}'{a}{c}'\\cong\\angle {d}$ and $\\angle {a}{b}'{c}'\\cong\\angle {e}$":
            ok = 'dilated' in f
            f.update({'len', 'angle-a', 'angle-b'})
            return ok
        if sentence == f"Dilations preserve angle measure, so $\\angle {b}'{a}{c}'\\cong\\angle {d}$ and $\\angle {a}{b}'{c}'\\cong\\angle {e}$":
            f.update({'angle-a', 'angle-b'})
            return 'dilated' in f
        if sentence == f"Dilations preserve angle measure, so $\\angle {b}'{a}{c}'\\cong\\angle {d}$":
            f.add('angle-a')
            return 'dilated' in f
        if sentence == f'Dilations preserve angle measure, so $\\triangle {IMG}$ has the same angles as $\\triangle {T2}$':
            f.update({'angle-a', 'angle-b', 'angle-c'})
            return 'dilated' in f
        if sentence == f"Dilations multiply angle measures by ${k}$, so $\\angle {a}{b}'{c}'$ no longer matches $\\angle {e}$":
            return False        # dilations keep angle measure
        if sentence == f"Dilations preserve length, so ${a}{b}'={a}{b}={s.s1}$":
            return False        # a dilation multiplies length by k ≠ 1
        if sentence in (f'So $\\triangle {IMG}\\cong\\triangle {T2}$ by ASA',):
            f.add('cong')
            return {'len', 'angle-a', 'angle-b'} <= f
        if sentence == f"By ASA, $\\triangle {IMG}\\cong\\triangle {T2}$, so a rigid motion maps $\\triangle {IMG}$ onto $\\triangle {T2}$":
            ok = {'len', 'angle-a', 'angle-b'} <= f
            f.update({'cong', 'rigid'})
            return ok
        if sentence in (f'So $\\triangle {IMG}\\cong\\triangle {T2}$ by SAS', f'So $\\triangle {IMG}\\cong\\triangle {T2}$ by AA'):
            return False        # one side and one angle, or angles only: no congruence criterion
        if sentence == f'A rigid motion then maps $\\triangle {IMG}$ onto $\\triangle {T2}$':
            ok = 'cong' in f
            f.add('rigid')
            return ok
        if sentence == f'Congruent triangles are similar, so $\\triangle {T1}\\sim\\triangle {T2}$':
            return False        # the congruent pair is the image and the second triangle
        if sentence in (f'The dilation followed by that rigid motion maps $\\triangle {T1}$ onto $\\triangle {T2}$, so $\\triangle {T1}\\sim\\triangle {T2}$',
                        f'So a dilation followed by a rigid motion maps $\\triangle {T1}$ onto $\\triangle {T2}$'):
            ok = {'dilated', 'rigid'} <= f and 'circular' not in f
            f.add('similar')
            return ok
        m = re.fullmatch(r'So \$\\triangle ' + T1 + r'\\sim\\triangle ' + T2 + r'\$, and \$\\frac\{' + d + e + r'\}\{' + a + b + r'\}=\\frac\{' + d + g + r'\}\{' + a + c + r'\}=(.+)\$', sentence)
        if m:
            f.add('circular')
            return False        # concludes the similarity being proved
        if sentence == f'Dilate $\\triangle {T1}$ about ${a}$ by ${k}$; the image $\\triangle {IMG}$ has the side lengths of $\\triangle {T2}$':
            f.add('dilated')
            return 'proportional' in f
        if sentence == f'Translate $\\triangle {T1}$ so ${a}$ lands on ${d}$, then rotate it so ray ${a}{b}$ lies along ray ${d}{e}$, reflecting over line ${d}{e}$ if needed':
            f.add('moved')
            return True
        if sentence == f'Since $\\angle {a}\\cong\\angle {d}$, the image of ray ${a}{c}$ lies along ray ${d}{g}$':
            f.add('ray')
            return 'moved' in f
        if sentence == f'So the images of ${b}$ and ${c}$ land on ${e}$ and ${g}$':
            return False        # a rigid motion keeps AB, which differs from DE
        if sentence == f'Therefore $\\triangle {T1}\\sim\\triangle {T2}$':
            return 'mapped' in f
        raise ValueError(f'Unread sentence {sentence!r}')


def solve_argument(public):
    s = Setup(public)
    p = public['prompt']
    sentences = re.findall(r'^Sentence (\d): (.+)\.$', p, re.M)
    if sentences:
        require(p.rstrip().endswith('Which sentence is the first flaw in the argument?'), 'Flaw question')
        arg = Argument(s)
        first = None
        for n, text in sentences:
            ok = arg.step(text)
            if not ok and first is None:
                first = int(n)
        label = 'There is no flaw' if first is None else f'Sentence {first}'
        hits = [o['id'] for o in public['response']['options'] if o['label'] == label]
        require(len(hits) == 1, f'The option {label!r} is offered')
        return hits[0]
    arguments = re.findall(r'^Argument (\d): (.+)$', p, re.M)
    require(len(arguments) == 4 and 'correctly and completely proves' in p, 'Four arguments')
    good = []
    for n, text in arguments:
        arg = Argument(s)
        parts = [x for x in re.split(r'(?<=\.) ', text.strip())]
        ok = True
        for part in parts:
            require(part.endswith('.'), 'Sentences end with a period')
            ok = arg.step(part[:-1]) and ok
        if ok and 'similar' in arg.facts:
            good.append(n)
    require(len(good) == 1, f'Exactly one complete argument, found {good}')
    return next(o['id'] for o in public['response']['options'] if o['label'] == f'Argument {good[0]}')


# ======================================================================

def solve(public):
    t = public['templateId']
    require(t in SUPPORTED, f'Unsupported template {t}')
    if t == BUILD:
        return solve_build(public)[0]
    if t == STEP:
        return solve_step(public)
    return solve_argument(public)


def review_problem(problem):
    public = problem['public']
    t = public['templateId']
    require(t in SUPPORTED, f'Unsupported template {t}')
    STATS['cases'] += 1
    if t == BUILD:
        return review_build(problem)
    response = public['response']
    require(response['kind'] == 'choice' and len(response['options']) == 4, 'Four options')
    require(len({o['label'] for o in response['options']}) == 4, 'Distinct options')
    return solve(public)


# ======================================================================
# Self-test

def _rejects(problem, why):
    try:
        review_problem(problem)
    except (ValueError, KeyError, TypeError, IndexError, StopIteration):
        return
    raise ValueError(f'Self-test mutation accepted: {why}')


def _build_fixture():
    prompt = (r'Use the figure. Given: $\angle A\cong\angle D$ and $\angle B\cong\angle E$, with $AB=8$ and $DE=12$. Prove: $\triangle ABC\sim\triangle DEF$, '
              r'using only transformations and their properties. The proof' + "'" + r's first step, the construction: let $k=\frac{DE}{AB}=\frac{12}{8}=\frac{3}{2}$, '
              r'and dilate $\triangle ABC$ about center $A$ by the scale factor $k$; call the image $\triangle AB' + "'" + r'C' + "'" + r'$. '
              r'The statements of the rest of the proof are shown. Choose the reason for each blank line.')
    stmts = [('sa', r"$AB'=k\cdot AB=DE$"), ('sb', r"$\angle B'AC'\cong\angle BAC$ and $\angle AB'C'\cong\angle ABC$"),
             ('sc', r"$\angle B'AC'\cong\angle D$ and $\angle AB'C'\cong\angle E$"), ('sd', r"$\triangle AB'C'\cong\triangle DEF$"),
             ('se', r"A rigid motion maps $\triangle AB'C'$ onto $\triangle DEF$"), ('sf', r'$\triangle ABC\sim\triangle DEF$')]
    reasons = [('ra', 'A dilation multiplies every length by its scale factor'), ('rb', 'Dilations preserve angle measure'),
               ('rc', 'Given, with the transitive property of congruence'), ('rd', 'ASA: two angles and the included side'),
               ('re', 'Definition of congruence: a rigid motion maps one figure onto the other'),
               ('rf', 'Definition of similarity: rigid motions and dilations map one figure onto the other'),
               ('rg', 'SAS congruence'), ('rh', 'AA similarity'), ('ri', 'Dilations preserve length')]
    key = [('sa', 'ra'), ('sb', 'rb'), ('sc', 'rc'), ('sd', 'rd'), ('se', 're'), ('sf', 'rf')]
    blank = {0, 2, 3, 5}
    rows = [{'id': f'r{i + 1}', 'fields': [{'kind': 'choice', 'label': 'Statement', 'bank': 'statements', 'given': st},
                                           dict({'kind': 'choice', 'label': 'Reason', 'bank': 'reasons'}, **({} if i in blank else {'given': r}))]}
            for i, (st, r) in enumerate(key)]
    response = {'kind': 'structured-work', 'label': 'Your proof', 'layout': 'proof', 'mode': 'fill', 'goal': stmts[5][1], 'rows': rows,
                'banks': [{'id': 'statements', 'label': 'Statement', 'options': [{'id': i, 'label': l} for i, l in stmts]},
                          {'id': 'reasons', 'label': 'Reason', 'options': [{'id': i, 'label': l} for i, l in reasons]}]}
    answer = [['', r if i in blank else ''] for i, (_, r) in enumerate(key)]
    claims = {'sa': {'ra': [[]]}, 'sb': {'rb': [[]]}, 'sc': {'rc': [['sb']]}, 'sd': {'rd': [['sa', 'sc']]}, 'se': {'re': [['sd']]}, 'sf': {'rf': [['se']]}}
    return {'public': {'templateId': BUILD, 'prompt': prompt, 'response': response},
            'answer': json.dumps(answer, separators=(',', ':')), 'workGrading': {'mode': 'proof', 'goal': 'sf', 'claims': claims}}


def self_test():
    proof = _build_fixture()
    require(review_problem(proof) == proof['answer'], 'build fixture')
    m = copy.deepcopy(proof)
    a = json.loads(m['answer']); a[3][1] = 'rg'; m['answer'] = json.dumps(a)
    _rejects(m, 'SAS for the congruence')
    m = copy.deepcopy(proof)
    a = json.loads(m['answer']); a[5][1] = 'rh'; m['answer'] = json.dumps(a)
    _rejects(m, 'AA used to prove AA')
    m = copy.deepcopy(proof)
    m['workGrading']['claims']['sf']['rh'] = [['sd']]
    _rejects(m, 'a circular claim in the private rule')
    m = copy.deepcopy(proof)
    m['workGrading']['claims']['sd']['rd'] = [['sa', 'sc', 'se']]
    _rejects(m, 'a claim needing more than ASA needs')
    m = copy.deepcopy(proof)
    m['public']['prompt'] = m['public']['prompt'].replace(r'\frac{3}{2}$, and dilate', r'2$, and dilate')
    _rejects(m, 'a wrong scale factor')
    # A flawed argument: the first flaw is the scaled angle.
    flaw = {'public': {'templateId': ARGUMENT, 'prompt': (
        'Use the figure. In $\\triangle ABC$ and $\\triangle DEF$, $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$, with $m\\angle A=48^\\circ$, '
        '$m\\angle B=62^\\circ$, $AB=8$ and $DE=12$. A student tries to prove $\\triangle ABC\\sim\\triangle DEF$:\n'
        "Sentence 1: Dilate $\\triangle ABC$ about $A$ by $k=\\frac{3}{2}$; call the image $\\triangle AB'C'$.\n"
        "Sentence 2: Then $AB'=\\frac{3}{2}\\cdot 8=12=DE$.\n"
        "Sentence 3: Dilations multiply angle measures by $\\frac{3}{2}$, so $\\angle AB'C'$ no longer matches $\\angle E$.\n"
        "Sentence 4: A rigid motion then maps $\\triangle AB'C'$ onto $\\triangle DEF$.\n"
        'Which sentence is the first flaw in the argument?'),
        'response': {'kind': 'choice', 'label': 'Choose', 'options': [{'id': 'option-a', 'label': 'Sentence 1'}, {'id': 'option-b', 'label': 'Sentence 2'},
                                                                       {'id': 'option-c', 'label': 'Sentence 3'}, {'id': 'option-d', 'label': 'There is no flaw'}]}},
        'answer': 'option-c'}
    require(review_problem(flaw) == 'option-c', 'argument fixture')
    m = copy.deepcopy(flaw)
    m['public']['prompt'] = m['public']['prompt'].replace('=12=DE', '=10=DE')
    _rejects(m, 'a wrong product makes sentence 2 the first flaw')
    # A step: why ASA.
    step = {'public': {'templateId': STEP, 'prompt': (
        'Use the figure. In $\\triangle ABC$ and $\\triangle DEF$, $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$, with $m\\angle A=48^\\circ$, '
        "$m\\angle B=62^\\circ$, $AB=8$ and $DE=12$. To prove ... Step: $\\triangle AB'C'\\cong\\triangle DEF$. Which statement justifies this step?"),
        'response': {'kind': 'choice', 'label': 'Choose', 'options': [
            {'id': 'option-a', 'label': 'AA: two pairs of angles are congruent.'},
            {'id': 'option-b', 'label': "ASA: $\\angle B'AC'\\cong\\angle D$, $AB'=DE$ and $\\angle AB'C'\\cong\\angle E$."},
            {'id': 'option-c', 'label': "SAS: $AB'=DE$ and $\\angle B'AC'\\cong\\angle D$."},
            {'id': 'option-d', 'label': 'SSS: a dilation keeps all three sides in proportion.'}]}}, 'answer': 'option-b'}
    require(review_problem(step) == 'option-b', 'step fixture')
    m = copy.deepcopy(step)
    m['public']['response']['options'][1]['label'] = "ASA: $\\angle B'AC'\\cong\\angle E$, $AB'=DE$ and $\\angle AB'C'\\cong\\angle D$."
    _rejects(m, 'ASA with the angle correspondence swapped')
    return {'self_test': 'ok'}


if __name__ == '__main__':
    print(self_test())
