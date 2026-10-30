# Adaptive Math Pathways: learner model and next-problem selection

AMP chooses a useful learning action given the learner's goals, observed work,
and uncertainty about what they can do. A learning action may advance a skill,
repair a prerequisite, retrieve earlier learning, or answer a diagnostic question.
The long-term objective is durable, transferable learning per unit of learner
time. Correct answers during practice are evidence, not the objective itself.

The model separates five things:

1. **Curriculum value:** what deserves attention, independent of corpus size.
2. **Pathways:** which capabilities support which others, including intersections.
3. **Problem demands:** what this particular item asks the learner to do.
4. **Learner evidence:** what was observed and what can reasonably be inferred.
5. **Selection policy:** how to spend the next few minutes given that evidence.

## Executable policy and scope

`src/curriculum/selection.ts` assigns every catalog skill to one stable exposure
objective. Each objective has editorial instructional importance and a separate
editorial assessment-emphasis estimate. General mixed practice uses instructional
importance. Assessment emphasis is reserved metadata; it is not an implemented
SAT profile or an observed test frequency.

`src/learning/selection-policy.ts` allocates probability to an objective, a skill
within it, then a problem family within that skill. The production planner uses
this kernel after its frontier, review, prerequisite, placement, accessibility,
and recency rules. Scripted placement openers and explicit user-selected drills
are separate selection modes.

The executable policy includes:

- The existing strand frontier and durable direct skill evidence.
- Existing repeated-error prerequisite repair, spaced review, skip handling,
  within-session variety, and batch reservations.
- Explicit curriculum budgets, relative skill and family weights, and seeded
  weighted sampling among suitably competitive candidates.
- An internal trace with policy and curriculum versions, utility, selection mode,
  each conditional probability, and their product.

It does **not** estimate causal learning gain, maintain a full skill-specific
psychometric posterior, diagnose the cause of every mixed-skill failure, or
calibrate individual instances. Online batches store the decision trace with each served problem, including
its purpose, focus, and recalibration epoch. Scripted openers and explicit drills
record their selection reason without inventing a sampling probability. The richer contracts below
specify extensions; they are not claims about implemented storage or inference.

## Practice recovery and confirmation

Birth year supplies the initial estimate. Independent responses update a pooled
estimate and strand estimates; answers marked as helped do not raise or lower
independent ability. Earned practice and skill history are separate from those
estimates. The menu’s **Working together** setting marks help without adding a
step to each answer.

The scheduler distinguishes ordinary work, foundation checks, and stretch
probes. Before direct foundation retrieval has been confirmed, every fourth
position targets that strand’s starting level or lower. On another fourth
position, a recent independent success permits a bounded harder probe. Other
positions stay near the strand’s working band. Prerequisite repair and due
review compete within those bounds; explicitly chosen skills constrain the
available content.

Initial ordinary work is bounded near the starting level. Varied independent
successes permit gradual provisional advancement during the first session.
Successful retrieval across separated occasions can confirm a higher band.
A failed harder probe does not erase demonstrated lower readiness. Foundation
confirmation requires direct work near the starting level, not inferred mastery
from harder answers. These thresholds are versioned scheduling hypotheses in
`frontier-policy.ts` and `practice-policy.ts`, not calibrated mastery probabilities.
The displayed grade remains an uncertain summary rather than a guarantee about
every skill.

**Skip** reveals an answer without creating an attempt or changing ability.
**Try easier**, available after skipping, gives that strand a lower starting
estimate. Other strands retain their estimates. **Reset practice level** starts
all difficulty estimates from birth year. Neither action deletes attempts, XP,
or skill evidence, and neither renews the free-practice allowance.

Changes are account-authorized and serialized per learner. Request receipts
make retries idempotent; revisions reject conflicting changes from another tab.
Served problems retain their epoch and revision so late answers preserve earned
work without restoring a discarded difficulty estimate. Recovery state and
receipts are included in parent export and learning-data deletion.

Selecting a skill under **Builds on** or **Leads to** keeps practice on that skill
until **Return to mixed practice** is chosen from the menu. Higher-grade **Builds
on** lists also include reachable elementary foundations through authored graph
paths; these shortcuts create no prerequisite or mastery claims.

