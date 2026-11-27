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

## Clever's guidance (Partner Engineering, 2026-11-26)

Clever's partner engineers answered AMP's LMS Connect questions on 2026-11-26. These are their rules, stated as facts about the API. Where AMP's code differs, the difference is listed after them.

### Google Classroom: turn in, return, reclaim

This is how Classroom works everywhere, not only in the demo district. Submission state changes need the district's Google Classroom Rostering Integration (GCRI).

- Update a submission with `PATCH /v3.1/sections/{section_id}/assignments/{assignment_id}/submissions/{user_id}`.
- The teacher must accept the provisioned class in Google Classroom before any submission in that section can be updated.
- The assignment must be `open`.
- A submission leaves `created` only when a `state` is sent, or when an `attachments` array is sent (which moves it to `submitted`).
- `returned` and `reclaimed` are valid only from `submitted`.
- `returned` can be set without a grade.
- After `submitted`, `returned` or `reclaimed`, a submission never goes back to `created`.
- Sequence: send `state: "submitted"` first. Send `returned` or `reclaimed` in a later request.
- The live 404 "failed to turn in student submission. ensure first that the section is active" and 400 "student submission has not been turned in" are not in Clever's error catalog. Clever reads them as "class not accepted / section not ready" and "submission not turned in yet".

### Grades

- Classroom is points-only through LMS Connect. Send the score as `grade_points`. `grade` and `grade_comment` are not supported on Classroom submissions.
- Classroom itself has a teacher-only draft grade and a grade students see. Clever's `grade_points` is the grade value for the submission. Turning in, returning and reclaiming are separate state updates.
- Sending `grade_points: null` is not a supported way to clear a grade. Clever will advise on a specific clear or ungrade use case if asked.

### LTI 1.3

- Clever supports launches from the LMS into the app only (Canvas or Schoology to AMP). There is no launch from the app back into the LMS.
- A launch is OpenID Connect and carries a signed ID token (JWT) with the user's identity, role and the course or section it came from. The app validates the token and routes the user from that context.
- Clever's docs: the app needs a working Clever SSO integration first; a launch from a mapped course goes straight to that course's view in the app, and an unmapped one goes to a setup or matching flow. Course-level launch is not LTI Deep Linking.
- Clever adds the app as an LTI 1.3 app in the Canvas and Schoology sandboxes once it has confirmed the direction and the landing behavior. Google Classroom has no LTI 1.3 SSO.

### Test logins

Clever's team issues demo teacher and student logins for each LMS sandbox. It needs the section name and teacher name the app tests with.

### Scopes

LMS Connect uses the same district-app bearer token as rostering, on API v3.1. A token that lists only the roster `read:*` scopes is expected.

### Creates that time out

- There is no list-assignments endpoint and no idempotency key.
- Store the assignment ID from the create response at once. It is the only way to read or update the assignment later.
- A retry after a timeout can create a duplicate column.
- Use a 15 to 60 second timeout on create and update calls.
- If a create times out and no ID came back, email integrations@clever.com rather than retrying.

### Schoology `term_id`

Clever's provider-differences, testing and API reference pages say `term_id` (the Clever term ID) is required on Schoology assignment writes. The reference's create table doesn't mark it required, which is why the sandbox accepted a create without it. Send it for Schoology anyway. Canvas doesn't use it.

### Where AMP stands

| Rule | AMP today |
| --- | --- |
| Classroom state order | Matches. A `created` or `reclaimed` submission gets `submitted` (with the grade) first; `returned` follows in a separate PATCH (`planSubmission` in `src/schools/clever/lms-payloads.ts`). `returned` and `reclaimed` are sent only from `submitted`. A state change is never repeated after an outage. |
| Assignment must be `open` | Matches. Submissions are read and written only while it is `open`; otherwise `lms_assignment_not_open`. |
| Teacher must accept the class | **Gap.** The 404 maps to the generic `lms_not_found`, so the teacher sees "not sent yet" with backoff, not "accept the class in Google Classroom". |
| `grade_points` only | Matches. AMP never sends `grade` or `grade_comment`. |
| No null clear | Matches. AMP never sends `grade_points: null`. Classroom work AMP turned in that no longer counts is reclaimed. Other LMSs show `lms_reclaim_unsupported` to the teacher. |
| Reclaim and the old grade | **Open.** Whether a reclaim leaves the old `grade_points` in place is unconfirmed. |
| LTI 1.3 | **Not built.** AMP accepts no LTI launch and reads no course context. Today, Clever sign-in lands a teacher on `/school` and a student on their practice. |
| Store the create ID at once | Matches. |
| Timeouts | Matches. 30 s on reads, 60 s on writes (`LmsClient`). |
| No retry of an unclear create | Matches. It becomes `lms_create_outcome_unknown` and waits. **Gap:** the teacher's message says "Check the LMS, then publish again or delete" and names no way to recover the ID through Clever. |
| Schoology `term_id` | Matches. Always sent on create and update; a section without a Clever term stops at `lms_term_required`. Never sent for Canvas or Classroom. |
| Same token, `read:*` scopes | Matches. |

### Follow-ups

1. Map Classroom's "ensure first that the section is active" 404 to its own code, shown to the teacher as "Accept this class in Google Classroom", with a slower retry.
2. Build the LTI 1.3 launch: validate Clever's ID token, map its course or section to the AMP class, and land a teacher on that class's Today (`/school/<org>/classes/<class>/today`) and a student on their practice. An unmapped course lands a teacher on their classes. Clever still has to say where the launch arrives (the existing Clever redirect URI or a separate launch URL) and which claim carries the section.
3. Give an unconfirmed create an operator path: ask integrations@clever.com for the ID, then attach it to the AMP assignment, instead of a second publish when the column already exists in the LMS.
4. Ask Clever whether a Classroom reclaim keeps the old `grade_points`, and what an ungrade should do.

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

- **Live sandbox status (2026-11-25, Canvas 2026-11-27).** Schoology passes the probe end to end: create, read, update, list submissions, grade, delete. Google Classroom creates, reads, updates, lists, writes a grade and deletes, but refuses to turn work in, return it or reclaim it (404 "failed to turn in student submission"; a return answers 400 "has not been turned in"). The grade in the same request is still written, so the work stays `created` with AMP's points and the pass reports a failure. Clever says this is the class not yet accepted by its teacher in Google Classroom (see [Clever's guidance](#google-classroom-turn-in-return-reclaim)); it needs a teacher login to verify. The Canvas demo district now shares 26 schools with the development app, and Clever reports 3 of its sections synced in Canvas; the probe has not run there yet. An assignment Clever no longer has answers 404 "Could not find assignment" (Classroom) or 500 "Assignment mapping not found" (Schoology); both read as deleted.
- **One-way.** AMP doesn't import teacher edits made in the LMS. A teacher's regrade there is overwritten only when AMP's own grade for that student changes.
- **Schoology grading category.** A grade can return success yet not appear in Schoology until the teacher sets the assignment's Category in Schoology. Clever gives no signal for this.
- **LTI 1.3.** Students reach AMP through the assignment link and Clever sign-in. AMP doesn't accept an LTI launch yet ([follow-up 2](#follow-ups)). Schoology still needs each student to launch AMP from Schoology once before their grade can be written.
- **No silent recovery.** An unanswered create waits for the teacher. A district that refuses access waits for Clever. Neither is guessed around.
