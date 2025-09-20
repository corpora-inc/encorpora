from typing import List, Dict
from pydantic import BaseModel
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
from cor.utils.prompts import SOURCE_TO_EN_PROMPT


# Pydantic schema for a single SOURCE→EN batch.
class PivotItem(BaseModel):
    idx: int  # the temporary index we provide
    text: str  # the English sentence (one per input)


class PivotBatch(BaseModel):
    items: List[PivotItem]


def translate_source_to_english_batch(
    src_lang_code: str,
    src_lang_name: str,
    sentences: List[str],  # raw source sentences (no ids needed)
    llm=None,
    llm_provider: str = "openai",
) -> List[str]:
    """
    Translate a list of source-language sentences to English (one-to-one, same order).
    - Adds temporary indices internally so the model can align outputs reliably.
    - Relies on get_data_completion schema injection; no JSON-format instructions needed.
    Returns: list of English sentences aligned to `sentences`.
    """
    if not sentences:
        return []

    if llm is None:
        llm = load_llm_provider(llm_provider)

    numbered = [(i, s) for i, s in enumerate(sentences, start=1)]
    payload = "\n".join(f"{i}: {s}" for i, s in numbered)

    sys_msg = ChatCompletionTextMessage(
        role="system",
        text=SOURCE_TO_EN_PROMPT,
    )
    user_msg = ChatCompletionTextMessage(
        role="user",
        text=(
            f"Source language: {src_lang_name} ({src_lang_code}).\n"
            "Translate each numbered sentence into English. "
            "Return exactly one English sentence per input and include the same idx for each item.\n\n"
            f"{payload}"
        ),
    )

    resp: PivotBatch = llm.get_data_completion([sys_msg, user_msg], PivotBatch)

    by_idx: Dict[int, str] = {
        item.idx: (item.text or "").strip() for item in resp.items
    }
    missing = [i for i, _ in numbered if i not in by_idx]
    if missing:
        raise ValueError(f"Missing items in SOURCE→EN batch for idx: {missing}")

    return [by_idx[i] for i, _ in numbered]