## Curriculum and content metadata

An **exposure objective** is a stable curriculum capability such as linear
equations, fraction operations, or right triangles. Its budget survives splitting
that capability into finer graph steps. Each micro-skill has one primary exposure
objective, even when its prerequisite edges cross several pathways.

| Record | Fields and interpretation |
| --- | --- |
| Curriculum revision | Immutable revision ID; skill, objective, edge and family metadata revisions; source and review notes |
| Objective | ID; instructional importance; assessment emphasis by goal profile; source basis (`editorial`, `blueprint`, `sampled-forms`); uncertainty where estimated |
| Skill | ID; objective ID; grade range; assessable facets; relative emphasis within objective; prerequisite groups; representations; optional skill-specific mastery criteria |
| Prerequisite edge | Source and target; `required`, `helpful`, or `alternative`; strength 0–1; rationale; evidence basis; alternative-group ID |
| Family | Immutable content ID/version; primary assessed skill; diagnostic facets; relative exposure weight within skill; required and incidental skills; representations; response mode; misconception mappings; difficulty controls; expected duration |
| Instance | Family version, seed and realized parameters; difficulty features; assessed skills actually required by this instance; response/guessing metadata; content revision |
| Goal profile | Target objectives and their weights; curriculum/test scope; time horizon; instructional/test-emphasis blend; learner-selected focus constraints |
| Selection revision | Mode weights, challenge bands, novelty/recency limits, exploration bounds, score coefficients, eligibility rules and calibration revision |

Weights are positive relative quantities, not percentages. An objective weight of
6 versus 1 means six times the baseline mass **when both are equally suitable**.
Zero exposure should be expressed as an explicit eligibility rule, not a
misleading low weight. Missing measured test prevalence is `null`, never zero.
Do not infer prevalence by counting standards, graph descendants, question-bank
items, or generators. A named test profile needs its own domain mapping and
sources; general K–12 practice does not inherit one test's blueprint.

The production catalog uses a compact objective membership table, with default
skill/family weights of 1 and explicit overrides. Each new node must join an
objective; a completeness test rejects omissions. New generators inherit their
skill's total budget. They can change the mix *within* that skill. If authors add
many variants of one interpretation, introduce a stable family-group budget
before doing so; per-family weights alone do not protect other interpretations
within the same skill from that form of overproduction.

A future expanded family record can describe these independent dimensions:

```json
{
  "schemaVersion": 2,
  "familyId": "rational-equation-one-denominator",
  "contentVersion": 1,
  "metadataRevision": "editorial-1",
  "primarySkill": "rational-equation-one-denominator",
  "exposure": { "familyGroup": "ordinary-solving", "weight": 3 },
  "assessedFacets": ["solve", "retain-domain-restrictions"],
  "demands": [
    { "skill": "linear-equations", "role": "required", "strength": 0.8 },
    { "skill": "fraction-division", "role": "required", "strength": 0.6 }
  ],
  "representation": "symbolic",
  "difficulty": {
    "basis": "editorial",
    "controls": ["coefficient-size", "signs", "fraction-complexity"],
    "estimatedSeconds": 75
  }
}
```

These numbers are illustrative author estimates. Raising a difficulty control
must have an explained mathematical effect. A symbolic solve and a word problem
can have the same numerical answer and different demands. Changes to scheduling
metadata need not change a frozen generator's seed-to-problem mapping; changes
to generated content do require content versioning. Existing v1 generators do
not accept the proposed controls or family-group selector.

## Learner state: observations, estimates, and earned progress

Keep an append-only, idempotent event history as the source of truth. Rebuild
model projections under a new model version without rewriting those events.

| State | Required meaning |
| --- | --- |
| Observation | Served item/version, realized difficulty, response, first independent result, help before answer, later helped completion, skip, timestamp, ingestion order |
| Context | Active goal, available time, presentation capabilities, explicit focus, session sequence; absence of work is not failure |
| Skill estimate | Ability distribution and uncertainty, evidence count, represented facets/families, retention estimate, last independent and delayed successes |
| Inferred support | Tentative prerequisite evidence, its source items and confidence; distinct from directly demonstrated skill |
| Error hypothesis | Candidate missing prerequisites/misconceptions, confidence and a discriminating follow-up; one error need not identify one cause |
| Exposure | Recent served objectives/skills/families/representations, expected conditional allocation, answered/skipped/reserved state |
| Earned progress | Demonstrated achievements and experience; uncertainty or forgetting does not erase the learner's history |

