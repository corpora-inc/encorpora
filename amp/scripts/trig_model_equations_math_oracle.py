"""Independent oracle for the HSF.TF.B.7 sinusoidal-model equation types.

Only the public payload is read: the model equation, domain, target value
and every option are parsed from the prompt and the response, and the
model is cross-checked against the figure's curve and dashed line. Every
solution of the equation on the domain is found by scanning the model and
bisecting each sign change (not from the generator's closed form), then
rounded as the prompt asks. Each option is judged by what it claims:
an isolated equation is right when it has the same solutions, an inverse
expression when it is a solution, a statement when it is true of the
model. Exactly one option of every choice (and of every part) may be
right.
"""
import json
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'trig-model-inverse-setup',
    'trig-model-solve-interval',
    'trig-model-interpret-solutions',
})
REVIEW_RETURNS_ANSWER = True


def require(cond, message):
    if not cond:
        raise ValueError(message)


# ------------------------------------------------------------ numbers

NUM = r'-?\d+(?:\.\d+)?'


def dec(text):
    """A decimal written in a prompt (true minus allowed) as a Fraction."""
    text = text.replace('−', '-').strip()
    require(re.fullmatch(NUM, text) is not None, f'Not a decimal: {text!r}')
    return Fraction(text)


def tex_value(text):
    """A TeX number: 0.35, -3, \\frac{8}{17}, -\\frac{8}{15}."""
    text = text.strip()
    m = re.fullmatch(r'(-?)\\frac\{(\d+)\}\{(\d+)\}', text)
    if m:
        v = Fraction(int(m[2]), int(m[3]))
        return -v if m[1] else v
    return dec(text)


def js_num(x):
    """A parameter as the app prints it: 12.4, 3, 0.375."""
    x = Fraction(x)
    if x.denominator == 1:
        return str(x.numerator)
    return repr(float(x))


# ------------------------------------------------------------ the model

CONTEXTS = {
    # id: (quantity marker, function name, value phrase pattern, unit)
    'tide': ('The water depth at a harbor', 'd', r'the depth is (\S+) m', 'm', 'hours'),
    'ferris': ('Ferris wheel', 'h', r'the rider is (\S+) m above the ground', 'm', 'seconds'),
    'temperature': ('The air temperature', 'T', r'the temperature is (\S+) °C', '°C', 'hours'),
    'daylight': ('hours of daylight', 'L', r'there are (\S+) hours of daylight', '', 'days'),
    'spring': ('on a spring', 's', r'the displacement is (\S+) cm', 'cm', 'seconds'),
}


def pi_multiple(text):
    """The coefficient of pi in \\pi, 2\\pi, \\frac{\\pi}{6}, \\frac{5\\pi}{31}."""
    text = text.strip()
    m = re.fullmatch(r'(\d*)\\pi', text)
    if m:
        return Fraction(int(m[1]) if m[1] else 1)
    m = re.fullmatch(r'\\frac\{(\d*)\\pi\}\{(\d+)\}', text)
    require(m is not None, f'Not a multiple of pi: {text!r}')
    return Fraction(int(m[1]) if m[1] else 1, int(m[2]))


class Model:
    def __init__(self, ctx, form, A, D, b, C, T):
        self.ctx, self.form = ctx, form
        self.A, self.D, self.b, self.C, self.T = A, D, b, C, T  # b: B / pi
        self.B = float(b) * math.pi
        self.P = 2 / b  # period as a Fraction

    def y(self, t):
        if self.form == 'sin':
            return float(self.A) * math.sin(self.B * (t - float(self.C))) + float(self.D)
        if self.form == 'cos':
            return float(self.A) * math.cos(self.B * (t - float(self.C))) + float(self.D)
        return float(self.D) - float(self.A) * math.cos(self.B * t)

    def roots(self, k, lo, hi):
        """Every t in [lo, hi] with y(t) = k: scan and bisect."""
        f = lambda t: self.y(t) - float(k)
        n = max(4000, int(math.ceil((hi - lo) / float(self.P) * 4000)))
        out = []
        prev_t, prev_v = lo, f(lo)
        for i in range(1, n + 1):
            t = lo + (hi - lo) * i / n
            v = f(t)
            if prev_v == 0:
                out.append(prev_t)
            elif prev_v * v < 0:
                a, b, fa = prev_t, t, prev_v
                for _ in range(200):
                    mid = (a + b) / 2
                    fm = f(mid)
                    if fa * fm <= 0:
                        b = mid
                    else:
                        a, fa = mid, fm
                out.append((a + b) / 2)
            prev_t, prev_v = t, v
        if prev_v == 0:
            out.append(prev_t)
        return out


