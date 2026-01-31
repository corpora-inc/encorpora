# LLM Integration Proof of Concept

This POC demonstrates on-device LLM inference integrated into Corpan using Candle (Hugging Face's pure Rust ML framework).

## What's Implemented

### Backend (Rust)
- **LLM Module** (`corpan-app/src-tauri/src/llm.rs`):
  - GGUF model loading (quantized models for efficient inference)
  - Text generation with configurable parameters
  - Support for pack:// protocol to load models from content packs
  - Token-by-token generation to avoid large IPC payloads
  - Temperature, top-p sampling, repeat penalty controls

### Frontend (TypeScript)
- **LLM Utilities** (`corpan-app/src/util/llm.ts`):
  - TypeScript bindings for Tauri commands
  - Model loading/unloading functions
  - Text generation API

- **Test UI** (`corpan-app/src/components/LlmTest.tsx`):
  - Model loading interface
  - Interactive prompt and response UI
  - Error handling and status indicators

## Quick Start

### 1. Download a Test Model

Download a small quantized model. Recommended options:

**Qwen2.5-0.5B-Instruct** (smallest, ~300MB):
```bash
# Download model
curl -L -o qwen2.5-0.5b-instruct-q4_k_m.gguf \
  https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf

# Download tokenizer
curl -L -o tokenizer.json \
  https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/raw/main/tokenizer.json
```

**Llama-3.2-1B-Instruct** (better quality, ~750MB):
```bash
# Download model
curl -L -o Llama-3.2-1B-Instruct-Q4_K_M.gguf \
  https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf

# Download tokenizer
curl -L -o tokenizer.json \
  https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct/raw/main/tokenizer.json
```

**Important**: Keep the model file and `tokenizer.json` in the same directory.

### 2. Build and Run

```bash
cd corpan-app
npm run tauri dev
```

### 3. Access the Test UI

Open the app and navigate to:
```
http://localhost:1420/?llmtest=true
```

(This works in dev mode only)

### 4. Test the LLM

1. Enter the full path to your downloaded model (e.g., `/Users/you/Downloads/qwen2.5-0.5b-instruct-q4_k_m.gguf`)
2. Click "Load Model"
3. Enter a prompt like "Tell me a short joke"
4. Click "Generate"

## API Reference

### Rust Commands

#### `llm_load_model`
```rust
llm_load_model(
    model_path: String,  // Supports pack://pack_id/path/model.gguf
    model_id: String     // Unique identifier for this model instance
) -> Result<(), String>
```

#### `llm_unload_model`
```rust
llm_unload_model(
    model_id: String
) -> Result<(), String>
```

#### `llm_generate`
```rust
llm_generate(
    model_id: String,
    request: LlmGenerateRequest {
        prompt: String,
        max_tokens: Option<usize>,      // Default: 512
        temperature: Option<f64>,        // Default: 0.7
        top_p: Option<f64>,              // Default: 0.9
        repeat_penalty: Option<f32>,     // Default: 1.1
        repeat_last_n: Option<usize>,    // Default: 64
        stop_sequences: Option<Vec<String>>
    }
) -> Result<Vec<String>, String>  // Returns array of token strings
```

### TypeScript API

```typescript
import { loadModel, generateText } from "@/util/llm";

// Load a model
await loadModel("/path/to/model.gguf", "personality-1");

// Generate text
const response = await generateText("personality-1", {
  prompt: "Hello! How are you?",
  max_tokens: 256,
  temperature: 0.7,
});

console.log(response); // Complete generated text
```

## Creating a Conversational Pack

Here's how to build a pack with an embedded LLM personality:

### 1. Pack Structure

```
my-personality-pack/
├── manifest.json
├── models/
│   ├── personality.gguf     # Quantized model (~500MB-2GB)
│   └── tokenizer.json        # Tokenizer for the model
├── prompts/
│   └── system.txt            # System prompt defining personality
└── src/
    ├── index.tsx             # Main pack entry point
    └── conversation.tsx       # Conversation UI
```

### 2. Example Pack Code

```typescript
// src/index.tsx
import { registerGame } from '@corpan/sdk';
import { loadModel, generateText } from '@corpan/host';

const SYSTEM_PROMPT = `You are a friendly Spanish language tutor.
Help users practice Spanish through natural conversation.
Keep responses concise (2-3 sentences).`;

registerGame({
  async onMount({ hostApi, container }) {
    // Load the model from pack
    await hostApi.llm.loadModel(
      'pack://my-personality-pack/models/personality.gguf',
      'tutor'
    );

    // Initialize conversation UI
    const conversation = [];

    container.innerHTML = `
      <div class="chat-container">
        <div id="messages"></div>
        <input id="input" type="text" placeholder="Type a message..." />
        <button id="send">Send</button>
      </div>
    `;

    async function sendMessage(userMessage) {
      conversation.push({ role: 'user', content: userMessage });

      // Build prompt with conversation history
      const prompt = buildPrompt(SYSTEM_PROMPT, conversation);

      // Generate response
      const response = await hostApi.llm.generateText('tutor', {
        prompt,
        max_tokens: 150,
        temperature: 0.7,
        stop_sequences: ['User:', '\n\n']
      });

      conversation.push({ role: 'assistant', content: response });
      displayMessage('assistant', response);

      // Optional: Use TTS to speak response
      await hostApi.speak({ text: response, language: 'es' });
    }

    // Attach event listeners...
  },

  async onUnmount({ hostApi }) {
    // Cleanup
    await hostApi.llm.unloadModel('tutor');
  }
});
```

### 3. manifest.json

```json
{
  "id": "my-personality-pack",
  "name": "Spanish Tutor",
  "version": "1.0.0",
  "entry": "src/index.tsx",
  "models": [
    {
      "id": "personality",
      "path": "models/personality.gguf",
      "size_mb": 750,
      "description": "Llama 3.2 1B tuned for Spanish tutoring"
    }
  ]
}
```

## Performance Targets

### Model Sizes (4-bit quantized)
- 0.5B params: ~300MB
- 1B params: ~750MB
- 3B params: ~1.8GB

### Inference Speed (on CPU)
- 0.5B: 15-30 tokens/sec on iPhone 12+
- 1B: 10-20 tokens/sec on iPhone 12+
- 3B: 5-15 tokens/sec on iPhone 13+

### Memory Usage
- Model size + ~200MB overhead
- 1B model needs ~1GB RAM minimum

## Next Steps

### Phase 2: Streaming
- Add streaming generation to display tokens as they're generated
- Implement proper cancellation
- Better UX with token-by-token display

### Phase 3: Speech-to-Text
- Integrate Whisper (tiny/base models)
- Voice input for conversations
- Streaming audio recognition

### Phase 4: Voice Synthesis
- Bundle Piper TTS models
- Voice cloning for personalities
- Real-time audio generation

### Phase 5: Advanced Features
- Fine-tuned models for language learning
- RAG (Retrieval Augmented Generation) over lesson content
- Adaptive difficulty based on user performance
- Multi-turn conversation management
- User profiles and memory

## Technical Notes

### Why Candle?
- **Pure Rust**: No C++ dependencies, easier cross-platform builds
- **GGUF Support**: Works with quantized models (smaller, faster)
- **Mobile-Ready**: Good CPU performance, supports Metal/NNAPI
- **Maintained**: Active development by Hugging Face

### Model Format
- Uses GGUF (GPT-Generated Unified Format)
- Quantized models (4-bit, 8-bit) for mobile efficiency
- Compatible with llama.cpp ecosystem

### IPC Strategy
- Returns array of token strings (not full text)
- Frontend joins tokens to avoid large single messages
- Future: use Tauri events for streaming

### Security
- Models loaded from pack directories only
- No network access during inference
- Sandboxed execution

## Troubleshooting

### Model won't load
- Ensure `tokenizer.json` is in same directory as model
- Check file permissions
- Verify model is GGUF format (not safetensors or PyTorch)

### Slow generation
- Try a smaller model (0.5B instead of 3B)
- Reduce `max_tokens`
- Use lower `temperature` (faster greedy decoding)

### Out of memory
- Close other apps
- Use a smaller quantized model (Q4 instead of Q8)
- Reduce context length

## Resources

- [Hugging Face Model Hub](https://huggingface.co/models?library=gguf)
- [Candle Documentation](https://github.com/huggingface/candle)
- [GGUF Format Spec](https://github.com/ggerganov/ggml/blob/master/docs/gguf.md)
- [Model Quantization Guide](https://huggingface.co/docs/transformers/main/en/quantization)
