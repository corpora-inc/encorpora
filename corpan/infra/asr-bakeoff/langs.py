"""Corpán language set ⇄ FLEURS config map for the Phase-0 ASR bake-off.

Our app speaks 54 languages / 55 written scripts (the authoritative list is
the coverage matrix in corpan/docs/STT_MASTERPLAN.md §6). FLEURS
(google/fleurs, CC-BY) is the eval corpus: 102 langs, a 350-sentence `test`
split each, loadable per-language with
`load_dataset("google/fleurs", "<config>", split="test")`.

Each row below ties one of OUR codes to:
  - `fleurs`: the FLEURS config id (or None when FLEURS has no matching
    language — then this code falls back to a curated Common Voice / public
    clip set, or is keyboard-floor-only).
  - `script`: how we score it. "spaced" → WER (word-level). "cjk"/"thai" →
    CER (character-level), because these scripts don't delimit words with
    spaces and WER is meaningless. "rtl" still scores as WER (Arabic/Hebrew
    ARE space-delimited; RTL is a rendering property, not a tokenization one).
  - `bakeoff`: which engines we actually RUN for this language (so we don't
    waste compute asking Parakeet for Hindi — it only does 25 EU langs).
    The router's real recommendation per language is a SEPARATE table the
    masterplan §6 owns; this is just "who competes here."

This file is the single source of truth for the harness; adding a language =
one row. CER vs WER is decided HERE, never inside an engine adapter.
"""

from dataclasses import dataclass, field


# Engine ids — must match the `--engines` CLI flag and the adapter registry.
WHISPER = "whisper"   # whisper large-v3 (q5 on device; faster-whisper proxy on desktop)
QWEN3 = "qwen3"       # Qwen3-ASR-0.6B (the north-star candidate)
PARAKEET = "parakeet" # NVIDIA Parakeet-TDT-0.6b-v3 via sherpa-onnx (25 EU, NAR)
SENSEVOICE = "sensevoice"  # SenseVoice-Small via sherpa-onnx (CJK/yue, NAR; license-gated)

ALL_ENGINES = [WHISPER, QWEN3, PARAKEET, SENSEVOICE]

# The 25 European languages Parakeet-TDT-0.6b-v3 covers (NVIDIA card). Used to
# auto-include PARAKEET in a language's bakeoff set. Our codes intersected
# with that list.
PARAKEET_LANGS = {
    "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hr", "hu",
    "it", "lt", "lv", "mt", "nl", "pl", "pt-BR", "pt-PT", "ro", "ru", "sk",
    "sl", "sv", "uk",
}

# SenseVoice-Small's transcription languages (zh/yue/en/ja/ko) — the CJK star.
SENSEVOICE_LANGS = {"zh-Hans", "zh-Hant", "yue-Hant-HK", "en", "ja", "ko-polite"}


@dataclass(frozen=True)
class Lang:
    code: str            # our code
    name: str
    fleurs: str | None   # FLEURS config id, or None
    script: str = "spaced"  # "spaced" | "cjk" | "thai" | "rtl"

    def engines(self) -> list[str]:
        """Which engines compete for this language in the bake-off.

        Whisper + Qwen3 are the broad generalists → always run (when we have
        audio). Parakeet/SenseVoice are added only where they claim the
        language, since running a NAR model on a language it can't do just
        produces garbage and burns time.
        """
        out = [QWEN3, WHISPER]
        if self.code in PARAKEET_LANGS:
            out.append(PARAKEET)
        if self.code in SENSEVOICE_LANGS:
            out.append(SENSEVOICE)
        return out


