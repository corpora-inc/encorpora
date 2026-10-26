"""Independent scope-of-inference review from displayed design and options.

No generator imports or private sampling/frame flags. Random population selection
and randomized treatment allocation are parsed and judged separately.
"""
import copy
import re

SUPPORTED = frozenset({'scope-of-inference-choice'})

def require(ok, message):
    if not ok:
        raise ValueError(message)

def design(public):
    require(public['templateId'] in SUPPORTED, 'Unknown study-design family')
    prompt = public['prompt']
    guards = 'Everyone completes the study, measurement is reliable, and task conditions are otherwise the same.'
    require(prompt.count(guards) == 1, 'Missing well-run-study conditions')
    setup, question = prompt.split(guards)
    question = question.strip()
    random = re.search(r'(\d+) participants are drawn at random without replacement from a complete list of all (\d+) ([^;]+); every set of (\d+) has the same chance of selection\.', setup)
    nonrandom = re.search(r'(\d+) of the (\d+) (.+?)(?: volunteer after seeing an invitation\. These volunteers enter the study without random sampling\.| who are easiest for the researcher to reach enter the study without random sampling\.)', setup)
    require(bool(random) != bool(nonrandom), 'Missing or conflicting population selection')
    selection = random or nonrandom
    n, total, population = int(selection[1]), int(selection[2]), selection[3]
    require(0 < n < total and n % 2 == 0, 'Invalid sample size')
    if random:
        require(int(random[4]) == n, 'Random sampling group size mismatch')
    allocation = re.search(r'The researcher randomly assigns half of the participants to use (.+?) and half to use (.+?)\.', setup)
    choice = re.search(r'Each participant chooses whether to use (.+?) or (.+?); the researcher does not assign treatments\.', setup)
    require(bool(allocation) != bool(choice), 'Missing or conflicting treatment allocation')
    require((allocation or choice)[1] != (allocation or choice)[2], 'Treatments must differ')
    return bool(random), bool(allocation), n, total, population, question

def solve(public):
    sampled, assigned, n, total, population, question = design(public)
    population_question = 'Based on participant selection, which statement about generalizing the findings is justified by this design alone?'
    causal_question = 'If the analysis finds convincing evidence of an outcome difference, does the comparison support attributing that difference to the instructions for the study participants?'
    combined_question = f'Which pair of conclusions does the design support? Here, generalization means extending findings to all {total} {population}; causal inference means attributing a convincing outcome difference to the instructions for the participants.'
    if question == population_question:
        expected = (f'The findings can be generalized to all {total} {population}, with sampling uncertainty.' if sampled else 'The design alone does not justify generalizing the findings beyond the participants.')
    elif question == causal_question:
        expected = ('Yes, because the participants were randomly assigned to the two kinds of instructions.' if assigned else 'No, because participants chose their instructions and could differ in other relevant ways.')
    else:
        require(question == combined_question, 'Unknown inference request or population boundary')
        expected = f'{"Supports" if sampled else "Does not support"} population generalization; {"supports" if assigned else "does not support"} causal inference.'
    response = public['response']
    require(response['kind'] == 'choice', 'Expected choices')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4 and len({o['label'] for o in options}) == 4, 'Ambiguous/duplicate options')
    matched = [o['id'] for o in options if o['label'] == expected]
    require(len(matched) == 1, 'Missing or ambiguous supported conclusion')
    return matched[0]

def review_problem(problem):
    expected = solve(problem['public'])
    require(problem['answer'] == expected, 'Incorrect inference conclusion')
    return expected

