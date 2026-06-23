#!/bin/bash
# Setup script for Encorpora development

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WEB_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
REPO_ROOT="$( cd "$WEB_DIR/.." && pwd )"

echo "🔧 Setting up Encorpora development environment..."
echo ""

# Root dependencies
echo "📦 Installing root dependencies..."
cd "$REPO_ROOT"
npm install
echo ""

# io/ site
echo "📦 Installing io/ dependencies..."
cd "$WEB_DIR/io"
npm install
cd "$REPO_ROOT"
echo ""

# hover-runner pack
echo "🎮 Installing hover-runner pack dependencies..."
cd "$REPO_ROOT/corpan/packs/hover-runner"
npm install --legacy-peer-deps
cd "$REPO_ROOT"
echo ""

# juice-squeeze pack
echo "🧃 Installing juice-squeeze pack dependencies..."
cd "$REPO_ROOT/corpan/packs/juice-squeeze"
npm install
cd "$REPO_ROOT"
echo ""

echo "✅ Setup complete!"
echo ""
echo "To start developing:"
echo "  npm run dev"
echo ""
echo "Then visit http://localhost:8000"
echo ""