Record active time only when reliably measured; a backgrounded app is not a slow
learner. Duration can inform item-cost estimates and session fit without lowering
a learner's mathematical ability estimate. A hint-assisted correct answer is
useful learning evidence but is not independent mastery; preserve first-attempt
and help information instead of collapsing them into one success bit.

An advanced independent success can reduce the need to test its prerequisite
pathway. It cannot automatically award mastery to every ancestor: the item may
permit another method, or an answer may be guessed. Propagate **tentative** support
only over required demands, with attenuation and correlated-evidence safeguards.
Never count the same response as several independent observations because it
travels through several graph paths. The production evidence projector grants
no ancestor mastery.

## Frontier and prerequisite diagnosis

The frontier is a collection of nearby boundaries, one for each developing
capability, not one global grade. A learner may be ready for harder algebra while
repairing fraction operations. Grade provides a broad initial prior and a useful
display label; it is not a prerequisite gate.

For each objective, retain a small candidate set: an attainable next step, an
immediate prerequisite check, a due retrieval, and an informative probe where
available. Use actual implemented content and client capabilities. A missing
middle node in the corpus must not force an unlearnable jump.

A useful diagnosis sequence is:

1. A mixed-skill error raises several hypotheses, including an ordinary slip.
2. Revisit through another representation or ask a short problem that separates
   the likely causes.
3. If a prerequisite is weak, practice its nearest useful step and gradually
   reconnect it to the original task.
4. Return to the original capability to verify that the repair transferred.

Raw descendant count is a poor unlock score. A graph with 100 tiny nodes must not
beat an equally valuable pathway represented by ten nodes. Compute unlock value
from **distinct exposure objectives**, discounted by distance and the likelihood
that this skill is their active bottleneck. Limit it to nearby, relevant goals;
otherwise elementary skills acquire enormous permanent priority merely because
they precede nearly everything. Multiple prerequisites may jointly block an
objective; evaluate the likely bottleneck rather than crediting every ancestor
with the whole benefit. Reverse edges and bounded neighborhoods can be cached
per curriculum revision.

## Selection objective and runtime loop

The target quantity is expected durable learning and transfer per unit of time.
Until learning gains are estimable, use explicit proxies rather than labeling a
heuristic score as that quantity:

```
value(action) = goal importance × attainable learning opportunity
              + nearby unlock value
              + valuable retention recovery
              + useful diagnostic information
              - repetition and frustration costs
```

Every component needs a bounded scale and a versioned coefficient. Normalize time
with a conservative floor; otherwise trivial short questions dominate. A
longer multi-step item may be worth its time. Diagnostic information is useful
when it changes a future decision, not merely when uncertainty is large.

The intended runtime loop is:

1. Read a consistent learner snapshot and active goal; load precompiled catalog
   indexes and revisions.
2. Build the local frontier and eligible repair/retrieval/probe candidates.
3. Estimate each candidate's suitability, independent success, cost and diagnostic
   or unlock value, including uncertainty in those estimates.
4. Choose a purpose, then allocate mass through objective → skill → family group
   → family → attainable difficulty/instance. Reallocate unavailable mass among
   eligible candidates; do not accumulate catch-up debt for inaccessible content.
5. Apply bounded recent-exposure correction. Draw from the resulting distribution
   and reserve the item against concurrent or offline batches.
6. Persist the served decision and **final conditional probability** after all
   filtering and reservations. Process the response idempotently, then replan.

A starting purpose mix could be 60% frontier, 20% repair, 15% retrieval and 5%
diagnosis. These are proposed flexible targets, not implemented quotas or
empirically established optima. Placement needs more diagnosis; sustained trouble
needs more repair. When a purpose has no suitable candidates, redistribute its
mass. Production instead uses its existing alternating support reservation.

