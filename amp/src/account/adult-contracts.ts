import { z } from "zod";
import { adultStarts } from "../learning/starting-point.js";
import {
  progressRecordResource,
  studentTimeResponse,
} from "../schools/teacher-contracts.js";

/** An adult's own record: what a teacher's student record shows, pointed at
 * themselves, with their days and skills. */
export const ownPracticeResponse = z.object({
  learner: z.object({
    id: z.string(),
    name: z.string(),
    first: z.string(),
    start: z.enum(adultStarts).nullable(),
    active: z.boolean(),
    endsAt: z.string().nullable(),
  }),
  record: progressRecordResource,
  time: studentTimeResponse.omit({ student: true }),
});
export type OwnPractice = z.infer<typeof ownPracticeResponse>;
