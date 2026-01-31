#!/bin/bash

# Development script that sets required environment variables
export SDKROOT=$(xcrun --show-sdk-path)
export CC=/usr/bin/clang
export CXX=/usr/bin/clang++

echo "🚀 Starting Corpan development server..."
echo "   SDKROOT: $SDKROOT"
echo ""

npm run tauri dev
