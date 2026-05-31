"""Lessons for Portuguese.

Each lesson is a dict with:
  - topic:    snake_case slug (stable id; used by retriever to dispatch)
  - title:    human title (shown to user)
  - level:    CEFR (A1/A2/B1/B2/C1/C2) or HSK (1-6) or custom
  - body:     markdown body, ~400-600 words for reference-grade
  - related:  list of related topic slugs (cross-links)
  - l1_notes: optional {"es": "Spanish speakers tend to...", "zh": "..."} —
              surfaced when user's L1 matches

Keep lessons in conceptual order (basics first, advanced last). The retriever
uses `topic` for dispatch, not array position; reorder freely.

Authoring conventions:
  - Markdown body, but NO h1 (the title is rendered separately by the UI).
    Start with h2 or paragraph text.
  - Three-column tables work in the chat UI; wider tables wrap awkwardly.
  - Lead with the rule, then 2-3 short examples in target language,
    then "common mistakes" callout.
  - End with a one-line `Related: [[topic_slug]], [[topic_slug]]` if not
    captured in `related`.
"""

LESSONS = []


def L(topic, title, level, body, related=None, l1_notes=None):
    LESSONS.append({
        "topic": topic,
        "title": title,
        "level": level,
        "body": body,
        "related": related or [],
        "l1_notes": l1_notes or {},
    })


# ============================================================
# UNIVERSAL LESSON BLUEPRINT — 30 topics every language ships
# Fill in the body for each. Skip / merge / split as the language warrants.
# ============================================================

# 1. PHONOLOGY
L("alphabet", "The Portuguese alphabet and sounds", "A1",
  """TODO: write 400-600 words covering the script / alphabet, sounds that don't exist in English, common pronunciation pitfalls. Include a phonemes table.""",
  related=["stress_intonation"])

L("stress_intonation", "Stress, rhythm, and intonation", "A2",
  """TODO: stress placement rules, sentence rhythm, question intonation.""")

# 2. WORD ORDER
L("word_order_basic", "Basic word order", "A1",
  """TODO: SVO / SOV / V2 / etc. Where do adjectives go. Where do adverbs go. Question word order.""",
  related=["questions"])

# 3. ARTICLES + DETERMINERS
L("articles", "Articles and determiners", "A1",
  """TODO: definite / indefinite / zero article rules. Include count vs uncount distinction if applicable.""",
  related=["nouns_basics"])

# 4. NOUNS
L("nouns_basics", "Nouns: gender, number, case", "A1",
  """TODO: noun system overview. Gender (if applicable), plural formation, case marking (if applicable).""")

# 5. PRONOUNS
L("pronouns", "Pronouns: subject, object, possessive", "A1",
  """TODO: full pronoun paradigm. Subject/object/possessive/reflexive. T-V distinction if applicable.""")

# 6. VERBS — base
L("verbs_basics", "Verbs: an overview", "A1",
  """TODO: verb system at a high level — tenses, aspect, mood, voice. Set up the more detailed tense lessons.""")

# 7. PRESENT TENSE
L("present_tense", "The present tense", "A1",
  """TODO: present tense forms, when to use, common verbs in present.""",
  related=["verbs_basics"])

# 8. PAST TENSE
L("past_tense", "The past tense", "A2",
  """TODO: past tense forms, common usage patterns.""",
  related=["present_tense"])

# 9. FUTURE TENSE
L("future_tense", "The future tense", "A2",
  """TODO: future tense forms, alternatives (e.g. 'going to' in English).""",
  related=["present_tense"])

# 10. PERFECT ASPECTS (if applicable)
L("perfect_aspects", "Perfect aspects: have + done", "B1",
  """TODO: perfect aspect system. When to use vs simple past. Common-mistake area.""",
  related=["past_tense"])

# 11. PROGRESSIVE / CONTINUOUS (if applicable)
L("continuous_aspect", "Continuous / progressive aspect", "A2",
  """TODO: progressive forms (-ing equivalent), stative-vs-dynamic verb distinction.""")

