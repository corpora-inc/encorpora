# Clever and direct school onboarding

AMP supports teacher-led pilots and institution-managed rosters using the same learners, classes and learning records. Classroom setup requires data authority but does not require a purchase, payment card or AMP operator approval. Commercial pricing is negotiated separately.

## Entry paths

| Starting point | Path to a learning class |
| --- | --- |
| Teacher with no roster integration | Sign in, open `/school/start`, confirm classroom authority, paste names or import CSV/Excel, review the roster, activate the pilot and open Start class. |
| School or district using Clever Complete | A Clever district administrator authorizes sharing, signs into AMP, confirms the institutional agreement and imports the roster. Teachers enter their shared classes and activate their own pilot when ready. |
| Institution without Clever | Start classes directly. An AnySchool request records the institution contact for the provider's hosted invitation. After the administrator connects a supported source, AMP uses the same roster API and model as Complete. |
| Existing AMP school joining a district | The school owner authorizes adoption into one specific district. Its administrator reviews the grant and any staff identity conflicts. Learners, evidence, classes and pilot dates keep their IDs. |
| Existing AMP school moving to Clever | Stage the first import, adopt the school if needed, and review exact school, person and section source-ID matches before starting synchronization. Names and email addresses never establish identity. |

Clever's [AnySchool setup guide](https://dev.clever.com/docs/anyschool-rostering) requires provider enablement and a dashboard invitation completed by the institution. The request in AMP does not claim to have sent that invitation or connected an SIS. Teachers can start directly while the institution completes this step.

## Pilot and purchase lifecycle

The first explicitly activated class starts a teacher's 30-day pilot. Seven days of full-access grace follow it. Additional classes share the original deadline; an already activated class cannot switch to a co-teacher's fresh pilot. Provider aliases and a verified mailbox are recorded as eligibility digests, so reconnecting or recreating an account cannot renew the trial. Deletion removes account identity and classroom data according to its ownership while retaining only the minimal eligibility references and dates.

Expiry pauses new online practice and new workbooks. Reports, exports, issued materials and entry of their paper results remain accessible. Another valid pilot, license or grant continues access. A paid class scope requires current membership; leaving every purchased class invalidates and releases that seat. Overlapping school licenses count a learner once. An operator can extend a pilot with an auditable reason and reference.

The teacher's buyer link contains aggregate adoption information, expires after 30 days and grants no account or school authority. Negotiation, quotes, POs and invoices can precede activation. The operator commands `purchase-status` and `activate-purchase` record that process. Activation uses existing records and is idempotent by purchase request. `issue-license` supports selected classes or an entire school/district subtree.

## Identity and source ownership

Clever identities are keyed by environment, district and user ID. Sandbox and production cannot collide. Staff can sign in without a mailbox; a Clever email is not proof of mailbox ownership. Linking to an existing AMP account requires a fresh authenticated linking flow. Student sessions retain AMP's isolated `st_` capability and cannot become parent sessions on a shared device. See [Clever sign-in](clever-auth.md).

The roster adapter imports districts, schools, multi-role users, multi-school memberships, sections with co-teachers, courses and terms. Optional fields may be absent. Contacts are recognized but do not create guardian permissions. AMP retains an allowlisted source snapshot and discards sensitive fields it does not use. One person has one learner within a district, even across several schools or sections.

