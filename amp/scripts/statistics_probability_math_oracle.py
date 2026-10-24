"""Independent review of the statistics-and-probability practice families.

Every answer is derived from the public prompt, choices and figure only, with exact
Fractions. Conceptual families (normal-model fit, report critique, residual conclusions,
fair procedures, random-variable definitions) are classified from the facts stated in the
prompt by explicit rules written here, and the reviewer requires that exactly one choice
satisfies the rule.
"""
import copy
import re
from fractions import Fraction
from math import comb

SUPPORTED = frozenset({
    'normal-model-rule', 'random-variable-distribution',
    'theoretical-distribution-expectation', 'empirical-distribution-expectation',
    'strategy-expected-value', 'fair-selection-procedure',
    'simulation-consistency-check', 'randomization-test-decision',
    'report-flaw-critique', 'model-residual-conclusion',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def clean(text):
    return (text.replace('$', '').replace('−', '-').replace('\\dfrac', '\\frac')
            .replace('\\ge ', '≥').replace('\\le ', '≤').replace('\\hat y', 'yhat'))


def num(text):
    """Exact value of '12', '-3.5', '\\frac{3}{4}', '-\\frac{25}{6}', '16%', '$7$ dollars'."""
    t = clean(text).replace(',', '').replace('dollars', '').replace('dollar', '').strip()
    percent = t.endswith('%')
    t = t.rstrip('%').strip()
    m = re.fullmatch(r'(-?)\\frac\{(-?\d+)\}\{(\d+)\}', t)
    if m:
        v = Fraction(int(m[2]), int(m[3]))
        v = -v if m[1] else v
    else:
        require(re.fullmatch(r'-?\d+(\.\d+)?', t) is not None, f'Unreadable number: {text}')
        v = Fraction(t)
    return v / 100 if percent else v


def frac_in(text):
    """Fractions like \\frac{3}{4} found anywhere in a prompt."""
    return [Fraction(int(a), int(b)) for a, b in re.findall(r'\\frac\{(\d+)\}\{(\d+)\}', text)]


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    require(len({o['label'].strip().lower() for o in options}) == 4, 'Duplicate choice labels')
    return options


def pick(options, predicate, what):
    hits = [o['id'] for o in options if predicate(o['label'])]
    require(len(hits) == 1, f'{what}: {len(hits)} choices satisfy the rule')
    return hits[0]


def pick_value(options, expected, what):
    values = [num(o['label']) for o in options]
    require(len(set(values)) == 4, f'{what}: mathematically duplicate choices')
    return pick(options, lambda label: num(label) == expected, what)


def chart(public):
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'bar-chart', 'Bar chart required')
    cats, vals = figure['categories'], figure['values']
    require(len(cats) == len(vals) and len(cats) > 1, 'Chart arity')
    require(all(isinstance(v, int) and v >= 0 for v in vals), 'Chart counts must be whole numbers')
    return [int(c.replace('−', '-')) for c in cats], vals


# ---------------------------------------------------------------- normal model
HALF = {0: Fraction(0), 1: Fraction(34), 2: Fraction(95, 2), 3: Fraction(9970, 200)}
WITHIN = {1: 68, 2: 95, 3: 997}


def z_of(value, mean, sd):
    z = Fraction(value - mean) / sd
    return z


def solve_normal(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    require(public.get('figure') is None, 'Unexpected figure')
    if 'most appropriate' in prompt:
        # A bell-shaped model needs symmetry, one peak, mean = median.
        def fits(label):
            t = label.lower()
            return 'symmetric' in t and ('one peak' in t or 'bell-shaped' in t) and 'mean and median both' in t
        return pick(options, fits, 'normal data set')
    m = re.search(r'mean (-?[\d.]+) \w+ and standard deviation ([\d.]+)', prompt)
    if 'Who scored higher' in prompt:
        s = re.fullmatch(
            r'Both exams have approximately normal scores\. (\w+) scored (\d+) on the \w+ exam \(mean (\d+), standard deviation (\d+)\)\. '
            r'(\w+) scored (\d+) on the \w+ exam \(mean (\d+), standard deviation (\d+)\)\. Who scored higher relative to the others who took the same exam\? '
            r'Compare z-scores, where z = \(score - mean\) ÷ standard deviation\.', prompt)
        require(s is not None, 'z-score prompt not recognised')
        (a, xa, ma, sa, b, xb, mb, sb) = s.groups()
        za, zb = z_of(int(xa), int(ma), int(sa)), z_of(int(xb), int(mb), int(sb))
        require(za != zb, 'Tied z-scores')
        win, lose = (a, b) if za > zb else (b, a)
        zw, zl = max(za, zb), min(za, zb)

        def fmt(z):
            return str(float(z)).rstrip('0').rstrip('.') if z.denominator != 1 else str(int(z))

        def good(label):
            t = clean(label)
            return t == f'{win}: z = {fmt(zw)}, compared with z = {fmt(zl)} for {lose}'
        return pick(options, good, 'z-score comparison')
    mean, sd = Fraction(m[1]), Fraction(m[2])
    if 'less than' in prompt or 'greater than' in prompt:
        v = Fraction(re.search(r'(?:less|greater) than (-?[\d.]+)', prompt)[1])
        z = z_of(v, mean, sd)
        require(z.denominator == 1 and 1 <= abs(z) <= 3, 'Cutoff must be a whole number of SDs')
        tail = 50 - HALF[abs(int(z))]            # percent beyond |z| on one side
        below = tail if z < 0 else 100 - tail
        expected = below if 'less than' in prompt else 100 - below
        return pick_value(options, expected / 100, 'one-sided percent')
    if 'lie between' in prompt:
        lo, hi = map(Fraction, re.search(r'between (-?[\d.]+) and (-?[\d.]+)', prompt).groups())
        zl, zh = z_of(lo, mean, sd), z_of(hi, mean, sd)
        require(zl.denominator == 1 and zh.denominator == 1 and abs(zl) <= 3 and abs(zh) <= 3 and zl < zh, 'Bounds in whole SDs')
        hl, hh = HALF[abs(int(zl))], HALF[abs(int(zh))]
        expected = hl + hh if zl < 0 < zh else abs(hh - hl)
        return pick_value(options, expected / 100, 'two-sided percent')
    s = re.search(r'About (\d+(?:\.\d+)?)% of the values lie within which interval', prompt)
    require(s is not None, 'Normal-rule prompt not recognised')
    k = {Fraction(68): 1, Fraction(95): 2, Fraction(997, 10): 3}[Fraction(s[1])]
    lo, hi = mean - k * sd, mean + k * sd

    def interval(label):
        n = re.findall(r'-?\d+(?:\.\d+)?', clean(label))
        return len(n) == 2 and Fraction(n[0]) == lo and Fraction(n[1]) == hi
    return pick(options, interval, 'rule interval')


# ---------------------------------------------------------- random variables
def dice_counts(fn):
    out = {}
    for a in range(1, 7):
        for b in range(1, 7):
            out[fn(a, b)] = out.get(fn(a, b), 0) + 1
    return out


def compare_event(op, k, dist):
    keep = {'=': lambda x: x == k, '≥': lambda x: x >= k, '≤': lambda x: x <= k}[op]
    return sum(p for x, p in dist.items() if keep(x))


def solve_random_variable(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    if 'Which definition gives a numerical random variable' in prompt:
        require(public.get('figure') is None, 'Unexpected figure')

        def numeric(label):
            return re.fullmatch(r'X = the (number of|sum of) .+', clean(label)) is not None
        return pick(options, numeric, 'numerical definition')
    m = re.fullmatch(r'A fair coin is tossed (\d+) times\. Let X be the number of heads\. What is P\(X=(\d+)\)\?', prompt)
    if m:
        n, k = int(m[1]), int(m[2])
        return pick_value(options, Fraction(comb(n, k), 2 ** n), 'coin binomial')
    m = re.fullmatch(r'Two fair six-sided dice are rolled\. Let X be the larger of the two numbers \(if they match, X is that number\)\. What is P\(X=(\d+)\)\?', prompt)
    if m:
        counts = dice_counts(max)
        return pick_value(options, Fraction(counts.get(int(m[1]), 0), 36), 'max of dice')
    m = re.fullmatch(r'A spinner game has equally likely outcomes\. Let X be the score\. The bar chart shows how many outcomes give each score\. Find P\(X(=|≥|≤)(-?\d+)\)\.', prompt)
    if m:
        cats, vals = chart(public)
        total = sum(vals)
        dist = {c: Fraction(v, total) for c, v in zip(cats, vals)}
        return pick_value(options, compare_event(m[1], int(m[2]), dist), 'chart probability')
    m = re.fullmatch(r'A random variable X takes the values (.+?) and (-?\d+)\. Its distribution is (.+)\. Find a\.', prompt)
    require(m is not None, 'Random-variable prompt not recognised')
    entries = re.findall(r'P\(X=(-?\d+)\)=(a|\\frac\{\d+\}\{\d+\})', m[3])
    require(len(entries) == 4 and sum(1 for _, v in entries if v == 'a') == 1, 'One unknown probability')
    known = sum(num(v) for _, v in entries if v != 'a')
    expected = 1 - known
    require(0 < expected < 1, 'Missing probability must be a proper probability')
    return pick_value(options, expected, 'missing probability')


# ------------------------------------------------------ theoretical expectation
def solve_theoretical(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    m = re.fullmatch(r'A player makes each of (\d+) shots independently with probability (\\frac\{\d+\}\{\d+\})\. Let X be the number of shots made\. Find P\(X=(\d+)\)\.', prompt)
    if m:
        n, p, k = int(m[1]), num(m[2]), int(m[3])
        return pick_value(options, comb(n, k) * p ** k * (1 - p) ** (n - k), 'binomial probability')
    m = re.fullmatch(r'X is the number of shots made in (\d+) independent shots\. Its distribution is (.+)\. Find the expected value E\(X\) exactly\.', prompt)
    if m:
        entries = re.findall(r'P\(X=(\d+)\)=(\\frac\{\d+\}\{\d+\})', m[2])
        probs = [num(v) for _, v in entries]
        require([int(k) for k, _ in entries] == list(range(int(m[1]) + 1)) and sum(probs) == 1, 'Stated distribution must sum to 1')
        return pick_value(options, sum(int(k) * num(v) for k, v in entries), 'expected value')
    m = re.fullmatch(r'Two fair six-sided dice are rolled\. Let X be the sum of the two numbers\. What is P\(X(=|≥)(\d+)\)\?', prompt)
    if m:
        return pick_value(options, compare_event(m[1], int(m[2]), {k: Fraction(v, 36) for k, v in dice_counts(lambda a, b: a + b).items()}), 'dice sum')
    m = re.fullmatch(r'You roll two fair dice\. If (.+), you win (\d+) dollars; otherwise you lose (\d+) dollars?\. Let X be your net gain in dollars\. Find the expected value E\(X\) exactly\.', prompt)
    require(m is not None, 'Theoretical-expectation prompt not recognised')
    cond, win, lose = m[1], int(m[2]), int(m[3])
    if cond == 'both dice show the same number':
        event = lambda a, b: a == b
    elif (s := re.fullmatch(r'the sum is (\d+) or (\d+)', cond)):
        event = lambda a, b: a + b in (int(s[1]), int(s[2]))
    elif (s := re.fullmatch(r'the sum is (\d+) or more', cond)):
        event = lambda a, b: a + b >= int(s[1])
    elif (s := re.fullmatch(r'the sum is (\d+) or less', cond)):
        event = lambda a, b: a + b <= int(s[1])
    elif (s := re.fullmatch(r'the sum is (\d+)', cond)):
        event = lambda a, b: a + b == int(s[1])
    else:
        raise ValueError('Dice condition not recognised')
    hits = sum(1 for a in range(1, 7) for b in range(1, 7) if event(a, b))
    require(0 < hits < 36, 'Event must be possible and not certain')
    p = Fraction(hits, 36)
    return pick_value(options, p * win - (1 - p) * lose, 'dice game expectation')


# ------------------------------------------------------- empirical expectation
def solve_empirical(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    cats, vals = chart(public)
    m = re.match(r'The bar chart shows the observed number of [\w ]+? in each of (\d+) \w+\. (.*)$', prompt)
    require(m is not None, 'Empirical prompt not recognised')
    n, rest = int(m[1]), m[2]
    require(sum(vals) == n, 'Chart total does not match the stated number of observations')
    mean = Fraction(sum(c * v for c, v in zip(cats, vals)), n)
    s = re.fullmatch(r'Use the relative frequencies as estimated probabilities\. Estimate the probability that the number of [\w ]+ in a \w+ is (-?\d+)\. Give a decimal\.', rest)
    if s:
        require(int(s[1]) in cats, 'Asked value must appear in the chart')
        return pick_value(options, Fraction(vals[cats.index(int(s[1]))], n), 'relative frequency')
    if re.fullmatch(r'Use the relative frequencies as estimated probabilities\. Find the expected number of [\w ]+ per \w+\. Give a decimal\.', rest):
        return pick_value(options, mean, 'empirical mean')
    s = re.fullmatch(r'Suppose the same pattern holds for (\d+) \w+ in the [\w ]+\. About how many [\w ]+ in total should be expected\?', rest)
    require(s is not None, 'Empirical question not recognised')
    return pick_value(options, mean * int(s[1]), 'scaled total')


# ------------------------------------------------------------------- strategy
def solve_strategy(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    m = re.fullmatch(r'You can take a sure (-?\d+) dollars or a gamble\. In the gamble you win (\d+) dollars with probability (\\frac\{\d+\}\{\d+\}) and otherwise lose (\d+) dollars?\. Which statement is justified by comparing expected values\?', prompt)
    if m:
        sure, win, p, lose = int(m[1]), int(m[2]), num(m[3]), int(m[4])
        ev = p * win - (1 - p) * lose
        verdict = 'Either choice' if ev == sure else 'Take the gamble' if ev > sure else 'Take the sure amount'
        phrase = 'equals' if ev == sure else 'is more than' if ev > sure else 'is less than'

        def good(label):
            t = clean(label)
            s = re.fullmatch(r"(Either choice|Take the gamble|Take the sure amount): (?:the gamble's expected value|its expected value), (.+?) dollars, (equals|is more than|is less than) the sure (-?\d+) dollars\.", t)
            return bool(s) and s[1] == verdict and s[3] == phrase and num(s[2]) == ev and int(s[4]) == sure
        return pick(options, good, 'gamble versus sure amount')
    m = re.fullmatch(r'A warranty costs (\d+) dollars\. Without it, there is a probability of (\\frac\{\d+\}\{\d+\}) that you pay a (\d+)-dollar repair bill and otherwise pay nothing\. Which statement is justified by comparing expected costs\?', prompt)
    if m:
        price, p, bill = int(m[1]), num(m[2]), int(m[3])
        ev = p * bill
        verdict = 'Either choice' if ev == price else 'Buy the warranty' if ev > price else 'Skip the warranty'

        def good(label):
            t = clean(label)
            s = re.fullmatch(r'(Buy the warranty|Skip the warranty): the expected repair cost without it is (\d+(?:\.\d+)?) dollars, compared with its price of (\d+) dollars\.', t)
            if not s:
                return False
            return s[1] == verdict and Fraction(s[2]) == ev and int(s[3]) == price
        if verdict == 'Either choice':
            return pick(options, lambda l: clean(l).startswith('Either choice') and f'{ev}' in clean(l), 'warranty tie')
        return pick(options, good, 'warranty')
    m = re.match(r'Four games are offered\. (.*) Which game has the greatest expected net gain per play \(prize chance times prize, minus the cost\)\?$', prompt)
    require(m is not None, 'Strategy prompt not recognised')
    games = re.findall(r'Game ([A-D]): pay (\d+) dollars? to play; win (\d+) dollars with probability (\\frac\{\d+\}\{\d+\}), otherwise win nothing\.', m[1])
    require(len(games) == 4, 'Four games required')
    nets = {g: num(p) * int(prize) - int(cost) for g, cost, prize, p in games}
    best = max(nets.values())
    require(list(nets.values()).count(best) == 1, 'Tied best game')
    winner = next(g for g, v in nets.items() if v == best)
    require(len({o['label'] for o in options}) == 4 and {o['label'] for o in options} == {f'Game {g}' for g in 'ABCD'}, 'Each game must be one choice')
    return pick(options, lambda l: l == f'Game {winner}', 'best game')


# ------------------------------------------------------------------ fair draw
def solve_fair(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    m = re.fullmatch(r'A teacher must choose one of (\d+) students at random so that every student has exactly the same chance\. Which procedure does that\?', prompt)
    if m:
        n = int(m[1])

        def uniform(label):
            t = clean(label)
            if (s := re.fullmatch(r'Spin an arrow on a wheel divided into (\d+) equal sectors, one per student\.', t)):
                return int(s[1]) == n
            if (s := re.fullmatch(r'Put (\d+) identical slips, one per student, in a bag, mix well and draw one\.', t)):
                return int(s[1]) == n
            if (s := re.fullmatch(r'Roll a fair (\d+)-sided die, rolling again if the result is above (\d+); the result is the student number\.', t)):
                return int(s[2]) == n <= int(s[1])
            if (s := re.fullmatch(r'Roll a fair (\d+)-sided die; the remainder after dividing by (\d+) is the student \(remainder 0 means student (\d+)\)\.', t)):
                d, k = int(s[1]), int(s[2])
                if k != n or int(s[3]) != n:
                    return False
                tally = {}
                for r in range(1, d + 1):
                    tally[r % n or n] = tally.get(r % n or n, 0) + 1
                return len(tally) == n and len(set(tally.values())) == 1
            if (s := re.fullmatch(r'Roll one fair six-sided die and use the result as the student number\.', t)):
                return n == 6
            if (s := re.fullmatch(r'Roll two fair dice, add them, and choose student sum - (\d+); roll again if the sum is above (\d+)\.', t)):
                tally = {}
                for a in range(1, 7):
                    for b in range(1, 7):
                        if a + b <= int(s[2]):
                            tally[a + b - int(s[1])] = tally.get(a + b - int(s[1]), 0) + 1
                return set(tally) == set(range(1, n + 1)) and len(set(tally.values())) == 1
            if (s := re.fullmatch(r'Flip a fair coin (\d+) times and choose student (\d+) \+ the number of heads\.', t)):
                k = int(s[1])
                return k + 1 == n and {comb(k, j) for j in range(k + 1)} == {1}
            raise ValueError(f'Unknown procedure: {label}')
        return pick(options, uniform, 'uniform procedure')
    m = re.match(r'To pick one of (\d+) students numbered 1 to \1, a teacher (.*) What is the probability that student (\d+) is chosen\?$', prompt)
    require(m is not None, 'Fair-selection prompt not recognised')
    n, body, student = int(m[1]), m[2], int(m[3])
    require(1 <= student <= n, 'Student outside range')
    if (s := re.fullmatch(r'rolls a fair (\d+)-sided die numbered 1 to \1, rolling again whenever the result is greater than (\d+)\. The result is the student number\.', body)):
        d, cut = int(s[1]), int(s[2])
        require(cut == n <= d, 'Reroll cutoff must equal the student count')
        expected = Fraction(1, cut)
    elif (s := re.fullmatch(r'rolls two fair six-sided dice and chooses the student numbered \(sum - (\d+)\)\.', body)):
        expected = Fraction(dice_counts(lambda a, b: a + b).get(student + int(s[1]), 0), 36)
    elif (s := re.fullmatch(r'rolls a fair (\d+)-sided die numbered 1 to \1\. The student number is the remainder after dividing the result by (\d+), and a remainder of 0 means student (\d+)\.', body)):
        d, k = int(s[1]), int(s[2])
        require(k == n and int(s[3]) == n, 'Remainder rule must use the student count')
        expected = Fraction(sum(1 for r in range(1, d + 1) if (r % n or n) == student), d)
    else:
        raise ValueError('Selection body not recognised')
    return pick_value(options, expected, 'selection probability')


# ----------------------------------------------------------- simulation tests
def decide_tail(count, total, cutoff_text):
    pct = Fraction(count, total)
    return pct, pct < Fraction(cutoff_text) / 100


def solve_simulation(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    cats, vals = chart(public)
    m = re.search(r'in each of (\d+) sets of (\d+) \w+ simulated under the model\.', prompt)
    require(m is not None, 'Simulation set count missing')
    sets, trials = int(m[1]), int(m[2])
    require(sum(vals) == sets, 'Chart total does not match the stated number of simulated sets')
    require(all(0 <= c <= trials for c in cats), 'Chart categories outside the possible counts')
    p = frac_in(prompt)[0]
    observed = int(re.search(r'(?:landed on blue|landed heads|made|she made) (\d+) (?:times|shots)', prompt)[1])
    cutoff = re.search(r'Fewer than (\d+(?:\.\d+)?)% that extreme means not consistent with the model', prompt)
    require(cutoff is not None, 'Decision rule must be stated with its boundary')
    centre = p * trials
    if 'in either direction' in prompt:
        s = re.search(r'at least as far from (\d+) as (\d+) is, in either direction \((\d+) or fewer, or (\d+) or more\)', prompt)
        require(s is not None and Fraction(s[1]) == centre and int(s[2]) == observed, 'Two-sided wording must match the model and the data')
        dist = abs(observed - centre)
        lo, hi = centre - dist, centre + dist
        require(Fraction(s[3]) == lo and Fraction(s[4]) == hi, 'Stated tails must be symmetric about the expected count')
        count = sum(v for c, v in zip(cats, vals) if abs(c - centre) >= dist)
    else:
        s = re.search(r'You suspect the true probability is greater than .*? Count the sets with (\d+) or more', prompt)
        require(s is not None and int(s[1]) == observed and observed > centre, 'One-sided wording must match the data')
        count = sum(v for c, v in zip(cats, vals) if c >= observed)
    pct, inconsistent = decide_tail(count, sets, cutoff[1])

    def good(label):
        t = clean(label)
        s = re.fullmatch(r'(\d+) of (\d+) sets \((\d+(?:\.\d+)?)%\): (not consistent|consistent) with the model', t)
        return bool(s) and int(s[1]) == count and int(s[2]) == sets and Fraction(s[3]) == pct * 100 and (s[4] == 'not consistent') == inconsistent
    return pick(options, good, 'simulation decision')


def solve_randomization(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    cats, vals = chart(public)
    m = re.search(r'was (-?\d+) [\w ]+?\. To test whether .*?, the labels were reshuffled (\d+) times', prompt)
    require(m is not None, 'Randomization prompt not recognised')
    observed, shuffles = int(m[1]), int(m[2])
    require(sum(vals) == shuffles, 'Chart total does not match the stated number of reshuffles')
    cutoff = re.search(r'Significant means that proportion is less than (\d+(?:\.\d+)?)%', prompt)
    require(cutoff is not None, 'Significance boundary must be stated')
    if 'To test whether the groups differ' in prompt:
        s = re.search(r'Count the reshuffles with a difference of (\d+) or more, or (-\d+) or less', prompt)
        require(s is not None and int(s[1]) == abs(observed) and int(s[2]) == -abs(observed), 'Two-sided wording must be symmetric about 0')
        count = sum(v for c, v in zip(cats, vals) if abs(c) >= abs(observed))
    else:
        s = re.search(r'Count the reshuffles with a difference of (\d+) or more\.', prompt)
        require(s is not None and int(s[1]) == observed and observed > 0 and 'gave a higher' in prompt, 'One-sided wording must match the data')
        count = sum(v for c, v in zip(cats, vals) if c >= observed)
    pct = Fraction(count, shuffles)
    significant = pct < Fraction(cutoff[1]) / 100

    def good(label):
        t = clean(label)
        s = re.fullmatch(r'(\d+) of (\d+) reshuffles \((\d+(?:\.\d+)?)%\): (not significant; chance could explain it|significant; chance is an unlikely explanation)', t)
        return bool(s) and int(s[1]) == count and int(s[2]) == shuffles and Fraction(s[3]) == pct * 100 and s[4].startswith('significant') == significant
    return pick(options, good, 'randomization decision')


# --------------------------------------------------------------- report flaws
FLAW_NAMES = {
    'Voluntary response': 'voluntary', 'Convenience sample': 'convenience',
    'Sample too small': 'small', 'No margin of error': 'nomoe', 'Truncated axis': 'axis',
}


def label_flaws(label):
    t = clean(label)
    head = t.split(':')[0]
    found = set()
    for key, code in FLAW_NAMES.items():
        if key.lower() in head.lower():
            found.add(code)
    require(found, f'No flaw named in {label}')
    return found


def solve_report(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    flaws = set()
    if 'posted the question on its website and counted' in prompt:
        flaws.add('voluntary')
        n = int(re.search(r'counted the (\d+) replies', prompt)[1])
    elif 'it met at one' in prompt:
        flaws.add('convenience')
        n = int(re.search(r'asked (\d+) \w+ it met', prompt)[1])
    else:
        require('at random from a complete list' in prompt, 'Sampling method not recognised')
        n = int(re.search(r'selected (\d+) \w+ at random', prompt)[1])
    s = re.search(r'(\d+)% chose .*? and (\d+)% chose the other option', prompt)
    top, other = int(s[1]), int(s[2])
    require(top + other == 100 and top > other, 'Percentages must sum to 100 and favour the headline')
    gap = top - other
    moe = re.search(r'margin of error of ±(\d+) percentage points', prompt)
    if moe:
        # A reported margin that matches 1/sqrt(n) (in points) is honest; n this small is a flaw.
        approx = 100 / n ** 0.5
        require(abs(approx - int(moe[1])) <= 1.5, 'Reported margin of error must match the sample size')
    else:
        require(gap <= 2 * 100 / n ** 0.5, 'A missing margin of error is only decisive when the lead is within twice the sampling margin')
        flaws.add('nomoe')
    if n < 30:
        flaws.add('small')
    axis = int(re.search(r'vertical axis that starts at (\d+)%', prompt)[1])
    if axis > 0:
        require(axis > 0 and axis < other, 'Truncated axis must start between 0 and the lower bar')
        flaws.add('axis')
    two = 'Which two flaws' in prompt
    require(two or 'Which flaw most weakens' in prompt, 'Question form not recognised')
    require(len(flaws) == (2 if two else 1), f'Facts show {len(flaws)} flaw(s); question asks for {2 if two else 1}')
    return pick(options, lambda l: label_flaws(l) == flaws, 'report flaws')


# ------------------------------------------------------------ model residuals
def solve_residual(public):
    prompt = clean(public['prompt'])
    options = options_of(public)
    if prompt.startswith('Two models predict'):
        s = re.fullmatch(r'Two models predict the same (\d+) data values\. A residual is observed minus predicted\. Model A residuals: (.+?)\. Model B residuals: (.+?)\. Which statement is justified\? \(Compare the sum of the squared residuals, since squaring removes the sign\.\)', prompt)
        require(s is not None, 'Model comparison prompt not recognised')
        a = [int(x) for x in s[2].split(',')]
        b = [int(x) for x in s[3].split(',')]
        require(len(a) == len(b) == int(s[1]), 'Residual list length')
        sa, sb = sum(x * x for x in a), sum(x * x for x in b)
        require(sa != sb, 'Tied fit')
        best, big, small = ('A', sa, sb) if sa < sb else ('B', sb, sa)
        low, high = min(sa, sb), max(sa, sb)

        def good(label):
            t = clean(label)
            return t == f'Model {best} fits better: its sum of squared residuals is {low}, compared with {high}.'
        return pick(options, good, 'better model')
    pre = re.fullmatch(r'A linear model yhat=(\d+)x\+(\d+) predicts .+? after x .+?\. A residual is observed minus predicted\. The data: (.+?)\. (.*)', prompt)
    require(pre is not None, 'Residual prompt not recognised')
    slope, icpt = int(pre[1]), int(pre[2])
    rows = re.findall(r'x = (\d+): observed (-?\d+), predicted (-?\d+), residual (-?\d+)', pre[3])
    require(len(rows) == 7, 'Seven data rows')
    xs, res = [], []
    for x, obs, pred, r in rows:
        require(int(pred) == slope * int(x) + icpt, 'Stated prediction must follow the model')
        require(int(r) == int(obs) - int(pred), 'Stated residual must be observed minus predicted')
        xs.append(int(x)); res.append(int(r))
    require(xs == list(range(1, 8)), 'x values 1..7')
    tail = pre[4]
    ext = re.search(r'predict .*? when x=(\d+)\. Which statement is justified\?', tail)
    if ext:
        require('residuals are small and show no pattern' in tail and max(abs(r) for r in res) <= 1, 'Extrapolation premise must hold')
        far = int(ext[1])
        require(far >= 3 * max(xs), 'Prediction must be far outside the data')
        return pick(options, lambda l: clean(l) == f'The prediction at x = {far} is an extrapolation far beyond x = 1 to 7, so these residuals do not show it is reliable.', 'extrapolation')
    require(tail == 'Which conclusion do the residuals support?', 'Question form not recognised')
    sign = [(r > 0) - (r < 0) for r in res]
    run = longest = 1
    for i in range(1, 7):
        run = run + 1 if sign[i] == sign[i - 1] != 0 else 1
        longest = max(longest, run)
    structured = longest >= 3
    if structured:
        # Describe the sign blocks and demand the curve conclusion to name them accurately.
        blocks = []
        for sgn in sign:
            if sgn != 0 and (not blocks or blocks[-1] != sgn):
                blocks.append(sgn)
        require(len(blocks) == 3 and blocks[0] == blocks[2] != blocks[1], 'Structured residuals should alternate in three blocks')
        word = {1: 'positive', -1: 'negative'}
        want = f'The line misses a curve: the residuals are {word[blocks[0]]}, then {word[blocks[1]]}, then {word[blocks[2]]}, so a curved model should be tried.'
        return pick(options, lambda l: clean(l) == want, 'curved residual pattern')
    require(max(abs(r) for r in res) <= 2, 'Small residuals expected')
    return pick(options, lambda l: clean(l) == 'The residuals are small and show no pattern, so the line is a reasonable model for these values of x.', 'reasonable fit')


SOLVERS = {
    'normal-model-rule': solve_normal,
    'random-variable-distribution': solve_random_variable,
    'theoretical-distribution-expectation': solve_theoretical,
    'empirical-distribution-expectation': solve_empirical,
    'strategy-expected-value': solve_strategy,
    'fair-selection-procedure': solve_fair,
    'simulation-consistency-check': solve_simulation,
    'randomization-test-decision': solve_randomization,
    'report-flaw-critique': solve_report,
    'model-residual-conclusion': solve_residual,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected statistics family')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'Statistics answer key mismatch')
    return result


def self_test():
    def build(template, prompt, labels, correct, figure=None):
        public = {'templateId': template, 'prompt': prompt,
                  'response': {'kind': 'choice', 'options': [{'id': f'option-{i}', 'label': l} for i, l in enumerate(labels)]}}
        if figure:
            public['figure'] = figure
        return {'public': public, 'answer': f'option-{correct}'}

    bars = lambda cats, vals: {'kind': 'bar-chart', 'categories': [str(c) for c in cats], 'values': vals, 'valueLabel': 'n'}
    sim_prompt = ('A coin maker says a new coin lands heads with probability $\\frac{1}{2}$. In a test of 20 tosses, the coin landed heads 4 times. '
                  'The chart shows the number of heads in each of 100 sets of 20 tosses simulated under the model. Count the sets at least as far from 10 as 4 is, in either direction (4 or fewer, or 16 or more). '
                  'Fewer than 2% that extreme means not consistent with the model. What do you conclude?')
    sim_fig = bars(range(4, 17), [1, 1, 5, 6, 10, 18, 18, 17, 11, 6, 4, 2, 1])
    rand_prompt = ('Volunteers were randomly assigned to plant food A or plant food B. The difference in mean growth (plant food A minus plant food B) was 3 cm. '
                   'To test whether plant food A gave a higher mean growth, the labels were reshuffled 200 times; the chart shows how many reshuffles gave each difference. '
                   'Count the reshuffles with a difference of 3 or more. Significant means that proportion is less than 5%. What do you conclude?')
    rand_fig = bars(range(-6, 7), [3, 2, 6, 14, 24, 33, 37, 32, 24, 13, 8, 3, 1])
    report = ('A transit agency selected 1200 riders at random from a complete list of all riders on its bus system. The question was which of two proposed schedules they prefer. '
              '51% chose Schedule X and 49% chose the other option. The report\'s bar chart uses a vertical axis that starts at 0%. Headline: "Most riders prefer Schedule X." Which flaw most weakens the headline conclusion?')
    resid = ('A linear model $\\hat y=4x+15$ predicts the distance a cyclist has ridden (km) after $x$ hours. A residual is observed minus predicted. The data: '
             + '; '.join(f'x = {x}: observed {4*x+15+r}, predicted {4*x+15}, residual {str(r).replace("-", "−")}' for x, r in zip(range(1, 8), [1, -1, 0, 1, -1, 0, 1]))
             + '. The residuals are small and show no pattern. A report uses the model to predict the distance a cyclist has ridden when $x=48$. Which statement is justified?')
    cases = [
        build('normal-model-rule', 'The fill weights of boxes from a cereal machine are approximately normal with mean 510 g and standard deviation 4 g. Using the 68–95–99.7 rule, about what percent of values are less than 506 g?',
              ['16%', '32%', '34%', '84%'], 0),
        build('normal-model-rule', 'The scores on a placement exam are approximately normal with mean 66 points and standard deviation 7 points. Using the 68–95–99.7 rule, about what percent of values lie between 45 and 80 points?',
              ['49.85%', '97.35%', '95%', '99.7%'], 1),
        build('random-variable-distribution', 'A fair coin is tossed 3 times. Let $X$ be the number of heads. What is $P(X=0)$?',
              ['$\\frac{1}{8}$', '$\\frac{1}{9}$', '$\\frac{1}{6}$', '$\\frac{1}{4}$'], 0),
        build('theoretical-distribution-expectation', 'You roll two fair dice. If the sum is 2 or 3, you win 5 dollars; otherwise you lose 5 dollars. Let $X$ be your net gain in dollars. Find the expected value $E(X)$ exactly.',
              ['$-\\frac{25}{6}$ dollars', '$0$ dollars', '$-150$ dollars', '$\\frac{5}{12}$ dollars'], 0),
        build('empirical-distribution-expectation', 'The bar chart shows the observed number of delayed orders in each of 40 days. Suppose the same pattern holds for 400 days in the season. About how many delayed orders in total should be expected?',
              ['84', '840', '2.1', '800'], 1, bars(range(5), [7, 9, 5, 11, 8])),
        build('strategy-expected-value', 'A warranty costs 170 dollars. Without it, there is a probability of $\\frac{3}{10}$ that you pay a 600-dollar repair bill and otherwise pay nothing. Which statement is justified by comparing expected costs?',
              ['Buy the warranty: the expected repair cost without it is 420 dollars, compared with its price of 170 dollars.',
               'Skip the warranty: a repair is unlikely, with probability only $\\frac{3}{10}$.',
               'Buy the warranty: the expected repair cost without it is 180 dollars, compared with its price of 170 dollars.',
               'Either choice is equally good: you pay at most 600 dollars either way.'], 2),
        build('fair-selection-procedure', 'To pick one of 11 students numbered 1 to 11, a teacher rolls two fair six-sided dice and chooses the student numbered (sum − 1). What is the probability that student 8 is chosen?',
              ['$\\frac{4}{11}$', '$\\frac{1}{11}$', '$\\frac{1}{3}$', '$\\frac{1}{9}$'], 3),
        build('simulation-consistency-check', sim_prompt,
              ['0 of 100 sets (0%): not consistent with the model', '1 of 100 sets (1%): not consistent with the model',
               '98 of 100 sets (98%): consistent with the model', '2 of 100 sets (2%): consistent with the model'], 3, sim_fig),
        build('randomization-test-decision', rand_prompt,
              ['50 of 200 reshuffles (25%): not significant; chance could explain it', '25 of 200 reshuffles (12.5%): not significant; chance could explain it',
               '13 of 200 reshuffles (6.5%): not significant; chance could explain it', '175 of 200 reshuffles (87.5%): not significant; chance could explain it'], 1, rand_fig),
        build('report-flaw-critique', report,
              ['Convenience sample: the people asked do not represent the whole group.', 'Voluntary response: only people who chose to reply are counted.',
               'Sample too small: a few people give an unreliable estimate.', 'No margin of error: a close result is reported as if it were certain.'], 3),
        build('model-residual-conclusion', resid,
              ['The prediction at x = 48 is reliable, because the residuals for x = 1 to 7 are small.', 'No prediction from any model can ever be made.',
               'The prediction at x = 48 is an extrapolation far beyond x = 1 to 7, so these residuals do not show it is reliable.', 'The prediction is reliable, because the model is a straight line.'], 2),
    ]
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Corrupt statistics problem was accepted')

    for case in cases:
        review_problem(case)
        wrong = copy.deepcopy(case)
        wrong['answer'] = 'option-0' if case['answer'] != 'option-0' else 'option-1'
        reject(wrong)
        dup = copy.deepcopy(case)
        dup['public']['response']['options'][3]['label'] = dup['public']['response']['options'][2]['label']
        reject(dup)
        if case['public'].get('figure'):
            bad = copy.deepcopy(case)
            bad['public']['figure']['values'][3] += 1  # chart no longer matches its stated total
            reject(bad)
    # Boundary wording: exactly the cutoff percentage is NOT "fewer than" it, so a wrong verdict fails.
    boundary = copy.deepcopy(cases[7])
    boundary['public']['response']['options'][3]['label'] = '2 of 100 sets (2%): not consistent with the model'
    boundary['public']['response']['options'][1]['label'] = '2 of 100 sets (2%): consistent with the model'
    boundary['answer'] = 'option-3'
    reject(boundary)
    # Fair procedure: a 6-student class makes the single-die procedure fair, so a 10-student
    # claim for it must fail.
    fair = build('fair-selection-procedure', 'A teacher must choose one of 10 students at random so that every student has exactly the same chance. Which procedure does that?',
                 ['Spin an arrow on a wheel divided into 10 equal sectors, one per student.', 'Roll one fair six-sided die and use the result as the student number.',
                  'Roll a fair 12-sided die; the remainder after dividing by 10 is the student (remainder 0 means student 10).',
                  'Roll two fair dice, add them, and choose student sum − 1; roll again if the sum is above 11.'], 0)
    review_problem(fair)
    bad = copy.deepcopy(fair)
    bad['answer'] = 'option-2'
    reject(bad)
    return {'fixtures': len(cases) + 1, 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