def parse_model(public):
    prompt = public['prompt']
    ctx = next((c for c, row in CONTEXTS.items() if row[0] in prompt), None)
    require(ctx is not None, 'Unknown context')
    name = CONTEXTS[ctx][1]
    m = re.search(r'is modeled by \$(\w)\(t\)=(.+?)\$ for (\$0\\le t\\le (' + NUM + r')\$|\$t\\ge0\$), with the angle in radians\.', prompt)
    require(m is not None, 'Missing model sentence')
    require(m[1] == name, 'Function name does not fit the context')
    body = m[2]
    T = dec(m[4]) if m[4] else None
    arg = r'\\left\((.+?)\\right\)'
    neg = re.fullmatch(r'(' + NUM + r')-(' + NUM + r')?\\cos' + arg, body)
    pos = re.fullmatch(r'(' + NUM + r')?\\(sin|cos)' + arg + r'(?:\+(' + NUM + r'))?', body)
    require(bool(neg) != bool(pos), f'Unreadable model {body!r}')
    if neg:
        form, D, A, argtext = 'neg-cos', dec(neg[1]), dec(neg[2]) if neg[2] else Fraction(1), neg[3]
    else:
        form, A, argtext = pos[2], dec(pos[1]) if pos[1] else Fraction(1), pos[3]
        D = dec(pos[4]) if pos[4] else Fraction(0)
    am = re.fullmatch(r'(.+?)(?: t|\(t-(' + NUM + r')\))', argtext)
    require(am is not None, f'Unreadable argument {argtext!r}')
    b = pi_multiple(am[1]) * 1  # B = 2*pi/P, written as a multiple of pi
    C = dec(am[2]) if am[2] else Fraction(0)
    require(form != 'neg-cos' or C == 0, 'The negative cosine model has no shift')
    require(A > 0, 'Amplitude must be positive')
    model = Model(ctx, form, A, D, b, C, T)
    # The period sentence states P.
    words = {'tide': r'The tide repeats every (\S+) hours\.', 'ferris': r'The wheel turns once every (\S+) seconds\.',
             'temperature': r'The pattern repeats every 24 hours\.', 'daylight': r'The pattern repeats every 365 days\.',
             'spring': r'It completes one cycle every (\S+) seconds\.'}[ctx]
    pm = re.search(words, prompt)
    require(pm is not None, 'Missing period sentence')
    stated = dec(pm[1]) if pm.groups() else (Fraction(24) if ctx == 'temperature' else Fraction(365))
    require(stated == model.P, f'Stated period {stated} differs from the model period {model.P}')
    check_figure(public, model)
    return model, argtext


def check_figure(public, model):
    """The figure's curve and its dashed line must be the stated model."""
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Expected a graph')
    graph = next(e for e in figure['scene']['elements'] if e.get('type') == 'graph')
    curve = graph['curves'][0]['fn']
    require(abs(curve['b'] - model.B) < 1e-9, 'Figure period differs')
    if model.form == 'neg-cos':
        require(curve['f'] == 'cos' and abs(curve['a'] + float(model.A)) < 1e-9, 'Figure curve differs')
        require(abs(curve.get('h', 0)) < 1e-12, 'Figure shift differs')
    else:
        require(curve['f'] == model.form and abs(curve['a'] - float(model.A)) < 1e-9, 'Figure curve differs')
        require(abs(curve.get('h', 0) - float(model.C)) < 1e-9, 'Figure shift differs')
    require(abs(curve.get('k', 0) - float(model.D)) < 1e-9, 'Figure midline differs')
    if model.T is not None:
        require(graph['x'] == [0, float(model.T)] or graph['x'] == [0, int(model.T)], 'Figure domain differs')
    return graph['lines'][0]['line']['b']


