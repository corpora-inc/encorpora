import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { request } from "../../lib/api";
import { annualOfferSchema } from "../../../billing/stripe/enrollment-contracts";

/** The public plans and prices. Its own module, with nothing that signs in,
 * so the pitch's light entry (`home-entry.tsx`) loads it without the app. */
export const pricesOptions = queryOptions({
  queryKey: ["billing", "prices"],
  queryFn: ({ signal }) =>
    request(
      "/billing/prices",
      z.object({
        available: z.boolean(),
        offers: z.array(annualOfferSchema),
        extraOffers: z.array(annualOfferSchema).optional(),
      }),
      { signal },
    ),
  staleTime: 5 * 60_000,
});
