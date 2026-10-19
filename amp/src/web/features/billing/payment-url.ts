/** Only Stripe's hosted pages may receive the parent. Anything else is refused. */
export function paymentUrl(
  value: string,
  host: "checkout.stripe.com" | "billing.stripe.com",
): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.username ||
    url.password
  )
    throw new Error(
      "The payment destination could not be verified. Try again.",
    );
  return url.href;
}
/** Amount saved per year by paying annually, in minor units (0 if none). */
export function annualSaving(
  offers: {
    interval: "year" | "month";
    amountMinor: number;
    currency: string;
  }[],
): number {
  const annual = offers.find((offer) => offer.interval === "year");
  const monthly = offers.find((offer) => offer.interval === "month");
  return annual && monthly && annual.currency === monthly.currency
    ? Math.max(0, monthly.amountMinor * 12 - annual.amountMinor)
    : 0;
}
export const formatUsd = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