A proposed first independent-success target is 75–90% for productive frontier
practice, with easier retrieval and occasional harder diagnostic probes.
Predictions must account for guessing, help and item variation. The production
grade-distance heuristic is not calibrated to that probability band. Validate
calibration before using predicted probabilities as hard difficulty gates.

For online practice, replan after every answer. For offline batches, reserve a
small diverse sequence without pretending unobserved answers succeeded. On
reconnect, reconcile attempts before planning further. The best second problem
often depends on the first response; a batch is a contingency-limited plan.

## Default production allocation

With the default policy, the planner supplies a utility score `u` after frontier and recency
adjustments. It first applies client/placement eligibility, freshness rules and
support reservations. Let `b` be the greatest score in that remaining pool.
Candidates with `u < b - 24` are excluded. The window prevents curriculum
importance from selecting work the learner is much less ready to use.

For each objective `o`, let `u_o` be its best eligible utility. For each skill
`s` within it, let `u_s` be its best eligible utility. With temperature `T = 12`:

```
P(o)     ∝ importance(o) × exp((u_o - b) / T)
P(s | o) ∝ skillWeight(s) × exp((u_s - u_o) / T)
P(f | s) ∝ familyWeight(f) × exp((v_f - max_family_v_in_skill) / T)
P(f)      = P(o) × P(s | o) × P(f | s)
```

Here `v_f` is family utility: curriculum utility plus template repetition and
skip penalties. Those family penalties affect only the final draw, so a fresh
duplicate cannot evade them to raise a skill's curriculum allocation. Hard
freshness exclusions still affect availability when no alternative is eligible.
Each line is normalized only over its eligible siblings. Maxima describe the
best available difficulty fit; they do not sum authoring volume. A duplicate
candidate with equivalent fit cannot raise the objective/skill budget. A newly
authored, better-fitting difficulty can legitimately improve that budget's
suitability. Hard template freshness and skip rules can also change availability:
adding a usable alternative to an exhausted family can restore a skill to the
pool. Thus the guarantee concerns allocation for equivalent eligible utilities,
not identical lifetime sequences after every corpus change. Readiness is
deliberately stronger than baseline prevalence.

These are probabilities for **this decision**, not guaranteed whole-session
percentages. Different mastery, review needs and recent exposure change them.
Existing recency penalties and hard variety rules provide short-term balancing;
a goal-normalized cumulative exposure controller is an extension.

The allocator scans candidates in linear time and uses sorted, seeded draws at
three levels. Its runtime is bounded by the small catalog, without an all-pairs
graph computation or a model call. Sorting makes draws independent of input
order; separate draws preserve the objective/skill decision when equivalent
families are added. RNG precision and floating-point arithmetic introduce only
numerical approximation to the reported probabilities.

## Evaluation and evolution

The policy tests require:

- One, ten or 100 equivalent generators leave their objective's total mass unchanged.
- Equal-importance skills retain equal mass despite different generator counts.
- Splitting a graph node within an objective does not increase that objective's mass.
- Family weights affect only the distribution inside their skill.
- Inappropriate work can be excluded despite a high importance weight.
- Draw frequencies agree with computed probabilities; a fixed seed is reproducible.
- Production retains prerequisite repair, skip handling, review, frontier variation
  and offline eligibility behavior.

These are engineering guarantees, not proof of better learning. Evaluate the
learner model with independent simulation and measured predictions, then assess
delayed retention, transfer to unfamiliar representations, frustration/abandonment,
and time spent repairing real gaps. Report results by starting level and pathway,
not just one aggregate success rate. Do not treat adaptive raw accuracy as item
difficulty: the scheduler selectively chooses who sees each item.

Useful increments are: persist selection/served exposure records; add primary
facet and diagnostic-demand metadata; calibrate difficulty by family/version and
realized instance features; improve local prerequisite diagnosis; estimate bounded
goal-aware unlock value; and test outcome-informed policy adjustments. Each
increment should retain an explainable fallback and pass invariance tests before
it controls practice.

## Configuring a selection hypothesis

`src/learning/practice-policy.ts` defines the JSON-compatible parameter schema
and `DEFAULT_PRACTICE_POLICY`. `createPracticePolicy` validates and copies an
input, rejects unknown fields and weight IDs, computes a canonical SHA-256
fingerprint, and deeply freezes the result. Compile once per experiment or
service, then pass that object to each planning call. There is no global setter.

