# Google Classroom import: OAuth verification submission

AMP lets a school's staff import one Google Classroom course as a class roster. The feature is code-complete behind `AMP_GOOGLE_CLASSROOM_IMPORT=true` and stays **off in production until Google approves** the scopes. This file is what the submission is written from. Nothing here is a secret; the client ID and secret live in each environment's secret.

## Links for the consent screen

- Application home page: https://amp.corpora.inc/schools
- Privacy policy: https://corpora.inc/legal/privacy/
- Terms of service: https://corpora.inc/legal/terms/
- Authorized domain: `corpora.inc`
- Redirect URI used by this feature (add to the existing web client before deploy): `https://amp.corpora.inc/api/v1/school/google-classroom/callback`. Stage and local development have their own, declared in `infra/auth-providers.ts`.

## Scopes (all read-only, all sensitive)

Requested only when a signed-in school admin chooses **Import from Google Classroom**, as incremental consent. Sign-in itself still asks for `openid email profile` and nothing else.

| Scope                                                        | Why AMP needs it                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://www.googleapis.com/auth/classroom.courses.readonly` | To show the teacher a list of their own active courses (`courses.list` with `teacherId=me`, `courseStates=ACTIVE`) so they can choose which course becomes the AMP class. Without it AMP cannot know which courses exist. It is read-only and used only to build that list and the class's name.                       |
| `https://www.googleapis.com/auth/classroom.rosters.readonly` | To read the students enrolled in the one course the teacher chose (`courses.students.list`): the student's name and Google user ID. AMP needs the roster to create the class's students in AMP. Read-only; AMP never writes to Classroom, and reads only the chosen course's students.                                 |
| `https://www.googleapis.com/auth/classroom.profile.emails`   | To read each student's email address from the same roster response. The address is stored as that student's Google sign-in, so the student can later sign in to their AMP class with their school Google account, and it lets a re-import recognize the same student. Read-only; used only for the roster and sign-in. |

AMP does not request coursework, grades, announcements, guardians or Drive scopes, and does not use any scope to modify a course.

## What AMP stores, and for how long

- **Access token:** kept on AMP's server only, never sent to the browser. It is encrypted at rest (AES-256-GCM, key derived from a server secret), bound to the staff account and school, and valid for at most 15 minutes. It is **deleted as soon as the chosen course's students have been read**, and expired rows are purged on the next use. AMP requests online access: no refresh token is requested or kept.
- **Roster data** (each student's name, email and Google user ID, plus the course ID and name) is shown to the teacher as a dry run first. Nothing is written until they choose Apply. When applied, it becomes ordinary AMP school records: a student's name and email, an outside ID (`google-classroom:<courseId>` and the Google user ID) linking the student to the course for re-imports, and, when the school has Google sign-in turned on, a sign-in credential derived from the email address (stored as a one-way hash).
- **Retention:** these are AMP school records and follow AMP for Schools' existing retention and deletion rules: the school can remove a student or delete its data at any time, which deletes the student's record and outside IDs, and student data is deleted 24 months after the later of last activity and license end. Importing never removes anyone, never changes a student's AMP progress, and is never used for advertising or sold.
- AMP does not transfer Classroom data to third parties other than its infrastructure providers, and does not use it to train models.

## Recording the demo video

Record one continuous screen capture (about 3 minutes) on the stage environment with a throwaway Google Workspace for Education account that teaches a course with three synthetic students (for example Ana, Noor and Lena Fixture). Show the browser address bar throughout.

1. Open https://amp-stage.corpora.inc, sign in as a school admin, and open a class's **Roster** screen. Point out the OAuth client's project name (it must match the consent screen).
2. Click **Import from Google Classroom**. Pause on Google's consent screen so every scope description is legible, and show the URL contains `client_id` and all three `scope` values. Click **Allow**.
3. Back in AMP, click **Choose a course**. This shows `classroom.courses.readonly` in use: the course list appears. Pick the course.
4. Click **Preview changes**. This shows `classroom.rosters.readonly` (the students) and `classroom.profile.emails` (their names and addresses, which the dry run reads) in use. Show that nothing has been saved yet.
5. Click **Apply changes** and open the class's roster to show the students now exist. Show that the school's Google sign-in setting lets these students sign in with the same address.
6. Show that running the import again reports "Your roster already matches", and that Classroom itself is unchanged.
7. Say aloud that the access is read-only, kept for minutes, and deleted after the students are read.

Before recording on stage: set `AMP_GOOGLE_CLASSROOM_IMPORT=true` there, add the stage redirect URI to the stage client, and add the three scopes to the consent screen's data access list (the unverified stage client can be used by test users while in testing).

## Submission checklist

- [ ] Redirect URI added to the prod and stage web clients (Google console).
- [ ] Three scopes added under Data Access on the consent screen, with the justifications above.
- [ ] Demo video uploaded to YouTube (unlisted) and linked in the submission.
- [ ] Home page, privacy policy and terms links entered; domain verified.
- [ ] After approval: set `AMP_GOOGLE_CLASSROOM_IMPORT=true` in production.
