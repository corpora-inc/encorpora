# Family and teaching projections

Family reads identify a household independently of its teaching class. A child's
`amp_learners.account_id` determines their family membership. A second parent
reads the children owned by the holder of that particular relationship. Class
enrollment never adds a child to a Family projection.

The response schemas and client types are in
[`projection-contracts.ts`](../../src/family/projection-contracts.ts). Existing
learning, consent, billing and school mutation endpoints retain their authority.
All endpoints below require an adult account and return `Cache-Control: no-store`.
Student bearer tokens take precedence over any parent cookie and are rejected.

## Family places

`GET /api/v1/families?after=<family UUID>` has no body. Omit `after` for the first
page. It returns at most 50 places, ordered by UUID, and a nullable cursor:

```ts
{
  families: Array<{
    familyId: string;                 // UUID
    displayName: string;
    role: "holder" | "second-parent" | "co-teacher";
    teachingPlace: TeachingPlace | null;
    capabilities: { readFamily: boolean; readTeaching: boolean };
  }>;
  next: string | null;                // pass as after; null ends pagination
}
type TeachingPlace = {
  classId: string;
  displayName: string;
  scope: "whole-class";
  path: string;                      // API path to the teaching projection
};
```

A holder or second parent belongs in the Family group of a place switcher.
A co-teacher belongs in Teaching. `teachingPlace` additionally identifies the
holder's or second parent's mixed tutoring class. Its presence, rather than
`readTeaching` alone, determines whether to show that separate place.

An existing family's ID equals its org ID. A parent whose children are all
hosted elsewhere receives a persisted `amp_family_spaces.id` on the first places
read. This creates no class, staff role or enrollment. If a local class is later
needed, it uses the same ID. An adult without children or a family class receives
no new Family place merely because they teach elsewhere.

## Family projection

`GET /api/v1/families/:family` has no body and accepts a family UUID. Co-teachers
receive `403 family_parent_only`; unrelated accounts receive `404 family_not_found`.

```ts
{
  familyId: string;
  displayName: string;
  role: "holder" | "second-parent";
  teachingPlace: TeachingPlace | null;
  capabilities: {
    readFamily: boolean;
    addChildren: boolean;
    manageConsent: boolean;
    manageBilling: boolean;
    inviteSecondParent: boolean;
    manageSecondParent: boolean;
    readTeaching: boolean;
  };
  children: Array<{
    id: string;                      // learner ID, never a roster person ID
    name: string;
    birthYear: number | null;
    gradeLevel: number | null;        // K = 0; birth year, roster grade or course
    access: {
      grants: Array<{
        channel: string; status: string; startsAt: string; endsAt: string;
      }>;
      hasAccess: boolean;
      canPractice: boolean;
      learningAllowed: boolean;
      freeAllowance: {
        problems: { total: 100; used: number; remaining: number };
        workbooks: {
          total: number; earned: number; made: number;
          available: number; nextAt: number | null;
        };
      };
    };
    week: { minutes: number; problems: number; lastPracticed: string | null };
    nextUp: {
      kind: "adaptive-practice" | "access" | "consent";
      learnerId: string;
      task: TodayTodo | null;
    };
    capabilities: {
      readProgress: boolean; readWorkbooks: boolean;
      createWorkbook: boolean; recordWorkbook: boolean;
      practiceHere: boolean; continuePurchase: boolean; purchase: boolean;
      rename: boolean; changeBirthYear: boolean; changePracticeSettings: boolean;
      manageConsent: boolean; delete: boolean;
      readGrades: boolean; editGrades: boolean; manageDevices: boolean;
    };
    classes: Array<{
      id: string; name: string; orgId: string; personId: string;
      hostedByFamily: boolean; canOpen: boolean;
    }>;
    paths: {
      progress: string;
      workbooks: string | null;
      practiceHere: string | null;
      continue: string | null;
    };
  }>;
  today: { date: string; tasks: TodayTodo[]; week: WeekFacts };
}
type WeekFacts = {
  from: string; minutes: number; problems: number; skills: number;
  objectives: number; working: number; students: number;
};
```

