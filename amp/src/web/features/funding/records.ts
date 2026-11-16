import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";

export const fundingOfferSummarySchema = z.object({
  programId: z.string().optional(),
  programName: z.string(),
  productTitle: z.string(),
  totalMinor: z.number(),
  instructions: z.string(),
  destinationUrl: z.string().url(),
  documentPolicy: z.string(),
});
export const fundingRecordSchema = z.object({
  id: z.string(),
  learnerId: z.string().optional(),
  studentBillingName: z.string().optional(),
  status: z.enum(["prepared", "parent-reported-submitted", "cancelled"]),
  orderId: z.string().nullable(),
  paymentStatus: z.string().optional(),
  expired: z.boolean(),
  offer: fundingOfferSummarySchema,
  fundedPending: z
    .object({ status: z.string(), endsAt: z.string() })
    .nullable()
    .optional(),
});
export const fundingRecordsKey = (id: string) => [
  "account",
  id,
  "funding-records",
];
export const fundingRecordsOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: fundingRecordsKey(session.accountId),
    queryFn: ({ signal }) =>
      request(
        "/funding/requests",
        z.object({ requests: z.array(fundingRecordSchema) }),
        {
          token: session.token,
          signal,
        },
      ),
    refetchInterval: 30000,
  });