```ts
import {
  createPracticePolicy,
  practiceParameters,
} from "../src/learning/practice-policy.js";
import { planMixedPractice } from "../src/server/mixed-practice.js";

const parameters = practiceParameters(); // Independent mutable copy of defaults.
parameters.version = "uncertainty-probe-1";
parameters.scoring.uncertaintyWeight = 20;
parameters.sampling.temperature = 18;
parameters.weights.objectives["fraction-operations"] = 8;
const policy = createPracticePolicy(parameters);
const choices = planMixedPractice({ ...learnerSnapshot, policy });
```

`learnerSnapshot` supplies the catalog, learner evidence, frontier, seed, time
and requested batch size. For a file-backed or calculated policy, pass the parsed
JSON or computed object to the same compiler. Parameter names and units are
explicit: score coefficients are utility points, distances use the curriculum
grade axis, windows/gaps count problems, and `sessionMs` uses milliseconds.

| Parameter group | Controls |
| --- | --- |
| `sampling` | Competitive utility window and sampling temperature |
| `target` | Offset from estimated level, uncertainty contribution, clamping to available material |
| `placement` | Assessment-only duration and whether scripted openers run |
| `support` | Error window and threshold, demonstrated prerequisite successes, reachable distances, support reservation and alternation |
| `scoring` | Difficulty-distance penalties, support floors/bonuses, review/novelty/uncertainty/age-gap adjustments, batch penalties and offline reach |
| `variety` | Freshness, template/skill/strand repetition, session duration, skip easing and return timing |
| `weights` | Objective, skill and family weights; omitted skill/family entries have weight 1; omitted objectives use the catalog's importance |

Use `buildApp({ ...options, practicePolicy: policy })` for online practice and
`registerOfflineRoutes(app, { ...options, practicePolicy: policy })` for offline
issuance. Pass the **same** compiled object to both when a service runs an
experiment. `OfflineRepository` also accepts it as its third constructor argument.
These are trusted service inputs; learners cannot submit a policy in an API
request. A simulation with a different catalog can provide explicit objective,
skill and family IDs as the compiler's second argument.

Adaptive decision traces include algorithm version, policy label, policy
fingerprint and curriculum version. The fingerprint includes every parameter,
even if two hypotheses reuse the same label; JSON key order does not affect it.
Save the source policy JSON, catalog/content revisions, learner snapshot, time
and seeds alongside results. A hash identifies configuration but cannot restore
it. Low-level allocator tests may supply a custom `budgetOf` function; that
function is a separate input and is not represented by the policy fingerprint.
Scripted openers and user-selected drills bypass weighted selection and do not
produce its probability trace. Decision traces are not durably stored yet.

Selection policy deliberately does not rewrite evidence. `frontier` and `evidence`
are independent planner inputs, so estimator hypotheses can be compared using
explicitly rebuilt inputs. Production frontier inference, mastery/retrieval
projection and grade/content mappings keep their own model semantics. Their
constants are not controls on this selection policy: changing persisted evidence
semantics needs a versioned rebuild. API limits, mathematical constants, RNG
precision and numeric safety bounds are also not learning-policy knobs.

For a paired comparison, hold starting learners, catalog, clock and response
randomness fixed, change one policy component, and record both configurations.
Then compare gap detection, review service, challenge fit and diversity before
measuring delayed learning outcomes. The default-equivalence fixture pins
problem choices, reasons, utilities and probabilities across 80 fixed runs
against the implementation before parameter extraction. Policy injection tests
verify altered weights, temperature, targeting and repair, plus isolation between
runs. No default selection values change when this configuration layer is used.

## Connected skills are navigation only

The pathways screen, answer feedback and public skill pages list strict
prerequisites first under "Builds on" and "Leads to", then editorial extension
and application connections in a quieter style. Related-kind connections, in
both directions, sit under "Related skills". `skillNeighbors` in
`src/web/features/pathways/neighbors.ts` builds these lists. Connections never
enter readiness, support inference or selection; they carry no evidence.
