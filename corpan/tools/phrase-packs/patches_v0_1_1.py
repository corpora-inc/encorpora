"""
Patches for v0.1.1 across all 24 phrase packs.

Goal: every pack has at least one phrase at every CEFR level
(A0, A1, A2, B1, B2, C1, C2). For packs that already cover A1..C2
this is just an A0 "easter egg." For older sparse packs it's a
short ladder-completion pass.

A0 = a single very short, on-topic sentence (3-6 words, present tense,
common verbs, no idiom). Belt-and-suspenders, not gimmick.

Each value is a list of {english, level} dicts appended to the existing
phrases.json. The new indices are simply len(existing)..len(existing)+N.
"""

PATCHES = {
    # ---------- 12 NEW PACKS (need A0 only) ----------
    "phrase-sciences-astronomy-night-sky": [
        {"english": "Look at the moon.", "level": "A0"},
    ],
    "phrase-nature-birds-everyday": [
        {"english": "I see a bird.", "level": "A0"},
    ],
    "phrase-nature-the-ocean": [
        {"english": "The sea is big.", "level": "A0"},
    ],
    "phrase-sports-soccer-basics": [
        {"english": "I love this game.", "level": "A0"},
    ],
    "phrase-sports-martial-arts": [
        {"english": "I want to learn.", "level": "A0"},
    ],
    "phrase-life-health-and-body": [
        {"english": "I am tired.", "level": "A0"},
    ],
    "phrase-life-family-and-friends": [
        {"english": "I love my mom.", "level": "A0"},
    ],
    "phrase-vehicles-cars-and-driving": [
        {"english": "I drive a car.", "level": "A0"},
    ],
    "phrase-arts-cinema-and-film": [
        {"english": "Let's see a movie.", "level": "A0"},
    ],
    "phrase-life-festivals-world": [
        {"english": "Today is a holiday.", "level": "A0"},
    ],
    "phrase-life-the-night": [
        {"english": "It is late.", "level": "A0"},
    ],
    "phrase-humanities-mythology-world": [
        {"english": "I like old stories.", "level": "A0"},
    ],

    # ---------- 12 OLDER PACKS (varying gaps) ----------
    "phrase-botany-basics": [
        {"english": "I like flowers.", "level": "A0"},
        {"english": "A garden is a small experiment in patience, a long correspondence between a gardener and the slow opinions of the soil.", "level": "C2"},
    ],
    "phrase-arts-music-fundamentals": [
        {"english": "I love music.", "level": "A0"},
        {"english": "Music is the public form of an inner argument the species has been having with itself since long before it had words for the argument.", "level": "C2"},
    ],
    "phrase-geology-basics": [
        {"english": "There is a rock.", "level": "A0"},
        {"english": "A continent is a slow argument the planet has been having with itself for several billion years, in a vocabulary of pressure, heat, and the patient rearrangement of stone.", "level": "C2"},
    ],
    "phrase-humanities-economics-basics": [
        {"english": "I have a job.", "level": "A0"},
        {"english": "Money is useful.", "level": "A1"},
        {"english": "An economy is the long, mostly invisible conversation a society has with itself about what its people most want, most fear, and are most willing to trade for one another.", "level": "C2"},
    ],
    "phrase-humanities-philosophy-basics": [
        {"english": "I think a lot.", "level": "A0"},
        {"english": "I have a question.", "level": "A1"},
        {"english": "A good question takes time to answer.", "level": "A2"},
        {"english": "Philosophy is the long, patient practice of asking the questions a culture has agreed to stop noticing, and of refusing the first easy answer until a more honest one becomes available.", "level": "C2"},
    ],
    "phrase-learning": [
        {"english": "I want to learn.", "level": "A0"},
        {"english": "To learn well is to remain a student of one's own attention, and to forgive the mind its long, uneven pilgrimage from confusion to clarity to deeper confusion of a finer grain.", "level": "C2"},
    ],
    "phrase-life-camping-basics": [
        {"english": "I love the woods.", "level": "A0"},
        {"english": "The fire is warm.", "level": "A1"},
        {"english": "A night in the woods returns the body to a rhythm the city has spent a century quietly persuading it to forget; the stars are unchanged and only our attention has narrowed.", "level": "C2"},
    ],
    "phrase-life-cooking-basics": [
        {"english": "I like food.", "level": "A0"},
        {"english": "A kitchen is a long, generous conversation between a cook and the ingredients on the counter, and the meal is the polite agreement they finally reach about how to feed the people in the next room.", "level": "C2"},
    ],
    "phrase-places-geography-world": [
        {"english": "Where is it?", "level": "A0"},
        {"english": "I am from here.", "level": "A1"},
        {"english": "Geography is the slow, patient study of how the shape of the land has quietly negotiated, over centuries, with the people who agreed to call it home, and how each has rewritten the other in the bargain.", "level": "C2"},
    ],
    "phrase-tech-computers-basics": [
        {"english": "I use a computer.", "level": "A0"},
        {"english": "The screen is on.", "level": "A1"},
        {"english": "A great engineer keeps a small library of mistakes carefully labeled by year.", "level": "C1"},
        {"english": "A computer is a stack of polite agreements between physics, mathematics, and human impatience, held together by the small daily faith that the next layer will keep its promises to the one above it.", "level": "C2"},
    ],
    "phrase-travel-essentials": [
        {"english": "I want to go.", "level": "A0"},
        {"english": "A long flight returns you to yourself in a slightly different country.", "level": "C1"},
        {"english": "Travel is the rare practice in which the body is asked, with money and inconvenience, to confess what it already half-knew: that the place we live is only one of the many possible answers to the question of how to be a person.", "level": "C2"},
    ],
    "phrase-work-office-basics": [
        {"english": "I work all day.", "level": "A0"},
        {"english": "An office is the small daily theater in which a culture rehearses its most cherished disagreements about time, attention, hierarchy, and the long compromise between what we are paid to do and what we suspect we were meant to do instead.", "level": "C2"},
    ],
}


if __name__ == "__main__":
    import sys
    from collections import Counter
    total_packs = len(PATCHES)
    total_phrases = sum(len(v) for v in PATCHES.values())
    levels = Counter(p["level"] for plist in PATCHES.values() for p in plist)
    print(f"packs: {total_packs}, phrases: {total_phrases}")
    print(f"by level: {dict(sorted(levels.items()))}")
