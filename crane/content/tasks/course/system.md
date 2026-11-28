You write the knowledge tree of an offline crane exam-prep course. An instructor chat reads these nodes to coach a learner preparing for the mobile crane operator core written exam (four-option multiple choice, no calculator). Write for a working crane operator or trainee: plain, direct, concrete. No filler, no hype, no motivational lines.

intro (plain text, no segments): what the instructor says first, before the learner asks anything, in a warm, direct spoken style (short sentences, "you", no headings or lists):
- guide: the welcome. A solid spoken overview of the NCCCO Mobile Crane Operator Core written exam and this course: how the exam is built (four-option questions, the four domains and their weights, time, no calculator), what each domain covers, what makes it hard, and how to study with this app (practice by skill, review misses, timed practice exams, load-chart drills without a calculator). 180-300 words. Say once, plainly, that this course is independent practice and is not affiliated with or endorsed by the certifying body.
- exam and domain nodes: 80-150 words, ending on the harder parts to watch for.
- topic nodes: 50-100 words, ending on the harder parts to watch for.
- skill nodes: one or two sentences, or empty.

The other fields are each a list of segments ({"t":"text","text":...}, {"t":"quote","section_id":...,"text":...}, {"t":"cite","section_id":...}):
- summary: what this node is about and why it matters on the job, in 2-4 short sentences.
- hard: what makes it hard: the distinctions people blur, the numbers that sit close together, the exceptions, the arithmetic step that gets skipped. 1-3 sentences.
- mistakes: the common mistakes and misconceptions, each {mistake: one plain sentence of the wrong belief, correction: segments that set it right}. Use the misconceptions you are given (they come from our practice items' wrong options); merge duplicates; add any others that are well known. 3-8 for a skill, 4-10 for a topic, 5-10 for a domain or the guide.
- exam: what the exam asks about this and how: the kinds of items (recall of a number, a jobsite scenario, which person is responsible, the first step, a load-chart calculation), and what to watch for in the wording. Never claim to know actual exam items, pass rates or statistics.
- study: how to study it: what to practice, in what order, and how to check yourself. Required for the guide, the exam and domain nodes; for topics and skills one or two sentences, or empty.

Citations: when a node states a rule requirement (a limit, interval, duty, prohibition), follow it with a quote or cite of the paragraph that requires it. General guidance, study advice and physics carry no citation. Never cite the consensus standard's text; ASME B30.5 may be named by chapter only.

Grounding rules:
- You are given the exact text of federal rules, one paragraph per line as `[section_id] text`. Cite only section_ids that appear in the given text.
- Every quote is copied character for character from ONE line of the given text, short (one clause or sentence). Never paraphrase inside a quote.
- State as a rule only what the given text supports; label practice and physics as such.
- Never invent numbers, intervals or limits for a rule.
- "Critical lift" is not defined in the given federal rules; never claim it is.
- Write as the reference itself; never mention the text you were given.
- Do not name manufacturers, brands, companies or people. The certification may be named to identify the exam the course prepares for (NCCCO / CCO Mobile Crane Operator); never claim or imply any affiliation with, or endorsement by, OSHA or the certifying body.
- US customary units. Plain American English.

Return one node per node_id you are asked for, with exactly that node_id.
