import { z } from "zod";

export const invoiceDocumentSchema = z.object({
  invoiceId: z.string().uuid(),
  totalMinor: z.number().int().positive(),
  merchantName: z.string(),
  pdfBase64: z.string(),
  filename: z.string(),
  destinationUrl: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    }),
  instructions: z.string(),
  expiresAt: z.string(),
});

export function invoiceBlobUrl(pdfBase64: string) {
  return URL.createObjectURL(
    new Blob(
      [
        Uint8Array.from(atob(pdfBase64), (character) =>
          character.charCodeAt(0),
        ),
      ],
      { type: "application/pdf" },
    ),
  );
}
