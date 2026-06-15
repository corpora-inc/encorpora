"""Fixed learner-message battery, identical across all languages.

The learner writes in their native language (English here) and the tutor must
reply IN THE TARGET language — exactly the real Tutomaton flow. Single-turn
prompts: each is an independent exchange (no multi-turn needed to measure
stays-in-language + coherence). Kept fixed so configs/langs are comparable.

TRIAGE uses the first `TRIAGE_N`; EN tuning + borderline rescue use the full set.
"""

BATTERY: list[str] = [
    "Hi! Can we start a short lesson?",
    "How do I say \"good morning\"?",
    "Teach me three useful words for ordering food at a restaurant.",
    "I want to practice introducing myself. Can you help me?",
    "What is a simple sentence I can use to ask for directions?",
    "Tell me about a common greeting and when people use it.",
    "Give me a short example conversation between two friends who meet.",
    "How do I say \"thank you\", and how should I reply when someone thanks me?",
    "Let's role-play: I am a customer at a cafe. Please start us off.",
    "What are the numbers one through five?",
]

TRIAGE_N = 6


def triage_battery() -> list[str]:
    return BATTERY[:TRIAGE_N]


def full_battery() -> list[str]:
    return BATTERY
