"""System-prompt loading + the exact ChatML wrapper the plugin uses.

`format_chatml` is a byte-for-byte port of `format_chatml` in
plugins/tauri-plugin-corpan-llm/src/state.rs:807-818. The plugin prepends the
system message itself, then wraps each message and opens the assistant turn.
Qwen3 has add_bos_token=false, so no BOS is added (verified with llama-tokenize)
— the raw /completion endpoint with this string matches the plugin's tokens.
"""

from __future__ import annotations

import os

from langs import Lang

PACK = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "packs", "tutomaton")
)
LANG_DIR = os.path.join(PACK, "languages")


def format_chatml(messages: list[dict]) -> str:
    """messages: [{"role","content"}, ...]  (system already included by caller).

    With TUTO_EVAL_NOTHINK=1 we seed the empty `<think></think>` prefill exactly
    as the plugin does for hybrid models (state.rs format_chatml no_think), so the
    eval scores the small Qwen3 tiers in their real non-thinking shipping config.
    """
    s = ""
    for m in messages:
        s += "<|im_start|>" + m["role"] + "\n" + m["content"] + "<|im_end|>\n"
    s += "<|im_start|>assistant\n"
    if os.environ.get("TUTO_EVAL_NOTHINK") == "1":
        s += "<think>\n\n</think>\n\n"
    return s


def english_template_prompt(lang: Lang) -> str:
    """The current gen_prompts.py template (English instruction)."""
    return (
        f"You are a friendly {lang.name} tutor and conversation partner. "
        f"Always reply in {lang.native} and teach through simple, natural "
        f"conversation.\n"
    )


def pack_system_prompt(lang: Lang) -> str:
    """The system prompt the pack actually ships for this lang (file on disk),
    falling back to the English template if no file exists yet."""
    path = os.path.join(LANG_DIR, lang.code, "prompts", "system_prompt.txt")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    return english_template_prompt(lang).strip()


def system_content(lang: Lang, prompt: str, native_language: str = "English") -> str:
    """Compose the system message the way chat.ts defaultPromptFor does:
    the tutor prompt + the learner's native-language line."""
    parts = [prompt.strip()]
    if native_language:
        parts.append(f"Learner's native language: {native_language}.")
    return "\n".join(p for p in parts if p)


def build_prompt(lang: Lang, system_prompt: str, user: str,
                 native_language: str = "English") -> str:
    """Full ChatML string for a single-turn exchange."""
    sys = system_content(lang, system_prompt, native_language)
    return format_chatml(
        [{"role": "system", "content": sys}, {"role": "user", "content": user}]
    )
