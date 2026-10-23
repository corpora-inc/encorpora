# Curriculum map

`/pathways` is an optional interactive atlas alongside adaptive mixed practice.
It draws every catalog skill and its actual prerequisite links. The spatial neighborhoods organize related subjects. Earlier skills sit lower and closer; advanced skills extend upward and farther away. Dotted lateral connections show skills with shared foundations. These are navigation aids, separate from the prerequisites used by the learning algorithm.
The catalog includes skills whose practice is being developed, so the map is
not a claim of verified coverage of every standard or assessment.

Drag to pan, pinch or scroll to zoom, or enable 3D orbit. Search and the skill
browser provide keyboard access to the same skills. Selecting a skill reveals
its prerequisites, dependents, recorded progress, and available problem types.
Lessons open in a reading sheet. A practice action requests the selected skill
or problem type for one problem, then returns to adaptive selection.

## Earned illumination

The map uses saved learner evidence. There is no simulated-progress mode.
Independent correct answers grow crystals permanently. `illumination-v1` assigns
0.5 illumination per independent success, capped at 10 after 20 successes.
This is accumulated experience, not a calibrated mastery probability. Recent
`review-ready` status adds brightness separately from cumulative growth.
A downstream success does not award prerequisite credit. The faint frontier
outlines represent the learner's estimated level range, not proof about every
skill within it.

Signed-in progress is scoped to the account and selected learner. The assessment
checkpoints and summary link to `/pathways?context=trial` to show that device's trial progress,
even when a parent is signed in. Trial enrollment uses the existing saved
evidence; illumination does not need a separate transfer or backfill.
Practice authorization and the free allowance are enforced by server endpoints.

## Catalog updates

Progress attaches to stable skill IDs, never graph positions or array indexes.
Do not rename or reuse a skill ID to represent a different skill. New skills
start without earned illumination. The map refreshes the catalog every five
minutes and saved evidence every 30 seconds while visible. Search, the selected
skill, camera position and zoom survive those refreshes. Per-ID spatial anchors
keep new skills from reindexing a neighborhood; collision spacing adjusts locally.

The renderer uses Three.js with WebGL, additive halos, batched connection
geometry, and moving particles following actual prerequisite direction. It
releases GPU resources on teardown. Motion pauses when the document is hidden,
honors reduced motion, and can be disabled explicitly. The skill browser remains
available without WebGL.

## Sharing an assessment

The assessment summary creates a share image from the actual curriculum and
saved evidence. The card includes the displayed level estimate, the number of
illuminated skills, and the public assessment link. It excludes learner names,
account identifiers, tokens and individual responses. Image generation happens
on the device and does not publish a learner snapshot to a server.

On supported devices, the share action attaches the PNG to the native share
sheet. Other browsers can save the image or share the estimate and public link.
The existing clipboard and selectable-text fallbacks work when native sharing
is unavailable.
