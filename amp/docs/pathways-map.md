# Pathways map

The web app’s `/pathways` screen shows the curriculum as a directed graph. Arrows run from prerequisite skills to the skills that build on them. Select a node, search by skill, or filter by grade or course to inspect its immediate prerequisites and next steps. Selected skills and search filters survive refresh and can be shared as links.

**Start learning** opens adaptive mixed practice. **Try a problem** opens one problem for the selected skill, then continues through the adaptive practice flow. Skills without an implemented problem family are labeled as practice in development. The graph describes the catalog; inclusion does not establish complete coverage of a standard or assessment.

Signed-in families can choose a learner to see earned crystals. Crystal shapes grow at 1, 5, and 15 cumulative correct answers without help. A later incorrect or assisted attempt cannot reduce that shape. Brightness indicates a strong record among the most recent attempts, regardless of their age; it is not a retention estimate or mastery certificate. Anonymous visitors can browse the curriculum without learner evidence.

The shaded band shows the existing frontier estimate’s approximate 90% range, using the selected skill’s area when measured and the overall estimate when no skill is selected. Expand **Frontier estimates by area** to inspect the range bars. These estimates can extend beyond the grade or course labels drawn on the map. Neither grade labels nor individual successes certify completion of an entire grade.

Prerequisite links are editorial. The graph displays direct evidence only: success on an advanced problem does not currently award credit to its ancestors. Any future inferred support should be distinguishable from directly demonstrated skill, use problem-specific prerequisite evidence, and be checked with targeted probes near the learner’s frontier. It must not turn every catalog edge into automatic mastery credit.

The map loads on its own route, renders only on interaction or state changes, and supports an accessible skill list when WebGL is unavailable. The native app uses its existing home and progress views.

Verify with `npm run test:pathways-ui`; screenshots are written to `artifacts/pathways/`. The browser check uses the real router, catalog and renderer with synthetic family/progress responses. It covers mobile and desktop layouts, selection-to-practice navigation, learner/account switching, refresh, failed progress loading, and WebGL fallback.
