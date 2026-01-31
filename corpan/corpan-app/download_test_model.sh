#!/bin/bash

# Script to download a small test LLM model for the POC

set -e

MODELS_DIR="$HOME/corpan-models"
MODEL_NAME="Llama-3.2-1B-Instruct-Q4_K_M"

echo "📦 Downloading test LLM model..."
echo "This will download ~750MB to: $MODELS_DIR"
echo ""

# Create directory
mkdir -p "$MODELS_DIR"
cd "$MODELS_DIR"

# Check if model already exists
if [ -f "$MODEL_NAME.gguf" ] && [ -f "tokenizer.json" ]; then
    echo "✅ Model already downloaded at:"
    echo "   $MODELS_DIR/$MODEL_NAME.gguf"
    echo ""
    echo "To use in the app, paste this path:"
    echo "   $MODELS_DIR/$MODEL_NAME.gguf"
    exit 0
fi

echo "Downloading Llama 3.2 1B Instruct (Q4_K_M quantized)..."
echo "This is a small but high-quality model (~750MB)"
echo ""

# Download model
if ! [ -f "$MODEL_NAME.gguf" ]; then
    echo "⬇️  Downloading model file..."
    curl -L --progress-bar -o "$MODEL_NAME.gguf" \
        "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf"
    echo "✅ Model downloaded"
else
    echo "✅ Model file already exists"
fi

# Download tokenizer
if ! [ -f "tokenizer.json" ]; then
    echo "⬇️  Downloading tokenizer..."
    curl -L --progress-bar -o "tokenizer.json" \
        "https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct/raw/main/tokenizer.json"
    echo "✅ Tokenizer downloaded"
else
    echo "✅ Tokenizer already exists"
fi

echo ""
echo "✨ All done! Model ready at:"
echo "   $MODELS_DIR/$MODEL_NAME.gguf"
echo ""
echo "📋 Next steps:"
echo "   1. Run: cd corpan-app && npm run tauri dev"
echo "   2. Open: http://localhost:1420/?llmtest=true"
echo "   3. Paste this path in the model field:"
echo "      $MODELS_DIR/$MODEL_NAME.gguf"
echo ""
echo "💡 Example prompts to try:"
echo "   - Tell me a short joke"
echo "   - Explain quantum physics in simple terms"
echo "   - Write a haiku about programming"
echo ""