def target(public, model):
    """The value k from the prompt's phrase (or the equation), checked
    against the figure's dashed line."""
    prompt = public['prompt']
    found = [dec(v) for v in re.findall(CONTEXTS[model.ctx][2], prompt, re.I)]
    found += [dec(v) for v in re.findall(r'\$\w\(t\)=(' + NUM + r')\$', prompt)]
    response = public['response']
    if response['kind'] == 'multi-part-choice':
        for blank in response['blanks']:
            found += [dec(v) for v in re.findall(r'\$\w\(t\)=(' + NUM + r')\$', blank['label'])]
    require(found and all(v == found[0] for v in found), 'Missing or conflicting target value')
    k = found[0]
    line = check_figure(public, model)
    require(abs(line - float(k)) < 1e-9, 'Figure line differs from the target')
    return k


def ratio(model, k):
    """r in trig(argument) = r, exactly."""
    return (model.D - k) / model.A if model.form == 'neg-cos' else (k - model.D) / model.A


def places(public):
    text = public['prompt'] + ' '.join(b['label'] for b in public['response'].get('blanks', []))
    day = 'to the nearest day' in text
    hundredth = 'to the nearest hundredth' in text
    require(day != hundredth or not (day or hundredth), 'Conflicting rounding')
    return 0 if day else 2


def shown(t, dp):
    if dp == 2:
        f = (t * 100) % 1
        require(not (0.35 < f < 0.65), f'{t} is near a rounding boundary')
        return f'{t:.2f}'
    f = t % 1
    require(not (0.35 < f < 0.65), f'{t} is near a rounding boundary')
    return str(int(math.floor(t + 0.5)))


def domain_roots(model, k):
    require(model.T is not None, 'Closed domain expected')
    return model.roots(k, 0.0, float(model.T))


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Expected a single choice')
    opts = response['options']
    require(len(opts) == 4 and len({o['id'] for o in opts}) == 4 and len({o['label'] for o in opts}) == 4,
            'Expected four distinct options')
    return opts


def only(found, what):
    require(len(found) == 1, f'Expected exactly one valid {what}, found {len(found)}')
    return found[0]


# ------------------------------------------------- 1. set up and solve

def inverse_value(label, argtext, model):
    """t from an option t = [C+][scale]arc(f)(v)."""
    m = re.fullmatch(r'\$t=(?:(' + NUM + r')\+)?(.*?)\\(arcsin|arccos)\\left\((.+)\\right\)\$', label)
    require(m is not None, f'Unreadable expression {label!r}')
    shift = dec(m[1]) if m[1] else Fraction(0)
    scale_text = m[2]
    if scale_text == '':
        scale = 1.0
    else:
        inv = re.fullmatch(r'\\frac\{(\d+)\}\{(\d*)\\pi\}', scale_text)
        if inv:
            scale = int(inv[1]) / ((int(inv[2]) if inv[2] else 1) * math.pi)
        else:
            scale = float(pi_multiple(scale_text)) * math.pi
    v = float(tex_value(m[4]))
    require(-1 <= v <= 1, 'Inverse of a value outside [-1, 1]')
    angle = math.asin(v) if m[3] == 'arcsin' else math.acos(v)
    return float(shift) + scale * angle


