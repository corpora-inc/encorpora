import {
  nationalProgramReviews,
  nationalReviewCheckedOn,
} from "./national-review.js";
import type {
  BaseFundingRegistry,
  FundingProgram,
  FundingRegistry,
  FundingSource,
} from "./types.js";

/** Combines dated research without conferring any Corpora approval or payment capability. */
export function expandFundingRegistry(
  base: BaseFundingRegistry,
): FundingRegistry {
  const sources: FundingSource[] = [...base.sources];
  const baseClassifications: Record<
    string,
    {
      purchaseModel: FundingProgram["purchaseModel"];
      operatingStatus: FundingProgram["operatingStatus"];
      onboardingSource: string;
    }
  > = {
    "az-esa": {
      purchaseModel: "parent-curriculum",
      operatingStatus: "operating",
      onboardingSource: "az",
    },
    "fl-pep": {
      purchaseModel: "parent-curriculum",
      operatingStatus: "operating",
      onboardingSource: "fl-vendor",
    },
    "fl-fes-ua": {
      purchaseModel: "parent-curriculum",
      operatingStatus: "operating",
      onboardingSource: "fl-vendor",
    },
    "tx-tefa": {
      purchaseModel: "parent-curriculum",
      operatingStatus: "operating",
      onboardingSource: "tx",
    },
    "tx-pdses": {
      purchaseModel: "parent-curriculum",
      operatingStatus: "operating",
      onboardingSource: "pdses",
    },
    "al-choose": {
      purchaseModel: "parent-curriculum",
      operatingStatus: "operating",
      onboardingSource: "al",
    },
    "nc-esa-plus": {
      purchaseModel: "parent-curriculum",
      operatingStatus: "operating",
      onboardingSource: "nc",
    },
    "wv-hope": {
      purchaseModel: "parent-curriculum",
      operatingStatus: "operating",
      onboardingSource: "wv",
    },
  };
  const programs = new Map<string, FundingProgram>();
  for (const program of base.programs) {
    if (nationalProgramReviews.some((review) => review.id === program.id))
      continue;
    const classification = baseClassifications[program.id];
    if (!classification)
      throw new Error(
        `Explicit funding classification required: ${program.id}`,
      );
    programs.set(program.id, {
      ...program,
      purchaseModel: classification.purchaseModel,
      operatingStatus: classification.operatingStatus,
      onboarding: {
        statement: program.nextAction,
        sourceIds: [classification.onboardingSource],
      },
    });
  }
  for (const review of nationalProgramReviews) {
    const previous = base.programs.find((program) => program.id === review.id);
    const addSource = (
      url: string,
      suffix: string,
      publisher: FundingSource["publisher"],
    ): string => {
      const id = `national-${review.id}-${suffix}`;
      sources.push({
        id,
        title: `${review.name}: ${suffix}`,
        url,
        checkedOn: nationalReviewCheckedOn,
        publisher,
      });
      return id;
    };
    const facts = review.evidence.map((source, index) => ({
      statement: source.statement,
      sourceIds: [
        addSource(source.url, `evidence-${index + 1}`, source.publisher),
      ],
    }));
    const onboarding = {
      statement: review.onboarding.requirements,
      sourceIds: [
        addSource(
          review.onboarding.url,
          "onboarding",
          review.onboarding.publisher,
        ),
      ],
    };
    const routes: Record<string, FundingProgram["purchasingRoutes"]> = {
      "ia-students-first": ["marketplace"],
      "ga-promise": ["marketplace"],
      "la-gator": ["marketplace"],
      "mo-moscholars": ["marketplace"],
      "wy-esa": ["marketplace", "reimbursement"],
      "ut-fits-all": ["marketplace", "reimbursement"],
      "in-esa": ["marketplace", "direct-pay", "reimbursement"],
      "nh-efa": ["marketplace", "direct-pay"],
      "id-empowering-parents": ["marketplace", "direct-pay"],
      "mt-special-needs-esa": ["reimbursement"],
      "ms-esa": ["reimbursement"],
    };
    const modelRoutes: Partial<
      Record<
        FundingProgram["purchaseModel"],
        FundingProgram["purchasingRoutes"]
      >
    > = {
      "family-tax-benefit": ["family-payment"],
      "school-tuition": ["school-contract"],
      "approved-specialist": ["provider-contract"],
      institutional: ["institutional-contract"],
    };
    const kind: FundingProgram["kind"] =
      review.purchaseModel === "institutional"
        ? "institutional"
        : review.purchaseModel === "family-tax-benefit"
          ? "family-tax-benefit"
          : review.purchaseModel === "school-tuition" ||
              ["nh-etc", "ut-csos"].includes(review.id)
            ? "scholarship"
            : review.purchaseModel === "approved-specialist" ||
                review.id === "fl-new-worlds"
              ? "scholarship"
              : "esa";
    programs.set(review.id, {
      id: review.id,
      jurisdiction: review.jurisdiction,
      name: review.name,
      kind: previous?.kind ?? kind,
      purchaseModel: review.purchaseModel,
      operatingStatus: review.operatingStatus,
      researchStatus: "official-sources-reviewed",
      priority:
        review.operatingStatus === "operating" &&
        ["parent-curriculum", "tuition-first"].includes(review.purchaseModel)
          ? "second-wave"
          : "research",
      administrator:
        previous?.administrator ??
        "See cited program authority or administrator",
      platform: review.platform,
      facts,
      onboarding,
      annualSubscription:
        review.id === "in-esa"
          ? "category-supported-term-unconfirmed"
          : "unconfirmed",
      purchasingRoutes:
        review.operatingStatus === "closed"
          ? []
          : (routes[review.id] ?? modelRoutes[review.purchaseModel] ?? []),
      corpora: previous?.corpora ?? {
        vendor: { status: "not-applied" },
        sku: { status: "not-applied" },
        listing: { status: "not-applied" },
        payment: "not-configured",
      },
      unknowns: review.unknowns,
      nextAction: review.onboarding.requirements,
    });
  }
  const allPrograms = [...programs.values()];
  return {
    ...base,
    checkedOn: nationalReviewCheckedOn,
    sources,
    programs: allPrograms,
    jurisdictions: base.jurisdictions.map((jurisdiction) => ({
      ...jurisdiction,
      researchStatus: "partial",
      programIds: allPrograms
        .filter((program) => program.jurisdiction === jurisdiction.code)
        .map((program) => program.id),
      nextAction:
        "Recheck current-year authority and product eligibility for listed channels; research local district, charter and supplemental purchasing opportunities separately. Partial review does not establish absence of other programs.",
    })),
  };
}
