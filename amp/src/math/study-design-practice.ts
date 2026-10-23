import type { GeneratedProblem, TemplateMetadata } from "./contracts.js";
import { assemble, random, type Draft } from "./distribution-practice.js";

export const studyDesignTemplate: TemplateMetadata = {
  id: "scope-of-inference-choice",
  version: 1,
  title: "What can this study support?",
  skillId: "study-design",
  gradeBand: "9–12",
  requiredResponseCapability: "single-choice-v1",
  description:
    "Distinguish random sampling from random assignment to judge population generalization and causal inference.",
};

const contexts = [
  {
    population: "students at Cedar School",
    larger: "students throughout the district",
    treatment: "a diagram-based instruction sheet",
    control: "a text-only instruction sheet",
    outcome: "accuracy on the same building task",
  },
  {
    population: "adult members of Harbor Library",
    larger: "adults throughout the city",
    treatment: "an illustrated search guide",
    control: "a text-only search guide",
    outcome: "time to find the same book",
  },
  {
    population: "members of the Valley Workshop",
    larger: "workshop members throughout the region",
    treatment: "a video tutorial",
    control: "a written tutorial",
    outcome: "accuracy on the same assembly task",
  },
] as const;
export type StudyDesignFrame = "population" | "causation" | "combined";
export type StudyDesignSampling = "random" | "volunteer" | "convenience";

/** Private case metadata supports bounded branch checks and independent review exports.
 * Only problem.public is delivered before grading. */
export function studyDesignCase(seed: string): {
  frame: StudyDesignFrame;
  sampling: StudyDesignSampling;
  assigned: boolean;
  problem: GeneratedProblem;
} {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(studyDesignTemplate.id, seed);
  const frame = (["population", "causation", "combined"] as const)[r(0, 2)]!;
  const sampling = (["random", "volunteer", "convenience"] as const)[r(0, 2)]!;
  const assigned = r(0, 1) === 1;
  const c = contexts[r(0, contexts.length - 1)]!;
  const total = r(6, 15) * 100,
    n = r(3, 6) * 20;
  const entry =
    sampling === "random"
      ? `${n} participants are drawn at random without replacement from a complete list of all ${total} ${c.population}; every set of ${n} has the same chance of selection.`
      : sampling === "volunteer"
        ? `${n} of the ${total} ${c.population} volunteer after seeing an invitation. These volunteers enter the study without random sampling.`
        : `${n} of the ${total} ${c.population} who are easiest for the researcher to reach enter the study without random sampling.`;
  const allocation = assigned
    ? `The researcher randomly assigns half of the participants to use ${c.treatment} and half to use ${c.control}.`
    : `Each participant chooses whether to use ${c.treatment} or ${c.control}; the researcher does not assign treatments.`;
  const intro = `A researcher compares ${c.outcome} with two kinds of instructions. ${entry} ${allocation} Everyone completes the study, measurement is reliable, and task conditions are otherwise the same.`;
  const samplingReason =
    sampling === "random"
      ? `The random sample comes from all ${total} ${c.population}, so it supports inference to that population, with sampling uncertainty.`
      : `The ${n} participants were selected by ${sampling === "volunteer" ? "volunteering" : "ease of access"}; they may differ from the other ${c.population}, so this design alone does not justify population generalization.`;
  const assignmentReason = assigned
    ? "Random assignment helps balance other influences between the groups. With convincing evidence of an outcome difference, this comparison can support a causal conclusion for the participants."
    : "Participants choose their instructions, so differences in their interests or experience could explain an outcome difference. The comparison alone supports association, not causation.";
  const draft: Draft = {
    prompt: intro,
    answer: "",
    hint: "",
    explanation: [samplingReason, assignmentReason],
  };
  if (frame === "population") {
    draft.prompt +=
      " Based on participant selection, which statement about generalizing the findings is justified by this design alone?";
    draft.hint = `Start with how the ${n} participants entered the study: from which complete group could they be chosen, and did chance or availability select them?`;
    draft.choices = [
      {
        label: `The findings can be generalized to all ${total} ${c.population}, with sampling uncertainty.`,
        ...(sampling === "random"
          ? { correct: true as const }
          : { feedback: samplingReason }),
      },
      {
        label:
          "The design alone does not justify generalizing the findings beyond the participants.",
        ...(sampling !== "random"
          ? { correct: true as const }
          : { feedback: samplingReason }),
      },
      {
        label: `The findings can be generalized to all ${c.larger}.`,
        feedback: `The study does not randomly sample all ${c.larger}.`,
      },
      {
        label: `The findings give exact results for every one of the ${total} ${c.population}.`,
        feedback:
          "A sample does not establish exact outcomes for every individual in the population.",
      },
    ];
  } else if (frame === "causation") {
    draft.prompt +=
      " If the analysis finds convincing evidence of an outcome difference, does the comparison support attributing that difference to the instructions for the study participants?";
    draft.hint = `Separate entering the study from receiving instructions. For these ${n} participants, who decided which instructions each person received?`;
    draft.choices = [
      {
        label:
          "Yes, because the participants were randomly assigned to the two kinds of instructions.",
        ...(assigned
          ? { correct: true as const }
          : { feedback: assignmentReason }),
      },
      {
        label:
          "No, because participants chose their instructions and could differ in other relevant ways.",
        ...(!assigned
          ? { correct: true as const }
          : { feedback: assignmentReason }),
      },
      {
        label: `Yes, because a study with ${n} participants always establishes causation.`,
        feedback:
          "Sample size alone cannot rule out other explanations for a difference.",
      },
      {
        label:
          "No, because only studying every person in the population could support causation.",
        feedback:
          "Causal support depends on a fair treatment comparison, not on observing the whole population.",
      },
    ];
  } else {
    draft.prompt += ` Which pair of conclusions does the design support? Here, generalization means extending findings to all ${total} ${c.population}; causal inference means attributing a convincing outcome difference to the instructions for the participants.`;
    draft.hint = `Ask two questions about the ${n} participants: how were they selected, and how did they receive their instructions? Judge the two kinds of inference separately.`;
    draft.choices = [false, true].flatMap((generalize) =>
      [false, true].map((cause) => ({
        label: `${generalize ? "Supports" : "Does not support"} population generalization; ${cause ? "supports" : "does not support"} causal inference.`,
        ...(generalize === (sampling === "random") && cause === assigned
          ? { correct: true as const }
          : {
              feedback:
                generalize !== (sampling === "random")
                  ? samplingReason
                  : assignmentReason,
            }),
      })),
    );
  }
  return {
    frame,
    sampling,
    assigned,
    problem: assemble(studyDesignTemplate, seed, r, draft),
  };
}
