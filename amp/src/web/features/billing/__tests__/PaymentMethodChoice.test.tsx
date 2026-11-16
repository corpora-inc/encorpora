import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PaymentMethodChoice, paymentMethodHref } from "../PaymentMethodChoice";

afterEach(cleanup);
test("payment methods use one keyboard-accessible choice", () => {
  const change = vi.fn();
  render(<PaymentMethodChoice value="card" onChange={change} />);
  expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
  const card = screen.getByRole("radio", { name: "Card" });
  expect(card.getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(card, { key: "ArrowRight" });
  expect(change).toHaveBeenCalledWith("education-funds");
  expect(document.activeElement).toBe(
    screen.getByRole("radio", { name: "Education funds (ESA)" }),
  );
});
test.each(["month", "year"] as const)(
  "method links preserve the %s term and exact learner",
  (interval) => {
    const funded = new URL(
      paymentMethodHref("education-funds", interval, "second-child"),
      "https://amp.invalid",
    );
    expect(funded.pathname).toBe("/purchase/funded");
    expect(funded.searchParams.get("learner")).toBe("second-child");
    expect(funded.searchParams.get("interval")).toBe(interval);
    expect(paymentMethodHref("card", interval, "second-child")).toBe(
      `/continue/second-child?interval=${interval}`,
    );
    expect(paymentMethodHref("card", interval)).toBe(
      `/purchase/annual?interval=${interval}`,
    );
  },
);