Dates in week facts are `YYYY-MM-DD`; grant dates are ISO timestamps. The week
starts Monday. `lastPracticed` is the latest activity date, including activity
before the current week. `students` is the shared read model's count field; it
counts only the projection's children. Family tasks use **learner IDs** in
`students[].id`, `action.personId` and `misses[].personId`. Teaching tasks use
roster person IDs. The shared renderer must interpret IDs in its supplied scope.

`TodayTodo` is exactly `todayTodoResource` from
[`teacher-contracts.ts`](../../src/schools/teacher-contracts.ts):

```ts
type TodayTodo = {
  id: string;
  kind: "shared-gap" | "stuck" | "no-practice" | "ready" | "good-day" | "start";
  title: string; detail: string;
  students: Array<{ id: string; name: string }>;
  action:
    | { kind: "lesson"; templateId: string; skillId: string; label: string }
    | { kind: "skill"; skillId: string; label: string }
    | { kind: "student"; personId: string; label: string }
    | { kind: "tab"; tab: "map" | "time" | "start" | "settings"; label: string };
  groupSheet?: { skillId: string; label: string };
  rule?: string;
  misses?: Array<{ personId: string; attempt: string; skillId: string }>;
};
```

Week facts and tasks are computed from the ownership-selected child set through
the same evidence and Today functions used by classes. They are not filtered
class totals. `nextUp.task` is the first relevant task; adaptive practice chooses
the actual next problem when practice starts, without issuing a problem on read.

`paths.progress` and `paths.workbooks` are GET API paths. `paths.practiceHere` is
a POST API path accepting `{}`. `paths.continue` is a browser destination.
A parent may practice with and continue access for their own child hosted
elsewhere; the host never receives that child's own-parent purchase action.
`canOpen: false` forbids presenting a link to the host class. Individual evidence
and workbook paths do not grant host-class access.

Capabilities describe the viewer's permitted action on this resource. Mutations
recheck permission and their submitted parameters. `purchase` additionally
requires confirmed email and purchase consent; `continuePurchase` permits the
holder to enter the existing setup/consent/purchase journey. Parent-entry naming
permits the holder to correct a child's name after consent withdrawal, without
resuming learning. A second parent cannot buy, rename, delete, change the birth
year or manage consent. The existing individual workbook API also excludes
second parents; this projection does not broaden it. Their class teaching tools
remain available under the Teaching scope. `readGrades`, `editGrades` and
`manageDevices` apply only through a child enrolled in this family's own class.
A second-parent invitation requires a local class, an empty second-parent slot
and no currently hosted children.

## Individual progress

`GET /api/v1/families/:family/children/:learner/progress` has no body. It requires
the holder or this family's active second parent and verifies learner ownership.
It returns `{ id: string, name: string, ...ProgressRecord }`, where
`ProgressRecord` is exactly `progressRecordResource` in
[`teacher-contracts.ts`](../../src/schools/teacher-contracts.ts): levels and strand
estimates, a nullable reference, twelve weeks, gained objectives and recent work.
It contains no host-class grades, credentials, roster or account data.

```ts
type ProgressRecord = {
  level: { overall: Estimate; strands: Record<string, Estimate> } | null;
  reference: { from: number; to: number } | null;
  strands: Array<{ id: string; label: string }>;
  weeks: Array<{ week: string; minutes: number }>;
  objectives: Array<{ skillId: string; title: string; strand: string; day: string }>;
  work: Array<{
    id: string; day: string; at: string; prompt: string;
    answer: string | null; response: string | null;
    result: "independent" | "hint" | "missed" | "paper";
    review: boolean; skill: string; strand: string;
  }>;
};
type Estimate = { level: number; sd: number };
```

## Teaching projection

`GET /api/v1/families/:family/teaching` has no body. It requires the existing
`students.read` permission for the mapped family class. A family without a class
returns `404 teaching_place_not_found`.

