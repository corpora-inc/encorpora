import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { act, step, table } from "../math/scene/author";

export const studyDesignLesson: Lesson = {
  id: "study-design",
  title: "Two kinds of randomness in a study",
  summary:
    "Choosing participants by chance helps describe the group they came from. Assigning treatments by chance helps compare causes. Check these two choices separately.",
  templateIds: ["scope-of-inference-choice"],
  includeGeneratedRepresentation: false,
  objectives: [
    "Identify the population a sample can represent.",
    "Distinguish random sampling from random assignment.",
    "Judge whether a design supports generalization, causal inference, both, or neither.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Who enters, and who gets which treatment?",
      paragraphs: [
        "A population is the whole group a study is about. A sample is the smaller group observed. Generalizing means using the sample to draw conclusions about the population. You need no calculation for this lesson; follow how people enter the study and how they receive instructions.",
        "Random sampling uses chance to select participants from a defined population. In a simple random sample, every possible group of the required size has the same chance of selection. This supports population estimates, with uncertainty because samples vary. Volunteers and people who are easy to reach can differ from the population, even in a large sample.",
        "A treatment is a condition being compared, such as one kind of instruction. An experiment assigns treatments. Random assignment uses chance to decide which treatment each participant receives. It helps balance other influences on average; it does not guarantee identical groups. A well-run randomized comparison can support a causal inference: that changing the treatment changes the outcome.",
        "In an observational study, researchers record conditions without assigning treatments. If participants choose their own instructions, prior experience could affect both their choice and their results. An association, meaning that two measured quantities vary together, does not by itself identify a cause.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "From a complete list of 800 students at one school, a researcher draws a simple random sample of 80. All participate. The researcher randomly assigns 40 to diagram instructions and 40 to text instructions for the same building task. Measurement is reliable and conditions are otherwise the same. What kinds of conclusions can this design support?",
    steps: [
      "Selection: the 80 students come at random from all 800 students at this school. The findings can be generalized to that school's students, with sampling uncertainty, but this selection does not represent the whole district.",
      "Assignment: chance places 40 participants in each instruction group. If the analysis finds convincing evidence of a difference, the randomized comparison supports attributing it to the instructions.",
      "Check the limits: random selection does not prove causation, and random assignment does not make volunteers representative. This example has both forms of randomization.",
    ],
    answer:
      "Both population generalization to this school's students and a causal comparison of instructions are supported.",
  },
  closingSections: [
    {
      stage: "method",
      title: "Read the two decisions separately",
      paragraphs: [
        "In the table, “Sample?” asks whether participants were randomly sampled; “Assign?” asks whether treatments were randomly assigned. “Population” means population generalization. Each row assumes reliable measurements, complete participation, and a well-run comparison. A causal conclusion also requires convincing evidence of an outcome difference. Removing either kind of randomization removes its corresponding justification.",
      ],
      illustration: "study-design-scope",
    },
    {
      stage: "formal",
      title: "Precise limits",
      paragraphs: [
        "Random sampling supports generalization to the population actually sampled, not automatically to other schools, cities, ages, or settings. It does not guarantee that a sample exactly matches that population. Nonresponse and unreliable measurement can weaken an otherwise random design.",
        "Random assignment supports causal comparison by controlling systematic differences in treatment allocation. Chance differences can remain, so assignment alone does not establish that an observed outcome difference is real. Without random assignment, an ordinary comparison may have other explanations; it does not by itself justify causation.",
        "A volunteer sample with random treatment assignment can support a causal comparison for the participants without justifying generalization to the full population. A random sample with self-selected treatments supports population generalization of associations without establishing their cause.",
      ],
    },
  ],
  pitfalls: [
    "Identify the exact population named in the sampling procedure.",
    "Do not treat random assignment as random selection from the population.",
    "A large convenience or volunteer sample does not repair the selection method.",
  ],
  parentGuide:
    "Compare choosing 20 names at random from a full school roster with accepting 20 volunteers. Then consider flipping coins to assign either group to two instruction sheets. Ask what each use of chance justifies.",
};
export const studyDesignMethod: ProblemMethod = {
  goal: "Match the conclusion to how participants were selected and treatments were allocated.",
  terms: [
    "population",
    "random-sample",
    "random-assignment",
    "causal-inference",
  ],
  method: [
    "Name the population and identify how participants entered the study. Random sampling supports generalizing to that population, with uncertainty.",
    "Check how treatments were allocated. Random assignment supports a causal comparison when the study is well run and the difference is convincing.",
    "Match each requested conclusion to its own justification; the study may support either, both, or neither.",
  ],
  watch:
    "Check selection and assignment separately; a large sample or random treatment assignment does not make volunteers a random population sample.",
};
export const studyDesignIllustrations = {
  "study-design-scope": table({
    id: "scope",
    corner: "Sample?",
    columns: ["Assign?", "Supports"],
    rows: [
      { label: "Yes", cells: ["Yes", "Both"] },
      { label: "Yes", cells: ["No", "Population"] },
      { label: "No", cells: ["Yes", "Causation"] },
      { label: "No", cells: ["No", "Neither"] },
    ],
  }).scene({
    title:
      "Sampling supports generalization; assignment supports causal inference. Assume a well-run study and convincing evidence of a difference.",
    steps: [
      step(
        "Rows beginning Yes have random sampling and support population generalization.",
        act.highlight("scope"),
      ),
      step(
        "Rows with Yes under Assign? have random assignment and support causal inference.",
        act.highlight("scope"),
      ),
    ],
  }),
};
