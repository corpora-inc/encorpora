/**
 * Synthetic Family-space answers for isolated browser fixtures: a parent's
 * one family (`GET /api/v1/families`) and its projection
 * (`GET /api/v1/families/<id>`), which the family's Today and each child's
 * page read. A signed-in parent with children lands on that Today.
 */
export const FIXTURE_FAMILY_ID = "00000000-0000-4000-8000-00000000fa01";

export type FixtureChild = {
  id: string;
  name: string;
  birthYear: number | null;
  canPractice?: boolean;
};

export function fixtureFamilies(familyId = FIXTURE_FAMILY_ID) {
  return {
    families: [
      {
        familyId,
        displayName: null,
        classId: null,
        orgId: null,
        role: "holder",
        teachingPlace: null,
        capabilities: { readFamily: true, readTeaching: false },
      },
    ],
    next: null,
  };
}

export function fixtureFamilyProjection(
  children: readonly FixtureChild[],
  familyId = FIXTURE_FAMILY_ID,
) {
  const capabilities = {
    readProgress: true,
    readWorkbooks: false,
    createWorkbook: false,
    recordWorkbook: false,
    practiceHere: false,
    continuePurchase: false,
    purchase: false,
    rename: false,
    changeBirthYear: false,
    changePracticeSettings: false,
    manageConsent: false,
    delete: false,
    readGrades: false,
    editGrades: false,
    manageDevices: false,
  };
  return {
    familyId,
    displayName: null,
    holderName: null,
    role: "holder",
    teachingPlace: null,
    capabilities: {
      readFamily: true,
      addChildren: true,
      manageConsent: true,
      manageBilling: true,
      inviteSecondParent: true,
      manageSecondParent: true,
      readTeaching: false,
    },
    children: children.map((child) => ({
      id: child.id,
      name: child.name,
      birthYear: child.birthYear,
      gradeLevel: null,
      access: {
        grants: [],
        hasAccess: false,
        canPractice: child.canPractice ?? true,
        learningAllowed: true,
        freeAllowance: {
          problems: { total: 100, used: 0, remaining: 100 },
          workbooks: {
            total: 0,
            earned: 0,
            made: 0,
            available: 0,
            nextAt: null,
          },
        },
      },
      week: { minutes: 0, problems: 0, lastPracticed: null },
      nextUp: { kind: "adaptive-practice", learnerId: child.id, task: null },
      capabilities,
      classes: [],
      paths: {
        progress: `/api/v1/learners/${child.id}/progress`,
        workbooks: null,
        practiceHere: null,
        continue: null,
      },
    })),
    today: {
      date: "2026-11-14",
      tasks: [],
      week: {
        from: "2026-11-09",
        minutes: 0,
        problems: 0,
        skills: 0,
        objectives: 0,
        working: 0,
        students: children.length,
      },
    },
  };
}

/** A child's record with nothing practiced yet
 * (`GET /api/v1/families/<id>/children/<learner>/progress`). */
export function fixtureChildProgress(id: string, name: string) {
  return {
    id,
    name,
    level: null,
    reference: null,
    strands: [],
    weeks: [],
    objectives: [],
    work: [],
  };
}