```ts
{
  familyId: string;
  place: "teaching";
  scope: "whole-class";
  class: ClassSummary;
  students: TodayStudent[];
  today: { date: string; tasks: TodayTodo[]; week: WeekFacts };
  approvals: Array<{
    id: string; personId: string | null;
    status: "waiting" | "opened" | "expired" | "approved" | "withdrawn" | "paused" | "ended";
    expiresAt: string; approvedAt: string | null; endedAt: string | null;
  }>;
  coTeachers: Array<{
    id: string; name: string | null; role: "teacher" | "aide";
    status: "active" | "invited"; secondParent: boolean;
  }>;
  capabilities: {
    readClass: boolean; readStaff: boolean; readApprovals: boolean;
    manageApprovals: boolean; manageStaff: boolean; manageDevices: boolean;
    editGrades: boolean; createWorkbooks: boolean;
  };
}
```

`ClassSummary` and `TodayStudent` are exactly `classSummary` and
`todayStudentResource` in the shared teacher contracts.

```ts
type ClassSummary = {
  id: string; orgId: string; name: string; orgName: string;
  course: { label: string; level: number; from: number; to: number } | null;
};
type TodayStudent = {
  id: string; learnerId?: string; name: string; gradeLevel: number | null;
  level: Estimate | null; provisional: boolean;
  todayMinutes: number; todayProblems: number;
  weekMinutes: number; weekProblems: number; lastActive: string | null;
};
```

Here `students` includes the entire current roster, including owned, unapproved and parent-approved
children. Its facts and tasks have the same whole-class scope. No hosted child
is given an own-parent Continue action. Approval history includes ended records.
`paused` means consent is not currently effective without a recorded withdrawal.
A rostered child without an invitation has no approval record. Approval results
are bounded to 1,000 records.

Approval records require the holder's existing approval authority. Staff details
require existing `staff.read` authority. Unauthorized sections are empty arrays,
with the corresponding capability false. The API does not reveal parent email
addresses, invitation tokens or account IDs. Existing holder approval and staff
endpoints provide authorized management links. An existing second parent can
still have teaching access to the entire mixed class; presenting a separate
Family scope does not revoke that legacy authority.

## Adult profile

`PATCH /api/v1/me/profile` accepts exactly:

```json
{"givenName":"Ada","familyName":"Okafor"}
```

Each field is a trimmed string of 1–100 characters without control characters,
or `null`. Both fields are required; unknown fields are rejected. Its response is:

```json
{"givenName":"Ada","familyName":"Okafor","displayName":"Ada Okafor"}
```

`GET /api/v1/me` includes these three nullable fields in `account`. A legacy auth
full name can supply `displayName`, but does not supply separately confirmed
given/family fields. An explicitly cleared profile has three null fields.
Updates synchronize the auth display name, linked adult roster identities and
the real adult learner, without renaming simulation profiles. The account export
includes the profile and family identity; account deletion removes both.

Other adult-name payloads expose:

- Approval lookup/detail: `teacherNames: (string | null)[]`. The legacy `teachers`
  string array contains only known names.
- Staff lists: `adultName: string | null`; legacy `name` is an empty string for an
  unknown name. No email local part is invented as a person's name.
- Invitation lookup: `inviterName: string | null`, resolved from its recorded sender.
- Second-parent reads: nullable `name`, and full known holder names in invitations.
- Report cards: `teacherNames: (string | null)[]` and the known-name `teachers` array.
- Today: nullable `teacherName`. Buyer pages and conflicts use nullable teacher names.

The nullable fields are the display source for interfaces that ask an adult to
supply a missing name. School roster storage retains its required role label
when no given name is supplied; the public name resolver never presents that
label as the person's name.

## First course placement

A child without a birth year or explicit starting choice uses the lowest known
course band of their earliest current class (enrollment date, then class ID).
Grade 4 supplies initial level 4. Unknown bands and absent classes retain the
existing fallback. The first course-derived estimate is stored in
`starting_course_level`; later class changes do not reset it. Birth year and
explicit starting choice take precedence. The migration preserves the previous
implicit level 2 for children with existing attempts, so their evidence is not
replayed from a new prior. No birthday, mastery or answer evidence is fabricated.
