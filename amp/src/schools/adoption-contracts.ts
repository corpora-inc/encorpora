import { z } from "zod";

export const adoptionToken = z.string().regex(/^adopt_[A-Za-z0-9_-]{43}$/);
export const adoptionDestination = z.object({
  schoolId: z.uuid(),
  districtId: z.uuid(),
});
export const adoptionDecisions = z.object({
  staffMerges: z
    .array(z.object({ sourcePersonId: z.uuid(), targetPersonId: z.uuid() }))
    .max(1000)
    .default([]),
  cleverPeople: z
    .array(
      z.object({
        personId: z.uuid(),
        userId: z.string().regex(/^[a-f0-9]{24}$/),
      }),
    )
    .max(10000)
    .default([]),
  cleverSections: z
    .array(
      z.object({
        classId: z.uuid(),
        sectionId: z.string().regex(/^[a-f0-9]{24}$/),
      }),
    )
    .max(2000)
    .default([]),
  cleverSchool: z
    .object({
      connectionId: z.uuid(),
      schoolId: z.string().regex(/^[a-f0-9]{24}$/),
    })
    .optional(),
});
export const adoptionRequest = adoptionDestination.extend({
  confirmed: z.literal(true),
});
export const adoptionReviewRequest = z.object({ token: adoptionToken });
export const adoptionAcceptRequest = adoptionDecisions.extend({
  token: adoptionToken,
  confirmed: z.literal(true),
});
const place = z.object({ id: z.uuid(), name: z.string() });
export const adoptionOptions = z.object({
  schools: z.array(place.extend({ classes: z.number().int() })),
  districts: z.array(place),
  district: place.nullable(),
  grants: z.array(
    z.object({
      id: z.uuid(),
      schoolName: z.string(),
      districtName: z.string(),
      expiresAt: z.string(),
      status: z.enum(["open", "expired", "used", "revoked"]),
    }),
  ),
});
export const adoptionDistrictView = z.object({ district: place });
export const adoptionIssued = z.object({
  id: z.uuid(),
  token: adoptionToken,
  expiresAt: z.string(),
});
const personContext = {
  grade: z.string().nullable().optional(),
  classNames: z.array(z.string()).optional(),
  teacherNames: z.array(z.string()).optional(),
};
const classContext = {
  grade: z.string().nullable().optional(),
  teacherNames: z.array(z.string()).optional(),
  courseName: z.string().nullable().optional(),
};
export const adoptionReview = z.object({
  schoolId: z.uuid(),
  districtId: z.uuid(),
  schoolName: z.string(),
  districtName: z.string(),
  expiresAt: z.string(),
  people: z.number().int(),
  learners: z.number().int(),
  classes: z.number().int(),
  conflicts: z.array(
    z.object({
      code: z.string(),
      sourcePersonId: z.uuid().optional(),
      targetPersonId: z.uuid().optional(),
    }),
  ),
  staffMatches: z.array(
    z.object({
      sourcePersonId: z.uuid(),
      targetPersonId: z.uuid(),
      sourceName: z.string(),
      targetName: z.string(),
      allowed: z.boolean(),
    }),
  ),
  sourcePeople: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      student: z.boolean(),
      ...personContext,
    }),
  ),
  sourceClasses: z.array(
    z.object({ id: z.uuid(), name: z.string(), ...classContext }),
  ),
  cleverConnections: z.array(
    z.object({
      id: z.uuid(),
      environment: z.enum(["sandbox", "production"]),
      districtName: z.string(),
    }),
  ),
});
export const adoptionAccepted = z.object({
  schoolId: z.uuid(),
  districtId: z.uuid(),
  people: z.number().int(),
  learners: z.number().int(),
  classes: z.number().int(),
});
export type AdoptionReview = z.infer<typeof adoptionReview>;
export type AdoptionOptions = z.infer<typeof adoptionOptions>;

export const adoptionCleverRequest = z.object({
  token: adoptionToken,
  connectionId: z.uuid(),
  schoolId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .optional(),
});
export const adoptionCleverPreview = z.object({
  schools: z.array(z.object({ id: z.string(), name: z.string() })),
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      student: z.boolean(),
      ...personContext,
    }),
  ),
  sections: z.array(
    z.object({ id: z.string(), name: z.string(), ...classContext }),
  ),
});
