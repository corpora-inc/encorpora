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
calibrate individual instances. The internal probability trace is returned by
the planner, not durably stored with served problems. The richer contracts below
specify extensions; they are not claims about implemented storage or inference.

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

## Exact production allocation

The existing planner supplies a utility score `u` after frontier and recency
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
