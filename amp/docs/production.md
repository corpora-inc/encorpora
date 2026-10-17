# Content production coverage

The production manifest joins standards, instructional skills, assessment facets, problem templates, lessons, and generated publications. It distinguishes catalog entries from recorded production evidence. A template attached to a skill does not establish that every facet or requirement of that skill is assessed.

Run from the `amp` directory after installing its Node dependencies:

```sh
npx tsx scripts/production-queue.ts
npx tsx scripts/production-queue.ts --stdout
npx tsx scripts/production-queue.ts --evidence ./review-evidence.json --output ./artifacts/production
```

The default command writes `coverage.json`, `queue.json`, and `summary.json` under `amp/artifacts/production`. `--stdout` emits one JSON object and writes no output files. Outputs omit timestamps so identical source artifacts and evidence produce identical results. Invalid references or evidence make the command exit unsuccessfully; the emitted manifest explains the errors.

## Evidence and coverage

Catalog presence means that a source record exists. The separate evidence stages are generated, tested, independently reviewed, and published. Every stage requires an explicit record. Testing requires generation evidence; independent review requires testing evidence; publication requires independent review evidence. Files on disk do not establish independent review or customer availability.

An evidence file contains `evidence` and `facetMappings` arrays. Each evidence record has `id`, `artifactId`, `sha256`, `stage`, `authorId`, `actorId`, `reference`, and `checks`; review records can also list `facetIds`. Artifact identifiers are `template.<template-id>`, `lesson.<lesson-id>`, or `publication.<filename>`. References point to the team's actual build, test, review, or release records. Testing and review require named checks. The independent reviewer must differ from the author, and an artifact cannot have conflicting author identities. Multiple-author work should use a stable team identity plus a reviewer outside that team.

The CLI computes template digests from the entire mathematics implementation source bundle and each template's metadata. Changes to shared mathematics code invalidate template evidence. Lesson digests cover their structured content. Publication records are loaded from `artifacts/publications/manifest.json`; every referenced PDF must exist and match its byte count and SHA-256 digest. A missing publication manifest means there are no publication records. A malformed or stale manifest fails the command. Lesson-to-publication links identify catalog relationships; the publication manifest does not attest which lesson source revision produced a PDF. Release review must verify that lineage separately.

Facet mappings explicitly name a `templateId`, `facetId`, `extent` of `partial` or `complete`, and a rationale. A declared facet is reviewed only when a complete mapping has matching digest-bound testing and independent review evidence naming that facet. `allDeclaredFacetsReviewed` describes only the declared facet list. `fullyCovered` stays false for skills and standards: a separately approved assessment blueprint and complete component-level review are required before introducing that claim.

Evidence records are auditable assertions supplied by the production team. This tool checks links, digests, ordering prerequisites, and identity separation; it does not authenticate reviewer identities or inspect external review systems. Do not manufacture evidence from the presence of code or a passing unrelated test.

## Bounded authoring tasks

The queue creates stable tasks for templates, explanations, lessons, workbooks, answer keys, rendering validation, and instructional review. Tasks include facet IDs, prerequisite skill IDs, artifact dependencies, checks, and exact owned files under `amp/content/skills/<skill-id>/`. No two tasks own the same file. The ownership list describes proposed authoring artifacts, not existing files or a finalized content schema.

Authoring tasks cannot change shared engine, curriculum, coverage, or package files. A renderer or schema gap needs a separate engineering task. Reviewers own review evidence, not the author's content. Assign different people or agent identities to authoring and instructional review, and retain those identities with revision-bound evidence. Queue priorities use prerequisite depth and artifact dependencies; production operators can assign tasks by stable ID without changing content identifiers.

The queue does not launch agents, reserve workers, purchase inference, publish products, or infer completed work. Execution is disabled in every task. A future scheduler must enforce ownership and reviewer separation, validate authoring schemas, and persist completion evidence before dependent tasks run.

The default manifest derives book inventory and teaching links from the same registered catalog used by the reading app. Book-backed practice uses `CoverageBook` records and explicit `CoverageBookBinding` links from template and skill IDs to existing page IDs. Bindings declare the numeric response being assessed and unassessed requirements. The coverage manifest rejects missing books/pages, mismatched skills, duplicate links, and empty limitations. Templates without a reference lesson or a valid book teaching link appear in `missingInstructionTemplateIds` and fail the audit. Book presence and validated page links do not establish tested, independently reviewed, published, or complete-skill status; those stages require separate revision-bound evidence.