def solve_setup(public):
    model, argtext = parse_model(public)
    k = target(public, model)
    r = ratio(model, k)
    require(abs(r) <= Fraction(9, 10), 'The isolated ratio must be reachable')
    dp = places(public)
    blanks = {b['id']: b for b in public['response']['blanks']}
    require(list(blanks) == ['isolate', 'inverse', 'first'], 'Expected three parts')
    trig = r'\\cos' if model.form != 'sin' else r'\\sin'
    key = {}
    # A: an equation with the same solutions as y(t) = k.
    good = []
    for o in blanks['isolate']['options']:
        m = re.fullmatch(r'\$' + trig + r'\\left\((.+?)\\right\)=(.+)\$', o['label'])
        require(m is not None and m[1] == argtext, f'Unreadable isolated equation {o["label"]!r}')
        if tex_value(m[2]) == r:
            good.append(o['id'])
    key['isolate'] = only(good, 'isolated equation')
    # B: an expression whose value solves the equation.
    good = []
    for o in blanks['inverse']['options']:
        t = inverse_value(o['label'], argtext, model)
        if abs(model.y(t) - float(k)) < 1e-9 * float(model.A):
            good.append(o['id'])
    key['inverse'] = only(good, 'inverse expression')
    # C: the first time t >= 0 in the domain.
    roots = domain_roots(model, k)
    require(len(roots) >= 2, 'The value is reached at least twice')
    first = shown(roots[0], dp)
    good = [o['id'] for o in blanks['first']['options'] if o['label'] == f'${first}$']
    key['first'] = only(good, 'first time')
    return json.dumps(key, separators=(',', ':'))


# ---------------------------------------------- 2. the solution set

def solve_interval(public):
    model, _ = parse_model(public)
    k = target(public, model)
    dp = places(public)
    prompt = public['prompt']
    opts = options(public)
    roots = domain_roots(model, k)
    require(2 <= len(roots) <= 4, 'Two to four solutions on the domain')
    if 'Find all times in' in prompt:
        want = [shown(t, dp) for t in roots]
        good, sizes = [], []
        for o in opts:
            m = re.fullmatch(r'\$\\\{(.+)\\\}\$', o['label'])
            require(m is not None, f'Unreadable set {o["label"]!r}')
            items = [x.strip() for x in m[1].split(',\\ ')]
            sizes.append(len(items))
            if items == want:
                good.append(o['id'])
        answer = only(good, 'solution set')
        # A distractor has as many times as the key, so size gives nothing away.
        require(sum(1 for n in sizes if n == len(want)) >= 2, 'The key is the only set of its size')
        return answer
    if 'Find the next time' in prompt:
        m = re.search(r'at about \$t=(' + NUM + r')\$\. Find the next time', prompt)
        require(m is not None, 'Missing the given time')
        given = [t for t in model.roots(k, 0.0, float(model.T) + float(model.P)) if shown(t, dp) == m[1]]
        t1 = only(given, 'given solution')
        later = [t for t in model.roots(k, t1 + 1e-9, t1 + float(model.P) + 1e-9) if t > t1 + 1e-7]
        require(later, 'No later solution')
        want = f'$t\\approx{shown(later[0], dp)}$'
        return only([o['id'] for o in opts if o['label'] == want], 'next time')
    require('How many times in' in prompt, 'Unknown interval question')
    require(sorted(o['label'] for o in opts) == ['1', '2', '3', '4'], 'Expected the counts 1 to 4')
    return only([o['id'] for o in opts if o['label'] == str(len(roots))], 'count')


# ---------------------------------------- 3. interpret the solutions

def value_words(model, k):
    unit = CONTEXTS[model.ctx][3]
    text = js_num(abs(k))
    text = ('−' if k < 0 else '') + text
    return f'{text} {unit}' if unit else text


