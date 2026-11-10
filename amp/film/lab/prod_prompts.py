"""Production prompts shared by every study and writer model."""
import json

from prompts import HOUSE, coverage_from_study, review_prompt as base_review_prompt, validate_review

VERSION = 3
FRAMEWORK = """A great lesson connects with the child watching. Find the simplest explanation with the strongest intuition and say it in few words: the picture and the examples carry the rigour, so a line that only describes what the picture already shows should go. Show the idea in several quick, different situations a learner at this level knows from life, so the idea is seen as a pattern and never mistaken for a fact about one prop; introduce each object the way a child would meet it, in a few words, before using it. More examples in less time with fewer words beats one example described exhaustively. The test: would a child at this level enjoy it and remember the idea, and would a parent watching think it is the clearest explanation they have seen?

Teach how to understand and solve this problem type. Mention a neighbouring idea only when the learner needs it to understand this problem, in a sentence at most; never teach the next skill. The coverage audit belongs to the study, not the film: do not expand this film to cover the rest of the standard.

The cast is a patient teacher and Champ, a quick learner who is wrong for a reason. Ground his questions and first attempts in the facts pack: observed wrong answers if available, then generated decoys, then an earlier true rule that stops applying, unfamiliar words, and boundary cases. Label inferred misconceptions as inferences; never invent app observations. A teacher can invite Champ to test a claim against the figure; the visible result settles it. Leave no false idea standing in K–2 and use no strike-outs there. Champ solving a final case with only nudges and explaining the idea in his own words is allowed, not required. Remove a Champ line if deleting it loses no mathematical idea. About 70% teacher words is a guide, not a quota.

The figure carries the explanation: it makes the actual quantities, operation, and reason visible. Choose the insight, picture, examples and sequence for this type. Make the film as long as this type needs and no longer, usually about 3 to 5 minutes, shorter when the idea is simple. Work each meaningfully different method or case fully on its own screen; omit repeated examples that teach nothing new. Say the givens and question plainly. Do not append another problem's answer to a completed example. No praise, greetings or motivational filler; a situation earns its place by doing mathematical work. Read the family design as a teaching proposal; use only tools implemented in the supplied kit. Its unbuilt tool specifications are not API documentation. Follow the grade plan's conventions without teaching a different type or assuming that every viewer watched the preceding films."""


def review_prompt(payload, images):
    return base_review_prompt(payload, images) + "\n\nAlso judge it as the founder does: is this the simplest, most intuitive explanation, in few words, with varied real situations, that a child at this level would enjoy? A verbose, over-rigorous or monotonous film (one prop repeated, long description of what the picture shows) does not ship even if it is correct; name the cut or change that would fix it."


def grade_plan_prompt(grade, rows, kit_summary):
    return f"""{HOUSE}

Make one short course plan for grade {grade} before its lesson-film studies begin. Return the complete Markdown plan, at most 900 words. Do not make tool calls. The supplied order comes from the app curriculum with prerequisites before successors; preserve it. Cover:
1. The ordered type IDs, grouped compactly by skill. Explain only dependencies necessary to understand the order.
2. How Champ's knowledge grows across this grade. Every film must also define the objects and words needed by a first-time viewer.
3. Consistent objects, words, labels, units and implemented figure choices that make these films feel like one course.
4. Concrete kit gaps, with affected type IDs and a reason. Distinguish unsupported figures from a design preference or an unbuilt proposal. Do not invent a kit capability.

{FRAMEWORK}

GRADE TYPES IN ORDER:
{json.dumps(rows, ensure_ascii=False, indent=2)}

IMPLEMENTED KIT AND RECORDED GAPS:
{kit_summary}
"""


def study_prompt(facts, family_design, grade_plan):
    return f"""{HOUSE}

Study one mathematics problem type to prepare its lesson-film author. Return the complete study.md content as your final answer. Do not write a screenplay or make tool calls.

{FRAMEWORK}

Write a concise, complete study with:
1. A learner card (about 200 words): what Champ already knows, the earlier belief about to break, what he would try first and why, a word or symbol he cannot read yet, and the one sentence the viewer should see differently afterward.
2. The insight and the picture that makes it visible, including labels, units, scale and the motion or comparison that tests Champ's idea. Name existing kit components. Explain how to read and solve this type and distinguish its problem families. Use the grade plan's conventions where they fit this type.
3. Only the prerequisites needed for this problem type, with skill IDs and standard codes. Mention a neighbouring idea only when needed for this problem, in a sentence at most. Do not plan to teach successors.
4. A coverage audit comparing the verbatim standard clauses with the ten generated problems, answers, response formats, and written lessons. Identify evidence by problem seed or lesson field. Distinguish a gap in this type's intended scope from a gap in an entire standard: ten samples cannot establish that the whole product lacks coverage. Do not treat correct answers or catalog tags as proof that a reasoning clause is assessed. State uncertainties and sample limits. Keep these coverage gaps out of the film; they go to the private coverage queue.
5. End with exactly one fenced block named coverage-json, containing an object with keys verdict (string), sample_limits (string), and gaps (array). Each gap has standard (code), clause (verbatim text from the supplied standard), evidence (string), gap (string), scope (type|lesson|needs-catalog-audit), and proposed_action (string). Use an empty array when no gap is supported. If no verbatim standard resolves, state that limitation and do not invent clauses.

GRADE PLAN:
{grade_plan}

FACTS PACK:
{json.dumps(facts, ensure_ascii=False, indent=2)}

FAMILY DESIGN:
{family_design}
"""


def screenplay_prompt(blind_id, check_command, *, feedback=''):
    return f"""{HOUSE}

Write one complete cast screenplay to screenplay.json for film ID {blind_id}. This workspace contains facts.json, study.md, grade-plan.md, AUTHORING.md, PROCESS.md, KAIZEN.md, CURRICULUM.md, FAMILY.md, schema.ts and reference screenplays. Read these inputs before writing. All writer models receive the same production framework; the facts and study are specific to this type. The framework below governs scope and pacing if a reference document proposes a broader lesson.

{FRAMEWORK}

Use exactly cast {{"teacher":{{}},"learner":{{}}}} and mark each beat's speaker. Voice bindings belong to production; do not name or choose a voice. The learner is Champ. Use the exact ID above and a useful mathematical title with no author, model, arm or experiment label. Prefer supplied generated examples and preserve their seeds when using the app's example figure. Recompute the mathematics.

The figure must draw the actual quantities and settle the important question or mistake in view. Use the implemented schema and closest references; do not invent actions from a family tool proposal. You may freely design figures from supported primitives. Define terms before using them. A final independent Champ example is optional; include it only if it helps teach this type within the focused length.

After writing, run this exact check command using the shell tool:
{check_command}

It runs make.ts --dry and figure checks behind the machine's heavy-command gate, and produces storyboard images in this workspace. Inspect every current storyboard page listed by the checker using the image-reading tool. Fix mathematical, schema, timing and layout errors and rerun the same check command until it passes. Never change the checker, kit or input documents. Write files with file tools, not shell redirection or heredocs. Leave screenplay.json as the finished artifact. Your final response should state which checks passed and any unresolved issue; it is not the screenplay.
{('FEEDBACK TO ADDRESS IN THIS REVISION:\n'+feedback) if feedback else ''}
"""
