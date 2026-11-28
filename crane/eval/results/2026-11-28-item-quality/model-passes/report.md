# Item quality and difficulty

3860 items (3434 multiple choice, 426 free text, 1726 variants). Intended difficulty: {0.2: 1549, 0.5: 2065, 0.8: 246}.

## Deterministic gates

| Gate | Rate | Expected for a good bank |
|---|---|---|
| Key is the longest option | 0.1264 | about 0.25 (4 options) |
| Key shares the most words with the rule quote | 0.8547 | about 0.25 |
| Every option has a rationale | 1.0 | 1.0 |
| Every cited section exists | 0.9844 | 1.0 |
| Every quote verbatim | 0.9859 | 1.0 |
| Key position (0-based) | {0: 845, 1: 873, 2: 830, 3: 886} | even |

## Model passes

| Pass | n | Result |
|---|---|---|
| options_only | 746 | correct 0.6247 (errors 0) |
| no_context.strong | 746 | correct 0.8405 (errors 0) |
| crane_aware | 712 | correct 0.986 (errors 0) |

## Calibration by intended difficulty

| Intended | items in bank | items asked | options_only | no_context.strong | crane_aware |
|---|---|---|---|---|---|
| 0.2 | 1547 | 300 | 0.58 | 0.8233 | 0.9895 |
| 0.5 | 1741 | 300 | 0.72 | 0.9067 | 0.9894 |
| 0.8 | 146 | 146 | 0.5205 | 0.7397 | 0.972 |

Items every answering pass gets right (options_only, no_context.strong, crane_aware): 421 (0.1226).

## By topic

| Topic | items in bank | key longest | key most like the rule | items asked | options_only | no_context.strong | crane_aware |
|---|---|---|---|---|---|---|---|
| access-fall | 82 | 0.0732 | 0.7561 | 17 | 0.5294 | 0.6471 | 1.0 |
| assembly | 228 | 0.1491 | 0.8596 | 44 | 0.6364 | 0.8409 | 1.0 |
| devices-aids | 206 | 0.0922 | 0.8592 | 43 | 0.5581 | 0.7674 | 1.0 |
| inspections | 238 | 0.1218 | 0.8655 | 50 | 0.6 | 0.82 | 0.96 |
| lift-planning | 78 | 0.0513 | 0.8462 | 17 | 0.7059 | 0.8235 | 1.0 |
| load-charts | 220 | 0.15 | 0.7045 | 60 | 0.5667 | 0.9 | 0.9667 |
| operations | 362 | 0.1105 | 0.8867 | 90 | 0.6556 | 0.8 | 0.9778 |
| other-equipment | 236 | 0.1186 | 0.8559 | 54 | 0.7593 | 0.8704 | 0.9815 |
| personnel-lifts | 200 | 0.145 | 0.82 | 44 | 0.6818 | 0.8409 | 1.0 |
| powerlines | 290 | 0.1655 | 0.9034 | 63 | 0.619 | 0.8095 | 0.9683 |
| rigging | 254 | 0.1378 | 0.7992 | 57 | 0.5263 | 0.9123 | 1.0 |
| roles | 174 | 0.1322 | 0.9138 | 31 | 0.7097 | 0.9355 | 1.0 |
| rules | 138 | 0.1087 | 0.8261 | 20 | 0.4 | 0.7 | 1.0 |
| signals | 110 | 0.1182 | 0.8636 | 28 | 0.7143 | 0.8929 | 0.9643 |
| site | 224 | 0.1116 | 0.8973 | 48 | 0.7917 | 0.9375 | 1.0 |
| technical | 142 | 0.1268 | 0.9155 | 30 | 0.3 | 0.7667 | 1.0 |
| weather | 56 | 0.0893 | 0.875 | 15 | 0.8667 | 1.0 | 1.0 |
| wire-rope | 196 | 0.1531 | 0.8827 | 35 | 0.5714 | 0.7714 | 1.0 |
