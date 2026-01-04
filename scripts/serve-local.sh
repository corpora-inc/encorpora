#!/bin/bash
# Local development server for GitHub Pages site
# This mirrors the GitHub Actions workflow for local testing

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
IO_DIR="$SCRIPT_DIR/io"
BUILD_DIR="$IO_DIR/out"

echo "🏗️  Building complete site (io + corpan + games)..."
echo ""

# Step 1: Build io/ site (root)
echo "🌐 Building io/ site (root)..."
cd "$IO_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing io/ dependencies..."
  npm install
fi

npm run build
echo ""

# Step 2: Build Corpan pages into io/out
echo "📄 Building Corpan pages..."
cd "$SCRIPT_DIR"
node "$SCRIPT_DIR/pages/build.js" "$BUILD_DIR"
echo ""

# Step 3: Build hover-runner
echo "🎮 Building hover-runner game..."
cd "$SCRIPT_DIR/corpan/games/hover-runner"

if [ ! -d "node_modules" ]; then
  echo "Installing hover-runner dependencies..."
  npm install --legacy-peer-deps
fi

npm run build
echo ""

# Step 4: Copy hover-runner into io/out
echo "📦 Copying hover-runner into site..."
mkdir -p "$BUILD_DIR/corpan/games/hover-runner"
cp "$SCRIPT_DIR/corpan/games/hover-runner/manifest.json" "$BUILD_DIR/corpan/games/hover-runner/"
cp -R "$SCRIPT_DIR/corpan/games/hover-runner/dist/." "$BUILD_DIR/corpan/games/hover-runner/"

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Site structure:"
find "$BUILD_DIR" -type f | grep -E "(corpan|assets|manifest)" | sort | sed "s|$BUILD_DIR|  |" | head -20
echo "  ... (and other io/ site files)"
echo ""

# Step 5: Start local server
echo "🚀 Starting local server..."
echo ""
echo "   Site will be available at:"
echo "   http://localhost:8000"
echo ""
echo "   Browse to:"
echo "   • http://localhost:8000/ (io/ root site)"
echo "   • http://localhost:8000/corpan/ (Corpan)"
echo "   • http://localhost:8000/corpan/games/ (Games listing)"
echo "   • http://localhost:8000/corpan/games/hover-runner/ (Hover Runner)"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

cd "$BUILD_DIR"
python3 -m http.server 8000