def solve_interpret(public):
    model, _ = parse_model(public)
    prompt = public['prompt']
    opts = options(public)
    unit = CONTEXTS[model.ctx][4]
    k = target(public, model)
    hi_val, lo_val = model.D + model.A, model.D - model.A
    good = []
    if 'gives an error' in prompt:
        require(k > hi_val or k < lo_val, 'An error needs a value outside the range')
        require(re.search(r'leads to \$\\(sin|cos)\\left\(', prompt), 'Missing isolated equation')
        for o in opts:
            label = o['label']
            m = re.fullmatch(r'The value (.+) is never reached: the model\'s (greatest|least) value is (.+)\.', label)
            if m:
                edge = hi_val if m[2] == 'greatest' else lo_val
                beyond = k > hi_val if m[2] == 'greatest' else k < lo_val
                if m[1] == value_words(model, k) and m[3] == value_words(model, edge) and beyond:
                    good.append(o['id'])
                continue
            if label == 'The calculator is in the wrong mode; in degree mode it would give a time.':
                continue  # no angle has a sine or cosine outside [-1, 1], in any unit
            m = re.fullmatch(r'The equation has the solution \$t=(' + NUM + r')\$\.', label)
            if m:
                if abs(model.y(float(dec(m[1]))) - float(k)) < 1e-9:
                    good.append(o['id'])
                continue
            m = re.fullmatch(r'The value (.+) is reached once per cycle, at the (highest|lowest) point\.', label)
            require(m is not None, f'Unknown claim {label!r}')
            if k == (hi_val if m[2] == 'highest' else lo_val):
                good.append(o['id'])
        return only(good, 'interpretation')

    if 'What does this negative time mean?' in prompt:
        require(model.ctx == 'tide' and model.form == 'cos', 'Negative-time items use the cosine tide')
        m = re.search(r'gets \$t=(' + NUM + r')-(\\frac\{\d+\}\{\d*\\pi\})\\arccos\\left\((.+?)\\right\)\\approx-(' + NUM + r')\$', prompt)
        require(m is not None, 'Missing the student expression')
        inv = re.fullmatch(r'\\frac\{(\d+)\}\{(\d*)\\pi\}', m[2])
        scale = int(inv[1]) / ((int(inv[2]) if inv[2] else 1) * math.pi)
        r = tex_value(m[3])
        require(r == ratio(model, k), 'The student used another ratio')
        ts = float(dec(m[1])) - scale * math.acos(float(r))
        require(abs(model.y(ts) - float(k)) < 1e-9, 'The student time is not a solution')
        require(ts < 0 and shown(-ts, 2) == m[4], 'The stated negative time is wrong')
        roots = domain_roots(model, k)
        require(roots, 'The equation has solutions in the domain')
        for o in opts:
            label = o['label']
            mm = re.fullmatch(r'It is before midnight\. Adding one period gives a later time with the same depth: about (' + NUM + r') hours\.', label)
            if mm:
                later = ts + float(model.P)
                if abs(model.y(later) - float(k)) < 1e-9 and 0 <= later <= float(model.T) and shown(later, 2) == mm[1]:
                    good.append(o['id'])
                continue
            if label == 'A negative time means the equation has no solution.':
                continue  # the domain holds solutions
            mm = re.fullmatch(r'Take the absolute value: the time is about (' + NUM + r') hours\.', label)
            if mm:
                if abs(model.y(-ts) - float(k)) < 1e-6 * float(model.A):
                    good.append(o['id'])
                continue
            require(label == 'The model is wrong, because time cannot be negative.', f'Unknown claim {label!r}')
        return only(good, 'meaning of the negative time')

    # The remaining items name the first solutions.
    unit_word = unit
    if 'Which statement correctly interprets them?' in prompt:
        m = re.search(r'gives \$t\\approx(' + NUM + r')\$ and \$t\\approx(' + NUM + r')\$ as the first two solutions\.', prompt)
        require(m is not None, 'Missing the two solutions')
        roots = domain_roots(model, k)
        require([shown(t, 2) for t in roots[:2]] == [m[1], m[2]], 'The stated solutions are not the first two')
        for o in opts:
            label = o['label']
            require(value_words(model, k) in label, 'An option names another value')
            if re.search(r' at about (' + NUM + r') \w+ and again at about (' + NUM + r') \w+\.$', label):
                a, b = re.search(r' at about (' + NUM + r') \w+ and again at about (' + NUM + r') \w+\.$', label).groups()
                if [a, b] == [m[1], m[2]]:
                    good.append(o['id'])
            elif re.search(r' for about (' + NUM + r') \w+, then it changes\.$', label):
                pass  # a solution is an instant: the model is not constant
            elif re.search(r' the whole time from (' + NUM + r') to (' + NUM + r') \w+\.$', label):
                mid = (roots[0] + roots[1]) / 2
                if abs(model.y(mid) - float(k)) < 1e-9:
                    good.append(o['id'])
            else:
                mm = re.search(r' only at about (' + NUM + r') \w+\.$', label)
                require(mm is not None, f'Unknown claim {label!r}')
                if len(model.roots(k, 0.0, float(model.T))) == 1:
                    good.append(o['id'])
        return only(good, 'interpretation of the solutions')

    if 'Which statement gives every time that' in prompt:
        require(model.T is None, 'Recurrence items use the open domain')
        m = re.search(r'The first two solutions of .*? are \$t\\approx(' + NUM + r')\$ and \$t\\approx(' + NUM + r')\$\.', prompt)
        require(m is not None, 'Missing the two solutions')
        horizon = 4 * float(model.P)
        roots = model.roots(k, 0.0, horizon)
        require([shown(t, 2) for t in roots[:2]] == [m[1], m[2]], 'The stated solutions are not the first two')
        t1, t2 = roots[0], roots[1]
        for o in opts:
            label = o['label']
            pair = re.fullmatch(r'At about (' + NUM + r') and (' + NUM + r') \w+, and every (' + NUM + r') \w+ after each of those\.', label)
            one = re.fullmatch(r'At about (' + NUM + r') \w+, then every (' + NUM + r') \w+ after that\.', label)
            require(pair or one, f'Unknown claim {label!r}')
            if pair:
                require([pair[1], pair[2]] == [m[1], m[2]], 'Wrong solutions quoted')
                step, starts = float(dec(pair[3])), [t1, t2]
            else:
                require(one[1] == m[1], 'Wrong solution quoted')
                step, starts = float(dec(one[2])), [t1]
            claimed = sorted(s + n * step for s in starts for n in range(int(horizon / step) + 2) if s + n * step <= horizon - 1e-6)
            true = [t for t in roots if t <= horizon - 1e-6]
            if len(claimed) == len(true) and all(abs(a - b) < 1e-6 for a, b in zip(claimed, true)):
                good.append(o['id'])
        return only(good, 'description of every solution')

    require('and the next one is' in prompt, 'Unknown interpretation question')
    m = re.search(r'gives the consecutive solutions \$t\\approx(' + NUM + r')\$ and \$t\\approx(' + NUM + r')\$, and the next one is \$t\\approx(' + NUM + r')\$\.', prompt)
    require(m is not None, 'Missing the solutions')
    roots = model.roots(k, 0.0, float(model.T) + float(model.P))
    named = [m[1], m[2], m[3]]
    found = [next((t for t in roots if shown(t, 2) == s), None) for s in named]
    require(all(t is not None for t in found), 'A stated time is not a solution')
    t1, t2, t3 = found
    require(not [t for t in roots if t1 + 1e-7 < t < t3 - 1e-7 and abs(t - t2) > 1e-7], 'The stated solutions are not consecutive')
    by_text = dict(zip(named, found))
    for o in opts:
        label = o['label']
        mm = re.fullmatch(r'The value is (greater|less) than (.+?) for \$t\$ between about (' + NUM + r') and (' + NUM + r')\.', label)
        half = re.fullmatch(r'The value is (greater|less) than (.+?) for exactly half of each (' + NUM + r')-\w+ cycle\.', label)
        at = re.fullmatch(r'The value is (greater|less) than (.+?) only at about (' + NUM + r') and (' + NUM + r') \w+\.', label)
        require(mm or half or at, f'Unknown claim {label!r}')
        match = mm or half or at
        require(match[2] == value_words(model, k), 'An option names another value')
        above = match[1] == 'greater'
        if mm:
            a, b = by_text.get(mm[3]), by_text.get(mm[4])
            require(a is not None and b is not None and a < b, 'Interval ends must be stated solutions')
            inside = [t for t in roots if a + 1e-7 < t < b - 1e-7]
            v = model.y((a + b) / 2) - float(k)
            if not inside and (v > 0 if above else v < 0):
                good.append(o['id'])
        elif half:
            require(dec(half[3]) == model.P, 'Wrong period')
            # Time above k in one full cycle starting at t1.
            mid = model.y((t1 + t2) / 2) > float(k)
            first = t2 - t1
            measure = first if mid == above else float(model.P) - first
            if abs(measure - float(model.P) / 2) < 1e-6:
                good.append(o['id'])
        else:
            pass  # at a solution the value equals k: it is neither greater nor less
    return only(good, 'statement about the value')


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected template')
    if template == 'trig-model-inverse-setup':
        return solve_setup(public)
    if template == 'trig-model-solve-interval':
        return solve_interval(public)
    return solve_interpret(public)


