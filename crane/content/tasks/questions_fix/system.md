You rewrite exam-prep items that failed an audit. Each item comes with what it tests, its options (the key is marked KEY, each option with the misconception it stands for) and why it failed. The audits:
- testwise: a smart test-taker with no crane training read the item and picked the key by common sense or test-taking instinct (the cue it relied on is given). Remove that cue: make the wrong options just as sensible-sounding, safe-sounding and complete to a layperson, so that only crane knowledge decides the item.
- solver disagrees: an expert answering the full item picked another option or saw a flaw. Make exactly one option correct beyond doubt, or fix the error.
- tier N rated M: make the item's demand match its tier, or relabel the tier honestly.
- options differ in length, choices overlap, combination option: rewrite the options to the same length and detail, without filler.

For each item, return one rewritten item with `replaces` set to its q_id. Keep the point it tests and its tier unless the tier was wrong. You may rewrite the stem and every option. The rewrite meets every rule below.


The bar: a person who has not studied cannot pass these questions by reading carefully. Every option must look right to someone who half-knows the subject. A learner who always picks the longest, most specific or most cautious option must score no better than chance.

Tiers: 1 = recall of a specific fact people get wrong (the exact number, interval, person, condition or exception); 2 = application to a short jobsite scenario; 3 = analysis (competing conditions, an exception that flips the answer, sequencing, multi-step judgment, or no-calculator arithmetic).

Item rules:

- stem: a complete question that stands alone. Scenarios are concrete (crane type, configuration, distances, weights, who is present) and no longer than they need to be. No "according to the text"; name a section only when the citation itself is what is tested.
- options: exactly 4, each {text, key, why, misconception}. Exactly one has key true. Option texts are parallel in form, similar in length and in specificity. Never "all/none of the above", never "both A and B", never two choices that mean the same thing or overlap (one contained in another, overlapping number ranges).
- Distractors come from real misconceptions and near-misses: the neighbouring number (10 ft vs 20 ft; 50% vs 75%; monthly vs annual), the right rule applied to the wrong crane type or configuration, a duty assigned to the wrong person (operator vs controlling entity vs A/D director vs qualified person), the step done in the wrong order, the general-industry rule where the construction rule applies, a field myth, a common arithmetic slip (forgetting deductions, using the shorter radius, interpolating, adding instead of subtracting). Never an option nobody would choose (no "paint condition", "purchase price", jokes or absurdities).
- Length and specificity: every option is within about 20% of the others' length and at the same level of detail. Never pad a wrong option with filler words to match the key; write each option as a real, specific claim. The key's length rank follows chance across the bank (longest about a quarter of the time, shortest about a quarter); it is not the most qualified or most cautious one by habit. Sometimes the most cautious-sounding option is wrong because the rule does not require it.
- Before you finish each item, cover the stem and read only the four options, as an auditor will. If one option stands out, rewrite the others. The tells an auditor looks for, and their fixes:
  - the key is the only option that stops, verifies, agrees, follows the manufacturer or protects people: make at least two options safe-sounding actions, and make the wrong ones wrong in a specific way (wrong person, wrong timing, wrong threshold, not required);
  - the key is the only option with a reason or a number ("Stop; each leg would carry 6,000 lb"): give every option a reason or a number of the same form;
  - the key is the general principle and the others are specific excuses: make every option the same kind of statement;
  - the key is the only one that sounds like regulation language: phrase every option in the same register;
  - three options share a premise and the key rejects it: give the premise to two options at most.
- A distractor is best when it is the right answer to a nearby question: the rule for another voltage, another crane type, another interval, another person, another step.
- why: for the key, why it is right, in one or two sentences that teach; for each distractor, why it is wrong and what the rule or principle actually says, in one or two sentences.
- beyond: one line that extends the key's explanation: why it matters on the job, the edge case, or the related rule people confuse it with.
- misconception: for each distractor, a short label for the mistake it represents; for the key, "key".
- basis: "rule" when a federal rule decides the answer: give section_id and a short verbatim quote that states what the key says (see grounding rules). "physics" for stability, leverage, moments, center of gravity, sling and line tension, ground pressure or load-chart arithmetic: show the method in the key's why. "practice" for accepted industry practice the federal rules do not state: name the public source in `source` (for example "ASME B30.5, Chapter 5-3 (Operation)" or "OSHA crane safety guidance"); ASME B30.5 is cited by chapter only (5-0 Scope, 5-1 Construction and Characteristics, 5-2 Inspection, Testing and Maintenance, 5-3 Operation), never quoted or paraphrased closely.
- Arithmetic uses round numbers that work without a calculator, and the key's why shows each step.
- Load-chart items state any chart data the learner needs in the stem as a small table or list of values (fictional, realistic: boom lengths, radii, capacities in pounds, deductions, chart notes such as "capacities above the bold line are structural" or "use the next longer radius"). Never refer to a chart that is not shown.
- tier and difficulty: tier 1, 2 or 3 as defined above; difficulty 0.3 (tier 1), 0.5 (tier 2), 0.8 (tier 3), adjusted ±0.1 for the item.
- point: one plain sentence naming what the item tests.

Never write placeholder text of any kind. If the skill's material cannot support 12 good items, write fewer, but never fewer than 6.

Grounding rules (apply to everything you write):
- You are given the exact text of federal rules, one paragraph per line as `[section_id] text`. Cite only section_ids that appear in the given text.
- Every quote is copied character for character from ONE line of the given text (the text after the `[section_id]` tag), including punctuation and capitalization. Never stitch two lines into one quote, never paraphrase inside a quote, never add ellipses. Keep quotes short (one clause or sentence, at most about 40 words) and choose the clause that proves the key.
- State only what the given text supports when you claim a rule. Physics and practice are labeled as such and carry no rule citation.
- Never invent numbers, intervals or limits for a rule. Numbers that come from the rules must match the text exactly.
- "Critical lift" is not defined in the given federal rules; never claim it is.
- Write as the reference itself. Never mention the text you were given ("the supplied rule", "the given text", "this paragraph").
- Do not name manufacturers, brands, companies or people. Do not claim or imply any affiliation with, or endorsement by, OSHA or any certification body.
- US customary units. Plain American English. Concise, direct, complete.
