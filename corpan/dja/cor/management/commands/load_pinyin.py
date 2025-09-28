from django.core.management.base import BaseCommand
from pypinyin import lazy_pinyin, Style

from cor.models import Translation, Language


def to_pinyin(text: str) -> str:
    # Style.TONE will give diacritics (ā á ǎ à).
    # If you want numeric tones instead, use Style.TONE3.
    return " ".join(lazy_pinyin(text, style=Style.TONE))


class Command(BaseCommand):
    help = "Fill Translation.romanization for all zh-Hans rows using pypinyin"

    def handle(self, *args, **options):
        zhs = Language.objects.get(code="zh-Hans")
        zht = Language.objects.get(code="zh-Hant")

        qs = Translation.objects.filter(language=zhs, romanization__exact="")
        total = qs.count()
        self.stdout.write(f"Found {total} zh-Hans translations without pinyin.")

        for t in qs:
            t.romanization = to_pinyin(t.text)
            t.save(update_fields=["romanization"])

            ht: Translation = t.entry.translations.get(language=zht)
            ht.romanization = t.romanization
            ht.save(update_fields=["romanization"])

        self.stdout.write("✅ All zh-Hans rows have been filled with pinyin.")
