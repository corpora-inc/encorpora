#!/usr/bin/env python3
"""Independent prompt-based exact oracle. Read export-math-cases.ts JSONL on stdin."""
from rational_equation_math_oracle import RATIONAL_EQUATION, RATIONAL_EQUATION_CHOICE, solve_rational_equation, review_rational_equation_fixtures, review_rational_equation_problem
from geometry_proof_math_oracle import GEOMETRY_PROOF, solve_geometry_proof, review_geometry_proof_fixtures, review_geometry_proof_problem
from radical_equation_math_oracle import RADICAL_EQUATION, RADICAL_EQUATION_CHOICE, solve_radical_equation, review_radical_equation_fixtures, review_radical_equation_problem
from assessment_gap_math_oracle import SUPPORTED as ASSESSMENT_GAP, CHOICE as ASSESSMENT_GAP_CHOICE, solve as solve_assessment_gap, self_test as review_assessment_gap_fixtures, review_problem as review_assessment_gap_problem
from study_design_math_oracle import SUPPORTED as STUDY_DESIGN, solve as solve_study_design, review_problem as review_study_design_problem, self_test as review_study_design_fixtures
from quadratic_irrational_math_oracle import SUPPORTED as QUADRATIC_IRRATIONAL, solve as solve_quadratic_irrational, review_problem as review_quadratic_irrational_problem, self_test as review_quadratic_irrational_fixtures
from inverse_rounding_math_oracle import SUPPORTED as INVERSE_ROUNDING, solve as solve_inverse_rounding, review_problem as review_inverse_rounding_problem, self_test as review_inverse_rounding_fixtures
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path
from collections import Counter
from fractions import Fraction
from rational_expression_math_oracle import RATIONAL_EXPRESSION, solve_rational_expression, review_rational_expression_fixtures, review_rational_expression_problem
from nonlinear_system_math_oracle import NONLINEAR_SYSTEM, solve_nonlinear_system, review_nonlinear_system_fixtures, review_nonlinear_system_problem
from elementary_math_oracle import ELEMENTARY, solve_elementary
from equal_groups_math_oracle import EQUAL_GROUPS, solve_equal_groups
from fraction_math_oracle import FRACTION_PRACTICE, solve_fraction_practice
from choice_math_oracle import CHOICE, solve_choice
from measurement_math_oracle import SUPPORTED as MEASUREMENT, solve as solve_measurement, self_test as review_measurement_fixtures
from algebra_math_oracle import ALGEBRA, ALGEBRA_CHOICE, solve_algebra, review_algebra_fixtures
from quadratic_math_oracle import QUADRATIC, QUADRATIC_CHOICE, solve_quadratic, review_quadratic_fixtures
from absolute_value_math_oracle import ABSOLUTE_VALUE, solve_absolute_value, review_absolute_value_fixtures, review_absolute_value_content, review_absolute_value_content_mutations
from polynomial_math_oracle import POLYNOMIAL, solve_polynomial, review_polynomial_fixtures, PolynomialShortcutReview
from factoring_math_oracle import FACTORING, solve_factoring, review_factoring_fixtures, review_explanation as review_factoring_explanation, FactoringReview, review_factoring_content
from inequality_math_oracle import INEQUALITY, solve_inequality, review_inequality_fixtures, InequalityReview, review_inequality_content
from percent_change_math_oracle import PERCENT_CHANGE, solve_percent_change, review_percent_change_fixtures, check_explanation as review_percent_explanation, review_percent_change_content
from linear_system_math_oracle import LINEAR_SYSTEM, solve_linear_system, review_linear_system_fixtures, LinearSystemReview, review_linear_system_explanation, review_linear_system_content
from right_triangle_math_oracle import RIGHT_TRIANGLE, RIGHT_TRIANGLE_CHOICE, solve_right_triangle, review_right_triangle_fixtures, RightTriangleCorpusReview, review_converse_explanation
from integer_exponent_math_oracle import INTEGER_EXPONENT, solve_integer_exponent, review_integer_exponent_fixtures, review_integer_exponent_explanation, review_integer_exponent_content, IntegerExponentReview
from right_triangle_figure_oracle import review_right_triangle_figures
from exponential_math_oracle import EXPONENTIAL, EXPONENTIAL_CHOICE, solve_exponential, review_exponential_fixtures
from power_math_oracle import POWER, POWER_CHOICE, solve_power, review_power_fixtures, review_power_problem
from algebra_statistics_math_oracle import ALGEBRA_STATISTICS, ALGEBRA_STATISTICS_CHOICE, solve_algebra_statistics, review_algebra_statistics_fixtures, review_algebra_statistics_problem
from coordinate_circle_math_oracle import COORDINATE_CIRCLE, solve_coordinate_circle, review_coordinate_circle_fixtures, review_coordinate_circle_problem
from similarity_trig_math_oracle import SIMILARITY_TRIG, solve_similarity_trig, review_similarity_trig_fixtures, review_similarity_trig_problem
from probability_rules_math_oracle import PROBABILITY_RULES, solve_probability_rules, review_probability_rules_fixtures, review_probability_rules_problem
from polygon_math_oracle import POLYGONS, POLYGONS_CHOICE, solve_polygon, review_polygon_fixtures, review_polygon_problem
from angle_math_oracle import ANGLES, ANGLES_CHOICE, solve_angle, review_angle_fixtures, review_angle_problem
from shape_math_oracle import SHAPES, SHAPES_CHOICE, solve_shape, review_shape_fixtures, review_shape_problem
from volume_coordinate_math_oracle import VOLUME_COORDINATE, VOLUME_COORDINATE_CHOICE, solve_volume_coordinate, review_volume_coordinate_fixtures, review_volume_coordinate_problem
from circle_measurement_math_oracle import CIRCLE, solve_circle, review_circle_fixtures, review_circle_content
from descriptive_statistics_math_oracle import DESCRIPTIVE_STATISTICS, solve_descriptive_statistics, review_descriptive_statistics_fixtures, review_explanation as review_statistics_explanation, review_descriptive_statistics_content, review_content_mutations as review_statistics_content_mutations
from completing_square_math_oracle import IDS as COMPLETING_SQUARE, solve_complete_square, self_test as review_completing_square_fixtures
from completing_square_content_oracle import CompletingSquareReview, self_test as review_completing_square_content_fixtures, review_completing_square_content
from print_math_oracle import review_print_math
from print_pdf_oracle import review_print_pdfs
from radical_public_oracle import RADICAL_TYPES, solve_radical, review_fixtures as review_radical_fixtures
from radical_math_oracle import review_arithmetic_fixtures as review_radical_arithmetic
from radical_content_oracle import check_problem as review_radical_problem, review_radical_content
from transformation_math_oracle import TRANSFORMATION, TRANSFORMATION_CHOICE, solve_transformation, review_transformation_fixtures, review_problem as review_transformation_problem, review_transformation_content, review_content_mutations as review_transformation_mutations
from angle_triangle_math_oracle import ANGLE_TRIANGLE, CHOICE_TYPES as ANGLE_TRIANGLE_CHOICE, solve_angle_triangle, review_angle_triangle_fixtures
from real_number_math_oracle import REAL_NUMBER, REAL_NUMBER_CHOICE, solve_real_number, review_real_number_fixtures, review_problem as review_real_number_problem, review_real_number_content, review_content_mutations as review_real_number_mutations
from number_system_math_oracle import NUMBER_SYSTEM, NUMBER_SYSTEM_CHOICE, solve_number_system, review_number_system_fixtures, review_problem as review_number_system_problem, review_number_system_content, review_content_mutations as review_number_system_mutations
from ratio_rate_math_oracle import RATIO_RATE, CHOICE_TYPES as RATIO_RATE_CHOICE, solve_ratio_rate, review_ratio_rate_fixtures, review_problem as review_ratio_rate_problem, review_ratio_rate_content, review_content_mutations as review_ratio_rate_mutations
from two_variable_math_oracle import TWO_VARIABLE, TWO_VARIABLE_CHOICE, solve_two_variable, review_two_variable_fixtures, review_problem as review_two_variable_problem, review_two_variable_content, review_content_mutations as review_two_variable_mutations
from linear_function_math_oracle import LINEAR_FUNCTION, LINEAR_FUNCTION_CHOICE, solve_linear_function, review_linear_function_fixtures, review_problem as review_linear_function_problem, review_linear_function_content, review_content_mutations as review_linear_function_mutations
from function_toolkit_math_oracle import FUNCTION_TOOLKIT, FUNCTION_TOOLKIT_CHOICE, solve_function_toolkit, review_function_toolkit_fixtures, review_problem as review_function_toolkit_problem, review_function_toolkit_content, review_content_mutations as review_function_toolkit_mutations
from quadratic_structure_math_oracle import QUADRATIC_STRUCTURE, QUADRATIC_STRUCTURE_CHOICE, solve_quadratic_structure, review_quadratic_structure_fixtures, review_problem as review_quadratic_structure_problem, review_quadratic_structure_content, review_content_mutations as review_quadratic_structure_mutations
from pattern_function_math_oracle import PATTERN_FUNCTION, PATTERN_FUNCTION_CHOICE, solve_pattern_function, review_pattern_function_fixtures, review_problem as review_pattern_function_problem, review_pattern_function_content, review_content_mutations as review_pattern_function_mutations
from equation_math_oracle import EQUATIONS, EQUATIONS_CHOICE, solve_equations, review_equation_fixtures, review_problem as review_equation_problem, review_equation_content, review_content_mutations as review_equation_mutations
from combinatorics_math_oracle import COMBINATORICS, solve_combinatorics, review_combinatorics_fixtures, review_problem as review_combinatorics_problem, review_combinatorics_content, review_content_mutations as review_combinatorics_mutations
from area_volume_math_oracle import AREA_VOLUME, solve_area_volume, review_area_volume_fixtures, review_problem as review_area_volume_problem, review_area_volume_content, review_content_mutations as review_area_volume_mutations
from rational_math_oracle import RATIONAL_TYPES, solve_rational, review_fixtures as review_rational_fixtures, RationalCorpus
from number_sense_math_oracle import NUMBER_SENSE, solve_number_sense, review_number_sense_fixtures, NumberSenseCorpus
from multiply_divide_math_oracle import MULTIPLY_DIVIDE, solve_multiply_divide, review_multiply_divide_fixtures, MultiplyDivideCorpus
from add_subtract_math_oracle import ADD_SUBTRACT, solve_add_subtract, review_add_subtract_fixtures, AddSubtractCorpus
from facts_math_oracle import FACTS, solve_facts, review_facts_fixtures, FactsCorpus
from fact_arrays_math_oracle import FACT_ARRAYS, solve_fact_arrays, review_fact_arrays_fixtures, FactArraysCorpus
from early_operations_math_oracle import EARLY_OPERATIONS, solve_early_operations, review_early_operations_fixtures, EarlyOperationsCorpus
from part_whole_math_oracle import PART_WHOLE, solve_part_whole, review_part_whole_fixtures
from decimal_math_oracle import DECIMAL, solve_decimal, review_decimal_fixtures, DecimalCorpus
from time_money_math_oracle import TIME_MONEY, TIME_MONEY_CHOICE, solve_time_money, review_time_money_fixtures
from attribute_math_oracle import ATTRIBUTE, ATTRIBUTE_CHOICE, solve_attribute, review_attribute_fixtures
from comparison_math_oracle import COMPARISON, COMPARISON_CHOICE, solve_comparison, review_comparison_fixtures, ComparisonCorpus
from data_display_math_oracle import DATA_DISPLAY, DATA_DISPLAY_CHOICE, solve_data_display, review_data_display_fixtures
from rational_content_oracle import check_problem as review_rational_problem, review_rational_content