def self_test():
    def fixture(sampled, assigned):
        entry = ('40 participants are drawn at random without replacement from a complete list of all 400 members of Example Club; every set of 40 has the same chance of selection.' if sampled else '40 of the 400 members of Example Club volunteer after seeing an invitation. These volunteers enter the study without random sampling.')
        allocation = ('The researcher randomly assigns half of the participants to use a video and half to use a booklet.' if assigned else 'Each participant chooses whether to use a video or a booklet; the researcher does not assign treatments.')
        labels = ['Does not support population generalization; does not support causal inference.', 'Does not support population generalization; supports causal inference.', 'Supports population generalization; does not support causal inference.', 'Supports population generalization; supports causal inference.']
        prompt = f'A researcher compares task completion with two kinds of instructions. {entry} {allocation} Everyone completes the study, measurement is reliable, and task conditions are otherwise the same. Which pair of conclusions does the design support? Here, generalization means extending findings to all 400 members of Example Club; causal inference means attributing a convincing outcome difference to the instructions for the participants.'
        return {'public':{'templateId':'scope-of-inference-choice','prompt':prompt,'response':{'kind':'choice','options':[{'id':str(i),'label':label} for i,label in enumerate(labels)]}},'answer':str(2*int(sampled)+int(assigned))}
    cases = [fixture(s,a) for s in [False,True] for a in [False,True]]
    rejected = 0
    def reject(case):
        nonlocal rejected
        try: review_problem(case)
        except ValueError: rejected += 1; return
        raise AssertionError('Accepted invalid inference fixture')
    for case in cases:
        review_problem(case)
        bad = copy.deepcopy(case); bad['answer'] = str((int(case['answer']) + 1) % 4); reject(bad)
        bad = copy.deepcopy(case); bad['public']['response']['options'][1]['label'] = bad['public']['response']['options'][0]['label']; reject(bad)
        bad = copy.deepcopy(case); bad['public']['prompt'] = bad['public']['prompt'].replace('Everyone completes the study', 'Only half complete the study'); reject(bad)
    # Counterfactual changes to each public design axis must change the conclusion.
    for sampled in [False,True]:
        for assigned in [False,True]:
            original = fixture(sampled,assigned)
            for changed in [fixture(not sampled,assigned),fixture(sampled,not assigned)]:
                changed['answer'] = original['answer']; reject(changed)
    bad = fixture(True,True); bad['public']['prompt'] = bad['public']['prompt'].replace('generalization means extending findings to all 400 members of Example Club', 'generalization means extending findings to all adults in the country'); reject(bad)
    # Sampling alone supports associations, not causal effects.
    case = fixture(True,False)
    case['public']['prompt'] = case['public']['prompt'].split(' Which pair')[0] + ' Based on participant selection, which statement about generalizing the findings is justified by this design alone?'
    case['public']['response']['options'] = [{'id':str(i),'label':label} for i,label in enumerate(['The findings can be generalized to all 400 members of Example Club, with sampling uncertainty.','The design alone does not justify generalizing the findings beyond the participants.','The findings can be generalized to all adults.','The findings give exact results for every one of the 400 members of Example Club.'])]
    case['answer']='0'; review_problem(case); cases.append(case)
    bad=copy.deepcopy(case);bad['public']['response']['options'][0]['label']='The findings can be generalized to all adults, with sampling uncertainty.';reject(bad)
    case=fixture(False,True)
    case['public']['prompt']=case['public']['prompt'].split(' Which pair')[0]+' If the analysis finds convincing evidence of an outcome difference, does the comparison support attributing that difference to the instructions for the study participants?'
    case['public']['response']['options']=[{'id':str(i),'label':label} for i,label in enumerate(['Yes, because the participants were randomly assigned to the two kinds of instructions.','No, because participants chose their instructions and could differ in other relevant ways.','Yes, because a study with 40 participants always establishes causation.','No, because only studying every person in the population could support causation.'])]
    case['answer']='0';review_problem(case);cases.append(case)
    # Convenience selection has the same inferential limit as volunteering.
    case=fixture(False,False);case['public']['prompt']=case['public']['prompt'].replace('volunteer after seeing an invitation. These volunteers enter the study without random sampling.', 'who are easiest for the researcher to reach enter the study without random sampling.');review_problem(case);cases.append(case)
    return {'fixtures':len(cases),'rejectedMutations':rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED


if __name__ == '__main__':
    print(self_test())
