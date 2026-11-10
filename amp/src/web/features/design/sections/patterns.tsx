import { useState } from "react";
import type { AnnualOffer } from "../../../../billing/stripe/purchase-contracts";
import type { OverviewResponse } from "../../../../schools/org-contracts";
import { ProviderButtons } from "../../auth/ProviderButtons";
import { socialCopyFor } from "../../auth/social-copy";
import { PlanChoice } from "../../billing/PlanChoice";
import { Progress } from "../../onboarding/Progress";
import { GradePicker as ProfileGradePicker } from "../../profiles/GradePicker";
import { LoadFailed } from "../../school/classes/teacher-shared";
import { TrendChart, StandingChart } from "../../school/org/charts";
import {
  CopyButton,
  FormNote,
  GradePicker as SchoolGradePicker,
  PageHead,
} from "../../school/parts";
import { CodeTiles } from "../../school/join/CodeTiles";
import { JoinClass } from "../../school/join/JoinClass";
import { YearRibbon } from "../../school/YearRibbon";
import { ContactAddress } from "../../support/ContactAddress";
import { Button } from "../../../ui/Button";
import { Section, Specimen } from "../Gallery";

const offer = (
  interval: "year" | "month",
  amountMinor: number,
  tier: "full" | "extra" = "full",
): AnnualOffer => ({
  id: `design-${interval}-${tier}`,
  mode: "test",
  currency: "USD",
  amountMinor,
  formattedAmount: `$${amountMinor / 100}`,
  interval,
  learnerCount: 1,
  tier,
});
const offers = [offer("year", 59900), offer("month", 5900)];
const extra = [offer("year", 39900, "extra"), offer("month", 3900, "extra")];

