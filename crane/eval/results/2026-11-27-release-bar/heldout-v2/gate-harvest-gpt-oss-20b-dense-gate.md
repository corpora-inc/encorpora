# Release gate: harvest-gpt-oss-20b-dense-gate

Set: heldout-v2 (73 items). **FAIL**

| Criterion | Pass | Value | Bar | Detail |
|---|---|---|---|---|
| fresh held-out set | yes | heldout-v2 | one of heldout-v2, heldout-v3 |  |
| set size | **no** | 73 | >= 300 items | too small to certify; reported as interim |
| no failed calls | yes | {'errors': 0, 'grades_missing': 0} | 0 and 0 |  |
| fully correct (answerable) | **no** | 0.4746 | >= 0.9 | 28 of 59; 95% CI [0.3559322033898305, 0.6101694915254238] |
| correct declines (must-decline declined) | **no** | 0.9286 | >= 0.95 | 13 of 14 |
| every shipped answer has a support verdict | yes | 0 | 0 answers without one | a missing support verdict would hide unsupported claims |
| unsupported claims in shipped answers | **no** | 6 | <= 0 | rate 0.027149321266968326; 5 answers carry one |
| every quote verbatim | yes | 1.0 | >= 1.0 | 177 of 177 |
| every citation real | yes | 1.0 | >= 1.0 |  |
| beats frontier-alone on fully correct | **no** | {'system': 0.4746, 'frontier-alone': 0.8475} | system > comparison, with 0 unsupported claims | frontier-alone unsupported-claim rate 0.21419185282522996 |
| beats opus-alone on fully correct | **no** | {'system': 0.4746, 'opus-alone': 0.7966} | system > comparison, with 0 unsupported claims | opus-alone unsupported-claim rate 0.3567110036275695 |
| set not in the bake | yes | 0 | no pack alias, answer or question with token Jaccard >= 0.9 to a set question | 0 look-alikes in [0.6, 0.9) over 1764 pack texts (reported, not failing) |

## By category

| Category | n | Metric | Value | Below floor | Answers with an unsupported claim |
|---|---|---|---|---|---|
| assembly-disassembly | 6 | fully correct | 0.500 | **yes** | 2 |
| crawler-truck-locomotive | 3 | fully correct | 0.333 | **yes** | 0 |
| decline-asme | 2 | declined | 0.500 | **yes** | 0 |
| decline-legal | 2 | declined | 1.000 | no | 0 |
| decline-manufacturer | 3 | declined | 1.000 | no | 0 |
| decline-non-crane | 2 | declined | 1.000 | no | 0 |
| decline-other | 1 | declined | 1.000 | no | 0 |
| decline-other-jurisdiction | 2 | declined | 1.000 | no | 0 |
| decline-specific-load-chart | 2 | declined | 1.000 | no | 0 |
| derricks | 2 | fully correct | 1.000 | no | 0 |
| fall-protection | 1 | fully correct | 1.000 | no | 0 |
| floating-cranes | 2 | fully correct | 0.500 | **yes** | 0 |
| inspections | 1 | fully correct | 1.000 | no | 0 |
| operational-aids | 4 | fully correct | 0.000 | **yes** | 0 |
| operator-duties | 4 | fully correct | 0.250 | **yes** | 0 |
| operator-qualification | 4 | fully correct | 0.500 | **yes** | 0 |
| overhead-gantry | 3 | fully correct | 1.000 | no | 0 |
| personnel-lifts | 3 | fully correct | 0.667 | **yes** | 0 |
| power-lines | 10 | fully correct | 0.300 | **yes** | 0 |
| rigging-slings | 4 | fully correct | 0.500 | **yes** | 0 |
| safety-devices | 1 | fully correct | 1.000 | no | 0 |
| scope-definitions | 3 | fully correct | 0.667 | **yes** | 1 |
| sideboom-pile-small | 1 | fully correct | 0.000 | **yes** | 0 |
| tower-cranes | 2 | fully correct | 0.500 | **yes** | 0 |
| wire-rope | 4 | fully correct | 0.250 | **yes** | 1 |
| work-area-control | 1 | fully correct | 1.000 | no | 1 |

## Set against the bake: 0 copies, 0 look-alikes

