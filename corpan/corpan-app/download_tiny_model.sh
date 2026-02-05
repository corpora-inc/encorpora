#!/bin/bash

# Download TinyLlama-1.1B - verified to work, smallest stable Llama model

set -e

MODELS_DIR="$HOME/corpan-models"
MODEL_NAME="TinyLlama-1.1B-Chat-v1.0.Q4_K_M"

echo "📦 Downloading TinyLlama-1.1B (smallest stable model)..."
echo "This will download ~600MB to: $MODELS_DIR"
echo ""

mkdir -p "$MODELS_DIR"
cd "$MODELS_DIR"

# Clean up any broken files
rm -f "SmolLM-135M-Instruct-Q4_K_M.gguf" 2>/dev/null

if [ -f "$MODEL_NAME.gguf" ] && [ -f "tokenizer.json" ]; then
    # Verify it's actually a GGUF file
    if head -c 4 "$MODEL_NAME.gguf" | grep -q "GGUF"; then
        echo "✅ Model already downloaded!"
        echo "   Path: $MODELS_DIR/$MODEL_NAME.gguf"
        exit 0
    else
        echo "⚠️  Existing file is corrupted, re-downloading..."
        rm -f "$MODEL_NAME.gguf"
    fi
fi

echo "⬇️  Downloading TinyLlama model (~600MB)..."
curl -L --progress-bar -o "$MODEL_NAME.gguf" \
    "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"

echo ""
echo "⬇️  Downloading tokenizer..."
curl -L --progress-bar -o "tokenizer.json" \
    "https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0/raw/main/tokenizer.json"

# Verify the download
echo ""
if head -c 4 "$MODEL_NAME.gguf" | grep -q "GGUF"; then
    echo "✅ Model downloaded and verified!"
else
    echo "❌ Download failed - file is not a valid GGUF"
    exit 1
fi

echo ""
echo "✨ Model ready at:"
echo "   $MODELS_DIR/$MODEL_NAME.gguf"
echo ""
echo "📊 Model specs:"
echo "   - Size: ~600MB"
echo "   - Params: 1.1B"
echo "   - Speed: 20-40 tokens/sec on laptop"
echo "   - Architecture: Llama (works with Candle)"
echo ""
