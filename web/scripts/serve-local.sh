#!/bin/bash
# Local development server for GitHub Pages site
# This mirrors the GitHub Actions workflow for local testing

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WEB_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
REPO_ROOT="$( cd "$WEB_DIR/.." && pwd )"
IO_DIR="$WEB_DIR/io"
BUILD_DIR="$IO_DIR/out"

BASE_PATH_URL="/"
OUTPUT_ROOT="$BUILD_DIR"

echo "🏗️  Building complete site (web/io + corpan + games)..."
echo ""

# Step 1: Build web/io/ site (root)
echo "🌐 Building web/io/ site (root)..."
cd "$IO_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing io/ dependencies..."
  npm install
fi

npm run build
echo ""

# Step 2: Build Corpan pages into web/io/out
echo "📄 Building Corpan pages..."
cd "$WEB_DIR"
node "$WEB_DIR/pages/build.js" "$BUILD_DIR"
echo ""

# Step 3: Build hover-runner
echo "🎮 Building hover-runner game..."
cd "$REPO_ROOT/corpan/games/hover-runner"

if [ ! -d "node_modules" ]; then
  echo "Installing hover-runner dependencies..."
  npm install --legacy-peer-deps
fi

npm run build
echo ""

# Step 4: Copy hover-runner into web/io/out
echo "📦 Copying hover-runner into site..."
mkdir -p "$OUTPUT_ROOT/corpan/games/hover-runner"
cp "$REPO_ROOT/corpan/games/hover-runner/manifest.json" "$OUTPUT_ROOT/corpan/games/hover-runner/"
cp -R "$REPO_ROOT/corpan/games/hover-runner/dist/." "$OUTPUT_ROOT/corpan/games/hover-runner/"

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Site structure:"
find "$BUILD_DIR" -type f | grep -E "(corpan|assets|manifest)" | sort | sed "s|$BUILD_DIR|  |" | head -20
echo "  ... (and other web/io/ site files)"
echo ""

# Step 5: Start local server
echo "🚀 Starting local server..."
echo ""
echo "   Site will be available at:"
echo "   http://localhost:8000"
echo ""
echo "   Browse to:"
echo "   • http://localhost:8000${BASE_PATH_URL} (web/io/ root site)"
echo "   • http://localhost:8000${BASE_PATH_URL}corpan/ (Corpan)"
echo "   • http://localhost:8000${BASE_PATH_URL}corpan/games/ (Games listing)"
echo "   • http://localhost:8000${BASE_PATH_URL}corpan/games/hover-runner/ (Hover Runner)"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

cd "$BUILD_DIR"
python3 -m http.server 8000
