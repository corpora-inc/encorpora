# Clever LMS Connect

AMP publishes assignments to a district's LMS and returns grades from students' AMP work. Google Classroom, Canvas and Schoology all go through one Clever API. It runs on Clever's API v3.1, with the district-app token AMP's roster sync already uses. Clever's guide: [LMS Connect overview](https://dev.clever.com/docs/lms-connect-overview).

## What a teacher does

LMS Connect works in a class imported from Clever, in a district that has connected its LMS to Clever. Once Clever has named that LMS, the gradebook's toolbar has a button for it: "Canvas", "Schoology" or "Google Classroom". It opens the class's assignments. New assignments can be made while Clever reports the district ready.

A teacher makes one of two kinds of assignment:

| Kind | The LMS gets | Points come from |
| --- | --- | --- |
| Practice minutes | A column due at the end of the due day, in the school's time zone | Measured on-screen practice minutes from the first day through the due day, each student clipped to their own enrollment. Points are possible × minutes ÷ target, capped at possible. |
| Term grade | A column for one grading term | The teacher's numeric final grade (0–100) for that term, scaled to the points. A letter or "Pass" is not sent. |

Both read only AMP's own records ([adaptive evidence](adaptive-evidence.md), [grades](schools.md)). A student with no work gets no grade, before or after the due date. AMP never writes a zero, and the teacher decides missing work in the LMS. Minutes practiced after the due date do not count. Paper work is not timed, so it doesn't add practice minutes.

Each assignment shows where it stands:

