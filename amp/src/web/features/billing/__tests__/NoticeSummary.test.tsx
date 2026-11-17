/**
 * The direct notice before payment (16 CFR 312.4(c)): a short summary with
 * the online notice's link, and every item of the policy's notice on the
 * same screen under "Privacy details". Rearranging it must never drop one.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { NoticeSummary } from "../NoticeSummary";
import { consentFixture } from "../../../../../tests/parent-consent.fixture";

afterEach(cleanup);

const notice = consentFixture.notice;

test("the summary is short, names the operator and links the policy", () => {
  render(<NoticeSummary notice={notice} />);
  const summary = screen
    .getByRole("heading", { name: "Learning and privacy" })
    .parentElement!.querySelector(":scope > p")!;
  expect(summary.textContent).toContain(notice.operator.name);
  expect(summary.textContent).toContain("Privacy settings");
  expect(summary.textContent!.length).toBeLessThan(220);
  expect(
    summary.querySelector(`a[href="${notice.privacyUrl}"]`)?.textContent,
  ).toBe("Privacy policy");
});

test("every item of the notice is under Privacy details, before the action", () => {
  const { container } = render(<NoticeSummary notice={notice} />);
  const details = container.querySelector("details")!;
  expect(details.querySelector("summary")?.textContent).toBe(
    "Privacy details",
  );
  const text = details.textContent!;
  for (const entry of notice.childData)
    for (const part of [entry.category, entry.purpose, entry.retention])
      expect(text).toContain(part);
  for (const entry of notice.processors)
    for (const part of [
      entry.name,
      entry.service,
      entry.data,
      entry.purpose,
      entry.retention,
    ])
      expect(text).toContain(part);
  for (const part of [
    notice.reviewAndDeletion,
    notice.evidenceRetentionPurpose,
    `${notice.withdrawnEvidenceDays} days after`,
    "withdraw consent at any time",
    "verifies parent permission",
    notice.operator.name,
    notice.operator.address,
    notice.operator.telephone,
    notice.operator.email,
    `Notice version ${notice.version}`,
  ])
    expect(text).toContain(part);
  expect(details.querySelector(`a[href="${notice.privacyUrl}"]`)).not.toBe(
    null,
  );
});
