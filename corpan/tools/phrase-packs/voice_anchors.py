"""
One-sentence voice anchor per phrase pack. Injected alongside the
first-20-phrases reference in every codex authoring call to keep the
authorial register consistent with the existing pack.

The sentence should describe HOW the pack sounds — register, tone,
narrative posture — not what it's about (the topic is already given
by pack.json). Keep it under 40 words.
"""

VOICE_ANCHORS = {
    "phrase-sciences-astronomy-night-sky":
        "Literary, observational, marrying scientific precision to wonder; "
        "closes in on the long human habit of looking up; not preachy, not "
        "purple, but unafraid of awe.",

    "phrase-nature-birds-everyday":
        "Everyday, neighborly attention; the patient watcher at the window; "
        "specific to species and behaviors; affectionate without "
        "sentimentality.",

    "phrase-nature-the-ocean":
        "Sensory, weighty, blue; the sea as character and metaphor; the long "
        "human relationship with going to sea; respectful of the ocean's "
        "scale.",

    "phrase-sports-soccer-basics":
        "Plainspoken sports register; tactics, fans, the pitch; the rhythm "
        "of a match; international and inclusive without being preachy.",

    "phrase-sports-martial-arts":
        "Discipline, the body, the dojo; respect for tradition across "
        "lineages (karate, judo, jiu-jitsu, kung fu); the long arc of "
        "practice; the inner game.",

    "phrase-life-health-and-body":
        "Lived experience of a body; doctors, exercise, sleep, recovery, "
        "nutrition; warm, practical, not preachy or wellness-coded.",

    "phrase-life-family-and-friends":
        "Warm, specific, intergenerational; small rituals around the table; "
        "in-laws and grandparents included; relationships across time and "
        "distance.",

    "phrase-vehicles-cars-and-driving":
        "Open-road feel; mechanics and road trips; the romance of the "
        "highway tempered with the practicality of oil changes and traffic.",

    "phrase-arts-cinema-and-film":
        "The audience's seat in the dark room; classics + new releases + the "
        "maker's craft seen from below; affectionate film-literacy without "
        "snobbery.",

    "phrase-life-festivals-world":
        "Multicultural and specific; particular holidays named (Diwali, Eid, "
        "Lunar New Year, Christmas, Holi, Carnival, Songkran, Day of the "
        "Dead, Hanukkah, Nowruz, Easter, Thanksgiving); the rhythm of "
        "gathering, feast, and song.",

    "phrase-life-the-night":
        "Quiet, late-hour intimacy; the kitchen at midnight; sleep + "
        "insomnia + the night shift + dreams; a small attention to what the "
        "world does after dark.",

    "phrase-humanities-mythology-world":
        "World mythological traditions named and respected (Greek, Norse, "
        "Hindu, Yoruba, Polynesian, Mesoamerican, Egyptian, Chinese, "
        "Japanese, Slavic); the comparative reader's patient interest; "
        "story-as-cultural-self-portrait.",

    "phrase-botany-basics":
        "Plants observed plainly; flowers, leaves, photosynthesis, gardens; "
        "the slow drama of growing things; not anthropomorphic.",

    "phrase-arts-music-fundamentals":
        "Practitioner-aware; instruments, scales, composers, concert halls; "
        "covers everyone from a first-week beginner to a lifetime listener; "
        "musically literate without being academic.",

    "phrase-geology-basics":
        "Stone, time, slowness; mountains, rivers, plate tectonics, the "
        "deep history of the rock under our feet; geologic patience.",

    "phrase-humanities-economics-basics":
        "Practical money + trade + jobs + supply + demand; how value moves "
        "in the actual world; concrete examples over theory; not "
        "ideological.",

    "phrase-humanities-philosophy-basics":
        "Reflective, careful, tradition-aware (Socrates, Plato, Kant, "
        "Wittgenstein, the Stoics, Eastern traditions); ethics + "
        "epistemology + the examined life; the patient questioner.",

    "phrase-learning":
        "Curiosity, practice, the long arc; mentors, childhood teachers, "
        "self-teaching, the grit of learning a new skill; the warm intimacy "
        "of someone telling you how they learned.",

    "phrase-life-camping-basics":
        "The woods, the fire, sleeping outside; gear, weather, knots, the "
        "satisfaction of basic competence; the camp's small economy of "
        "warmth and water.",

    "phrase-life-cooking-basics":
        "The kitchen as both room and craft; ingredients, technique, "
        "tasting, the cook's small daily decisions; meals shared; the "
        "long human conversation with food.",

    "phrase-places-geography-world":
        "Countries, landscapes, cities, climates; the variety of the world "
        "without the tourist gaze; a globalist register that respects the "
        "specificity of each place.",

    "phrase-tech-computers-basics":
        "Practical computing; files, keyboards, browsers, passwords, the "
        "modern digital life; demystifying without dumbing down; light on "
        "jargon.",

    "phrase-travel-essentials":
        "Practical traveler's phrasebook; questions at hotels, airports, "
        "restaurants; survival vocabulary + the curious traveler's small "
        "asides; warm, direct, immediately useful.",

    "phrase-work-office-basics":
        "The 9-to-5; meetings, email, colleagues, deadlines, the rhythm of "
        "the workweek; quietly observed; the long human compromise between "
        "what we are paid to do and what we suspect we were meant to do.",
}