const week = (offset: number) =>
  new Date(Date.UTC(2026, 10, 9) - offset * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
const trend: OverviewResponse["trend"] = Array.from(
  { length: 12 },
  (_, index) => ({
    week: week(11 - index),
    minutes: [0, 120, 340, 410, 380, 520, 610, 480, 700, 760, 690, 820][index]!,
    students: [0, 4, 9, 11, 10, 14, 15, 13, 17, 18, 17, 19][index]!,
  }),
);
/** Half-grade columns from three behind to three ahead, as the server
 * counts them (schools/org-reads.ts). */
const edges = Array.from({ length: 13 }, (_, index) => -3 + index / 2);
const counts = [1, 0, 2, 3, 4, 6, 12, 15, 7, 4, 2, 1, 0, 1];
const standing: OverviewResponse["standing"] = {
  bins: counts.map((students, index) => ({
    from: index === 0 ? null : edges[index - 1]!,
    to: index === edges.length ? null : edges[index]!,
    students,
  })),
  behind: 16,
  at: 27,
  ahead: 15,
  unplaced: 4,
};

function Grades({ school }: { school?: boolean }) {
  const [grade, setGrade] = useState<number | null>(4);
  return school ? (
    <SchoolGradePicker value={grade} onChange={setGrade} />
  ) : (
    <ProfileGradePicker value={grade} onChange={setGrade} />
  );
}

export function PatternSections() {
  return (
    <>
      <Section
        id="page-parts"
        title="Page heads, notes and small actions"
        source={[
          "features/school/parts.tsx",
          "features/school/classes/teacher-shared.tsx",
          "features/support/ContactAddress.tsx",
        ]}
        note="School-side parts that other screens borrow; see the duplicates in docs/components.md."
      >
        <Specimen label="Page head with its action" wide>
          <div data-dense>
            <PageHead
              title="Students"
              detail="48 students in 3 classes"
              action={<Button variant="primary">Add students</Button>}
            />
          </div>
        </Specimen>
        <Specimen label="Form note: an error, then a status">
          <div data-dense>
            <FormNote error="That code has expired. Ask the teacher for a new one." />
            <FormNote status="Invitation sent." />
          </div>
        </Specimen>
        <Specimen label="Copy button">
          <CopyButton
            text="https://amp.corpora.inc/join/K7M24Q"
            label="Copy link"
            copied="Link copied"
          />
        </Specimen>
        <Specimen label="Join this class, compact: the code, then one group of equal controls">
          <JoinClass
            compact
            code="K7M24Q"
            place={{ org: "gallery", class: "gallery" }}
            family
            manage
          />
        </Specimen>
        <Specimen label="Join this class, compact, while sign-in is paused">
          <JoinClass
            compact
            code="K7M24Q"
            place={{ org: "gallery", class: "gallery" }}
            family={false}
            boardLink={false}
            manage
            locked
          />
        </Specimen>
        <Specimen label="Load failed, with retry">
          <div data-dense>
            <LoadFailed what="The class map" onRetry={() => {}} />
          </div>
        </Specimen>
        <Specimen label="Support address with Copy">
          <ContactAddress />
        </Specimen>
      </Section>
      <Section
        id="grade-pickers"
        title="Grade pickers (two of them)"
        source={[
          "features/profiles/GradePicker.tsx",
          "features/school/parts.tsx",
        ]}
        note="Two components with one name and different controls."
      >
        <Specimen label="Profiles: a radio row" wide>
          <Grades />
        </Specimen>
        <Specimen label="School: a select">
          <div data-dense>
            <Grades school />
          </div>
        </Specimen>
      </Section>
      <Section
        id="plan-choice"
        title="Plan choice"
        source={[
          "features/billing/PlanChoice.tsx",
          "features/billing/Billing.module.css",
        ]}
      >
        <Specimen label="Yearly and monthly, with the extra-child line" wide>
          <PlanLive />
        </Specimen>
        <Specimen label="One plan sold">
          <PlanChoice
            offers={offers.slice(0, 1)}
            interval="year"
            onChange={() => {}}
          />
        </Specimen>
      </Section>
      <Section
        id="sign-in-parts"
        title="Sign-in and first-run parts"
        source={[
          "features/auth/ProviderButtons.tsx",
          "features/onboarding/Progress.tsx",
          "features/school/join/CodeTiles.tsx",
        ]}
      >
        <Specimen label="Provider buttons">
          <ProviderButtons
            providers={["google", "apple", "microsoft"]}
            copy={socialCopyFor("en")}
            busy={false}
            pending={null}
            onSelect={() => {}}
          />
        </Specimen>
        <Specimen label="Provider buttons, one starting">
          <ProviderButtons
            providers={["google", "apple", "microsoft"]}
            copy={socialCopyFor("en")}
            busy
            pending="google"
            onSelect={() => {}}
          />
        </Specimen>
        <Specimen label="First-run steps: 1 of 4, 3 of 4">
          <div>
            <Progress step={1} />
            <Progress step={3} />
          </div>
        </Specimen>
        <Specimen label="Class code tiles: typing, then the board">
          <div>
            <CodeTiles code="K7M" active={3} />
            <CodeTiles code="K7M24Q" solid />
          </div>
        </Specimen>
      </Section>
      <Section
        id="charts"
        title="School charts and the year ribbon"
        source={[
          "features/school/org/charts.tsx",
          "features/school/YearRibbon.tsx",
        ]}
      >
        <Specimen label="Weekly minutes" wide>
          <div data-dense>
            <TrendChart weeks={trend} today={week(0)} />
          </div>
        </Specimen>
        <Specimen label="Where students stand against their grade" wide>
          <div data-dense>
            <StandingChart standing={standing} />
          </div>
        </Specimen>
        <Specimen label="A year in semesters" wide>
          <div data-dense>
            <YearRibbon
              startsOn="2026-08-17"
              endsOn="2027-05-28"
              division="semester"
            />
          </div>
        </Specimen>
        <Specimen label="A year in quarters, without the list" wide>
          <div data-dense>
            <YearRibbon
              startsOn="2026-08-17"
              endsOn="2027-05-28"
              division="quarter"
              list={false}
            />
          </div>
        </Specimen>
      </Section>
    </>
  );
}

function PlanLive() {
  const [chosen, choose] = useState<"year" | "month">("year");
  return (
    <PlanChoice
      offers={offers}
      extra={extra}
      interval={chosen}
      onChange={choose}
    />
  );
}
