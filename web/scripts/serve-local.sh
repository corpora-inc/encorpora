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

echo "🏗️  Building complete site (web/io + corpan + packs)..."
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
echo "🎮 Building hover-runner pack..."
cd "$REPO_ROOT/corpan/packs/hover-runner"

if [ ! -d "node_modules" ]; then
  echo "Installing hover-runner dependencies..."
  npm install --legacy-peer-deps
fi

npm run build
echo ""

# Step 4: Copy hover-runner into web/io/out
echo "📦 Copying hover-runner into site..."
zip -r hover-runner.zip manifest.json dist/
mkdir -p "$OUTPUT_ROOT/corpan/packs/hover-runner"
cp "$REPO_ROOT/corpan/packs/hover-runner/manifest.json" "$OUTPUT_ROOT/corpan/packs/hover-runner/"
cp -R "$REPO_ROOT/corpan/packs/hover-runner/dist/." "$OUTPUT_ROOT/corpan/packs/hover-runner/"
cp "$REPO_ROOT/corpan/packs/hover-runner/hover-runner.zip" "$OUTPUT_ROOT/corpan/packs/hover-runner.zip"

# Step 5: Build juice-squeeze
echo "🧃 Building juice-squeeze pack..."
cd "$REPO_ROOT/corpan/packs/juice-squeeze"

if [ ! -d "node_modules" ]; then
  echo "Installing juice-squeeze dependencies..."
  npm install
fi

npm run build
echo ""

# Step 6: Copy juice-squeeze into web/io/out
echo "📦 Copying juice-squeeze into site..."
zip -r juice-squeeze.zip manifest.json dist/
mkdir -p "$OUTPUT_ROOT/corpan/packs/juice-squeeze"
cp "$REPO_ROOT/corpan/packs/juice-squeeze/manifest.json" "$OUTPUT_ROOT/corpan/packs/juice-squeeze/"
cp -R "$REPO_ROOT/corpan/packs/juice-squeeze/dist/." "$OUTPUT_ROOT/corpan/packs/juice-squeeze/"
cp "$REPO_ROOT/corpan/packs/juice-squeeze/juice-squeeze.zip" "$OUTPUT_ROOT/corpan/packs/juice-squeeze.zip"

# Step 7: Build Hanzipan bundle + zip
echo "📦 Packaging hanzipan..."
cd "$REPO_ROOT/corpan/packs/hanzipan"
mkdir -p dist
cat hanziwriter.min.js > dist/app.js
printf '\n;' >> dist/app.js
cat index.js >> dist/app.js
cp styles.css dist/app.css
zip -r hanzipan.zip manifest.json dist/ HANZIWRITER_LICENSE.txt data/
mkdir -p "$OUTPUT_ROOT/corpan/packs/hanzipan"
cp "$REPO_ROOT/corpan/packs/hanzipan/manifest.json" "$OUTPUT_ROOT/corpan/packs/hanzipan/"
cp -R "$REPO_ROOT/corpan/packs/hanzipan/dist/." "$OUTPUT_ROOT/corpan/packs/hanzipan/"
cp -R "$REPO_ROOT/corpan/packs/hanzipan/data" "$OUTPUT_ROOT/corpan/packs/hanzipan/"
cp "$REPO_ROOT/corpan/packs/hanzipan/hanzipan.zip" "$OUTPUT_ROOT/corpan/packs/hanzipan.zip"

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Site structure:"
find "$BUILD_DIR" -type f | grep -E "(corpan|assets|manifest)" | sort | sed "s|$BUILD_DIR|  |" | head -20
echo "  ... (and other web/io/ site files)"
echo ""

# Step 8: Start local server
echo "🚀 Starting local server..."
echo ""
echo "   Site will be available at:"
echo "   http://localhost:8000"
echo ""
echo "   Browse to:"
echo "   • http://localhost:8000${BASE_PATH_URL} (web/io/ root site)"
echo "   • http://localhost:8000${BASE_PATH_URL}corpan/ (Corpan)"
echo "   • http://localhost:8000${BASE_PATH_URL}corpan/packs/ (Packs listing)"
echo "   • http://localhost:8000${BASE_PATH_URL}corpan/packs/hover-runner/ (Hover Runner)"
echo "   • http://localhost:8000${BASE_PATH_URL}corpan/packs/juice-squeeze/ (Juice Squeeze)"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

cd "$BUILD_DIR"
python3 -m http.server 8000
