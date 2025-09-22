from django.core.management.base import BaseCommand
from django.db import transaction

try:
    from opencc import OpenCC  # pip install opencc-python-reimplemented
except Exception:
    OpenCC = None

from cor.models import Language, Translation


ZH_HANS = "zh-Hans"
ZH_HANT = "zh-Hant"
OPENCC_CONFIG = "s2tw"  # Simplified → Traditional (Taiwan standard)


class Command(BaseCommand):
    help = (
        "Populate/overwrite zh-Hant translations from zh-Hans deterministically using OpenCC.\n"
        f"Mapping: {OPENCC_CONFIG} (Taiwan Traditional). Always overwrites text & romanization."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit", type=int, default=0, help="Process only first N rows (optional)."
        )
        parser.add_argument(
            "--chunk-size", type=int, default=1000, help="DB iterator chunk size."
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            default=False,
            help="Print per-row actions.",
        )
        parser.add_argument(
            "--opencc-config",
            type=str,
            default=OPENCC_CONFIG,
            help="OpenCC config (e.g., s2tw, s2t, s2hk). Default s2tw.",
        )

    def handle(self, *args, **opts):
        if OpenCC is None:
            raise RuntimeError(
                "OpenCC not available. Add 'opencc-python-reimplemented' to requirements.txt and reinstall."
            )

        ocfg = opts["opencc_config"]
        cc = OpenCC(ocfg)
        limit = opts["limit"]
        chunk_size = opts["chunk_size"]
        verbose = opts["verbose"]

        # Ensure languages exist (lean: create if missing)
        zh_hans, _ = Language.objects.get_or_create(
            code=ZH_HANS, defaults={"name": "Chinese (Simplified)"}
        )
        zh_hant, _ = Language.objects.get_or_create(
            code=ZH_HANT, defaults={"name": "Chinese (Traditional)"}
        )

        qs = Translation.objects.filter(language=zh_hans).order_by("id")
        total_src = qs.count()
        if limit:
            qs = qs[:limit]

        self.stdout.write(
            f"Converting {qs.count()} of {total_src} translations: {ZH_HANS} → {ZH_HANT} [{ocfg}]"
        )

        created = updated = unchanged = 0

        # Always overwrite deterministically.
        with transaction.atomic():
            for tr in qs.iterator(chunk_size=chunk_size):
                src_text = tr.text or ""
                conv = cc.convert(src_text)
                src_rom = tr.romanization or ""

                tgt, created_flag = Translation.objects.get_or_create(
                    entry=tr.entry,
                    language=zh_hant,
                    defaults={"text": conv, "romanization": src_rom},
                )

                if created_flag:
                    created += 1
                    if verbose:
                        self.stdout.write(f"[create] entry={tr.entry_id}")
                    continue

                # Overwrite if any field differs
                to_update = []
                if tgt.text != conv:
                    tgt.text = conv
                    to_update.append("text")
                if (tgt.romanization or "") != src_rom:
                    tgt.romanization = src_rom
                    to_update.append("romanization")

                if to_update:
                    tgt.save(update_fields=to_update)
                    updated += 1
                    if verbose:
                        self.stdout.write(
                            f"[update] entry={tr.entry_id} -> {', '.join(to_update)}"
                        )
                else:
                    unchanged += 1

        self.stdout.write(
            f"Done. created={created} updated={updated} unchanged={unchanged}."
        )