# 12. NEGATION
L("negation", "How to negate sentences", "A1",
  """TODO: negation rules. Word-level vs clause-level. Double-negation if applicable.""")

# 13. QUESTIONS
L("questions", "Asking questions", "A1",
  """TODO: yes/no questions, wh-questions, tag questions. Include question particles if applicable.""",
  related=["word_order_basic"])

# 14. COMPARISON
L("comparison", "Comparatives and superlatives", "A2",
  """TODO: -er/-est equivalents, as-as constructions, irregulars.""")

# 15. CONDITIONALS
L("conditionals", "Conditionals: if / when / unless", "B1",
  """TODO: real and hypothetical conditionals. The different "types" if your language has them.""")

# 16. MODAL VERBS
L("modal_verbs", "Modal verbs: can, must, should", "A2",
  """TODO: modal verb system. Ability vs permission vs obligation.""")

# 17. PASSIVE VOICE
L("passive_voice", "The passive voice", "B1",
  """TODO: passive formation and when to use it.""")

# 18. REPORTED SPEECH
L("reported_speech", "Reported / indirect speech", "B1",
  """TODO: reporting what someone said. Tense backshift if applicable.""")

# 19. RELATIVE CLAUSES
L("relative_clauses", "Relative clauses", "B1",
  """TODO: who/which/that equivalents. Restrictive vs non-restrictive.""")

# 20. SUBJUNCTIVE / EQUIVALENT
L("subjunctive_or_equivalent", "Expressing wishes, doubts, hypotheticals", "B2",
  """TODO: subjunctive mood (or its equivalent) if your language has one. Skip if not applicable.""")

# 21. PREPOSITIONS
L("prepositions_time", "Prepositions of time", "A2",
  """TODO: in/on/at-equivalents for time. Year, month, day, hour patterns.""")

L("prepositions_place", "Prepositions of place", "A2",
  """TODO: in/on/at-equivalents for location. Movement vs static.""")

# 22. NUMBERS
L("numbers_basics", "Numbers, dates, and time-of-day", "A1",
  """TODO: cardinals, ordinals, dates, telling time.""")

# 23. COMMON CONFUSABLES
L("confusables_overview", "Common confusable words", "A2",
  """TODO: words learners confuse with each other. Language-specific.""")

# 24. POLITENESS / REGISTER
L("politeness_register", "Politeness and register", "A2",
  """TODO: formal vs informal forms, T-V distinction if applicable, social register conventions.""")

# 25. WORD FORMATION
L("word_formation", "Prefixes, suffixes, compounding", "B1",
  """TODO: derivation patterns. Common prefixes and suffixes. How to guess word meaning from parts.""")

# 26. GERUNDS / INFINITIVES (if applicable)
L("gerund_vs_infinitive", "Gerunds vs infinitives", "B1",
  """TODO: verbs that take -ing vs to-infinitive (or your language's equivalent distinction).""")

# 27. ADVERBS
L("adverbs", "Adverbs: position and types", "A2",
  """TODO: adverb formation, position in sentence, frequency adverbs.""")

# 28. CONJUNCTIONS
L("conjunctions", "Conjunctions: and / but / because", "A1",
  """TODO: coordinating and subordinating conjunctions.""")

# 29. IDIOMS
L("common_idioms", "Common idioms", "B1",
  """TODO: 8-10 high-frequency idioms with literal + figurative meaning.""")

# 30. CULTURE / USAGE
L("culture_usage_notes", "Cultural usage notes", "B1",
  """TODO: things learners need to know to not sound rude / weird / outdated. Greetings, taboos, regional variation.""")


# ============================================================
# LANG-SPECIFIC LESSONS — add topics unique to this language
# Examples:
#   English:  articles_a_an_the, tenses_present_perfect, phrasal_verbs_overview,
#             do_support, silent_letters
#   Mandarin: tones, classifiers, aspect_le, aspect_guo, ba_construction,
#             bei_construction, chengyu_intro
#   Japanese: particles_wa_ga, kanji_readings, te_form, honorifics
#   Arabic:   roots, broken_plurals, mood_jussive
# ============================================================