# Add an independently derived solver here before adding a generated family.
SUPPORTED = frozenset({
    'count-objects', 'add-within-20', 'subtract-within-20',
    'fraction-model', 'add-fractions', 'rectangle-area', 'linear-equation',
    'mean-data', 'right-triangle', 'quadratic-vertex', 'geometric-sequence',
    'logarithm-integer', 'place-value-digit', 'decimal-addition',
    'compare-fractions', 'multiply-fractions', 'divide-fractions', 'ratio-missing',
    'percent-of', 'integer-addition', 'line-slope',
    'linear-system-x', 'simple-probability', 'arithmetic-term',
    'function-evaluation', 'unit-price', 'decimal-multiplication', 'operation-order',
    'coordinate-point-reading', 'graphed-line-slope', 'bar-chart-total',
    'bar-chart-difference', 'clock-elapsed-minutes', 'number-line-distance',
})
SUPPORTED = AREA_VOLUME | ANGLE_TRIANGLE | REAL_NUMBER | COMBINATORICS | DESCRIPTIVE_STATISTICS | SUPPORTED | CIRCLE | ELEMENTARY | FRACTION_PRACTICE | CHOICE | EQUAL_GROUPS | ALGEBRA | MEASUREMENT | QUADRATIC | POLYNOMIAL | INEQUALITY | RIGHT_TRIANGLE | PERCENT_CHANGE | LINEAR_SYSTEM | RADICAL_TYPES | RATIONAL_TYPES | INTEGER_EXPONENT | NUMBER_SYSTEM | RATIO_RATE | PATTERN_FUNCTION | DATA_DISPLAY | COMPARISON | PART_WHOLE | EQUATIONS | FACTS | VOLUME_COORDINATE | ADD_SUBTRACT | DECIMAL | TIME_MONEY | SHAPES | FACT_ARRAYS | MULTIPLY_DIVIDE | ATTRIBUTE | EARLY_OPERATIONS | POLYGONS | ANGLES | TRANSFORMATION | PROBABILITY_RULES | NUMBER_SENSE | SIMILARITY_TRIG | COORDINATE_CIRCLE | POWER | ALGEBRA_STATISTICS
SUPPORTED |= QUADRATIC_IRRATIONAL
SUPPORTED |= INVERSE_ROUNDING
SUPPORTED |= STUDY_DESIGN
SUPPORTED |= ASSESSMENT_GAP
SUPPORTED |= RADICAL_EQUATION | RATIONAL_EQUATION | GEOMETRY_PROOF
SUPPORTED |= RATIONAL_EXPRESSION
SUPPORTED |= NONLINEAR_SYSTEM
SUPPORTED |= FACTORING
SUPPORTED |= COMPLETING_SQUARE
SUPPORTED |= LINEAR_FUNCTION
SUPPORTED |= QUADRATIC_STRUCTURE
SUPPORTED |= FUNCTION_TOOLKIT
SUPPORTED |= EXPONENTIAL
SUPPORTED |= TWO_VARIABLE


