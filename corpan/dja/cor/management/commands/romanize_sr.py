from django.core.management.base import BaseCommand

from cor.models import Language, Translation


SR_CYR_TO_LAT_SIMPLE = {
    "А": "A", "а": "a",
    "Б": "B", "б": "b",
    "В": "V", "в": "v",
    "Г": "G", "г": "g",
    "Д": "D", "д": "d",
    "Ђ": "Đ", "ђ": "đ",
    "Е": "E", "е": "e",
    "Ж": "Ž", "ж": "ž",
    "З": "Z", "з": "z",
    "И": "I", "и": "i",
    "Ј": "J", "ј": "j",
    "К": "K", "к": "k",
    "Л": "L", "л": "l",
    "М": "M", "м": "m",
    "Н": "N", "н": "n",
    "О": "O", "о": "o",
    "П": "P", "п": "p",
    "Р": "R", "р": "r",
    "С": "S", "с": "s",
    "Т": "T", "т": "t",
    "Ћ": "Ć", "ћ": "ć",
    "У": "U", "у": "u",
    "Ф": "F", "ф": "f",
    "Х": "H", "х": "h",
    "Ц": "C", "ц": "c",
    "Ч": "Č", "ч": "č",
    "Ш": "Š", "ш": "š",
}

# Digraphs need context: title case (next char lowercase) -> "Lj", all-caps -> "LJ".
SR_DIGRAPH_LOWER = {"љ": "lj", "њ": "nj", "џ": "dž"}
SR_DIGRAPH_UPPER_KEYS = {"Љ": ("Lj", "LJ"), "Њ": ("Nj", "NJ"), "Џ": ("Dž", "DŽ")}


def transliterate_sr(text: str) -> str:
    out = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch in SR_DIGRAPH_LOWER:
            out.append(SR_DIGRAPH_LOWER[ch])
        elif ch in SR_DIGRAPH_UPPER_KEYS:
            title, upper = SR_DIGRAPH_UPPER_KEYS[ch]
            # Look at the next non-space char. If it's also uppercase Cyrillic, treat as all-caps run.
            nxt = text[i + 1] if i + 1 < n else ""
            if nxt and nxt.isupper() and nxt in SR_CYR_TO_LAT_SIMPLE:
                out.append(upper)
            else:
                out.append(title)
        elif ch in SR_CYR_TO_LAT_SIMPLE:
            out.append(SR_CYR_TO_LAT_SIMPLE[ch])
        else:
            out.append(ch)
        i += 1
    return "".join(out)


class Command(BaseCommand):
    help = "Overwrite Translation.romanization for all Serbian (sr) rows using deterministic Cyrillic→Latinica (Gajica) mapping."

    def add_arguments(self, parser):
        parser.add_argument("--only-missing", action="store_true",
                            help="Only fill rows where romanization is empty.")

    def handle(self, *args, **opts):
        sr = Language.objects.get(code="sr")
        qs = Translation.objects.filter(language=sr)
        if opts["only_missing"]:
            qs = qs.filter(romanization__in=[None, ""])
        total = qs.count()
        print(f"Serbian translations to romanize: {total}")

        n = 0
        for t in qs.iterator(chunk_size=500):
            t.romanization = transliterate_sr(t.text)
            t.save(update_fields=["romanization"])
            n += 1
            if n % 1000 == 0:
                print(f"  ... {n}/{total}")

        print(f"Done. {n} Serbian rows romanized to Latinica.")
