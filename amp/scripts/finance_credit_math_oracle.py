"""Independent exact review of interest, loan, credit-card and saving-plan problems.

Every answer is re-derived from the displayed prompt only, with exact Fractions.
Rounding is applied exactly where each prompt states it (to the cent, half up);
a computation that lands exactly on a half cent is rejected as ambiguous.
"""
import copy
import re
from fractions import Fraction as Q

SUPPORTED = frozenset({
    'interest-compare-years', 'loan-total-cost', 'loan-compare-options', 'credit-card-balance',
    'credit-cost-concepts', 'savings-plan-growth', 'interest-table-type',
})
NUM = r'([\d,]+(?:\.\d+)?)'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def num(text):
    return Q(text.replace(',', ''))


def cents(value):
    """Round a Fraction to the cent, half up; reject exact half-cent ties."""
    scaled = Q(value) * 100
    require(scaled - (scaled.numerator // scaled.denominator) != Q(1, 2), 'Half-cent tie makes rounding ambiguous')
    return Q((scaled + Q(1, 2)).__floor__(), 100)


def plain(text):
    return text.replace('−', '-').replace('{,}', ',').replace('\\text{', '').replace('}', '')


def match(pattern, text):
    m = re.fullmatch(pattern, text, flags=re.S)
    return m


def compound_balances(principal, rate_percent, years):
    balances = [Q(principal)]
    for _ in range(years):
        balances.append(balances[-1] + cents(balances[-1] * Q(rate_percent) / 100))
    return balances


def simple_balance(principal, rate_percent, years):
    return Q(principal) * (1 + Q(rate_percent) * years / 100)


# ---------- canonical option parsing ----------
def canon(label):
    text = plain(label)
    if m := match(NUM + r' dollars?', text):
        return ('$', num(m[1]))
    if m := match(r'(\d+) months', text):
        return ('months', int(m[1]))
    if m := match(NUM + '%', text):
        return ('%', num(m[1]))
    if m := match(r'Account (\w) holds ' + NUM + ' dollars more', text):
        return ('acct', m[1], num(m[2]))
    if m := match(r'Account (\w) earns compound interest; after (\d+) years it holds ' + NUM + r' dollars more than the other account\.', text):
        return ('table', m[1], int(m[2]), num(m[3]))
    if m := match(r'Account (\w), ' + NUM + ' dollars', text):
        return ('acct-hold', m[1], num(m[2]))
    if m := match(r'Offer (\d) costs ' + NUM + r' dollars less (?:in total|overall)', text):
        return ('offer', int(m[1]), num(m[2]))
    if m := match(r'Plan (\w) by ' + NUM + ' dollars', text):
        return ('plan', m[1], num(m[2]))
    if m := match(r'Offer (\d) has both the lower monthly payment and the lower total cost\.', text):
        return ('lower', int(m[1]), int(m[1]))
    if m := match(r'Offer (\d) has the lower monthly payment, and Offer (\d) has the lower total cost\.', text):
        return ('lower', int(m[1]), int(m[2]))
    raise ValueError(f'Unreadable choice: {label}')


# ---------- interest ----------
def parse_table(prompt):
    m = re.search(r'\\begin\{array\}\{c\|r+\}\\text\{Year\}&\\text\{Account A\}&\\text\{Account B\}\\\\\\hline (.*?)\\end\{array\}', prompt, flags=re.S)
    require(m is not None, 'Interest table missing')
    rows = []
    for row in m[1].split('\\\\'):
        cells = [num(plain(c)) for c in row.split('&')]
        require(len(cells) == 3, 'Table row needs year and two balances')
        rows.append(cells)
    require([int(r[0]) for r in rows] == list(range(len(rows))), 'Table years must run 0..n')
    return rows


def classify_table(rows):
    """Return (simple column index, compound column index) after checking the figure is internally exact."""
    columns = [[r[1] for r in rows], [r[2] for r in rows]]
    require(columns[0][0] == columns[1][0], 'Both accounts must start equal')
    principal = columns[0][0]
    step = columns[0][1] - principal
    rate = step / principal * 100
    constant = [len({b - a for a, b in zip(col, col[1:])}) == 1 for col in columns]
    require(sorted(constant) == [False, True], 'Exactly one column must have constant yearly growth')
    simple = constant.index(True)
    compound = 1 - simple
    require(columns[0][1] == columns[1][1], 'Year 1 must be equal for both accounts')
    require(all(columns[simple][i] == simple_balance(principal, rate, i) for i in range(len(rows))), 'Simple column disagrees with rate')
    require(columns[compound] == compound_balances(principal, rate, len(rows) - 1), 'Compound column disagrees with yearly rounding')
    return simple, compound, principal, rate


def solve_interest_table(prompt):
    rows = parse_table(prompt)
    simple, compound, principal, rate = classify_table(rows)
    cols = [[r[1] for r in rows], [r[2] for r in rows]]
    letter = 'AB'
    if m := re.search(r'How much interest does the compound-interest account earn during year (\d+)\?\n', prompt):
        start = re.search(r'started with ' + NUM + r' dollars', prompt)
        require(start is not None and num(start[1]) == principal, 'Starting amount mismatch')
        y = int(m[1])
        require(1 <= y < len(rows), 'Year outside table')
        return ('$', cols[compound][y] - cols[compound][y - 1])
    if m := re.search(r'Which account pays simple interest, and what will it hold after (\d+) years\?\n', prompt):
        require('nothing is added or withdrawn' in prompt, 'Prompt must state no other deposits')
        years = int(m[1])
        return ('acct-hold', letter[simple], simple_balance(principal, rate, years))
    if 'Which statement is true?\n' in prompt:
        n = len(rows) - 1
        return ('table', letter[compound], n, cols[compound][n] - cols[simple][n])
    raise ValueError('Unrecognised table question')


def solve_interest_compare(prompt):
    if '\\begin{array}' in prompt:
        return solve_interest_table(prompt)
    if m := match(r'Two accounts each start with ' + NUM + r' dollars and earn (\d+)% interest a year\. Account S pays simple interest on the original deposit only\. Account C pays compound interest: each year\'s interest is added to the balance at the end of the year, rounded to the nearest cent, and earns interest the next year\. Nothing else is added or withdrawn\. After (\d+) years, how much more does Account C hold than Account S\?', prompt):
        p, r, n = num(m[1]), num(m[2]), int(m[3])
        return ('$', compound_balances(p, r, n)[-1] - simple_balance(p, r, n))
    if m := match(r'Account S pays (\d+)% simple interest and Account C pays (\d+)% interest compounded yearly with each year\'s interest rounded to the nearest cent\. Each starts with ' + NUM + r' dollars and nothing else is added or withdrawn\. During year (\d+), how much more interest does Account C earn than Account S\?', prompt):
        require(m[1] == m[2], 'Rates must match')
        r, p, k = num(m[1]), num(m[3]), int(m[4])
        bal = compound_balances(p, r, k)
        return ('$', (bal[k] - bal[k - 1]) - p * r / 100)
    if m := match(r'Account (\w) starts with ' + NUM + r' dollars and pays (\d+)% simple interest a year\. Account (\w) also starts with ' + NUM + r' dollars and pays (\d+)% interest a year, compounded: each year\'s interest, rounded to the nearest cent, is added to the balance\. With no deposits or withdrawals, which account holds more after (\d+) years, and by how much\?', prompt):
        require(m[2] == m[5], 'Both accounts must start equal')
        s, c = m[1], m[4]
        n = int(m[7])
        diff = simple_balance(num(m[2]), num(m[3]), n) - compound_balances(num(m[2]), num(m[6]), n)[-1]
        require(diff != 0, 'Tie between accounts')
        return ('acct', s if diff > 0 else c, abs(diff))
    raise ValueError('Unrecognised interest-compare prompt')


# ---------- loans ----------
def solve_loan_total(prompt):
    if m := match(r'\w+ borrows ' + NUM + r' dollars(?: .*?)? for (\d+) months\. At (\d+)% interest the monthly payment is ' + NUM + r' dollars\. At (\d+)% interest it is ' + NUM + r' dollars\. How much more does \w+ repay in total with the (\d+)% loan\?', prompt):
        n = int(m[2])
        loans = {int(m[3]): num(m[4]), int(m[5]): num(m[6])}
        asked = int(m[7])
        require(asked in loans and len(loans) == 2, 'Asked loan must be one of the two')
        other = [k for k in loans if k != asked][0]
        diff = n * (loans[asked] - loans[other])
        require(diff > 0 and asked > other, 'Asked loan must cost more with the higher rate')
        return ('$', diff)
    if m := match(r'\w+ can borrow ' + NUM + r' dollars .*? at the same interest rate for two different terms\. Over (\d+) months the payment is ' + NUM + r' dollars\. Over (\d+) months the payment is ' + NUM + r' dollars\. How much more is the total finance charge for the longer loan\?', prompt):
        terms = sorted([(int(m[2]), num(m[3])), (int(m[4]), num(m[5]))])
        diff = terms[1][0] * terms[1][1] - terms[0][0] * terms[0][1]
        require(diff > 0, 'Longer loan must cost more')
        return ('$', diff)
    if m := match(r'\w+ borrows ' + NUM + r' dollars .*? and repays it in (\d+) equal monthly payments\. The finance charge is ' + NUM + r' dollars\. How much is each monthly payment\?', prompt):
        pay = (num(m[1]) + num(m[3])) / int(m[2])
        require(pay.denominator == 1, 'Payment must be a whole dollar amount')
        return ('$', pay)
    if m := match(r'\w+ borrows ' + NUM + r' dollars .*?\. The loan is repaid with (\d+) equal monthly payments of ' + NUM + r' dollars\. How much does \w+ pay back in all\?', prompt):
        return ('$', int(m[2]) * num(m[3]))
    if m := match(r'\w+ borrows ' + NUM + r' dollars .*? repays it with (\d+) monthly payments of ' + NUM + r' dollars\. The finance charge is the total repaid minus the amount borrowed\. What is the finance charge\?', prompt):
        total = int(m[2]) * num(m[3])
        require(total > num(m[1]), 'Finance charge must be positive')
        return ('$', total - num(m[1]))
    if m := match(r'\w+ borrows ' + NUM + r' dollars .*? for (\d+) years and pays ' + NUM + r' dollars each month\. How much does \w+ repay in total\?', prompt):
        return ('$', 12 * int(m[2]) * num(m[3]))
    raise ValueError('Unrecognised loan-total prompt')


def check_amortised(principal, rate_percent, months, payment):
    """The stated payment must be the whole-dollar payment of an amortised loan at that rate."""
    i = Q(rate_percent) / 1200
    exact = principal / months if i == 0 else principal * i / (1 - (1 + i) ** -months)
    require(abs(exact - payment) <= 1, f'Payment {payment} is not near the amortised payment {float(exact):.2f}')


def solve_loan_compare(prompt):
    if m := match(r'\w+ needs ' + NUM + r' dollars\. Offer 1 is (\d+)% interest with (\d+) monthly payments of ' + NUM + r' dollars\. Offer 2 is (\d+)% interest with (\d+) monthly payments of ' + NUM + r' dollars\. Which offer costs less in total, and by how much\?', prompt):
        principal = num(m[1])
        totals = {1: int(m[3]) * num(m[4]), 2: int(m[6]) * num(m[7])}
        check_amortised(principal, int(m[2]), int(m[3]), num(m[4]))
        check_amortised(principal, int(m[5]), int(m[6]), num(m[7]))
        require(totals[1] != totals[2], 'Tie between offers')
        cheaper = 1 if totals[1] < totals[2] else 2
        return ('offer', cheaper, abs(totals[1] - totals[2]))
    if m := match(r'\w+ needs ' + NUM + r' dollars\. Offer 1 has no fee: (\d+) monthly payments of ' + NUM + r' dollars\. Offer 2 has a ' + NUM + r' dollars fee paid at the start, then (\d+) monthly payments of ' + NUM + r' dollars\. Counting the fee, which offer costs less overall, and by how much\?', prompt):
        totals = {1: int(m[2]) * num(m[3]), 2: num(m[4]) + int(m[5]) * num(m[6])}
        require(totals[1] != totals[2], 'Tie between offers')
        cheaper = 1 if totals[1] < totals[2] else 2
        return ('offer', cheaper, abs(totals[1] - totals[2]))
    if m := match(r'\w+ compares two loans of ' + NUM + r' dollars\. Offer 1 is (\d+) monthly payments of ' + NUM + r' dollars\. Offer 2 is (\d+) monthly payments of ' + NUM + r' dollars\. Which statement is true\?', prompt):
        pay = {1: num(m[3]), 2: num(m[5])}
        total = {1: int(m[2]) * pay[1], 2: int(m[4]) * pay[2]}
        require(pay[1] != pay[2] and total[1] != total[2], 'Ties make the statement ambiguous')
        return ('lower', 1 if pay[1] < pay[2] else 2, 1 if total[1] < total[2] else 2)
    raise ValueError('Unrecognised loan-compare prompt')


# ---------- credit cards ----------
CARD_HEAD = r"\w+'s credit card has an APR of (\d+)%, so its monthly rate is (\d+)% ÷ 12 = ([\d.]+)%\. Each month's interest is the monthly rate times the balance at the start of that month, rounded to the nearest cent, and it is added before \w+ pays\. "


def monthly_rate(apr, apr2, stated):
    require(apr == apr2, 'APR repeated inconsistently')
    rate = Q(apr) / 12
    require(num(stated) == rate, 'Stated monthly rate is not APR/12')
    return rate / 100


def solve_card(prompt):
    if m := match(CARD_HEAD + r'The balance at the start of the month is ' + NUM + r' dollars\. If \w+ pays the ' + NUM + r' dollars minimum, the balance at the end of the month is ' + NUM + r' dollars\. How much lower is the end-of-month balance if \w+ pays ' + NUM + r' dollars instead\?', prompt):
        rate = monthly_rate(m[1], m[2], m[3])
        bal, low, given_end, high = num(m[4]), num(m[5]), num(m[6]), num(m[7])
        interest = cents(bal * rate)
        require(bal + interest - low == given_end, 'Stated minimum-payment balance is wrong')
        require(high > low and bal + interest - high >= 0, 'Larger payment must stay within the balance')
        return ('$', (bal + interest - low) - (bal + interest - high))
    if m := match(CARD_HEAD + r'The balance at the start of the month is ' + NUM + r' dollars, and \w+ pays ' + NUM + r' dollars\. The part of a payment that is not interest reduces the debt\. How much of this payment reduces the debt\?', prompt):
        rate = monthly_rate(m[1], m[2], m[3])
        interest = cents(num(m[4]) * rate)
        reduce = num(m[5]) - interest
        require(reduce > 0, 'Payment must exceed interest')
        return ('$', reduce)
    if m := match(CARD_HEAD + r'The balance at the start of month (\d+) is ' + NUM + r' dollars\. \w+ makes no purchases and pays ' + NUM + r' dollars at the end of each of two months\. What is the balance after the second payment\?', prompt):
        require(m[4] == '1', 'Sequence must start in month 1')
        rate = monthly_rate(m[1], m[2], m[3])
        bal, pay = num(m[5]), num(m[6])
        for _ in range(2):
            bal = bal + cents(bal * rate) - pay
            require(bal > 0, 'Balance must stay positive')
        return ('$', bal)
    if m := match(CARD_HEAD + r'The balance at the start of the month is ' + NUM + r' dollars\. There are no new purchases, and \w+ makes one payment of ' + NUM + r' dollars\. What is the balance at the end of the month\?', prompt):
        rate = monthly_rate(m[1], m[2], m[3])
        bal = num(m[4])
        end = bal + cents(bal * rate) - num(m[5])
        require(end > 0, 'Balance must stay positive')
        return ('$', end)
    if m := match(CARD_HEAD + r'The balance at the start of month (\d+) is ' + NUM + r' dollars\. \w+ makes no purchases and pays ' + NUM + r' dollars at the end of each month for three months\. How much interest is charged in all three months\?', prompt):
        require(m[4] == '1', 'Sequence must start in month 1')
        rate = monthly_rate(m[1], m[2], m[3])
        bal, pay, total = num(m[5]), num(m[6]), Q(0)
        for _ in range(3):
            i = cents(bal * rate)
            total += i
            bal = bal + i - pay
            require(bal > 0, 'Balance must stay positive')
        return ('$', total)
    if m := match(CARD_HEAD + r'The balance at the start of this month is ' + NUM + r' dollars\. What is this month\'s interest, the finance charge\?', prompt):
        rate = monthly_rate(m[1], m[2], m[3])
        return ('$', cents(num(m[4]) * rate))
    raise ValueError('Unrecognised credit-card prompt')


def solve_credit_concept(prompt):
    if m := match(r"\w+ carries a balance of " + NUM + r" dollars for one month\. Card X has a (\d+)% APR and Card Y has a (\d+)% APR\. Each card's monthly rate is its APR ÷ 12, and each month's interest is rounded to the nearest cent\. How much less interest does Card X charge for the month\?", prompt):
        bal = num(m[1])
        x, y = cents(bal * Q(m[2]) / 1200), cents(bal * Q(m[3]) / 1200)
        require(y > x, 'Card X must charge less')
        return ('$', y - x)
    if m := match(r"\w+'s statement balance is " + NUM + r" dollars on a card with a (\d+)% APR, so the monthly rate is ([\d.]+)%\. Paying the full balance by the due date costs no interest\. If \w+ instead pays only the " + NUM + r" dollars minimum, interest for the month is charged on the unpaid part of the balance, rounded to the nearest cent\. How much more interest does \w+ pay by paying only the minimum than by paying in full\?", prompt):
        require(num(m[3]) == Q(m[2]) / 12, 'Stated monthly rate is not APR/12')
        bal, minimum = num(m[1]), num(m[4])
        require(0 < minimum < bal, 'Minimum payment must be below the balance')
        return ('$', cents((bal - minimum) * num(m[3]) / 100))
    if m := match(r"\w+'s card statement starts at " + NUM + r" dollars\. The APR is (\d+)% \(monthly rate ([\d.]+)%\)\. During the month, interest is charged on the starting balance, rounded to the nearest cent\. \w+ also buys " + NUM + r" dollars of items, is charged a " + NUM + r" dollars late fee, and makes a " + NUM + r" dollars payment\. What is the new balance\?", prompt):
        require(num(m[3]) == Q(m[2]) / 12, 'Stated monthly rate is not APR/12')
        bal = num(m[1])
        return ('$', bal + cents(bal * num(m[3]) / 100) + num(m[4]) + num(m[5]) - num(m[6]))
    if m := match(r"\w+ buys an item for " + NUM + r" dollars\. A debit card takes the price from checking right away and charges no interest\. A credit card on which \w+ pays nothing until after the due date adds one month of interest on the price at an APR of (\d+)% \(monthly rate ([\d.]+)%\), rounded to the nearest cent\. How much more does the item cost on credit after one month of interest than on debit\?", prompt):
        require(num(m[3]) == Q(m[2]) / 12, 'Stated monthly rate is not APR/12')
        return ('$', cents(num(m[1]) * num(m[3]) / 100))
    if m := match(r"A credit card charges ([\d.]+)% of the balance each month\. The APR, the annual percentage rate, is the monthly rate times 12 months\. What is this card's APR\?", prompt):
        return ('%', num(m[1]) * 12)
    if m := match(r"A credit card has an APR, annual percentage rate, of (\d+)%\. The monthly rate is the APR divided by 12 months\. What monthly rate does the card charge on its balance\?", prompt):
        return ('%', num(m[1]) / 12)
    raise ValueError('Unrecognised credit-concept prompt')


# ---------- savings ----------
def solve_savings(prompt):
    if m := match(r'\w+ has ' + NUM + r' dollars and wants exactly ' + NUM + r' dollars in (\d+) months, with no interest counted\. \w+ will make (\d+) equal monthly deposits\. How much should each deposit be\?', prompt):
        require(m[3] == m[4], 'Deposits must equal months')
        deposit = (num(m[2]) - num(m[1])) / int(m[3])
        require(deposit > 0 and deposit.denominator == 1, 'Deposit must be a positive whole dollar amount')
        return ('$', deposit)
    if m := match(r'Plan A starts with ' + NUM + r' dollars and adds ' + NUM + r' dollars each month\. Plan B starts with ' + NUM + r' dollars and adds ' + NUM + r' dollars each month\. After how many monthly deposits do the two plans hold the same amount\?', prompt):
        a0, da, b0, db = (num(m[i]) for i in range(1, 5))
        require(da != db, 'Parallel plans never meet')
        n = (b0 - a0) / (da - db)
        require(n > 0 and n.denominator == 1, 'Plans must meet after a whole positive number of deposits')
        return ('months', int(n))
    if m := match(r'\w+ has ' + NUM + r' dollars and wants ' + NUM + r' dollars for a trip\. \w+ will deposit ' + NUM + r' dollars at the end of each month and counts no interest\. In how many months will the balance first be at least ' + NUM + r' dollars\? Count whole months\.', prompt):
        require(m[2] == m[4], 'Goal repeated inconsistently')
        need = num(m[2]) - num(m[1])
        require(need > 0, 'Goal must exceed the start')
        k = -((-need) // num(m[3]))
        return ('months', int(k))
    if m := match(r'\w+ starts a savings plan with ' + NUM + r' dollars and deposits ' + NUM + r' dollars at the end of each month\. No interest is counted\. How much is in the account after (\d+) monthly deposits\?', prompt):
        return ('$', num(m[1]) + num(m[2]) * int(m[3]))
    if m := match(r'Plan A starts with ' + NUM + r' dollars and adds ' + NUM + r' dollars each month\. Plan B starts with ' + NUM + r' dollars and adds ' + NUM + r' dollars each month\. After (\d+) monthly deposits, which plan holds more, and by how much\?', prompt):
        n = int(m[5])
        a, b = num(m[1]) + num(m[2]) * n, num(m[3]) + num(m[4]) * n
        require(a != b, 'Tie between plans')
        return ('plan', 'A' if a > b else 'B', abs(a - b))
    if m := match(r'\w+ saves the same amount every month\. The table shows the balance in dollars at the end of months (\d+), (\d+) and (\d+)\. If the pattern continues, what is the balance at the end of month (\d+)\?\n\$\\begin\{array\}\{c\|ccc\}\\text\{Month\}&\d+&\d+&\d+\\\\\\hline\\text\{Balance\}&([\d,{}]+)&([\d,{}]+)&([\d,{}]+)\\end\{array\}\$', prompt):
        months = [int(m[1]), int(m[2]), int(m[3])]
        values = [num(plain(m[i])) for i in (5, 6, 7)]
        require(months == [1, 2, 3], 'Table months must be 1, 2, 3')
        require(values[1] - values[0] == values[2] - values[1] > 0, 'Table must grow by a constant')
        step = values[1] - values[0]
        k = int(m[4])
        return ('$', values[0] + step * (k - 1))
    raise ValueError('Unrecognised savings prompt')


SOLVERS = {
    'interest-compare-years': solve_interest_compare,
    'interest-table-type': solve_interest_compare,
    'loan-total-cost': solve_loan_total,
    'loan-compare-options': solve_loan_compare,
    'credit-card-balance': solve_card,
    'credit-cost-concepts': solve_credit_concept,
    'savings-plan-growth': solve_savings,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected finance family')
    require(public.get('figure') is None, 'Unexpected figure payload')
    response = public['response']
    require(response['kind'] == 'choice', 'Finance problems use choice responses')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    expected = SOLVERS[public['templateId']](public['prompt'])
    values = [canon(o['label']) for o in options]
    require(len(set(values)) == 4, 'Mathematically duplicate choices')
    require(len({v[0] for v in values}) == 1, 'Choices mix answer kinds')
    correct = [o['id'] for o, v in zip(options, values) if v == expected]
    require(len(correct) == 1, f'Missing or ambiguous correct choice for {expected}')
    return correct[0]


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'Finance answer key mismatch')
    # No leakage: a distinctive correct amount must not be printed in the prompt or hint.
    label = next(o['label'] for o in public['response']['options'] if o['id'] == result)
    amount = re.match(r'([\d,]+\.\d\d) dollars$', label) or re.match(r'([\d,]{5,}) dollars$', label)
    if amount:
        for text in (public['prompt'], problem.get('hint', '')):
            require(amount[1] not in plain(text), f'Correct amount {amount[1]} leaks into the prompt or hint')
    return result


def self_test():
    base = {
        'templateId': 'loan-total-cost', 'figure': None,
        'prompt': 'Amara borrows 27,500 dollars to pay for a roof repair. The loan is repaid with 24 equal monthly payments of 1,307 dollars. How much does Amara pay back in all?',
        'response': {'kind': 'choice', 'label': 'x', 'options': [
            {'id': 'option-a', 'label': '3,868 dollars'}, {'id': 'option-b', 'label': '28,807 dollars'},
            {'id': 'option-c', 'label': '30,061 dollars'}, {'id': 'option-d', 'label': '31,368 dollars'}]},
    }
    require(review_problem({'public': base, 'answer': 'option-d'}) == 'option-d', 'Finance self-test baseline failed')
    rejected = 0

    def reject(public, answer, message):
        nonlocal rejected
        try:
            review_problem({'public': public, 'answer': answer})
        except ValueError:
            rejected += 1
        else:
            raise ValueError(message)

    reject(base, 'option-c', 'Wrong key accepted')
    wrong = copy.deepcopy(base)
    wrong['response']['options'][0]['label'] = '31,368 dollars'
    reject(wrong, 'option-d', 'Duplicate correct choice accepted')
    wrong = copy.deepcopy(base)
    wrong['response']['options'][3]['label'] = '31,369 dollars'
    reject(wrong, 'option-d', 'Missing correct choice accepted')
    # Half-cent tie: 100.50 dollars at 1% monthly is 1.005 dollars.
    tie = {
        'templateId': 'credit-cost-concepts', 'figure': None,
        'prompt': "Ana buys an item for 100.50 dollars. A debit card takes the price from checking right away and charges no interest. A credit card on which Ana pays nothing until after the due date adds one month of interest on the price at an APR of 12% (monthly rate 1%), rounded to the nearest cent. How much more does the item cost on credit after one month of interest than on debit?",
        'response': {'kind': 'choice', 'label': 'x', 'options': [
            {'id': 'option-a', 'label': '1.00 dollars'}, {'id': 'option-b', 'label': '1.01 dollars'},
            {'id': 'option-c', 'label': '10.05 dollars'}, {'id': 'option-d', 'label': '100.50 dollars'}]},
    }
    reject(tie, 'option-b', 'Half-cent tie accepted')
    # Credit card rate that is not APR/12 must fail.
    card = {
        'templateId': 'credit-card-balance', 'figure': None,
        'prompt': "Luis's credit card has an APR of 18%, so its monthly rate is 18% ÷ 12 = 1.4%. Each month's interest is the monthly rate times the balance at the start of that month, rounded to the nearest cent, and it is added before Luis pays. The balance at the start of this month is 1,000 dollars. What is this month's interest, the finance charge?",
        'response': {'kind': 'choice', 'label': 'x', 'options': [
            {'id': 'option-a', 'label': '14.00 dollars'}, {'id': 'option-b', 'label': '15.00 dollars'},
            {'id': 'option-c', 'label': '18.00 dollars'}, {'id': 'option-d', 'label': '1,015.00 dollars'}]},
    }
    reject(card, 'option-a', 'Inconsistent monthly rate accepted')
    # Tie between loan totals must fail.
    offers = {
        'templateId': 'loan-compare-options', 'figure': None,
        'prompt': 'Maya compares two loans of 4,500 dollars. Offer 1 is 24 monthly payments of 150 dollars. Offer 2 is 36 monthly payments of 100 dollars. Which statement is true?',
        'response': {'kind': 'choice', 'label': 'x', 'options': [
            {'id': 'option-a', 'label': 'Offer 1 has the lower monthly payment, and Offer 2 has the lower total cost.'},
            {'id': 'option-b', 'label': 'Offer 2 has the lower monthly payment, and Offer 1 has the lower total cost.'},
            {'id': 'option-c', 'label': 'Offer 2 has both the lower monthly payment and the lower total cost.'},
            {'id': 'option-d', 'label': 'Offer 1 has both the lower monthly payment and the lower total cost.'}]},
    }
    reject(offers, 'option-c', 'Tied totals accepted')
    # Table where the compound column is not yearly-rounded must fail.
    table = {
        'templateId': 'interest-table-type', 'figure': None,
        'prompt': 'Both accounts started with 1,000 dollars and earn the same yearly rate; nothing is added or withdrawn. One account pays simple interest and one pays compound interest. The table shows year-end balances in dollars. Which account pays simple interest, and what will it hold after 10 years?\n$\\begin{array}{c|rr}\\text{Year}&\\text{Account A}&\\text{Account B}\\\\\\hline 0&1{,}000.00&1{,}000.00\\\\1&1{,}070.00&1{,}070.00\\\\2&1{,}140.00&1{,}144.00\\\\3&1{,}210.00&1{,}225.04\\end{array}$',
        'response': {'kind': 'choice', 'label': 'x', 'options': [
            {'id': 'option-a', 'label': 'Account A, 1,700 dollars'}, {'id': 'option-b', 'label': 'Account B, 1,700 dollars'},
            {'id': 'option-c', 'label': 'Account A, 1,070 dollars'}, {'id': 'option-d', 'label': 'Account B, 700 dollars'}]},
    }
    reject(table, 'option-a', 'Inconsistent table accepted')
    good = copy.deepcopy(table)
    good['prompt'] = good['prompt'].replace('1{,}144.00', '1{,}144.90')
    require(review_problem({'public': good, 'answer': 'option-a'}) == 'option-a', 'Valid table fixture rejected')
    require(rejected == 7, 'Finance corrupted fixtures were not all rejected')


# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED
