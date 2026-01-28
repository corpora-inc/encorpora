#!/bin/bash
set -e

# Test that all .so files in AAB have correct 16KB page alignment
# Usage: ./scripts/test-16kb.sh path/to/app.aab

AAB_PATH="$1"

if [ -z "$AAB_PATH" ]; then
  echo "Usage: $0 path/to/app.aab"
  exit 1
fi

if [ ! -f "$AAB_PATH" ]; then
  echo "Error: AAB file not found: $AAB_PATH"
  exit 1
fi

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Extracting AAB to $TEMP_DIR..."
unzip -q "$AAB_PATH" -d "$TEMP_DIR"

echo "Checking .so files for 16KB page alignment..."
FAILED=0

find "$TEMP_DIR" -name "*.so" | while read SO_FILE; do
  echo "Checking: $SO_FILE"

  # Check ELF p_align - should be 0x4000 (16384 in hex)
  ALIGN=$(readelf -l "$SO_FILE" | grep "LOAD" | head -1 | awk '{print $NF}')

  if [ "$ALIGN" != "0x4000" ]; then
    echo "  ❌ FAILED: p_align = $ALIGN (expected 0x4000)"
    FAILED=1
  else
    echo "  ✅ PASSED: p_align = 0x4000"
  fi
done

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "❌ VERIFICATION FAILED: Some .so files don't have 16KB alignment"
  exit 1
else
  echo ""
  echo "✅ ALL CHECKS PASSED: All .so files have 16KB page alignment"
fi
