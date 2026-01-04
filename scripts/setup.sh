#!/bin/bash
# Setup script for Encorpora development

set -e

echo "🔧 Setting up Encorpora development environment..."
echo ""

# Root dependencies
echo "📦 Installing root dependencies..."
npm install
echo ""

# io/ site
echo "📦 Installing io/ dependencies..."
cd io
npm install
cd ..
echo ""

# hover-runner game
echo "🎮 Installing hover-runner dependencies..."
cd corpan/games/hover-runner
npm install --legacy-peer-deps
cd ../../..
echo ""

echo "✅ Setup complete!"
echo ""
echo "To start developing:"
echo "  npm run dev"
echo ""
echo "Then visit http://localhost:8000"
echo ""
