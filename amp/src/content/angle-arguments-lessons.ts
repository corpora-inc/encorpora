import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for the informal angle arguments
 * (8.G.A.5). The learner judges arguments rather than writing them: each
 * item asks for a reason, a first wrong step, or the complete argument.
 */

const angleSenses = { degree: "degree-angle", degrees: "degree-angle" };

export const angleArgumentMethods: Record<string, ProblemMethod> = {
  "triangle-angle-argument": {
    goal: "Find the first wrong step in a triangle angle argument, or explain why three copies of a triangle line up in a straight edge.",
    intuition:
      "An argument is a chain of steps. Each step makes a claim and gives a reason. The reason must be a true fact about those exact angles. It also may not use the fact the argument is trying to prove. One wrong step breaks the chain, even when the last line is true.",
    senses: angleSenses,
    terms: [
      "angle",
      "parallel",
      "transversal",
      "alternate-interior-angles",
      "exterior-angle",
      "straight-angle",
    ],
    method: [
      "Read the steps in order. In each one, find the claim and the reason it gives.",
      "Check the claim against the figure: name the angles and where they sit.",
      "Check that the reason is a true fact about those angles and does not use the fact being proved.",
      "The first step that fails is the answer. If every step holds, no step is wrong.",
    ],
    watch:
      "Check the reason as well as the claim. A true claim with a wrong reason is still a wrong step.",
  },
  "triangle-angle-reasons": {
    goal: "Choose the reason for each step proving a triangle's angles add to 180° or an exterior angle equals the two angles not next to it.",
    intuition:
      "Draw a line through one corner of a triangle, parallel to the opposite side. Parallel lines never meet. Each side of the triangle now crosses two parallel lines. A line that crosses two other lines is called a transversal. Angles that make a zigzag along a transversal are equal. The three angles at that corner then fill a straight line, which is 180°.",
    senses: angleSenses,
    terms: [
      "transversal",
      "alternate-interior-angles",
      "corresponding-angles",
      "straight-angle",
      "exterior-angle",
    ],
    method: [
      "Find the parallel lines, and the transversal that joins the two angles in the step.",
      "Angles between the parallel lines on opposite sides of the transversal are alternate interior angles. Angles in matching positions are corresponding angles. Both kinds are equal.",
      "For a sum, check whether the angles sit side by side and fill a straight angle, or whether a ray splits a bigger angle into them.",
      "Never use the triangle's 180° sum to prove that same sum.",
    ],
    watch:
      "Name the transversal that joins the two angles. For angle 1 and $\\angle B$ it is side $AB$, not side $AC$.",
  },
  "parallel-angle-argument": {
    goal: "Choose the motion or argument showing two angles at parallel lines are equal, find a wrong step, or spot a missing hypothesis.",
    intuition:
      "Two lines are parallel when they never meet. When a third line crosses both, it makes the same angles at each crossing. A motion shows why. Slide the whole picture along the crossing line until one crossing lands on the other. The first line lands on the second line, and each angle lands on its match. This works only when the two lines are parallel.",
    senses: angleSenses,
    terms: [
      "parallel",
      "transversal",
      "corresponding-angles",
      "alternate-interior-angles",
      "translation",
      "rotation",
    ],
    method: [
      "Name the pair: matching positions at the two crossings are corresponding angles. Between the lines on opposite sides of the transversal are alternate interior angles.",
      "Corresponding angles: slide along the transversal. Alternate interior angles: turn halfway around the midpoint between the two crossings.",
      "Check that the lines are given as parallel before you use either fact.",
    ],
    watch:
      "Corresponding angles are equal only when the lines are parallel. Look for the parallel marks before you use the fact.",
  },
  "parallel-angle-reasons": {
    goal: "Choose the reason for each step proving alternate interior angles equal or same-side interior angles adding to 180°.",
    intuition:
      "A transversal is a line that crosses two other lines. When the two lines are parallel, angles in matching positions at the two crossings are equal. These are called corresponding angles. From there, one more step at a single crossing proves the other angle facts.",
    senses: angleSenses,
    terms: [
      "transversal",
      "corresponding-angles",
      "vertical-angles",
      "linear-pair",
      "alternate-interior-angles",
      "same-side-interior-angles",
    ],
    method: [
      "Step 1 moves from one crossing to the other: the two angles are corresponding angles, so they are equal.",
      "Step 2 stays at one crossing. Angles across from each other are vertical angles, so they are equal. Angles side by side along a line are a linear pair, so they add to 180°.",
      "Replace the middle angle to reach the fact being proved.",
    ],
    watch:
      "The fact being proved cannot be its own reason. Use corresponding angles first, then vertical angles or a linear pair.",
  },
  "aa-similarity-argument": {
    goal: "Decide whether two triangles with two given angles each are similar, and choose the complete argument or find the wrong step.",
    intuition:
      "Two triangles are similar when they have the same shape: one is a scaled copy of the other. The angles of a triangle add to 180°, so two angles fix the third. If all three angles match, a dilation (a resizing from a point) and some slides, turns and flips carry one triangle onto the other.",
    senses: { ...angleSenses, similar: "similar-figures" },
    terms: ["similar-figures", "dilation", "rigid-motion", "aa-similarity"],
    method: [
      "Find the third angle of each triangle: 180° minus the two given angles.",
      "Compare the three angles of one triangle with the three angles of the other.",
      "If all three match, the triangles are similar. If any one differs, they are not, because dilations and rigid motions never change an angle.",
    ],
    watch:
      "Find both third angles before you compare. One shared angle is not enough, and the given pairs may be different angles.",
  },
  "aa-similarity-select": {
    goal: "From two angles of a triangle, select every triangle, each given by two of its angles, that must be similar to it.",
    intuition:
      "Similar triangles have the same shape: the same three angles, in any size. Two angles of a triangle fix the third, because the three add to 180°. So each choice can be finished and compared with the given triangle.",
    senses: { ...angleSenses, similar: "similar-figures" },
    terms: ["similar-figures", "aa-similarity", "angle"],
    method: [
      "Find the third angle of the given triangle: 180° minus its two given angles.",
      "For each choice, find its third angle the same way.",
      "Select the choice when its three angles are the same three as the given triangle's, in any order.",
    ],
    watch:
      "An angle that is only close to one of the three does not count. Compare exact measures.",
  },
};

