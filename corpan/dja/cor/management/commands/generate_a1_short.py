import random
import time

from django.core.management.base import BaseCommand
from cor.models import Entry, Language, Translation
from cor.utils.io import load_wordlist
from cor.utils.llm import translate_entry_batch  # Use your existing logic!
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
from pydantic import BaseModel
from typing import List


# llm = load_llm_provider("local", completion_model="qwen2.5-7b-instruct-mlx")
llm = load_llm_provider("xai", completion_model="grok-3-mini-fast")


class SentenceList(BaseModel):
    sentences: List[str]


def generate_a1_sentences(word: str, llm) -> List[str]:
    system = ChatCompletionTextMessage(
        role="system",
        text=(
            "You are a CEFR A1 English sentence generator. "
            "Given a single word, generate exactly 5 simple, natural, "
            "useful English sentences. Return complete, natural sentences, as would be heard in a real conversation. "
            "Be creative and return different types of sentences. "
            "Use 5 words or fewer in each sentence (utterance). "
            "Only output a JSON list of 5 sentences using the given word."
        ),
    )
    user = ChatCompletionTextMessage(
        role="user",
        text=f"Generate 5 CEFR A1 sentences containing the word: \n\n```\n{word}\n```\n\n",
    )
    result = llm.get_data_completion([system, user], SentenceList)
    return result.sentences


class Command(BaseCommand):
    help = "Generate A1 sentences for Oxford 3000 A1 words and use translate_entry_batch for batch translation."

    def add_arguments(self, parser):
        parser.add_argument("--wordlist", type=str, default="data/oxford-5k.csv")
        parser.add_argument("--dry-run", action="store_true", default=False)
        parser.add_argument("--limit", type=int, default=0)

    def handle(self, *args, **options):
        wordlist_path = options["wordlist"]
        dry_run = options["dry_run"]
        limit = options["limit"]

        words = load_wordlist(wordlist_path)
        a1_words = [word for word, level in words if level.upper() == "A1"]
        random.shuffle(a1_words)
        if limit:
            a1_words = a1_words[:limit]

        langs: List[str] = list(Language.objects.values_list("code", flat=True))
        self.stdout.write(f"Loaded {len(a1_words)} A1 words from {wordlist_path}")
        self.stdout.write(f"Target languages: {', '.join(langs)}")

        start_time = time.time()
        total_sent = total_trans = 0

        for i, word in enumerate(a1_words, 1):
            self.stdout.write(f"\n[{i}/{len(a1_words)}] '{word}'")
            sentences = generate_a1_sentences(word, llm)
            for sent in sentences:
                self.stdout.write(f"  S: {sent}")

            # Save or skip word+sentences
            word_entry = None
            if not dry_run:
                word_entry, _ = Entry.objects.get_or_create(
                    en_text=word, defaults={"level": "A1"}
                )
                for sent in sentences:
                    Entry.objects.get_or_create(en_text=sent, defaults={"level": "A1"})

            # Use your central translation batcher!
            for lang in langs:
                if lang == "en":
                    if not dry_run:
                        Translation.objects.get_or_create(
                            entry=word_entry,
                            language=Language.objects.get(code=lang),
                            defaults={"translated_text": word_entry.en_text},
                        )
                    continue
                self.stdout.write(f"  Translating to {lang}...")
                # translate_entry_batch(lang_code: str, entries: list[Tuple[int, str]])
                batch = []
                for sent in sentences:
                    if not dry_run:
                        entry = Entry.objects.get(en_text=sent)
                        batch.append((entry.id, sent))
                    else:
                        batch.append((random.randint(1, 10000), sent))

                tresp = translate_entry_batch(
                    lang,
                    batch,
                    dry_run=dry_run,
                    llm=llm,
                )
                self.stdout.write(
                    f"     {lang}:\n"
                    f"        {[t.translated_text for t in tresp.translations]}"
                )
                total_trans += len(tresp.translations)
            total_sent += len(sentences)

        elapsed = time.time() - start_time
        self.stdout.write(
            f"\nDone. {len(a1_words)} words, {total_sent} sentences, {total_trans} translations in {elapsed:.2f}s"
        )
