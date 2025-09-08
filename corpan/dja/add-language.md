# Add a Language to Corpán

Using Polish as an example.

## Ensure the Language Exists in the Database

```
./manage.py ensure_language pl Polish
```

## Add System Message to the LLM Utility

in `prompt_native` in `corpan/dja/cor/utils/llm.py`, add a system message for Polish:

```python
        "pl": (
            "Jesteś profesjonalnym tłumaczem z angielskiego na polski, "
            "specjalizującym się w tłumaczeniach dla uczących się języka. "
            "Przetłumacz każde zdanie w sposób naturalny, grzeczny i zrozumiały, "
            "zachowując sens oryginału, ale dbając, aby tłumaczenie brzmiało całkowicie naturalnie. "
            "Unikaj tłumaczeń zbyt dosłownych lub zbyt kreatywnych. "
            "Zwróć wyłącznie listę JSON przetłumaczonych zdań."
        ),
```

## Quality check translation in dry-run and choose models

```sh
./manage.py translate_missing --provider local --lang pl --random --dry-run --limit 20
```

Trying differen models, different providers. In this case, we found the XAI was the best. Actually, Gemma3 might have been the king; but, we don't have the hardware to run it fast enough.

So, we are going to kick off the translation process with the XAI provider.

## Kick off the Translation Process

```sh
./manage.py translate_missing --provider xai --lang pl --random
```

You can run this in parallel up to the point of getting rate limited or running out of money `:)`.

## Now, the frontend

Add the translation of the language itself and the translations for the language:

```
corpan/corpan-app/src/store/translations.ts
```

Add the code to the settings (TODO: could query the DB and not need this list?):

```
corpan/corpan-app/src/store/settings.ts
```

And then similarly `LANGUAGE_NAMES` (TODO: ?):

```
corpan/corpan-app/src/store/constants.ts
```

BOOM! You're done. Go check it out on the frontend and see if it is amazing!