export const angleArgumentPrinciples: Record<string, string> = {
  "triangle-angle-argument":
    "An argument is correct only when every step is true and every reason is a true fact about those exact angles that does not use the fact being proved. The first step that fails is where the argument goes wrong.",
  "triangle-angle-reasons":
    "Through one corner of a triangle, draw the line parallel to the opposite side. Alternate interior angles along the two other sides copy the base angles to that corner, and the three angles there fill a straight angle, so they add to 180°. The same parallel line through the corner next to an exterior angle splits it into copies of the two angles not next to it.",
  "parallel-angle-argument":
    "When two parallel lines are crossed by a transversal, a slide along the transversal carries each crossing onto the other, so corresponding angles are equal. A half-turn about the midpoint between the crossings carries each alternate interior angle onto the other. Without parallel lines, neither motion works.",
  "parallel-angle-reasons":
    "Corresponding angles at parallel lines are equal. With vertical angles they give equal alternate interior angles, and with a linear pair they give same-side interior angles that add to 180°.",
  "aa-similarity-argument":
    "Two angles of a triangle fix the third. Two triangles are similar exactly when their three angles match, because a dilation and rigid motions then carry one onto the other, and those motions never change an angle.",
  "aa-similarity-select":
    "A triangle is similar to another exactly when it has the same three angles. Two given angles of each triangle are enough, because the third is 180° minus the two.",
};

