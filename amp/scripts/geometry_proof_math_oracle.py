"""Independent matching of proof givens, exact target, and applicable theorem.

This finite theorem inventory checks the entire stated configuration and target;
it does not infer a proof reason from a keyword or from the supplied answer.
"""
import copy

GEOMETRY_PROOF = frozenset({'geometry-proof-step'})
THEOREMS = (
    (r'Straight lines $AC$ and $BD$ intersect at $O$, with $O$ between $A$ and $C$ and between $B$ and $D$.',
     r'$m\angle AOB = m\angle COD$',
     'Vertical angles are congruent.'),
    (r'Points $A$, $B$ and $D$ lie in that order on one straight line. Ray $BC$ starts at $B$ and is not on that line.',
     r'$m\angle ABC + m\angle CBD = 180^\circ$',
     'Angles that form a linear pair are supplementary.'),
    (r'A straight transversal crosses two parallel lines. Angles 1 and 2 occupy corresponding positions at the two crossings.',
     r'$m\angle 1 = m\angle 2$',
     'Corresponding angles formed by a transversal of parallel lines are congruent.'),
    (r'The interior angles of triangle $ABC$ are $\angle A$, $\angle B$ and $\angle C$.',
     r'$m\angle A + m\angle B + m\angle C = 180^\circ$',
     'The interior angles of a triangle sum to 180 degrees.'),
)
REASONS = frozenset(reason for _, _, reason in THEOREMS)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def prompt(givens, target):
    return f'{givens} A proof states {target}. Which reason justifies this step?'


def solve_geometry_proof(public):
    require(public['templateId'] in GEOMETRY_PROOF, 'Unknown geometry-proof template')
    applicable = [reason for givens, target, reason in THEOREMS
                  if public['prompt'] == prompt(givens, target)]
    require(len(applicable) == 1, 'Unsupported givens or invalid proof target')
    response = public['response']
    require(response['kind'] == 'choice', 'Expected theorem choice')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Expected four distinct choice identifiers')
    require({o['label'] for o in options} == REASONS, 'Expected four distinct valid theorem statements')
    return next(o['id'] for o in options if o['label'] == applicable[0])


def review_geometry_proof_problem(problem):
    answer = solve_geometry_proof(problem['public'])
    require(problem['answer'] == answer, 'Incorrect geometric proof reason')
    return answer


def review_geometry_proof_fixtures():
    rejected = 0
    def reject(problem):
        nonlocal rejected
        try:
            review_geometry_proof_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Oracle accepted corrupt geometry-proof evidence')

    for index, (givens, target, reason) in enumerate(THEOREMS):
        # Rotate positions: the same index cannot be used as the answer oracle.
        offset = (2 * index + 1) % 4
        ordered = list(THEOREMS[offset:]) + list(THEOREMS[:offset])
        options = [{'id': f'choice-{i}', 'label': row[2]} for i, row in enumerate(ordered)]
        answer = next(o['id'] for o in options if o['label'] == reason)
        problem = {'public': {'templateId': 'geometry-proof-step', 'prompt': prompt(givens, target),
                             'response': {'kind': 'choice', 'options': options}}, 'answer': answer}
        review_geometry_proof_problem(problem)
        bad = copy.deepcopy(problem); bad['answer'] = next(o['id'] for o in options if o['id'] != answer); reject(bad)
        bad = copy.deepcopy(problem); bad['public']['prompt'] = prompt(givens, THEOREMS[(index+1) % 4][1]); reject(bad)
        bad = copy.deepcopy(problem); next(o for o in bad['public']['response']['options'] if o['id'] != answer)['label'] = reason; reject(bad)
        bad = copy.deepcopy(problem); bad['public']['response']['options'] = [o for o in options if o['id'] != answer]; reject(bad)
    wrong_targets = [r'$m\angle AOB = m\angle BOC$', r'$m\angle ABC + m\angle CBD = 90^\circ$',
                     r'$m\angle 1 + m\angle 2 = 180^\circ$', r'$m\angle A + m\angle B + m\angle C = 360^\circ$']
    for (givens, _, _), target in zip(THEOREMS, wrong_targets):
        bad = copy.deepcopy(problem); bad['public']['prompt'] = prompt(givens, target); reject(bad)
    bad = copy.deepcopy(problem)
    bad['public']['prompt'] = prompt(THEOREMS[2][0].replace('parallel lines', 'nonparallel lines'), THEOREMS[2][1]); reject(bad)
    return {'fixtures': len(THEOREMS), 'rejectedMutations': rejected}


if __name__ == '__main__':
    import json
    print(json.dumps(review_geometry_proof_fixtures()))