- **Publishing**: queued for the LMS.
- **In Canvas** (or the LMS's name): published, with the number of students graded.
- **Grades returned**: the due date has passed and every grade reached the LMS.
- **Needs attention**: the LMS or Clever needs something; the line under it says what.
- **Unconfirmed**: Clever didn't answer a create. The teacher checks the LMS, then chooses Publish again or Delete.
- **Deleted in Canvas**: someone deleted it in the LMS, and AMP stopped writing to it.

**Send now** queues the next pass now and skips any backoff once. **Edit** changes the title, points, minutes or dates. The kind and term are fixed. Edited grades are recomputed and sent again. **Delete** removes the column from the LMS on the next pass.

## How a pass works

API handlers only write AMP's rows. Every Clever call is made by the scheduled Clever job (`scripts/clever-sync.ts sync all auto`, every minute) once LMS Connect is enabled. `scripts/clever-lms.ts run [CONNECTION_ID|all]` runs the same pass by hand. One district runs at a time under a database lock. Each pass:

1. Reads the district's `lms_state` and `lms_type`. Writes start only at `success`. A district is reread at least hourly, so its button appears before any assignment exists.
2. Deletes assignments a teacher deleted. An assignment already gone counts as deleted.
3. Publishes new assignments. Before each create, the pass checks that Clever reports the section `synced_in_lms`. The Clever assignment ID is stored the moment Clever returns it. Clever has no way to list assignments, so this ID is the only handle there will ever be.
4. Sends teacher edits.
5. Returns grades. It reads each open assignment and its submissions, computes each student's grade, and writes only what changed, using the transitions each LMS supports. An open assignment is recomputed every 15 minutes, and once more 30 minutes after its due time to hand the final grades back. After that it is left alone.

### LMS differences handled

| | Canvas | Google Classroom | Schoology |
| --- | --- | --- | --- |
| Assignment | `submission_types: ["link"]`, `max_attempts: 1`; no `term_id` | Link attachment on create only; no `submission_types`, `max_attempts` or `term_id` | `term_id` from the section's Clever term is required; a `link` attachment holds the AMP link; every update resends it, since an update without it deletes it |
| Grade | `grade_points`, with `state: "submitted"` for SpeedGrader | `submitted` with the grade before the due date, then `returned` | `grade_points` only; Schoology marks it returned |
| Work that no longer counts | Left for the teacher | `reclaimed`, if AMP turned it in | Left for the teacher |
| Blocked when | The assignment is unpublished (draft) | The assignment isn't `open` | The student never launched AMP from Schoology |

An assignment's link opens AMP at its origin, where the student signs in with Clever.

### Failures

| Code | Meaning | Retry |
| --- | --- | --- |
| `lms_unauthorized`, `lms_forbidden` | Clever refused the token or the app's LMS access (401/403) | Per district, 1 to 512 minutes; fails the job |
| `lms_not_ready`, `lms_type_unknown` | District still matching, or the LMS fields aren't enabled for the app | 15 minutes while assignments wait, otherwise hourly |
| `lms_section_not_synced` | Clever hasn't matched this section in the LMS | Backoff |
| `lms_section_unshared` | The district no longer shares the section; no call is made | Backoff |
| `lms_term_required` | Schoology and the section has no Clever term | After an edit |
| `lms_create_outcome_unknown` | A create got no usable answer and may exist | Never on its own |
| `lms_assignment_unpublished`, `lms_assignment_not_open` | The teacher must publish or open it in the LMS | Backoff |
| `lms_submission_update_failed` | Schoology: the student hasn't launched AMP from Schoology yet | Every 6 hours |
| `lms_user_not_in_lms` | Clever lists no submission for the student | Daily |
| `lms_reclaim_unsupported` | A grade AMP sent no longer has work behind it; the LMS can't take it back | Never; shown to the teacher |

A 429 waits for Clever's reset. A read, update or delete retries an outage after 1, 2 and 4 seconds. A create is never retried after an unclear failure, because a second one would make a duplicate column nobody could find. Raw provider messages are never stored or logged. A pass stops at 600 requests, half of Clever's per-token limit, and the next pass continues.

## Configuration

| Variable | Where | Value |
| --- | --- | --- |
| `AMP_CLEVER_LMS_CONNECT` | API and worker | `enabled`, or unset (off) |
| `AMP_CLEVER_API_VERSION` | API and worker | Must be `3.1` when enabled |
| `AMP_ACCOUNTS_URL` | Worker | The AMP origin students open (HTTPS) |

The Clever variables from [Clever sign-in](clever-auth.md) are required too. Startup fails if LMS Connect is enabled without them, or with API 3.0. While it's off, the toolbar button, the LMS routes (404) and the worker's LMS pass are all absent. Migration `0147-clever-lms-connect.sql` adds `amp_clever_lms`, `amp_lms_assignments` and `amp_lms_submissions`. Deleting a person deletes their passback rows; grades already in the LMS are the district's record.

## Operations

- **Verify a sandbox district:** set `AMP_CLEVER_ENVIRONMENT=sandbox`, the dev-app credentials, `AMP_CLEVER_TEST_DISTRICT_ID` and optionally `AMP_CLEVER_TEST_SECTION_ID`, then run `npx tsx scripts/clever-lms-probe.ts`. It prints statuses, enum values and counts only.
  - `--write` also creates, reads, updates and deletes one assignment and lists its submissions.
  - `--write --submission` also grades one matched sandbox student before the deletion.
  - A 401/403 shows as `capability: true`.
- **Run one district now:** `node --import tsx scripts/clever-lms.ts run <connection-id>`.
- **Find stuck work:** `SELECT status,failure_code,count(*) FROM amp_lms_assignments GROUP BY 1,2`. Every action is also in `amp_school_events` as `lms.assignment.*`.

Tests: `tests/clever-lms.test.ts` and `tests/clever-lms-probe.test.ts` run against fixtures copied from Clever's API reference. `tests/clever-lms.integration.ts` and `tests/clever-lms-routes.integration.ts` need `AMP_TEST_DATABASE_URL`. `src/web/features/school/classes/__tests__/lms-sheet.test.tsx` covers the sheet.

## Limits

- **Live sandbox status (2026-11-25).** Schoology passes the probe end to end: create, read, update, list submissions, grade, delete. Google Classroom creates, reads, updates, lists, writes a grade and deletes, but refuses to turn work in, return it or reclaim it (404 "failed to turn in student submission"; a return answers 400 "has not been turned in"). The grade in the same request is still written, so the work stays `created` with AMP's points and the pass reports a failure; this is open with Clever. The Canvas demo district shares no schools, sections or users with the app yet. An assignment Clever no longer has answers 404 "Could not find assignment" (Classroom) or 500 "Assignment mapping not found" (Schoology); both read as deleted.
- **One-way.** AMP doesn't import teacher edits made in the LMS. A teacher's regrade there is overwritten only when AMP's own grade for that student changes.
- **Schoology grading category.** A grade can return success yet not appear in Schoology until the teacher sets the assignment's Category in Schoology. Clever gives no signal for this.
- **LTI 1.3.** Students reach AMP through the assignment link and Clever sign-in. AMP doesn't route an LMS LTI launch to a course. Schoology still needs each student to launch AMP from Schoology once before their grade can be written.
- **No silent recovery.** An unanswered create waits for the teacher. A district that refuses access waits for Clever. Neither is guessed around.