def require(condition, message):
    # Do not use assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


SUPPORTED |= ABSOLUTE_VALUE

PLAIN_MATH = re.compile(r'\$([^$]+)\$')


# Only a single typeset name is read as text: a variable ($x$, $A'$), a named
# point ($A(1, 2)$), a pair ($(x, y)$), an angle ($\\angle ABC$) or a fraction.
# A formula with an operation keeps its TeX, so checks of written arithmetic
# still see it.
PLAIN_NAME = re.compile(r"[A-Za-z]+'?|[A-Z]'?\([^()$=]*\)|\([a-z], [a-z]\)|\\angle\s*[A-Z]+'?|\\t?frac\{\d+\}\{\d+\}|[\dπ]+π?[a-z]?")


def plain_span(match):
    tex = match.group(1)
    if not PLAIN_NAME.fullmatch(tex):
        return match.group(0)
    reading = re.sub(r'\\angle\s*', '∠', tex)
    reading = re.sub(r'\\t?frac\{([^{}]*)\}\{([^{}]*)\}', r'\1/\2', reading)
    return reading.replace("'", '′')


def plain_reading(value):
    """The learner-facing text with each $…$ span that holds no other TeX
    command read as its text: $x$ as x, $A'$ as A′, $\\angle ABC$ as ∠ABC."""
    if isinstance(value, str):
        return PLAIN_MATH.sub(plain_span, value)
    if isinstance(value, list):
        return [plain_reading(item) for item in value]
    if isinstance(value, dict):
        return {key: plain_reading(item) for key, item in value.items()}
    return value

def read_plainly(check):
    """A family check that retries once with the plain reading of a problem,
    lesson or record whose variables are typeset ($x$ read as x)."""
    def check_typeset(*args, **kwargs):
        readings = [plain_reading(arg) for arg in args]
        retry = readings != list(args)
        try:
            result = check(*args, **kwargs)
            if result is not False or not retry:
                return result
        except (ValueError, TypeError, KeyError, AttributeError, StopIteration):
            if not retry:
                raise
        return check(*readings, **kwargs)
    check_typeset.__wrapped__ = check
    return check_typeset


# Family oracles also call their own solvers and checks (worksheet, lesson and
# explanation reviews); each reads typeset variables the same way.
PLAIN_CHECKS = re.compile(r'^(?:solve|review_|check_|parse|worked_answer|equation_of)')
for _module in list(sys.modules.values()):
    if getattr(_module, '__name__', '').endswith('_math_oracle'):
        for _name, _value in list(vars(_module).items()):
            if PLAIN_CHECKS.match(_name) and callable(_value) and getattr(_value, '__module__', None) == _module.__name__:
                setattr(_module, _name, read_plainly(_value))


def solve(public):
    """Only public prompt/figure givens enter this function, never generated
    answers. A family oracle that does not read the typeset wording retries
    with its plain reading (see plain_reading)."""
    try:
        return solve_family(public)
    except ValueError:
        reading = plain_reading(public)
        if reading == public:
            raise
        return solve_family(reading)