export const angleArgumentLessons: Lesson[] = [
  chainLesson({
    id: "angle-arguments-why-lesson",
    title: "Why the angle facts are true",
    summary:
      "Parallel lines crossed by a third line make equal angles, and a slide or a half-turn shows why. A line through one corner of a triangle, parallel to the opposite side, then shows that the triangle's angles fill a straight line.",
    senses: angleSenses,
    templateIds: [
      "parallel-angle-reasons",
      "parallel-angle-argument",
      "triangle-angle-reasons",
      "triangle-angle-argument",
    ],
    objectives: [
      "Choose the reason for each step of the arguments for parallel-line angles and for a triangle's angle sum.",
      "Find the first wrong step in an angle argument, and say why an argument needs parallel lines.",
    ],
    openingTitle: "From a slide to 180°",
    opening: [
      "Two lines are parallel when they never meet. A line that crosses two other lines is called a transversal.",
      "Slide the whole picture along the transversal until one crossing lands on the other. The first parallel line lands on the second, so each angle lands on the angle in the matching position. Angles in matching positions are called corresponding angles, and they are equal.",
      "Angles between the parallel lines, on opposite sides of the transversal, make a zigzag. They are called alternate interior angles, and they are equal too.",
      "Now draw a line through the top corner of a triangle, parallel to the bottom side. Each other side is a transversal. Its zigzag angles copy the two bottom angles up to the top corner. There the three angles sit side by side along a straight line, so they add to 180°.",
    ],
    example: {
      prompt:
        "Line $DE$ goes through corner $A$ of triangle $ABC$, parallel to side $BC$. Angle 1 is between $DA$ and $AB$, angle 2 is $\\angle A$, and angle 3 is between $AC$ and $AE$. Why do $\\angle A$, $\\angle B$ and $\\angle C$ add to 180°?",
      steps: [
        "Side $AB$ crosses the parallel lines $DE$ and $BC$, so it is a transversal. Angle 1 and $\\angle B$ sit between those lines on opposite sides of $AB$. They are alternate interior angles, so angle 1 equals $\\angle B$.",
        "In the same way, along side $AC$, angle 3 equals $\\angle C$.",
        "Angles 1, 2 and 3 sit side by side at $A$ and fill the straight angle along $DE$, so they add to 180°.",
        "Replace angle 1 with $\\angle B$ and angle 3 with $\\angle C$. Then $\\angle B + \\angle A + \\angle C = 180^\\circ$.",
      ],
      answer:
        "The angles at $A$ copy $\\angle B$ and $\\angle C$ and fill a straight angle, so the three angles add to 180°.",
    },
    methodTitle: "Check each step and its reason",
    method: [
      "Find the parallel lines and the transversal that joins the two angles in a step.",
      "Name the pair: corresponding, alternate interior, vertical (across from each other at one crossing) or a linear pair (side by side along a line).",
      "A step is right only when its claim is true and its reason is a true fact about those angles.",
      "A reason may not use the fact being proved, and a drawing or a measurement is never a reason.",
    ],
    formalTitle: "The facts and what they need",
    formal: [
      "If two parallel lines are cut by a transversal, corresponding angles are equal, alternate interior angles are equal, and same-side interior angles add to 180°.",
      "A slide along the transversal proves the first fact, because it carries one parallel line onto the other. Vertical angles and linear pairs give the other two.",
      "The angles of a triangle add to 180°. An exterior angle, formed by one side and the extension of the next, equals the sum of the two angles of the triangle not next to it.",
      "Each fact about corresponding or alternate interior angles needs the lines to be parallel.",
    ],
    pitfalls: [
      "Naming the wrong transversal, so the reason fits a different pair of angles.",
      "Using the triangle's 180° sum to prove that same sum.",
      "Using a parallel-line fact when nothing says the lines are parallel.",
    ],
    parentGuide:
      "Ask your learner to point to the two parallel lines and to the line crossing both before choosing a reason. Then ask whether the reason is about exactly the two angles in the step.",
  }),
  chainLesson({
    id: "angle-arguments-similarity-lesson",
    title: "Two angles are enough for similar triangles",
    summary:
      "Two angles of a triangle fix the third, because the three add to 180°. Two triangles with the same three angles are similar: a dilation and slides, turns and flips carry one onto the other.",
    senses: { ...angleSenses, similar: "similar-figures" },
    templateIds: ["aa-similarity-argument", "aa-similarity-select"],
    objectives: [
      "Decide whether two triangles with two given angles each are similar, and choose or check the argument.",
      "Select every triangle that must be similar to a triangle with two given angles.",
    ],
    openingTitle: "Same angles, same shape",
    opening: [
      "Two figures are similar when they have the same shape: one is a scaled copy of the other. Their sizes may differ.",
      "A dilation is a resizing from a point. It changes lengths but never changes an angle. Slides, turns and flips, called rigid motions, never change an angle either.",
      "The angles of a triangle add to 180°. So if you know two angles, the third is 180° minus the two.",
      "If two triangles have the same three angles, a dilation makes one the size of the other, and rigid motions place it exactly on the other. So the triangles are similar.",
    ],
    example: {
      prompt:
        "In $\\triangle ABC$, $\\angle A = 50^\\circ$ and $\\angle B = 60^\\circ$. In $\\triangle DEF$, $\\angle E = 70^\\circ$ and $\\angle F = 60^\\circ$. Are the triangles similar?",
      steps: [
        "Third angle of $\\triangle ABC$: $180 - 50 - 60 = 70$, so $\\angle C = 70^\\circ$.",
        "Third angle of $\\triangle DEF$: $180 - 70 - 60 = 50$, so $\\angle D = 50^\\circ$.",
        "Both triangles have angles of 50°, 60° and 70°, so all three angles match.",
        "A dilation and rigid motions carry $\\triangle ABC$ onto $\\triangle DEF$, so the triangles are similar.",
      ],
      answer: "Yes. Both triangles have angles of 50°, 60° and 70°.",
    },
    methodTitle: "Finish, then compare",
    method: [
      "Find each missing angle: 180° minus the two given angles.",
      "Compare all three angles of one triangle with all three of the other, in any order.",
      "All three match: similar. Any one differs: not similar.",
    ],
    formalTitle: "The angle-angle criterion",
    formal: [
      "If two angles of one triangle equal two angles of another, the third angles are equal too, and the triangles are similar. This is called the angle-angle (AA) criterion.",
      "Similar triangles have equal angles and side lengths in one constant ratio. They are congruent, the same size as well, only when that ratio is 1.",
    ],
    pitfalls: [
      "Stopping after one shared angle.",
      "Comparing the given pairs without finding the third angles.",
      "Calling similar triangles congruent, or calling them not similar because their sides differ.",
    ],
    parentGuide:
      "Ask your learner to write all three angles of each triangle before deciding. Then ask whether similar means the same size or the same shape.",
  }),
];

