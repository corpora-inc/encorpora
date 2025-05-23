import random
from multiprocessing import Pool, cpu_count
from typing import Set, Tuple

from django.core.management.base import BaseCommand

from cor.models import Entry, Language, Translation
from cor.utils.llm import get_english_sentences, translate_entry_batch
from cor.utils.io import load_wordlist


def get_existing_translation_pairs() -> Set[Tuple[int, str]]:
    """Returns a set of (entry_id, language_code) for already translated entries."""
    return set(Translation.objects.values_list("entry_id", "language__code"))


def generate_for_word(
    word: str,
    level: str,
    langs: list[str],
    existing_pairs: Set[Tuple[int, str]],
    stdout,
) -> None:
    stdout.write(f"\n🔤 Generating entries for word: '{word}' (Level: {level})")

    # Create or retrieve the root word entry
    word_entry, _ = Entry.objects.get_or_create(en_text=word, defaults={"level": level})

    # Generate new English sentence entries (includes saving)
    sentence_entries = get_english_sentences(word, 25)
    stdout.write(f" → Generated {len(sentence_entries)} sentence entries.")

    all_entries = [word_entry] + sentence_entries

    # Determine which entries need translation
    batch: list[Tuple[int, str, str]] = []
    for lang_code in langs:
        for entry in all_entries:
            if (entry.id, lang_code) not in existing_pairs:
                batch.append((entry.id, entry.en_text, lang_code))

    grouped: dict[str, list[Tuple[int, str]]] = {}
    for entry_id, text, lang in batch:
        grouped.setdefault(lang, []).append((entry_id, text))

    if grouped:
        stdout.write(
            f" 🌐 Translating into {len(grouped)} language(s): {', '.join(grouped)}"
        )
    else:
        stdout.write(" ✅ All translations already exist. Skipping translation.")

    with Pool(min(cpu_count(), len(grouped))) as pool:
        pool.starmap(translate_entry_batch, grouped.items())


LEVELS = ["A1"]
# , "A2", "B1"]  # CEFR levels to be used for filtering


class Command(BaseCommand):
    help = "Generate corpus entries and translations from a list of words."

    def add_arguments(self, parser):
        parser.add_argument("--wordlist", type=str, default="data/oxford-5k.csv")

    def handle(self, *args, **options):
        wordlist_path = options["wordlist"]
        words = load_wordlist(wordlist_path)  # List[Tuple[str, str]] -> (level, word)
        random.shuffle(words)

        self.stdout.write(f"📄 Loaded {len(words)} words from {wordlist_path}\n")

        langs = list(Language.objects.values_list("code", flat=True))
        self.stdout.write(f"🌍 Target languages: {', '.join(langs)}\n")

        existing_pairs = get_existing_translation_pairs()

        for word, level in words:
            if level.upper() not in LEVELS:
                self.stdout.write(f"⚠️ Skipping word '{word}' (Level: {level})")
                continue
            try:
                generate_for_word(word, level, langs, existing_pairs, self.stdout)
            except Exception as e:
                self.stderr.write(f"[ERROR] Word '{word}': {e}")

        self.stdout.write("\n🎉 Done! All entries processed.")
