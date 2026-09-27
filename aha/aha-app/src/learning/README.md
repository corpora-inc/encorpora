# Learning integration contract

Import the public surface from `./learning`. All persisted types are JSON-safe.
No learner names, credentials or provider keys enter the prompt context.

```ts
const learner = createLearner(localProfileId, 4);
const { system, context, candidates } = buildTutorContext(learner);
// Send these through the real Free2Z adapter. No provider JSON mode is assumed.
const result = validateActivity(modelText, candidates.map(c => c.skill.id));
if (result.ok) {
  const activity = result.activity;
  // Render activity.prompt and activity.visual; never the raw model question.
  const feedback = gradeAnswer(activity, learnerAnswer);
  if (!feedback.error) {
    const next = recordAttempt(learner, activity, {
      id: stableSubmissionId, answer: learnerAnswer,
      hintsUsed: hintsOpened, activeMs: visibleForegroundMs,
      interrupted: taskWasBackgrounded,
    });
    // Persist next and its evidence atomically before selecting another activity.
  }
}
```

The module is pure apart from optional default clock values. Supply explicit times
and seeds for tests. Errors in numeric entry are input errors, not wrong answers.
A submitted activity and attempt ID are idempotent; a second try needs a newly
identified activity and cannot rewrite the first answer. `generatePractice()`
creates a validated local task for an assessed skill; it throws for guided-only
skills. Always label local practice honestly, particularly after network failure.

`validateActivity()` accepts a parsed object or bounded JSON string and reconstructs
all canonical quantities, question text, task fingerprint and visual. It discards
model-proposed prompts, visuals and answer keys. Optional explanations and hints
are unverified teaching text: sanitize rendering, label AI content, permit dispute,
and do not use them as grading authority. No arbitrary expressions, JavaScript,
external assets or visual programs execute. Choices have distinct exact values
and exactly one computed correct answer. Timed fluency cannot use answer choices.

Supported exact task families: arithmetic, comparison, missing operand, fraction
picture, place value, rounding, arithmetic sequence, rectangle/triangle/prism
measurement, linear equation, integer power, GCF/LCM, mean/median/range, elementary
probability, percentage, unit rate, slope, integer Pythagorean lengths and bounded
polynomial evaluation. Fractions and finite decimals normalize using BigInt.
Input is bounded to 18 digits; validation rejects any task whose answer cannot be
entered within that grammar. Skill-specific guards constrain operations and topic.
A small numeric answer does not prove the broader conceptual requirement.

Progress policy is intentionally transparent and provisional:

- Three distinct independently correct tasks since the last assisted/wrong answer
  establish provisional numerical understanding. Slow correct answers still count.
- Fluency requires the last twelve recall-mode attempts since assistance or error,
  independently correct, without answer choices or interrupted timing, within the
  skill's target, across at least eight distinct tasks and two UTC dates. The
  thresholds are product defaults, not validated population norms or diagnoses.
- Reviews use 1/3/7/14/30-day spacing. Same-day wins do not confirm retention.
  Two successful due reviews establish retained numerical evidence; later failure
  clears retention and starts a next-day review. The longest interval repeats.
- `selectCandidates()` supplies due/support/continuation/frontier/placement choices.
  The first twelve attempts favor breadth across domains. Starting grade is only a
  placement hint; existing success does not permanently fence the learner in.
- `quarantineActivity()` marks disputed evidence and rebuilds projections from the
  remaining history. It preserves original attempts for audit and removes disputed
  evidence from prompt context. Persist that update in the same transaction as the
  dispute. `rebuildProgress()` is available for recovery/migrations.

`ActiveTimer` accepts monotonic timestamps from the UI. Pause on app background,
window blur, hidden document or task departure; resume on actual visible activity.
An interruption disqualifies the time from fluency evidence, not the conceptual
answer. Do not infer elapsed time from request duration, wall-clock timestamps,
or provider latency. Cached/locally generated review tasks avoid network timing.

Run from `aha/aha-app`: `node --import tsx --test src/learning/learning.test.ts`.
Tests include the full generator matrix, independently enumerated expected answers,
fractions/decimals, malformed model output, false topic credit, duplicates, varied
success, delayed reviews, assisted answers, choice/recall separation, disputes and
foreground timing. The module requires ES2022 or newer and no runtime dependencies.
