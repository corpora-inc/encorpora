import { Author, text, note } from "./authoring.js";
export function addGuide(a: Author) {
  a.section = "transfer";
  a.page(
    "adult-guide",
    "A guide for your counting partner",
    [
      text(
        "Read the short invitations aloud when that helps. A learner can point, move objects, speak, draw or write. Reading difficulty should not hide mathematical understanding. Let the learner do the counting and moving; record their words when handwriting would get in the way.",
      ),
      note(
        "Start with something the learner can show",
        "Use buttons, blocks or paper counters of a safe size. Ask for a collection, a missing partner and a ten-and-ones explanation. Begin where the learner has something to investigate. An older learner can use these models without being labeled by a grade.",
      ),
      text(
        "On a counting page, notice whether each object receives one number name and whether the learner uses the last count to answer “how many?” After rearranging a collection without adding or removing anything, ask for a prediction before inviting another count.",
      ),
      text(
        "A wrong answer is a useful question. “Show me what this ten means” is more informative than repeating a rule about digits. If a trade changes the total, return to ten loose units and one ten-strip with the same unit size.",
      ),
      note(
        "Keep the learner in charge",
        "Offer a model, a smaller quantity or one focused question. Then ask a different example without the same hint. Record what the learner did independently and what support helped; do not convert a supported answer into a mastery label.",
      ),
    ],
    "guide",
  );
  a.page(
    "adult-route",
    "A route with room to return",
    [
      text(
        "The sections move from small collections to parts of ten, then to ten-units and arithmetic stories. The route is flexible: a learner who understands tens may still need to revisit a missing-part story. Mix a familiar task with a new decision rather than requiring a long row of identical sums.",
      ),
      text(
        "The later exchange examples extend into selected second-grade strategies. They are not a reason to rush a kindergartner through two-digit subtraction. Stay with small collections until the learner can explain the units and parts being used.",
      ),
      note(
        "Use the keys as a conversation",
        "Each task has an answer or an acceptance rule, followed by reasoning and a check. A different drawing or valid strategy can be correct. Ask how it represents the same quantities. The book does not automatically score spoken explanations, drawings or invented stories.",
      ),
      text(
        "After a break, revisit the same idea with different numbers or a different model. A remembered answer from a nearby example and an independent later solution are different kinds of evidence. Fluency grows with meaningful practice; this volume does not certify it from a stopwatch or a completed page.",
      ),
      note(
        "What this volume leaves for other study",
        "Hundreds and counting to 1,000, the full K–2 geometry and measurement curriculum, time, money and data need additional instruction. Pictured collections and practice links cover stated ranges, not every requirement of a grade.",
      ),
    ],
    "guide",
  );
}