export const angleArgumentFacetMappings: FacetMapping[] = [
  {
    templateId: "triangle-angle-argument",
    facetId: "triangle-angle-theorems.triangle-sum",
    extent: "partial",
    rationale:
      "Find the first wrong step in the parallel-line argument for a triangle's 180° sum or for the exterior angle, or choose why three copies of a triangle line up along a straight edge. The learner judges a given argument and does not write one.",
  },
  {
    templateId: "triangle-angle-reasons",
    facetId: "triangle-angle-theorems.exterior-angle",
    extent: "partial",
    rationale:
      "Choose the reason for each step of the argument for a triangle's 180° sum or for the exterior angle as the sum of the two angles not next to it. Reasons are chosen from a list; the argument is not written freely.",
  },
  {
    templateId: "parallel-angle-argument",
    facetId: "triangle-angle-theorems.parallel-transversal",
    extent: "partial",
    rationale:
      "Choose the slide or half-turn that shows corresponding or alternate interior angles are equal, find the first wrong step in such an argument, or say why the argument fails when the lines are not parallel. Angle measures are not computed.",
  },
  {
    templateId: "parallel-angle-reasons",
    facetId: "triangle-angle-theorems.parallel-transversal",
    extent: "partial",
    rationale:
      "Choose the reasons, corresponding angles then vertical angles or a linear pair, that prove alternate interior angles equal or same-side interior angles supplementary. Reasons are chosen from a list.",
  },
  {
    templateId: "aa-similarity-argument",
    facetId: "triangle-angle-theorems.core",
    extent: "partial",
    rationale:
      "Decide from two given angles of each triangle whether two triangles are similar, choosing the complete argument (third angles found, all three compared, dilation and rigid motions) or the first wrong step. Side lengths and scale factors are not computed.",
  },
  {
    templateId: "aa-similarity-select",
    facetId: "triangle-angle-theorems.core",
    extent: "partial",
    rationale:
      "Select every triangle, given by two angles, that must be similar to a triangle with two given angles, by finding third angles and comparing all three. The number to select is shown.",
  },
];
