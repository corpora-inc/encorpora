# Maria Chat Pack

Maria Chat is a minimal Corpán pack that demonstrates the pack/host split for on-device GGUF inference.
The runtime lives in the Corpán core app; this pack contributes model assets + UI.

Design note for future agents:
The UI bar is "better than Apple": minimal surfaces, icon-first controls, and no jargon-heavy chrome.

1. Pack-provided model assets (`model/*.gguf`)
2. Host API mediation (`getPackLlmConfig`, `startLocalLlmStream`, `cancelLocalLlmStream`)
3. Streaming output in the pack UI
4. Pack-side Spanish voice picker via host TTS APIs (`listTtsVoices`, `speakWithVoice`)

## Import model assets

```bash
cd packs/maria-chat
npm run import:assets -- --source ~/corpan-model-packs/maria-qwen25-1p5b-v1
```

Use `--variants q4_k_m` (or include `q5_k_m`,`q8_0`,`f16` when explicitly testing alternates) to control shipped variants.
Use `--copy` to duplicate files instead of link/clone behavior.
The import script updates `manifest.json` `llm.models` and `defaultModel` to match selected files.

## Build

```bash
npm install
npm run build
npm run package:zip
```

## Dev watch + static server

```bash
npm run dev:corpan
```

This serves packs on `http://localhost:8989` and updates `manifest.json` revision for hot reload in Corpán.