def review_problem(problem):
    return solve(problem['public'])


# -------------------------------------------------------------- tests

def _graph(form, A, D, P, C, k, T):
    B = 2 * math.pi / P
    fn = {'f': 'cos' if form == 'neg-cos' else form, 'a': -A if form == 'neg-cos' else A, 'b': B, 'k': D}
    if form != 'neg-cos' and C:
        fn['h'] = C
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [
        {'type': 'graph', 'x': [0, T], 'y': [0, 10], 'lines': [{'line': {'m': 0, 'b': k}}], 'curves': [{'fn': fn}]}]}}


def _choice(labels):
    return {'kind': 'choice', 'options': [{'id': f'option-{"abcd"[i]}', 'label': x} for i, x in enumerate(labels)]}


def _must_fail(public):
    try:
        solve(public)
    except ValueError:
        return
    raise AssertionError('Accepted a corrupted fixture')


def self_test():
    import copy
    tide = ('The water depth at a harbor, in meters, $t$ hours after midnight is modeled by '
            '$d(t)=2\\sin\\left(\\frac{5\\pi}{31}(t-2)\\right)+5$ for $0\\le t\\le 24$, with the angle in radians. '
            'The tide repeats every 12.4 hours.')
    # sin(5pi/31 (t-2)) = (5.8-5)/2 = 0.4.
    theta = math.asin(0.4)
    B = 2 * math.pi / 12.4
    t1 = 2 + theta / B
    t2 = 2 + 6.2 - theta / B
    sols = sorted(x for base in (t1, t2) for x in (base, base + 12.4) if 0 <= x <= 24)
    fmt = lambda xs: '$\\{' + ',\\ '.join(f'{x:.2f}' for x in xs) + '\\}$'
    interval = {'templateId': 'trig-model-solve-interval',
                'prompt': tide + ' Find all times in $0\\le t\\le 24$ when the depth is 5.8 m. Round to the nearest hundredth.',
                'response': _choice([fmt([t1, t1 + 12.4]), fmt(sols), fmt([t1, 2 - theta / B + 12.4, t1 + 12.4, 2 - theta / B + 24.8][:4]), fmt(sols[:2])]),
                'figure': _graph('sin', 2, 5, 12.4, 2, 5.8, 24)}
    require(solve(interval) == 'option-b', 'Complete set on the domain')
    wrong_line = copy.deepcopy(interval)
    wrong_line['figure']['scene']['elements'][0]['lines'][0]['line']['b'] = 5.9
    _must_fail(wrong_line)
    two_right = copy.deepcopy(interval)
    two_right['response']['options'][0]['label'] = fmt(sols)
    _must_fail(two_right)
    count = copy.deepcopy(interval)
    count['prompt'] = tide + ' How many times in $0\\le t\\le 24$ is it true that the depth is 5.8 m?'
    count['response'] = _choice(['1', '2', '3', '4'])
    require(solve(count) == f'option-{"abcd"[len(sols) - 1]}', 'Count of solutions')
    nxt = copy.deepcopy(interval)
    nxt['prompt'] = tide + f' The depth is 5.8 m at about $t={t1:.2f}$. Find the next time the depth is 5.8 m. Round to the nearest hundredth.'
    nxt['response'] = _choice([f'$t\\approx{t1 + 12.4:.2f}$', f'$t\\approx{t2:.2f}$', f'$t\\approx{t1 + 6.2:.2f}$', f'$t\\approx{2 - (t1 - 2):.2f}$'])
    require(solve(nxt) == 'option-b', 'Next solution is the other branch')
    # Set up and solve: the Ferris wheel, h = 20 - 17cos(pi t/20) = 12.
    ferris = ('A rider boards a Ferris wheel at its lowest point. The rider\'s height above the ground, in meters, $t$ seconds after boarding '
              'is modeled by $h(t)=20-17\\cos\\left(\\frac{\\pi}{20} t\\right)$ for $0\\le t\\le 80$, with the angle in radians. '
              'The wheel turns once every 40 seconds. Find the first time $t\\ge0$ when the rider is 12 m above the ground. Use a calculator in radian mode.')
    arg = '\\frac{\\pi}{20} t'
    setup = {'templateId': 'trig-model-inverse-setup', 'prompt': ferris, 'figure': _graph('neg-cos', 17, 20, 40, 0, 12, 80),
             'response': {'kind': 'multi-part-choice', 'blanks': [
                 {'id': 'isolate', 'label': 'A. An equation equivalent to $h(t)=12$, with the cosine alone', 'options': [
                     {'id': 'a', 'label': f'$\\cos\\left({arg}\\right)=8$'}, {'id': 'b', 'label': f'$\\cos\\left({arg}\\right)=-\\frac{{8}}{{17}}$'},
                     {'id': 'c', 'label': f'$\\cos\\left({arg}\\right)=\\frac{{8}}{{17}}$'}, {'id': 'd', 'label': f'$\\cos\\left({arg}\\right)=12$'}]},
                 {'id': 'inverse', 'label': 'B. An expression for one solution of that equation', 'options': [
                     {'id': 'a', 'label': '$t=\\frac{\\pi}{20}\\arccos\\left(\\frac{8}{17}\\right)$'},
                     {'id': 'b', 'label': '$t=\\frac{20}{\\pi}\\arcsin\\left(\\frac{8}{17}\\right)$'},
                     {'id': 'c', 'label': '$t=\\frac{20}{\\pi}\\arccos\\left(\\frac{8}{17}\\right)$'},
                     {'id': 'd', 'label': '$t=\\arccos\\left(\\frac{8}{17}\\right)$'}]},
                 {'id': 'first', 'label': 'C. The first time $t\\ge0$, to the nearest hundredth', 'options': [
                     {'id': 'a', 'label': '$6.88$'}, {'id': 'b', 'label': '$1.08$'}, {'id': 'c', 'label': '$33.12$'}, {'id': 'd', 'label': '$394.24$'}]}]}}
    require(solve(setup) == '{"isolate":"c","inverse":"c","first":"a"}', 'Ferris setup')
    second_first = copy.deepcopy(setup)
    second_first['response']['blanks'][2]['options'][0]['label'] = '$33.13$'
    _must_fail(second_first)
    both = copy.deepcopy(setup)
    both['response']['blanks'][1]['options'][0]['label'] = '$t=80-\\frac{20}{\\pi}\\arccos\\left(\\frac{8}{17}\\right)$'
    _must_fail(both)  # an option without the inverse form is unreadable
    # Interpret: a value never reached.
    nosol = {'templateId': 'trig-model-interpret-solutions', 'figure': _graph('sin', 2, 5, 12.4, 2, 7.6, 24),
             'prompt': tide + ' Solving $d(t)=7.6$ leads to $\\sin\\left(\\frac{5\\pi}{31}(t-2)\\right)=1.3$, and a calculator gives an error for $\\arcsin\\left(1.3\\right)$. What does this mean?',
             'response': _choice(['The value 7.6 m is never reached: the model\'s greatest value is 7 m.',
                                  'The calculator is in the wrong mode; in degree mode it would give a time.',
                                  'The equation has the solution $t=2$.',
                                  'The value 7.6 m is reached once per cycle, at the highest point.'])}
    require(solve(nosol) == 'option-a', 'Never reached')
    least = copy.deepcopy(nosol)
    least['response']['options'][0]['label'] = 'The value 7.6 m is never reached: the model\'s least value is 3 m.'
    _must_fail(least)
    return 9


if __name__ == '__main__':
    print(self_test())