# Full set, ordered to roughly mirror the masterplan §6 table. `fleurs=None`
# flags a coverage gap we must fill from another corpus (or accept as
# keyboard-floor-only in the report).
LANGS: list[Lang] = [
    # --- Tier-1 European (native-rich, but we still measure downloadable) ---
    Lang("en", "English", "en_us"),
    Lang("es", "Spanish", "es_419"),
    Lang("fr", "French", "fr_fr"),
    Lang("de", "German", "de_de"),
    Lang("it", "Italian", "it_it"),
    Lang("pt-BR", "Portuguese (BR)", "pt_br"),
    Lang("pt-PT", "Portuguese (PT)", "pt_br"),   # FLEURS has only pt_br
    Lang("nl", "Dutch", "nl_nl"),
    Lang("ru", "Russian", "ru_ru"),
    Lang("sv", "Swedish", "sv_se"),
    Lang("da", "Danish", "da_dk"),
    Lang("no", "Norwegian", "nb_no"),
    Lang("fi", "Finnish", "fi_fi"),
    Lang("tr", "Turkish", "tr_tr"),
    # --- European tail (Apple-skipped → Parakeet's home turf) ---
    Lang("uk", "Ukrainian", "uk_ua"),
    Lang("pl", "Polish", "pl_pl"),
    Lang("cs", "Czech", "cs_cz"),
    Lang("sk", "Slovak", "sk_sk"),
    Lang("sl", "Slovenian", "sl_si"),
    Lang("hr", "Croatian", "hr_hr"),
    Lang("sr", "Serbian", "sr_rs"),
    Lang("bg", "Bulgarian", "bg_bg"),
    Lang("ro", "Romanian", "ro_ro"),
    Lang("hu", "Hungarian", "hu_hu"),
    Lang("el", "Greek", "el_gr"),
    Lang("ca", "Catalan", "ca_es"),
    Lang("lt", "Lithuanian", "lt_lt"),
    # --- RTL ---
    Lang("he", "Hebrew", "he_il", script="rtl"),
    Lang("ar", "Arabic", "ar_eg", script="rtl"),
    Lang("fa", "Persian", "fa_ir", script="rtl"),
    Lang("ur", "Urdu", "ur_pk", script="rtl"),
    Lang("pa-Arab", "Punjabi (Shahmukhi)", None, script="rtl"),  # no corpus ships it
    # --- Indic ---
    Lang("hi", "Hindi", "hi_in"),
    Lang("bn", "Bengali", "bn_in"),
    Lang("ta", "Tamil", "ta_in"),
    Lang("te", "Telugu", "te_in"),
    Lang("kn", "Kannada", "kn_in"),
    Lang("mr", "Marathi", "mr_in"),
    Lang("gu", "Gujarati", "gu_in"),
    Lang("pa-Guru", "Punjabi (Gurmukhi)", "pa_in"),
    Lang("ne", "Nepali", "ne_np"),
    # --- CJK + non-spaced (CER) ---
    Lang("ja", "Japanese", "ja_jp", script="cjk"),
    Lang("ko-polite", "Korean", "ko_kr", script="cjk"),
    Lang("zh-Hans", "Chinese (Simp.)", "cmn_hans_cn", script="cjk"),
    Lang("zh-Hant", "Chinese (Trad.)", "cmn_hans_cn", script="cjk"),  # FLEURS only has cmn_hans
    Lang("yue-Hant-HK", "Cantonese", "yue_hant_hk", script="cjk"),
    Lang("th", "Thai", "th_th", script="thai"),
    # --- SEA / other ---
    Lang("vi", "Vietnamese", "vi_vn"),
    Lang("id", "Indonesian", "id_id"),
    Lang("jv", "Javanese", "jv_id"),
    Lang("su", "Sundanese", "su_id"),
    Lang("ms", "Malay", "ms_my"),
    Lang("tl", "Tagalog", "fil_ph"),
    Lang("sw", "Swahili", "sw_ke"),
]


def by_code(code: str) -> Lang | None:
    for lang in LANGS:
        if lang.code == code:
            return lang
    return None


def with_corpus() -> list[Lang]:
    """Languages we can actually score this run (FLEURS config present)."""
    return [lang for lang in LANGS if lang.fleurs is not None]


def coverage_gaps() -> list[Lang]:
    """Languages with no FLEURS config — keyboard-floor or other-corpus only."""
    return [lang for lang in LANGS if lang.fleurs is None]
