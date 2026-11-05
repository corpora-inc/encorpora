import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { TrialWelcome } from "../TrialWelcome";

afterEach(cleanup);
const session = { token: "trial-token", learnerId: "trial-learner" };
const workbooks = {
  total: 5,
  earned: 1,
  made: 0,
  available: 1,
  nextAt: 20,
  pdf: true,
  items: [],
};

test("a parent who came for the free workbook gets it as the main action", () => {
  render(
    <TrialWelcome
      onContinue={() => {}}
      session={session}
      workbooks={workbooks}
      workbookFirst
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Your free workbook" }),
  ).toBeTruthy();
  const download = screen.getByRole("button", {
    name: "Download free workbook",
  });
  expect(download.className).toMatch(/primary/);
  expect(document.activeElement).toBe(download);
  expect(
    screen.getByRole("button", { name: "Start practicing" }).className,
  ).toMatch(/secondary/);
});

test("otherwise practice leads and the workbook stays optional", () => {
  render(
    <TrialWelcome
      onContinue={() => {}}
      session={session}
      workbooks={workbooks}
    />,
  );
  expect(screen.getByRole("heading", { name: "Watch AMP adapt" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Download free workbook" }).className,
  ).toMatch(/secondary/);
  expect(
    screen.getByRole("button", { name: "Start practicing" }).className,
  ).toMatch(/primary/);
});

test("with no workbook to offer, the workbook path falls back to practice", () => {
  render(
    <TrialWelcome
      onContinue={() => {}}
      session={session}
      workbooks={{ ...workbooks, available: 0 }}
      workbookFirst
    />,
  );
  expect(screen.getByRole("heading", { name: "Watch AMP adapt" })).toBeTruthy();
});
