# Clever AnySchool

AnySchool brings a school that is not on Clever into Clever. Clever hosts the setup. The school uploads two spreadsheets, uses SFTP, or connects its own SIS. Its data then reaches AMP through the same Secure Sync API as any district ([Clever quickstart](https://dev.clever.com/docs/anyschool-rostering)). AMP reads it with the adapter described in [Clever onboarding](clever-onboarding.md).

Two things differ from a Secure Sync district:

- **The invitation.** A partner sends it from Clever's dashboard. It needs a name and the email of the person who will do the setup. The link works only for that address, for 48 hours after it is first opened ([partner article](https://support.clever.com/hc/s/articles/000001725?language=en_US)).
- **The administrator.** An AnySchool CSV lists students, teachers and staff only ([CSV spec](https://support.clever.com/hc/s/articles/000001762)). The district may have no Clever district administrator to sign AMP's agreement in the Clever connect flow. So the school accepts the agreement when it asks in AMP, and the operator connects the district.

## Who does what

| Step | Who | Where | Record in AMP |
| --- | --- | --- | --- |
| 1. Ask | School administrator | AMP: the school's **Integrations** page, **Clever AnySchool**, **Set this up with us** | Request `requested`, with the setup email and the signed agreement |
| 2. Invite | Operator | Clever dashboard, then `anyschool-invite` | Request `invited`, with the Clever district ID |
| 3. Set up | The person at the setup email | Clever's hosted setup | None; Clever syncs the data and issues AMP a district token |
| 4. Connect | Operator | `anyschool-connect` | District org, agreement, requester as district administrator, staged connection |
| 5. Move classes in | School administrator, and each teacher with an AMP pilot | AMP: **Move classes in** (`/school/adopt/<district>`) | Reviewed adoption: school, people and classes matched to Clever IDs |
| 6. Import | Operator | `anyschool-import` | Connection launched; the worker imports and then syncs daily |

A school that already uses Clever does not need this. Its district administrator connects at `/school/connect`.

## Operator steps

Commands run as `npm run school:admin -- <command> <private-input.json>`, in the API image with the production database (see [schools](schools.md)). `anyschool-connect` and `school-queue` also need the worker's `AMP_CLEVER_ENVIRONMENT`, `AMP_CLEVER_CLIENT_ID`, `AMP_CLEVER_CLIENT_SECRET` and `AMP_CLEVER_API_VERSION`. `AMP_ACCOUNTS_URL` makes the printed adoption link a full URL. Output is private: it includes the setup email.

1. **Find the request.** Run `school-queue` with `{}`. Under `connections`, an AnySchool request has `method: "anyschool"`, `status: "requested"`, its `id`, `institution_name` and `contact_email`. The contact email is the setup email.
2. **Invite in Clever.**
   1. In the Clever App Dashboard, go to **Home > Invite Districts > Add an AnySchool District**. The partner article calls the button **Connect to an AnySchool district**.
   2. Enter the request's `institution_name`, then select **Create new district**.
   3. On the district overview page, select **Send email invite**.
   4. Set **District Email** to the request's `contact_email`. Use this subject: "Set up your roster for AMP". Use this body: "AMP reads your school's roster through Clever. This link opens Clever's setup. It works for this email address only, for 48 hours after you open it. Choose CSV Upload to send two spreadsheets, or connect your student information system."
   5. Select **Send email**.
3. **Record the invitation.** Run `anyschool-invite` with `{"id": "<request id>", "districtId": "<Clever district ID>", "reference": "<free text>"}`. The district ID is on the new district's overview page. If you don't have it, leave it out and pass it to `anyschool-connect`. The school's Integrations page now says where the invitation went.
4. **Re-send when needed.** The link expires 48 hours after it is first opened. A school that re-uploads may need a new link. Send it again from the district overview, then run `anyschool-invite` again with the same `id`.
5. **Watch for the setup.** Run `school-queue`. When the school has finished, its district appears under `clever.awaitingConnection` with `connectionType: "anyschool"`. Clever sends no event for a new district, so the queue's list is the signal ([Events API](https://dev.clever.com/docs/events-api)).
6. **Connect.** Run `anyschool-connect` with `{"id": "<request id>"}`. Add `"districtId"` if step 3 left it out. It refuses when:
   - Clever has no token yet (`district_not_authorized`): the school has not finished.
   - The district is not AnySchool (`anyschool_connection_type_mismatch`). A Secure Sync district connects through its own administrator. A district that omits `connection_type` can be connected with `"confirmAnySchool": true`, after checking in the dashboard that it is the one from step 2.
   - The requester no longer administers the school (`anyschool_requester_authority_ended`).
   - The request's agreement is missing or out of date (`anyschool_agreement_required`). The school asks again.

   On success it prints `districtOrgId` and `adoptUrl`. Within a minute the worker caches the roster for review. It creates no one.
7. **Tell the school.** Send the requester the `adoptUrl`. Their Integrations page also shows **Move classes in**. Each teacher who ran their own AMP pilot opens the same link. They authorize their pilot school, and the requester accepts it. In the review, match the Clever school, then each existing teacher, student and class to its Clever record. Names are never matched automatically.
8. **Import.** Run `anyschool-import` with `{"id": "<request id>"}`. It refuses with `anyschool_schools_unmatched` while a Clever school has no AMP school matched to it, so a pilot's learners are never created twice. If the school had nothing in AMP, pass `"allowNewSchools": true`. `anyschool_stage_pending` means the worker has not staged the roster yet; `anyschool_stage_failed:<code>` gives the worker's error.
9. **Check.** Run `school-queue`. The connection shows `state: "launched"`. Its schools count in `clever.launchedSchools`.

`connection-request-status` can still close a request (`{"id", "status": "closed", "reference"}`). For AnySchool, use the `anyschool-*` commands for every other step.

## The partner license

Clever counts schools. `school-queue` reports them by environment under `clever`:

- `launchedSchools`: schools in active, unpaused connections. These are imported or importing.
- `stagedSchools`: schools cached for adoption review. Nobody has been created yet.
- `connections`: each connection with its `state`, `connectionType`, `launchDate` and school count.
- `awaitingConnection`: districts that shared data with AMP but are not connected. AMP imports nothing from them.

AMP imports only connections that a district administrator or this procedure created. It reads only what the district shares. Before connecting, compare `launchedSchools.production` with the number of schools the Clever contract covers. Capacity is never a gate on starting a class.

## What the school does

The person at the setup email follows Clever's [school setup](https://support.clever.com/hc/s/articles/000001726):

1. Open the email and select **Verify email and begin setup**, then **Get started**. The link works only for that address. It cannot be forwarded to IT.
2. Choose a **Data source**. A school with no SIS uses **CSV Upload**. Clever supports Infinite Campus, Skyward, Blackbaud, OneRoster sources and SFTP.
3. For CSV, download the templates and upload `users.csv` and `sections.csv`.
4. Optionally set up sign-in (Google, Microsoft and others). Students can always use AMP's cards and class codes.
5. Select **Confirm**. Clever syncs at once, then nightly. It emails a sync report with any errors.

To update the roster, edit the same files and upload them again. A brand-new file replaces the existing data.

### Spreadsheet advice for AMP

| Column | Required by Clever | What AMP does with it |
| --- | --- | --- |
| `users.csv` `User_id` | Yes | The person's lasting identity, through Clever's ID. Keep it stable. AMP shows it as the school's identifier. |
| `User_type` | Yes | `student` becomes a learner. `teacher` teaches their sections. `staff` becomes a school administrator in AMP. |
| `First_name`, `Last_name` | Yes | The roster name. |
| `Email` | No | Optional. A student without one signs in with a card or class code. |
| `Grade` | No | Places the learner. `Ungraded`, `Other` or blank fall back to `DOB`. |
| `DOB` | No | Only the school-year birth cohort is kept. |
| `sections.csv` `Section_id`, `Teacher_id`, `User_id` | Yes | One class per section, with its teacher and students. |
| `Subject`, `Period`, `Section_name` | No | Kept with the class. Clever names a section that has no name. |

List the head of school as `staff` so they administer the school in AMP. Include every teacher and student of an existing AMP pilot class, so the adoption review can match them.

## How AMP reads AnySchool data

AnySchool data uses the same adapter and validation as Secure Sync. These differences are expected and tested:

| AnySchool data | AMP |
| --- | --- |
| No terms, no courses, no `term_id` on sections | Classes go into one stable school-year calendar per connection |
| No `student_number`, `teacher_number`, `state_id` | The identifier comes from `sis_id` (the CSV's `User_id`), then `staff_id` |
| No email | Allowed. Email never establishes identity |
| No NCES, MDR, low or high grade; `school_number` as typed | Not used |
| One teacher per section row | Co-teachers are optional |
| `staff` users, usually with no sub-roles | School administrators. `PortalOnly` staff get no authority |
| `connection_type: "anyschool"`, `sis_type: "sftp"` | Stored with the connection and shown in the queue |
| Removal on re-upload | Archived as with any district. Learning records stay |

## Acceptance tests

Automated, against a disposable PostgreSQL schema (`AMP_TEST_DATABASE_URL`):

- `npx tsx --test tests/clever-anyschool.integration.ts` covers the whole path. A school leader asks, and asking again before the invitation corrects the email. The operator invites, then connect is refused without a token and for a non-AnySchool district. Connect makes the district, its agreement, the requester's administrator role and a staged connection. The worker stages without creating anyone. Import is refused while the Clever school is unmatched. A teacher's solo pilot adopts with matched school, teacher, learner and class. Import keeps the pilot's learner and class IDs and creates three CSV-only learners. Grades, `DOB`, missing email, staff and an idle teacher are mapped. There is one year calendar, no courses, and the queue counts launched, staged and awaiting schools.
- `tests/schools-org.integration.ts` covers the request route. A viewer gets 404. A school inside a district gets 409. The agreement is required. The request is stored and mailed once.
- `src/web/features/school/org/__tests__/anyschool.test.tsx` covers the Integrations row: each status line, the request form and its body, the viewer view, and **Move classes in**.

Manual, with a Clever development app that has AnySchool enabled. These need a real invitation:

1. Ask from a test school's Integrations page with an inbox you control.
2. Send the invitation from the dashboard. Run `anyschool-invite`. Confirm the email arrives with your subject and body.
3. Complete the setup with Clever's sample CSVs, then with a CSV that includes a pilot class's teacher and students.
4. Confirm the district appears in `school-queue` under `awaitingConnection` with `connectionType: "anyschool"`. Record its `sis_type`, `launch_date` and `state`.
5. Run `anyschool-connect`. Move the pilot in. Run `anyschool-import`. Confirm the counts match the CSVs and the pilot learner keeps their history.
6. Sign in to AMP as a teacher and a student through the school's chosen sign-in, if it set one up.
7. Re-upload the CSV with one student removed and one added. Confirm the archive and the addition after the next sync.

## Questions for Clever's integrations walkthrough

1. When AMP's app is invited, is AnySchool enabled for production by default, or does it need a request? Is it enabled on our development app?
2. Does the person at the setup email appear in the API as a `district_admin` user? Can they sign in with Clever? If so, AMP's self-serve `/school/connect` also works for them.
3. Is the Clever district ID shown on the district overview page after **Create new district**? Does a district token exist before the school finishes setup?
4. Does `GET /v3.0/districts/{id}` return `connection_type`, or only v3.1?
5. For a CSV district, what are `sis_type`, `launch_date`, `state`, `login_methods` and `portal_url`? Is there a launch step, or is the district live after the first sync?
6. Do `User_id`, `Section_id` and `School_number` become `sis_id`, section `sis_id` and `school_number`? Does `Username` become `district_username`?
7. Which `roles.staff.roles` does a CSV `staff` user get?
8. Must `User_id` be unique across user types? How does a school list a co-teacher, or a person at two schools?
9. Does each re-upload need a new invitation link? Can a link be re-sent from the same district?
10. What invitation statuses does the dashboard show for AnySchool districts? Is there an API for invitations or their status?
11. When an AnySchool school stops, how is the district disconnected? Does AMP see `district_not_authorized`?
12. How do AnySchool schools count toward our partner license: from invitation, from setup, or from the first sync?
13. Can the dashboard email's subject and body be saved as a template for every invitation?
14. Is AnySchool available outside the United States and Canada?
