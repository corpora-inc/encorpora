# LLM Integration - Quick Start Guide

## What You Have Now

A working proof-of-concept for on-device LLM inference in Corpan:

- ✅ **Rust backend** with Candle (Hugging Face's ML framework)
- ✅ **GGUF model support** (quantized models, 300MB-2GB)
- ✅ **TypeScript API** for loading models and generating text
- ✅ **Test UI** to try it out
- ✅ **Pack support** (models can be bundled in content packs via `pack://` URLs)

## Try It Out (2 minutes)

### 1. Download a Test Model

```bash
cd corpan-app
./download_test_model.sh
```

This downloads a tiny 300MB model to `~/corpan-models/`

### 2. Start the App in Tauri

```bash
npm run tauri dev
```

The LLM test UI will load automatically! (In dev mode, Tauri defaults to showing the test interface)

To see the normal app instead, use: **http://localhost:1420/?llmtest=false**

### 3. Load and Test

1. The path will be shown after downloading: `~/corpan-models/qwen2.5-0.5b-instruct-q4_k_m.gguf`
2. Paste it in the "Model Path" field
3. Click "Load Model" (takes 5-10 seconds)
4. Enter a prompt: "Tell me a short joke"
5. Click "Generate"

First generation takes ~10-30 seconds. After that it's faster (10-20 tokens/sec).

## Code Examples

### Loading a Model

```typescript
import { loadModel, generateText } from "@/util/llm";

// Load from filesystem
await loadModel("/path/to/model.gguf", "my-model");

// Or from a pack
await loadModel("pack://spanish-tutor/models/tutor.gguf", "tutor");
```

### Generating Text

```typescript
const response = await generateText("my-model", {
  prompt: "Hello! How are you?",
  max_tokens: 256,
  temperature: 0.7,
  top_p: 0.9,
});

console.log(response); // "I'm doing well, thank you for asking!..."
```

### Building a Conversational Pack

```typescript
// In your pack's index.tsx
import { registerGame } from '@corpan/sdk';

registerGame({
  async onMount({ hostApi, container }) {
    // Load personality model
    await hostApi.llm.loadModel(
      'pack://my-pack/models/personality.gguf',
      'personality'
    );

    // Generate response
    const response = await hostApi.llm.generateText('personality', {
      prompt: buildPrompt(history, userMessage),
      max_tokens: 150,
    });

    // Speak it out loud
    await hostApi.speak({ text: response, language: 'es' });
  },

  async onUnmount({ hostApi }) {
    await hostApi.llm.unloadModel('personality');
  }
});
```

## What's Next?

See [LLM_POC.md](./LLM_POC.md) for:
- Complete API reference
- Performance targets
- How to create conversational packs
- Roadmap (streaming, STT, voice cloning)
- Troubleshooting

## File Structure

```
corpan-app/
├── src-tauri/src/
│   ├── llm.rs              # Rust LLM inference module
│   └── lib.rs              # Added llm commands
├── src/
│   ├── util/llm.ts         # TypeScript API
│   ├── components/
│   │   └── LlmTest.tsx     # Test UI
│   └── App.tsx             # Added ?llmtest=true route
└── download_test_model.sh  # Helper to download test model
```

## Model Requirements

Models must be:
- **Format**: GGUF (quantized)
- **Tokenizer**: `tokenizer.json` in same directory as model
- **Size**: 300MB-2GB (for mobile)
- **Architecture**: Llama, Qwen, Phi, Gemma (supported by Candle)

## Performance

On a modern laptop/iPhone 12+:
- **Load time**: 5-30 seconds (one-time)
- **First token**: 1-3 seconds
- **Speed**: 10-30 tokens/second
- **Memory**: Model size + 200MB

## Tauri Commands Added

| Command | Description |
|---------|-------------|
| `llm_load_model` | Load a GGUF model into memory |
| `llm_unload_model` | Unload a model from memory |
| `llm_generate` | Generate text with a loaded model |

## Dependencies Added

### Rust (Cargo.toml)
```toml
candle-core = "0.8.0"
candle-nn = "0.8.0"
candle-transformers = "0.8.0"
hf-hub = "0.3"
tokenizers = "0.21"
tokio = { version = "1", features = ["full"] }
tokio-stream = "0.1"
```

### TypeScript
- None! Uses existing Tauri bindings

## Troubleshooting

**Model won't load?**
- Make sure `tokenizer.json` is in the same directory
- Check the path is correct (use absolute paths)
- Verify it's a GGUF file (not safetensors or .bin)

**Generation is slow?**
- First generation is always slow (loading)
- Try a smaller model (0.5B instead of 1B)
- This is CPU inference - GPU support coming later

**Out of memory?**
- Use a more quantized model (Q4 instead of Q8)
- Close other applications
- Try a smaller model

## Next Steps to Production

1. **Streaming**: Add token-by-token streaming for better UX
2. **Speech-to-Text**: Integrate Whisper for voice input
3. **Voice Models**: Add Piper TTS for personality voices
4. **Pack System**: Create pack format with model manifests
5. **Model Hub**: Build a catalog of personality packs
6. **Fine-tuning**: Train models specifically for language learning
7. **RAG**: Add retrieval over lesson content

## Questions?

- Full docs: [LLM_POC.md](./LLM_POC.md)
- Candle docs: https://github.com/huggingface/candle
- Model hub: https://huggingface.co/models?library=gguf
