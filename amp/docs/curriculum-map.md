# Curriculum map

`/pathways` is an optional interactive atlas alongside adaptive mixed practice.
It draws every catalog skill and its actual prerequisite links. The spatial
neighborhoods organize related subjects; they do not add learning dependencies.
The catalog includes skills whose practice is being developed, so the map is
not a claim of verified coverage of every standard or assessment.

Drag to pan, pinch or scroll to zoom, or enable 3D orbit. Search and the skill
browser provide keyboard access to the same skills. Selecting a skill reveals
its prerequisites, dependents, recorded progress, and available problem types.
Lessons open in a reading sheet. A practice action requests the selected skill
or problem type for one problem, then returns to adaptive selection.

Independent successes grow crystals permanently. Recent `review-ready` status
adds brightness separately from cumulative growth. A downstream success does
not award prerequisite credit. The faint frontier annulus represents the
learner's estimated level range, not proof about individual skills.

Signed-in progress is scoped to the account and selected learner. The assessment
summary links to `/pathways?context=trial` to show that device's trial progress,
even when a parent is signed in. Practice authorization and the free allowance
are enforced by the existing server endpoints.

**Preview illumination** renders deterministic sample progress. Its visible
banner distinguishes it from learner results; it never writes evidence or
changes progress counts. Use this preview for promotional screenshots or video.
The full-screen control gives the map more room while retaining the brand,
preview label, search, and skill inspection. Promotional assets should retain
the preview label and should not imply a student's actual results.

The renderer uses Three.js with WebGL, additive halos, batched connection
geometry, and moving particles following actual prerequisite direction. Layout
is deterministic and independent of catalog ordering. Geometry is disposed on
unmount. Motion pauses when the document is hidden, honors reduced motion, and
can be disabled explicitly. The skill browser remains available without WebGL.

With AMP running locally, `npx tsx scripts/capture-pathways.ts` creates a 1920×1080
overview, a selected-pathways image, and a short browser recording under
`artifacts/pathways-campaign/`. Set `AMP_MAP_ORIGIN` to use another deployment.
The capture uses a fresh browser context and retains the sample-data banner.
