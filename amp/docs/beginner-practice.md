# Beginning a mixed practice session

Mixed practice uses observed answers and an editorial prerequisite graph to choose work across mathematical strands. Grade bands guide initial range; they are not calibrated difficulty scores, and a selected starting range does not establish mastery.

A beginning session can compare aligned lengths, identify circles, triangles and squares, and count objects. A recent independent success on every immediate prerequisite can open a nearby successor. This is tentative instructional support, separate from review readiness and spaced retrieval credit. A later error or assisted answer removes that support. An independently successful advanced skill can stay available without crediting its unobserved ancestors.

## Exploration and recovery

Selection first determines eligible work, then balances variety, review and support. Ordinary multi-question batches allow at most one unsupported diagnostic near an entry skill or on the prerequisite path of a recorded difficulty. Single-question requests prefer supported work; a recorded difficulty can justify a prerequisite diagnostic. The quota applies to each batch, not to a persistent learner-wide exploration budget.

An explicitly selected higher starting range has a separate diagnostic purpose: untouched enrolled strands can sample an entry task within their available requested range. Those probes use the shallowest eligible prerequisite depth within that range. Graph depth is an editorial ordering, not a measurement of cognitive difficulty. Observed outcomes replace the initial preference, and editing a preference cannot reset an observed strand.

After a difficult task, a nearest implemented prerequisite may be offered as a diagnostic. If that prerequisite also proves difficult or needs assistance, selection descends again. A missing intermediate lesson can be crossed backward to find available support; it is never marked learned. A client with a limited set of supported problem formats may receive fewer distinct tasks or a smaller batch. The planner does not fill a sparse pool with repeated unsupported diagnostics. Offline pool selection also retains its range ceiling.

The graph and implemented content limit the available paths. For example, a missing categorical-data activity can prevent supported progression into picture graphs. Content gaps should be filled with teaching and assessment rather than hidden by selection scores. Independent answers, assistance and spaced retrieval remain distinct evidence; no diagnostic grants ancestor credit.

## Two entry activities

**Line up and compare** presents two straight strips with aligned left endpoints. The learner selects the longer strip, the shorter strip, or equal lengths. Differences are visually separated; equality is exact. Labels and endpoints carry the comparison independently of color. This assesses a selected direct-length comparison component of K.MD.A.2, not weight, capacity, physical measurement or the entire compare-attributes skill.

**Meet a shape** presents a circle, triangle or square with varying size and orientation. Triangle examples include unequal side lengths. Square geometry preserves equal sides and right angles under rotation. This assesses recognition of these three flat shapes across orientation and size, a selected component of K.G.A.2. It does not assess solid shapes, spatial language, drawing or the entire name-shapes skill. Written answer choices may require adult read-aloud support; independent access for nonreaders needs an audio interaction.

Both activities use typed geometric data and the existing single-choice response protocol. Clients must advertise `entry-models-v1` and `single-choice-v1` before receiving them. Public figures contain visible givens; answers and selected-choice feedback remain on the grading side. Reference lessons include worked reasoning, pitfalls and hands-on adult guidance. These lessons are not substitutes for a complete illustrated course.

## Verification

`npm run review:frontier` emits reproducible cold-start distributions and multi-session trajectories for independent answers, counting difficulties and assistance. These are policy checks, not evidence of learning efficacy. Unit and database tests cover latest-outcome support, same-band descent, sibling prerequisites, sparse and legacy catalogs, capability negotiation, ownership and retry behavior. `npm run test:entry-ui` checks focused problem, feedback and lesson views at several viewport sizes, enlarged text and printed figures. Independent Python geometry checks derive answers from the public drawings and displayed choices.