def solve_family(public):
    if public["templateId"] in INVERSE_ROUNDING:
        return solve_inverse_rounding(public)
    if public["templateId"] in QUADRATIC_IRRATIONAL:
        return solve_quadratic_irrational(public)
    if public["templateId"] in STUDY_DESIGN:
        return solve_study_design(public)
    if public["templateId"] in ASSESSMENT_GAP:
        return solve_assessment_gap(public)
    if public["templateId"] in RADICAL_EQUATION:
        return solve_radical_equation(public)
    if public["templateId"] in RATIONAL_EQUATION:
        return solve_rational_equation(public)
    if public["templateId"] in GEOMETRY_PROOF:
        return solve_geometry_proof(public)
    if public["templateId"] in RATIONAL_EXPRESSION:
        return solve_rational_expression(public)
    if public["templateId"] in NONLINEAR_SYSTEM:
        return solve_nonlinear_system(public)
    template = public['templateId']
    if template in AREA_VOLUME:
        return solve_area_volume(public)
    if template in TWO_VARIABLE:
        return solve_two_variable(public)
    if template in NUMBER_SENSE:
        return solve_number_sense(public)
    if template in TRANSFORMATION:
        return solve_transformation(public)
    if template in COMPLETING_SQUARE:
        return solve_complete_square(public)
    if template in LINEAR_FUNCTION:
        return solve_linear_function(public)
    if template in QUADRATIC_STRUCTURE:
        return solve_quadratic_structure(public)
    if template in FUNCTION_TOOLKIT:
        return solve_function_toolkit(public)
    if template in ANGLE_TRIANGLE:
        return solve_angle_triangle(public)
    if template in REAL_NUMBER:
        return solve_real_number(public)
    if template in NUMBER_SYSTEM:
        return solve_number_system(public)
    if template in MULTIPLY_DIVIDE:
        return solve_multiply_divide(public)
    if template in RATIO_RATE:
        return solve_ratio_rate(public)
    if template in SHAPES:
        return solve_shape(public)
    if template in ANGLES:
        return solve_angle(public)
    if template in POLYGONS:
        return solve_polygon(public)
    if template in EXPONENTIAL:
        return solve_exponential(public)
    if template in PROBABILITY_RULES:
        return solve_probability_rules(public)
    if template in SIMILARITY_TRIG:
        return solve_similarity_trig(public)
    if template in COORDINATE_CIRCLE:
        return solve_coordinate_circle(public)
    if template in ALGEBRA_STATISTICS:
        return solve_algebra_statistics(public)
    if template in POWER:
        return solve_power(public)
    if template in PATTERN_FUNCTION:
        return solve_pattern_function(public)
    if template in EQUATIONS:
        return solve_equations(public)
    if template in ADD_SUBTRACT:
        return solve_add_subtract(public)
    if template in VOLUME_COORDINATE:
        return solve_volume_coordinate(public)
    if template in FACTS:
        return solve_facts(public)
    if template in FACT_ARRAYS:
        return solve_fact_arrays(public)
    if template in EARLY_OPERATIONS:
        return solve_early_operations(public)
    if template in PART_WHOLE:
        return solve_part_whole(public)
    if template in DECIMAL:
        return solve_decimal(public)
    if template in TIME_MONEY:
        return solve_time_money(public)
    if template in ATTRIBUTE:
        return solve_attribute(public)
    if template in COMPARISON:
        return solve_comparison(public)
    if template in DATA_DISPLAY:
        return solve_data_display(public)
    if template in COMBINATORICS:
        return solve_combinatorics(public)
    if template in RADICAL_TYPES:
        return solve_radical(public)
    if template in RATIONAL_TYPES:
        return solve_rational(public)
    if template in CIRCLE:
        return solve_circle(public)
    if template in INTEGER_EXPONENT:
        return solve_integer_exponent(public)
    if template in DESCRIPTIVE_STATISTICS:
        return solve_descriptive_statistics(public)
    if template in PERCENT_CHANGE:
        return solve_percent_change(public)
    if template in LINEAR_SYSTEM:
        return solve_linear_system(public)
    if template in INEQUALITY:
        return solve_inequality(public)
    if template in RIGHT_TRIANGLE:
        return solve_right_triangle(public)
    if template in POLYNOMIAL:
        return solve_polynomial(public)
    if template in FACTORING:
        return solve_factoring(public)
    if template in QUADRATIC:
        return solve_quadratic(public)
    if template in ABSOLUTE_VALUE:
        return solve_absolute_value(public)
    if template in MEASUREMENT:
        return solve_measurement(public)
    if template in ALGEBRA:
        return solve_algebra(public)
    if template in CHOICE:
        return solve_choice(public)
    if template in EQUAL_GROUPS:
        return solve_equal_groups(public)
    if template in FRACTION_PRACTICE:
        return solve_fraction_practice(public)
    if template in ELEMENTARY:
        return solve_elementary(public)
    prompt = public['prompt']
    # Standard notation omits a coefficient of 1 ("x + 5y", "−x²"); restore it
    # for terms inside equations and expressions before reading the givens.
    prompt = re.sub(r'([:;=+−-]\s*)([xy])(?=²|\s*[+=−-]|\s*$)', r'\g<1>1\2', prompt)
    numbers = [int(value) for value in re.findall(r'-?[0-9]+', prompt)]
    figure = public.get('figure')
    f = Fraction
    if template in {'coordinate-point-reading', 'graphed-line-slope'}:
        require(figure['kind'] == 'coordinate-plane', 'Wrong coordinate representation')
        require(figure['xMin'] < figure['xMax'] and figure['yMin'] < figure['yMax'], 'Invalid coordinate bounds')
        points = figure['points']
        require(all(figure['xMin'] <= point['x'] <= figure['xMax'] and
                    figure['yMin'] <= point['y'] <= figure['yMax'] and
                    type(point['x']) is int and type(point['y']) is int for point in points),
                'Coordinates must be visible integer grid points')
        if template == 'coordinate-point-reading':
            require(len(points) == 1 and points[0]['label'] == 'P', 'Expected one point P')
            requested = re.search(r'What is the ([xy])-coordinate of point P', prompt)
            require(requested is not None, 'Ambiguous requested coordinate')
            return points[0][requested[1]]
        require(len(points) == 2 and [point['label'] for point in points] == ['A', 'B'], 'Expected points A and B')
        left, right = points
        slope = f(right['y']-left['y'], right['x']-left['x'])
        lines = figure['lines']
        require(len(lines) == 1, 'Expected a single line')
        line = lines[0]
        # Rendering uses floating coefficients; grading remains an exact rational.
        require(math.isfinite(line['m']) and math.isfinite(line['b']) and
                math.isclose(line['m'], float(slope), rel_tol=0, abs_tol=1e-12), 'Line slope contradicts points')
        require(all(math.isclose(line['m']*point['x']+line['b'], point['y'], rel_tol=0, abs_tol=1e-12)
                    for point in points), 'Drawn line does not pass through marked points')
        return slope
    if template in {'bar-chart-total', 'bar-chart-difference'}:
        require(figure['kind'] == 'bar-chart' and figure['valueLabel'] == 'Trees', 'Wrong chart representation')
        categories, values = figure['categories'], figure['values']
        require(len(categories) == len(values) == 3 and len(set(categories)) == 3 and
                all(type(value) is int and value >= 0 for value in values), 'Invalid category counts')
        counts = dict(zip(categories, values))
        if template == 'bar-chart-total':
            return sum(values)
        requested = re.search(r'How many more (\w+) trees than (\w+) trees', prompt)
        require(requested is not None and requested[1] in counts and requested[2] in counts, 'Unknown named category')
        difference = counts[requested[1]] - counts[requested[2]]
        require(difference > 0, 'More-than prompt names the wrong larger category')
        return difference
    if template == 'clock-elapsed-minutes':
        require(figure['kind'] == 'clock' and 1 <= figure['hour'] <= 12 and
                0 <= figure['minute'] < 60, 'Invalid clock')
        end_time = re.search(r'ends at ([0-9]+):([0-9]{2}) later that same morning', prompt)
        require(end_time is not None, 'Missing same-morning ending time')
        hour, minute = map(int, end_time.groups())
        require(1 <= hour < 12 and 0 <= minute < 60, 'Ending time outside morning')
        elapsed = hour*60 + minute - (figure['hour']*60 + figure['minute'])
        require(0 < elapsed <= 120, 'Duration outside supported bounds')
        return elapsed
    if template == 'number-line-distance':
        require(figure['kind'] == 'number-line' and figure['min'] < figure['max'], 'Invalid number line')
        left, right = figure['points']
        require(all(type(point) is int and figure['min'] <= point <= figure['max'] for point in (left, right)),
                'Marked points must be visible integer ticks')
        require(left != right, 'Distance question needs distinct points')
        return abs(right-left)
    if template == 'count-objects':
        require(figure['kind'] == 'collection' and 1 <= figure['count'] <= 10, 'Invalid counting representation')
        return figure['count']
    if template == 'add-within-20':
        require(len(numbers) == 2 and min(numbers) >= 0 and sum(numbers) <= 20, 'Addition bounds')
        # The scene: a 0–20 number line marked at the greater addend, with
        # jumps from it that total the other addend; the sum stays unknown.
        require(figure['kind'] == 'scene', 'Number-line scene required')
        (line,) = figure['scene']['elements']
        require(line['type'] == 'numberLine' and line['min'] == 0 and line['max'] == 20, 'A 0 to 20 number line')
        require([m['at'] for m in line['marks']] == [max(numbers)], 'The greater addend is marked')
        position = max(numbers)
        for hop in line.get('hops', []):
            require(hop['from'] == position, 'Jumps continue from the last landing')
            position += hop['by']
        require(position == sum(numbers), 'Jumps total the other addend')
        hops = line.get('hops', [])
        require(not hops or hops[-1].get('landing', 'derived') != 'shown', 'The sum stays unknown')
        return sum(numbers)
    if template == 'subtract-within-20':
        a, b = numbers
        require(0 <= b <= a <= 20, 'Subtraction bounds')
        return a - b
    if template == 'fraction-model':
        require(figure['kind'] == 'fraction' and 0 < figure['selected'] < figure['parts'], 'Invalid fraction representation')
        return f(figure['selected'], figure['parts'])
    if template in {'add-fractions', 'compare-fractions', 'multiply-fractions', 'divide-fractions'}:
        a, b, c, d = numbers
        left, right = f(a, b), f(c, d)
        if template == 'add-fractions':
            return left + right
        if template == 'compare-fractions':
            require(left != right, 'Comparison must have a unique larger fraction')
            return max(left, right)
        if template == 'multiply-fractions':
            return left * right
        return left / right
    if template == 'rectangle-area':
        width, height = numbers
        require(figure == {'kind': 'rectangle', 'width': width, 'height': height, 'unit': 'cm'}, 'Rectangle prompt/figure mismatch')
        return width * height
    if template == 'linear-equation':
        coefficient, constant, total = numbers
        return f(total - constant, coefficient)
    if template == 'mean-data':
        require(figure == {'kind': 'dataset', 'values': numbers} and len(numbers) == 5, 'Dataset mismatch')
        return f(sum(numbers), len(numbers))
    if template == 'right-triangle':
        a, b = numbers
        require(figure == {'kind': 'right-triangle', 'a': a, 'b': b, 'unit': 'cm'}, 'Triangle prompt/figure mismatch')
        square = a*a + b*b
        root = math.isqrt(square)
        require(root*root == square, 'Integer-root family produced an irrational result')
        return root
    if template == 'quadratic-vertex':
        coefficient, vertex_x, vertex_y = numbers
        require(coefficient > 0 and 'For real x' in prompt, 'Minimum requires positive coefficient and real domain')
        return vertex_y
    if template == 'geometric-sequence':
        first, ratio, term, first_label = numbers
        require(first_label == 1, 'Unsupported sequence indexing')
        result = first
        for _ in range(term - 1):
            result *= ratio
        return result
    if template == 'logarithm-integer':
        base, argument = numbers
        require(base > 1 and argument > 0, 'Invalid logarithm domain')
        value, exponent = 1, 0
        while value < argument:
            value *= base
            exponent += 1
        require(value == argument, 'Integer logarithm family produced a noninteger result')
        return exponent
    if template == 'place-value-digit':
        number, = numbers
        positions = [place for place in ('ones', 'tens', 'hundreds') if place in prompt]
        require(len(positions) == 1, 'Ambiguous digit position')
        place = ('ones', 'tens', 'hundreds').index(positions[0])
        return number // 10**place % 10 * 10**place
    if template in {'decimal-addition', 'decimal-multiplication'}:
        left, right = [f(value) for value in re.findall(r'[0-9]+\.[0-9]+', prompt)]
        return left + right if template == 'decimal-addition' else left * right
    if template == 'ratio-missing':
        blue, white, target_white = numbers
        return f(blue * target_white, white)
    if template == 'percent-of':
        percent, whole = numbers
        return f(percent * whole, 100)
    if template == 'integer-addition':
        left, right = numbers
        return left + right
    if template == 'line-slope':
        x1, y1, x2, y2 = numbers
        return f(y2-y1, x2-x1)
    if template == 'linear-system-x':
        a, b, e, c, d, total = numbers
        # Cramer's rule, distinct from generated elimination explanations.
        return f(e*d-b*total, a*d-b*c)
    if template == 'simple-probability':
        red, blue = numbers
        return f(red, red+blue)
    if template == 'arithmetic-term':
        first, difference, term, first_label = numbers
        require(first_label == 1, 'Unsupported sequence indexing')
        result = first
        for _ in range(term - 1):
            result += difference
        return result
    if template == 'function-evaluation':
        a, b, c, x = numbers
        return a*x*x + b*x + c
    if template == 'unit-price':
        quantity, cost, target = numbers
        return f(cost*target, quantity)
    if template == 'operation-order':
        a, b, c, d = numbers
        return a + (b+c)*d
    raise ValueError(f'No independent solver for {template}')


