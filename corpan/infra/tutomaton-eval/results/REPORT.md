# Tutomaton × Qwen3-4B — language support & tuning report

On-device model: **Qwen3-4B Q4_K_M GGUF** via `tauri-plugin-corpan-llm` (llama.cpp, Metal). Eval reproduced the plugin's exact ChatML + sampler chain. Results are specific to THIS model build on this machine.

## Verdict

- **KEEP 50 / 55** languages.
- **DROP 5 / 55**: jv, su, sw, te, pa-Arab.

## New global defaults (apply to every language)

```json
{
  "temperature": 0.3,
  "topP": 0.9,
  "topK": 20,
  "minP": 0.05,
  "repeatPenalty": 1.1,
  "presencePenalty": 0,
  "maxTokens": 700
}
```
Was: `temp 0.6, topP 0.95, topK 20, minP 0, repeatPenalty 1.0, maxTokens 700`. Lowering temperature to 0.3 and adding a light min_p / repeat penalty measurably reduced fabrication and repetition loops (e.g. Marathi flipped drop→keep; Swahili loops shrank) and was neutral-to-positive on strong languages. A single global default beats per-language numeric overrides here — the lever generalises.

## Dropped languages (fundamentally broken at best params)

| code | why |
|------|-----|
| jv (Javanese) | A native speaker recognizes scattered real Javanese, but core teaching vocabulary is fabricated or Indonesian and several sentences don't parse, making it unusable for learning Javanese. |
| su (Sundanese) | Replies are mostly Indonesian/Malay padded with garbled and invented pseudo-Sundanese vocabulary, not real usable Sundanese. |
| sw (Swahili) | Output uses real Swahili words but produces non-parsing word-salad with invented vocabulary, factually wrong lessons taught as fact, and dominating repetition loops even at low temperature. |
| te (Telugu) | Although some replies are genuine Telugu, the output is riddled with invented/nonsense vocabulary taught as fact, mistranslations, and a full repetition loop, so a native speaker would judge much of it as not-real Telugu. |
| pa-Arab (Punjabi (Shahmukhi)) | Recognizable Punjabi function words appear but the content is a Punjabi-Urdu creole riddled with invented vocabulary, wrong numbers, a non-word for "means," and the wrong-tradition Namaste greeting, making it unreliable and largely non-parsing as teaching Shahmukhi Punjabi. |

## Full table

| code | name | decision | binary(low-temp) | strict 1-5 (context) |
|------|------|----------|------------------|----------------------|
| en | English | keep | (not contested) | good 5/5 |
| es | Spanish | keep | (not contested) | good 4/5 |
| fr | French | keep | (not contested) | good 4/5 |
| de | German | keep | (not contested) | weak 3/3 |
| it | Italian | keep | (not contested) | weak 3/4 |
| pt-BR | Portuguese (Brazilian) | keep | (not contested) | good 4/5 |
| pt-PT | Portuguese (European) | keep | (not contested) | weak 3/3 |
| nl | Dutch | keep | (not contested) | weak 3/3 |
| ca | Catalan | keep | keep/high | unsupported 2/2 |
| ro | Romanian | keep | (not contested) | weak 3/3 |
| pl | Polish | keep | (not contested) | weak 3/3 |
| cs | Czech | keep | keep/high | unsupported 2/3 |
| sk | Slovak | keep | keep/high | unsupported 2/3 |
| sl | Slovenian | keep | keep/high | unsupported 2/3 |
| hr | Croatian | keep | keep/high | unsupported 2/2 |
| hu | Hungarian | keep | keep/high | unsupported 2/3 |
| lt | Lithuanian | keep | keep/high | unsupported 2/2 |
| sv | Swedish | keep | (not contested) | weak 3/3 |
| da | Danish | keep | (not contested) | weak 3/4 |
| no | Norwegian | keep | keep/high | unsupported 2/3 |
| fi | Finnish | keep | keep/high | unsupported 2/2 |
| tr | Turkish | keep | keep/high | unsupported 2/2 |
| vi | Vietnamese | keep | (not contested) | good 4/5 |
| id | Indonesian | keep | (not contested) | good 4/5 |
| ms | Malay | keep | (not contested) | weak 3/3 |
| jv | Javanese | DROP | drop/high | unsupported 2/2 |
| su | Sundanese | DROP | drop/high | unsupported 1/1 |
| tl | Tagalog | keep | keep/medium | unsupported 2/2 |
| sw | Swahili | DROP | drop/high | unsupported 1/1 |
| ru | Russian | keep | (not contested) | good 4/5 |
| uk | Ukrainian | keep | (not contested) | weak 3/3 |
| bg | Bulgarian | keep | (not contested) | weak 3/3 |
| sr | Serbian | keep | keep/high | unsupported 1/2 |
| el | Greek | keep | keep/high | unsupported 2/3 |
| zh | Mandarin Chinese | keep | (not contested) | good 5/5 |
| zh-Hans | Chinese (Simplified) | keep | (not contested) | good 4/5 |
| zh-Hant | Chinese (Traditional) | keep | (not contested) | good 4/5 |
| yue-Hant-HK | Cantonese (Traditional) | keep | keep/high | unsupported 2/2 |
| ja | Japanese | keep | keep/medium | weak 3/4 |
| ko-polite | Korean (Polite) | keep | (not contested) | good 4/5 |
| th | Thai | keep | keep/high | weak 3/3 |
| hi | Hindi | keep | (not contested) | weak 3/3 |
| mr | Marathi | keep | keep/high | unsupported 2/2 |
| ne | Nepali | keep | keep/high | unsupported 2/2 |
| bn | Bengali | keep | keep/high | unsupported 2/2 |
| ta | Tamil | keep | keep/high | unsupported 2/2 |
| te | Telugu | DROP | drop/high | unsupported 2/2 |
| gu | Gujarati | keep | keep/high | unsupported 2/2 |
| kn | Kannada | keep | keep/high | unsupported 2/2 |
| pa-Guru | Punjabi (Gurmukhi) | keep | keep/medium | unsupported 1/1 |
| ar | Arabic (Standard) | keep | keep/medium | weak 3/3 |
| fa | Persian | keep | keep/high | unsupported 2/2 |
| ur | Urdu | keep | keep/medium | unsupported 2/2 |
| he | Hebrew | keep | keep/high | unsupported 2/2 |
| pa-Arab | Punjabi (Shahmukhi) | DROP | drop/medium | unsupported 1/1 |

## Method

1. **Triage** (all 55): programmatic gate — script coverage, py3langid, repetition/refusal/template — proves the model can emit the script. Necessary, not sufficient.
2. **Strict fluency judge** (all 55): per-language Claude judge, 1-5. Useful for finding errors but ran ~1 pt harsh and had high variance at the weak/unsupported boundary (it wrongly failed German, Turkish, Finnish…), so NOT the decision source.
3. **Low-temp regen + calibrated BINARY judge** (every contested language): real-language-with-errors = KEEP vs broken/wrong-language/fabrication = DROP. This is the decision.
4. **A/B** confirmed temperature is a real lever (Marathi drop→keep at temp 0.3) while most of the strict-judge 'failures' were calibration, not capability.

Raw generations: `results/rows.jsonl`. Per-language samples: `results/judge_lowtemp/`. Verdicts: `results/judge_verdicts_lowtemp/`.