Clever staff designations are distinct from teaching or district administration. A `SchoolTechLead` receives read-only school access; `PortalOnly` staff receive no school-wide roster permissions. A teacher's access follows their class enrollments. Multiple supported roles combine their scopes, while student and contact identities cannot also hold staff roles. See Clever's [staff-role definitions](https://dev.clever.com/docs/api-v3-upgrade-guide).

Full snapshots and Events update source-owned memberships. Manual memberships remain independently controlled. Unshared records are archived and can be restored under the same provider IDs. Learning evidence is not deleted by a roster removal. Privacy deletion tombstones identities so synchronization cannot silently recreate the learner. Events, source records and the resulting roster commit atomically. Invalid, partial or forbidden responses cannot trigger a removal sweep.

A separate worker requests a full snapshot daily and processes enabled Events every five minutes. API handlers only queue work. On-demand requests require a school or district administrator and are limited to one per connection per 15 minutes. Repeating connection setup does not bypass this limit. Deployment-wide claims prevent duplicate work; interrupted runs are recovered. Repeated failures back off exponentially from one minute to 512 minutes and reset after success. Deleted people are skipped and entered in the connection review queue; their deletion does not stop other roster changes.

Connection status reports queued, running, retrying, delayed or ready synchronization, with request, attempt and retry timestamps. A request or due retry waiting more than five minutes, or a running attempt older than the worker's 30-minute deadline, reports delayed. This detects missing or interrupted job processing without granting or denying school access. The connection and imported records are preserved; an administrator can retry within the request limit. Operators should check the worker schedule, credentials and job logs when processing is delayed. Bootstrap administrator proofs do not count as worker attempts.

Each worker pass visits unattempted districts first, then districts with the oldest attempt. An interrupted import therefore yields to other districts on the next pass. Database claims prevent concurrent imports of the same connection.

For a staged connection, the worker caches the source for adoption review without provisioning people, classes or memberships. An administrator starts the import after reviewing the matches. Adoption authority is rechecked with a single provider-user read. The school selector reads stored school records; a selected-school preview reads at most 5,000 source records and refuses larger previews. A provider revocation ends source access; reauthorization uses a short-lived onboarding proof and a current provider-role check before normal access can resume.

## Worker deployment

Run `node --import tsx scripts/clever-sync.ts sync all auto` in a separate job every minute. The command checks each connection's due time and retry deadline, processes districts sequentially, and clears only requests it consumed. Use [the CronJob template](../deploy/clever-sync-cronjob.yaml) with the release's API image and a worker Secret containing `AMP_DATABASE_URL`, `AMP_CLEVER_ENVIRONMENT`, `AMP_CLEVER_CLIENT_ID`, `AMP_CLEVER_CLIENT_SECRET` and `AMP_CLEVER_API_VERSION`. Set the same API version for the server and worker: `3.0` for a Rostering v3.0-enabled app, or `3.1` when that version is enabled for the app. Rostering v3.0 provides the data required for this onboarding; enhanced demographics and LMS grade exchange are separate capabilities. Substitute both template placeholders before deployment. The template requests one CPU and 1 GiB memory, limits memory to 2 GiB, and prevents overlapping jobs. Verify capacity for the largest district; [measurements and lock-capacity requirements](clever-performance.md) include synthetic fixtures and their limitations.

Do not run this command inside an API container. API maintenance independently reconciles seats, updates connection reviews and expires provider sessions and OAuth flows. Sign-in attempts the roster attachment lock without waiting; a busy apply defers attachment until a subsequent authenticated request. An identity conflict expires the session. Completed synchronization runs older than 30 days are removed once no source binding or membership references them.

## Sandbox and launch

1. Create a development application and obtain Rostering API v3.0 or v3.1 and AnySchool access from Clever. Configure `AMP_CLEVER_API_VERSION` for the enabled version in both the server and worker. Default developer credentials may have only basic SSO scopes.
2. Configure the exact redirect URI `<AMP origin>/api/v1/school/sso/clever/callback`. Enable supported user types and Events in the provider dashboard. Store credentials in secret storage, never in the repository or a shared transcript.
3. Apply migrations and configure the variables in [Clever sign-in](clever-auth.md). Set `AMP_CLEVER_TEST_DISTRICT_ID` privately and run `npx tsx scripts/clever-probe.ts` with `AMP_CLEVER_ENVIRONMENT=sandbox`. Its output contains capability status and record counts only. A 401/403 is a capability failure, not an empty roster.
4. Complete a real development-app round trip: district sharing, initial roster, teacher/student sign-in, sharing removal and restoration, school/class transfer, co-teacher, multiple roles, zero-section user, missing optional fields, terms/courses, Events and full resync. Exercise AnySchool invitation, source upload and import separately.
5. Use Clever's [Secure Sync certification guide](https://dev.clever.com/docs/secure-sync-certification-guide) and certification dataset. Request the certification form through the partner contact. Fixture tests and a successful token request do not establish provider certification or production readiness.

`npx tsx scripts/clever-sync.ts sync <connection-id> full` performs an explicit full repair; `sync all auto` runs configured connections. Credentials and tokens are not written into sync logs. `npm run school:admin -- school-queue <private-input.json>` lists connection requests, commercial follow-up and connection-release reviews. AnySchool invitations are performed in Clever's dashboard; `connection-request-status` records their actual outcome and reference. Review disconnected or expired institutions before freeing an upstream slot. Capacity is not an onboarding gate.

Use `AMP_TEST_DATABASE_URL=<dedicated test database> npx tsx scripts/verify-clever-scale.ts --run` for the synthetic district benchmark. It checks stable IDs, repeated imports, scoped access, transfers and empty Events polling, and reports query counts, time and memory. It uses a disposable schema and synthetic HTTP responses. See [roster performance and privacy](clever-performance.md) for measured district workloads, memory use and PostgreSQL lock sizing for mass changes. These measurements do not include provider latency or establish production capacity.

## Limits

Provider access, institution sharing and certification are external prerequisites. A connected district exposes only what it shares. Existing Clever bindings cannot be silently repointed to another learner or institution; established duplicate identities need a reviewed resolution. District adoption grants are single-use, expire after seven days and recheck both parties' authority at acceptance. Learner names and school names are never matching keys.

LMS grade passback, graded assignment authoring, teacher referral commissions and public seat-pack checkout are outside this onboarding implementation. AMP's core remains adaptive practice.

### Retrying a busy connection

When a roster apply holds the connection lock, connecting returns HTTP 409 with
`{error: "clever_sync_already_running", retryAfter: 1}` and `Retry-After: 1`.
Retry after that delay. A deferred administrator attachment does not create a
person or grant bootstrap authority. Staff sign-in defers attachment during lock
contention and can attach on a later session read.
