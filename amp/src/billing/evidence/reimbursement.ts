import { z } from "zod";

export const receiptFields = {
  sellerName: "Vendor legal name",
  sellerAddress: "Vendor address",
  sellerContact: "Vendor contact information",
  receiptNumber: "Receipt or transaction number",
  purchaseDate: "Purchase date",
  product: "Itemized product and quantity",
  licenseTerm: "License start and end dates",
  amountPaid: "Amount paid",
  paymentMethod: "Payment method",
  learnerName: "Learner name entered by the parent",
} as const;
const fields = Object.keys(receiptFields) as [
  keyof typeof receiptFields,
  ...(keyof typeof receiptFields)[],
];
export const reimbursementProgramsSchema = z
  .array(
    z
      .object({
        id: z.string().regex(/^[a-z0-9-]{1,80}$/),
        state: z.string().regex(/^[A-Z]{2}$/),
        programName: z.string().trim().min(1).max(180),
        officialUrl: z
          .string()
          .url()
          .max(500)
          .refine((value) => {
            try {
              const url = new URL(value);
              return (
                url.protocol === "https:" && !url.username && !url.password
              );
            } catch {
              return false;
            }
          }),
        requiredFields: z.array(z.enum(fields)).min(1).max(fields.length),
      })
      .strict(),
  )
  .max(100)
  .refine(
    (programs) => new Set(programs.map((p) => p.id)).size === programs.length,
  );
export type ReimbursementProgram = z.infer<
  typeof reimbursementProgramsSchema
>[number];
// WinAnsi (Helvetica) printable repertoire, checked against the font in tests. Reject unsupported names before
// generating a document rather than silently changing a child's name.
export const receiptRequestSchema = z
  .object({
    learnerName: z
      .string()
      .transform((value) => value.normalize("NFC").trim())
      .pipe(
        z
          .string()
          .max(120)
          .regex(/^[\x20-\x7e\xa0-\xff€‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸŽž]*$/u),
      )
      .optional(),
    programId: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .optional(),
  })
  .strict();
