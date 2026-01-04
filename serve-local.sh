#!/bin/bash
# Local development server for GitHub Pages site
# This mirrors the GitHub Actions workflow for local testing

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUILD_DIR="$SCRIPT_DIR/.local-pages"

echo "🏗️  Building local GitHub Pages site..."
echo ""

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
  echo "Cleaning previous build..."
  rm -rf "$BUILD_DIR"
fi

# Step 1: Build landing pages
echo "📄 Building landing pages..."
node "$SCRIPT_DIR/pages/build.js" "$BUILD_DIR"
echo ""

# Step 2: Build hover-runner
echo "🎮 Building hover-runner game..."
cd "$SCRIPT_DIR/corpan/games/hover-runner"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --legacy-peer-deps
fi

npm run build
echo ""

# Step 3: Assemble everything
echo "📦 Assembling site structure..."
mkdir -p "$BUILD_DIR/corpan/games/hover-runner"

# Copy hover-runner files
cp "$SCRIPT_DIR/corpan/games/hover-runner/manifest.json" "$BUILD_DIR/corpan/games/hover-runner/"
cp -R "$SCRIPT_DIR/corpan/games/hover-runner/dist/." "$BUILD_DIR/corpan/games/hover-runner/"

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Site structure:"
find "$BUILD_DIR" -type f | sort | sed "s|$BUILD_DIR|  |"
echo ""

# Step 4: Start local server
echo "🚀 Starting local server..."
echo ""
echo "   Site will be available at:"
echo "   http://localhost:8000"
echo ""
echo "   Browse to:"
echo "   • http://localhost:8000/ (root)"
echo "   • http://localhost:8000/corpan/ (Corpan)"
echo "   • http://localhost:8000/corpan/games/ (Games listing)"
echo "   • http://localhost:8000/corpan/games/hover-runner/ (Hover Runner)"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

cd "$BUILD_DIR"
python3 -m http.server 8000