def review(stream):
    first_line = next(stream, None)
    require(first_line is not None, 'Missing manifest')
    manifest = json.loads(first_line)
    require(manifest.get('kind') == 'manifest' and manifest.get('format') == 1, 'Unsupported manifest')
    ids = manifest['templates']
    require(isinstance(ids, list) and all(isinstance(item, str) for item in ids), 'Invalid template inventory')
    require(len(ids) == len(set(ids)) and set(ids) == SUPPORTED,
            f'Oracle inventory mismatch; unknown={set(ids)-SUPPORTED}, missing={SUPPORTED-set(ids)}')
    start, count = manifest['seedStart'], manifest['seedCount']
    require(type(start) is int and type(count) is int and start >= 0 and count >= 256, 'Require at least 256 seeds per family')
    seen, counts = set(), Counter()
    area_volume_equalities = 0
    polynomial_shortcuts = PolynomialShortcutReview()
    factoring_review = FactoringReview()
    inequality_review = InequalityReview()
    system_review = LinearSystemReview()
    exponent_review = IntegerExponentReview()
    completing_square_review = CompletingSquareReview()
    right_triangles = RightTriangleCorpusReview()
    rational_corpus = RationalCorpus()
    comparison_corpus = ComparisonCorpus()
    number_sense_corpus = NumberSenseCorpus()
    multiply_divide_corpus = MultiplyDivideCorpus()
    decimal_corpus = DecimalCorpus()
    add_subtract_corpus = AddSubtractCorpus()
    facts_corpus = FactsCorpus()
    fact_arrays_corpus = FactArraysCorpus()
    early_operations_corpus = EarlyOperationsCorpus()
    def check_case(problem, record=True):
        """Every review of one generated case, on the given reading of it."""
        nonlocal area_volume_equalities
        public = problem['public']
        template, seed = public['templateId'], public['seed']
        solved = solve_family(public)
        if template in COMPLETING_SQUARE:
            if record:
                completing_square_review.record(problem)
        if template in INTEGER_EXPONENT:
            if record:
                exponent_review.record(public, solved)
            review_integer_exponent_explanation(public, problem["explanation"])
        if template in RIGHT_TRIANGLE:
            if record:
                right_triangles.record(public, solved)
        if template in RIGHT_TRIANGLE_CHOICE:
            review_converse_explanation(public, problem['explanation'])
        if template in POLYNOMIAL:
            if record:
                polynomial_shortcuts.record(public, solved)
        if template in FACTORING:
            if record:
                factoring_review.record(public, solved)
            review_factoring_explanation(problem)
        if template in PERCENT_CHANGE:
            review_percent_explanation(public, problem['explanation'])
        if template in INEQUALITY:
            if record:
                inequality_review.record(public, solved)
        if template in LINEAR_SYSTEM:
            if record:
                system_review.record(public, solved)
            review_linear_system_explanation(public, problem['explanation'], problem['choiceFeedback'])
        if template in DESCRIPTIVE_STATISTICS:
            review_statistics_explanation(problem)
        if template in TRANSFORMATION:
            review_transformation_problem(problem)
        if template in PATTERN_FUNCTION:
            review_pattern_function_problem(problem)
        if template in TWO_VARIABLE:
            review_two_variable_problem(problem)
        if template in LINEAR_FUNCTION:
            review_linear_function_problem(problem)
        if template in QUADRATIC_IRRATIONAL:
            review_quadratic_irrational_problem(problem)
        if template in INVERSE_ROUNDING:
            review_inverse_rounding_problem(problem)
        if template in STUDY_DESIGN:
            review_study_design_problem(problem)
        if template in ASSESSMENT_GAP:
            review_assessment_gap_problem(problem)
        if template in RADICAL_EQUATION:
            review_radical_equation_problem(problem)
        if template in RATIONAL_EQUATION:
            review_rational_equation_problem(problem)
        if template in GEOMETRY_PROOF:
            review_geometry_proof_problem(problem)
        if template in RATIONAL_EXPRESSION:
            review_rational_expression_problem(problem)
        if template in NONLINEAR_SYSTEM:
            review_nonlinear_system_problem(problem)
        if template in QUADRATIC_STRUCTURE:
            review_quadratic_structure_problem(problem)
        if template in FUNCTION_TOOLKIT:
            review_function_toolkit_problem(problem)
        if template in EQUATIONS:
            review_equation_problem(problem)
        if template in COMBINATORICS:
            review_combinatorics_problem(problem)
        if template in AREA_VOLUME:
            checked = review_area_volume_problem(problem)
            if record:
                area_volume_equalities += checked
        if template in REAL_NUMBER:
            review_real_number_problem(problem)
        if template in NUMBER_SYSTEM:
            review_number_system_problem(problem)
        if template in RATIO_RATE:
            review_ratio_rate_problem(problem)
        # Generated answer is used only as the value under test, never as an oracle input.
        if template in RADICAL_TYPES:
            review_radical_problem(problem)
        if template in ADD_SUBTRACT:
            if record:
                add_subtract_corpus.record(public, solved)
        if template in FACTS:
            if record:
                facts_corpus.record(public, solved)
        if template in FACT_ARRAYS:
            if record:
                fact_arrays_corpus.record(public, solved)
        if template in EARLY_OPERATIONS:
            if record:
                early_operations_corpus.record(public, solved)
        if template in COMPARISON:
            if record:
                comparison_corpus.record(public, solved)
        if template in NUMBER_SENSE:
            if record:
                number_sense_corpus.record(public, solved)
        if template in MULTIPLY_DIVIDE:
            if record:
                multiply_divide_corpus.record(public, solved)
        if template in DECIMAL:
            if record:
                decimal_corpus.record(public, solved)
        if template in RATIONAL_TYPES:
            review_rational_problem(problem)
            if record:
                rational_corpus.record(public, solved)
        if template in INVERSE_ROUNDING | QUADRATIC_IRRATIONAL | STUDY_DESIGN | ASSESSMENT_GAP_CHOICE | RADICAL_EQUATION_CHOICE | RATIONAL_EQUATION_CHOICE | GEOMETRY_PROOF | RATIONAL_EXPRESSION | FUNCTION_TOOLKIT_CHOICE | QUADRATIC_STRUCTURE_CHOICE | EXPONENTIAL_CHOICE | TRANSFORMATION_CHOICE | (COMPLETING_SQUARE - {'complete-square-term'}) | ANGLE_TRIANGLE_CHOICE | ANGLES_CHOICE | REAL_NUMBER_CHOICE | ABSOLUTE_VALUE | FACTORING | NUMBER_SYSTEM_CHOICE | POLYGONS_CHOICE | SHAPES_CHOICE | EQUATIONS_CHOICE or template in TWO_VARIABLE_CHOICE | LINEAR_FUNCTION_CHOICE | RATIO_RATE_CHOICE | PATTERN_FUNCTION_CHOICE | VOLUME_COORDINATE_CHOICE | DATA_DISPLAY_CHOICE | CHOICE | ALGEBRA_CHOICE | QUADRATIC_CHOICE | POLYNOMIAL | INEQUALITY | RIGHT_TRIANGLE_CHOICE | LINEAR_SYSTEM | RADICAL_TYPES | COMPARISON_CHOICE | TIME_MONEY_CHOICE | ATTRIBUTE_CHOICE | POWER_CHOICE | ALGEBRA_STATISTICS_CHOICE or (template in MEASUREMENT | PART_WHOLE and public["response"]["kind"] == "choice"):
            expected = solved
            actual = problem['answer']
            require(isinstance(actual, str), 'Choice answer must be an option ID')
        else:
            expected = Fraction(solved)
            actual = Fraction(problem['answer'])
        require(actual == expected, f'Mismatch {template}/{seed}: {public["prompt"]!r}; got {actual}, expected {expected}')
        if template in VOLUME_COORDINATE:
            review_volume_coordinate_problem(problem)
        if template in SHAPES:
            review_shape_problem(problem)
        if template in ANGLES:
            review_angle_problem(problem)
        if template in POLYGONS:
            review_polygon_problem(problem)
        if template in PROBABILITY_RULES:
            review_probability_rules_problem(problem, solved)
        if template in SIMILARITY_TRIG:
            review_similarity_trig_problem(problem, solved)
        if template in COORDINATE_CIRCLE:
            review_coordinate_circle_problem(problem, solved)
        if template in ALGEBRA_STATISTICS:
            review_algebra_statistics_problem(problem, solved)
        if template in POWER:
            review_power_problem(problem, solved)
    for line_number, line in enumerate(stream, 2):
        require(line.strip(), f'Empty record at line {line_number}')
        record = json.loads(line)
        require(record.get('kind') == 'case', f'Unexpected record at line {line_number}')
        problem = record['problem']
        public = problem['public']
        template, seed = public['templateId'], public['seed']
        require(template in SUPPORTED, f'Unknown family {template}')
        match = re.fullmatch(r'independent-(0|[1-9][0-9]*)', seed)
        require(match is not None, f'Invalid seed {seed}')
        index = int(match[1])
        require(start <= index < start + count, f'Seed outside declared range: {seed}')
        identity = (template, seed)
        require(identity not in seen, f'Duplicate case {identity}')
        seen.add(identity)
        try:
            check_case(problem, record=False)
        except (ValueError, TypeError, KeyError, AttributeError, StopIteration):
            # A variable or point typeset as $x$ reads as x. A family oracle that
            # parses the plain wording reviews the plain reading instead; every
            # check runs once without recording first, so nothing counts twice.
            reading = plain_reading(problem)
            if reading == problem:
                raise
            problem = reading
        check_case(problem)
        counts[template] += 1
    require(all(counts[template] == count for template in SUPPORTED), f'Incomplete coverage: {dict(counts)}')
    # Reject invalid input before the expensive authored-content fixtures. Every
    # successful review still runs the full fixture and mutation inventory.
    review_quadratic_irrational_fixtures()
    review_inverse_rounding_fixtures()
    review_study_design_fixtures()
    review_assessment_gap_fixtures()
    review_radical_equation_fixtures()
    review_rational_equation_fixtures()
    review_geometry_proof_fixtures()
    review_rational_expression_fixtures()
    review_nonlinear_system_fixtures()
    area_volume_fixtures = review_area_volume_fixtures()
    area_volume_mutants = review_area_volume_mutations()
    review_two_variable_fixtures()
    review_two_variable_mutations()
    review_transformation_fixtures()
    review_transformation_mutations()
    review_completing_square_fixtures()
    review_completing_square_content_fixtures()
    review_linear_function_fixtures()
    review_linear_function_mutations()
    review_quadratic_structure_fixtures()
    review_quadratic_structure_mutations()
    review_function_toolkit_fixtures()
    review_function_toolkit_mutations()
    review_angle_triangle_fixtures()
    review_real_number_fixtures()
    review_real_number_mutations()
    review_number_system_fixtures()
    review_number_system_mutations()
    review_multiply_divide_fixtures()
    review_ratio_rate_fixtures()
    review_ratio_rate_mutations()
    review_shape_fixtures()
    review_angle_fixtures()
    review_polygon_fixtures()
    review_exponential_fixtures()
    review_probability_rules_fixtures()
    review_similarity_trig_fixtures()
    review_coordinate_circle_fixtures()
    review_algebra_statistics_fixtures()
    review_power_fixtures()
    review_pattern_function_fixtures()
    review_pattern_function_mutations()
    review_equation_fixtures()
    review_equation_mutations()
    review_add_subtract_fixtures()
    review_volume_coordinate_fixtures()
    review_facts_fixtures()
    review_fact_arrays_fixtures()
    review_early_operations_fixtures()
    review_part_whole_fixtures()
    review_decimal_fixtures()
    review_time_money_fixtures()
    review_attribute_fixtures()
    review_comparison_fixtures()
    review_number_sense_fixtures()
    review_data_display_fixtures()
    review_combinatorics_fixtures()
    review_combinatorics_mutations()
    review_radical_arithmetic()
    review_radical_fixtures()
    review_rational_fixtures()
    review_circle_fixtures()
    review_integer_exponent_fixtures()
    review_descriptive_statistics_fixtures()
    review_statistics_content_mutations()
    review_algebra_fixtures()
    review_measurement_fixtures()
    review_quadratic_fixtures()
    review_absolute_value_fixtures()
    review_absolute_value_content_mutations()
    review_polynomial_fixtures()
    review_factoring_fixtures()
    review_inequality_fixtures()
    review_percent_change_fixtures()
    review_linear_system_fixtures()
    review_right_triangle_fixtures()
    print('Independent area/volume review: ' + json.dumps({**area_volume_fixtures, 'checkedEqualities': area_volume_equalities}), file=sys.stderr)
    print('Independent area/volume content: ' + json.dumps({**review_area_volume_content(), 'rejectedContentMutations': area_volume_mutants}), file=sys.stderr)
    print('Independent number-sense coverage: ' + json.dumps(number_sense_corpus.finish()), file=sys.stderr)
    print('Independent coordinate-geometry content: ' + json.dumps(review_transformation_content()), file=sys.stderr)
    print('Independent completing-square coverage: ' + json.dumps(completing_square_review.finish(count)), file=sys.stderr)
    print('Independent completing-square content: ' + json.dumps(review_completing_square_content()), file=sys.stderr)
    print('Independent real-number content: ' + json.dumps(review_real_number_content()), file=sys.stderr)
    print('Independent number-system content: ' + json.dumps(review_number_system_content()), file=sys.stderr)
    print('Independent multiply-divide coverage: ' + json.dumps(multiply_divide_corpus.finish()), file=sys.stderr)
    print('Independent ratio and rate content: ' + json.dumps(review_ratio_rate_content()), file=sys.stderr)
    print('Independent Algebra 1 two-variable content: ' + json.dumps(review_two_variable_content()), file=sys.stderr)
    print('Independent Algebra 1 function content: ' + json.dumps(review_linear_function_content()), file=sys.stderr)
    print('Independent quadratic-structure content: ' + json.dumps(review_quadratic_structure_content()), file=sys.stderr)
    print('Independent function-toolkit content: ' + json.dumps(review_function_toolkit_content()), file=sys.stderr)
    print('Independent pattern/function content: ' + json.dumps(review_pattern_function_content()), file=sys.stderr)
    print('Independent equation content: ' + json.dumps(review_equation_content()), file=sys.stderr)
    print('Independent add-subtract coverage: ' + json.dumps(add_subtract_corpus.finish()), file=sys.stderr)
    print('Independent facts coverage: ' + json.dumps(facts_corpus.finish()), file=sys.stderr)
    print('Independent fact-array coverage: ' + json.dumps(fact_arrays_corpus.finish()), file=sys.stderr)
    print('Independent early-operations coverage: ' + json.dumps(early_operations_corpus.finish()), file=sys.stderr)
    print('Independent comparison coverage: ' + json.dumps(comparison_corpus.finish()), file=sys.stderr)
    print('Independent decimal comparison coverage: ' + json.dumps(decimal_corpus.finish()), file=sys.stderr)
    print('Independent combinatorics content: ' + json.dumps(review_combinatorics_content()), file=sys.stderr)
    print('Independent circle review: ' + json.dumps(review_circle_content()), file=sys.stderr)
    print('Independent radical content: ' + json.dumps(review_radical_content()), file=sys.stderr)
    print('Independent rational coverage: ' + json.dumps(rational_corpus.finish(count)), file=sys.stderr)
    print('Independent rational content: ' + json.dumps(review_rational_content()), file=sys.stderr)
    print('Independent integer-exponent coverage: ' + json.dumps(exponent_review.finish(count)), file=sys.stderr)
    print('Independent integer-exponent content: ' + json.dumps(review_integer_exponent_content()), file=sys.stderr)
    print('Independent statistics content: '+json.dumps(review_descriptive_statistics_content()),file=sys.stderr)
    print('Independent percent-change review: ' + json.dumps(review_percent_change_content()), file=sys.stderr)
    print('Independent inequality worksheet/registry review: ' + json.dumps(review_inequality_content()), file=sys.stderr)
    print('Independent inequality coverage: ' + json.dumps(inequality_review.finish(count)), file=sys.stderr)
    print('Independent linear-system coverage: ' + json.dumps(system_review.finish(count)), file=sys.stderr)
    print('Independent linear-system worksheet/figure review: ' + json.dumps(review_linear_system_content()), file=sys.stderr)
    print('Independent right-triangle coverage: ' + json.dumps(right_triangles.finish(count)), file=sys.stderr)
    print('Known polynomial choice shortcuts: ' + json.dumps(polynomial_shortcuts.finish(count)), file=sys.stderr)
    print('Independent factoring breadth and named choice shortcuts: ' + json.dumps(factoring_review.finish(count)), file=sys.stderr)
    print('Independent factoring content: ' + json.dumps(review_factoring_content()), file=sys.stderr)
    print('Independent absolute-value content: '+json.dumps(review_absolute_value_content()),file=sys.stderr)
    print('Independent right-triangle teaching geometry: ' + json.dumps(review_right_triangle_figures()), file=sys.stderr)
    print('Independent print notation review: ' + json.dumps(review_print_math()), file=sys.stderr)
    # `npm run review:math` rebuilds artifacts/publications first, so the print
    # review sees current output. Unit tests point this at an absent directory
    # so their result never depends on whatever happens to be on disk.
    amp_root = Path(__file__).resolve().parent.parent
    publications = Path(os.environ.get('AMP_PUBLICATIONS_DIR') or amp_root / 'artifacts/publications')
    if publications.exists():
        reader = subprocess.run(
            ['node', '--import', 'tsx', 'scripts/verify-reader-typesetting.ts'],
            cwd=amp_root,
            env={**os.environ, 'READER_REVIEW_OUT': str(amp_root / 'artifacts/reader-typesetting-review')},
            capture_output=True, text=True, timeout=120)
        require(reader.returncode == 0, f'Reader typesetting review failed: {reader.stderr}')
        print('Independent reader typesetting review: ' + reader.stdout.strip(), file=sys.stderr)
        print('Independent PDF bounds review: ' + json.dumps(review_print_pdfs(publications)), file=sys.stderr)
    else:
        print(f'Reader typesetting and print layout/PDF review not run: no publication export directory at {publications}; npm run review:math builds it.', file=sys.stderr)
    return {'cases': sum(counts.values()), 'families': len(counts), 'seedsPerFamily': count,
            'seedStart': start, 'mismatches': 0}


if __name__ == '__main__':
    try:
        print(json.dumps(review(iter(sys.stdin))))
    except (ValueError, KeyError, TypeError, ZeroDivisionError, OverflowError) as error:
        print(f'Independent math review failed: {error}', file=sys.stderr)
        sys.exit(1)
