#!/usr/bin/env bash
# Verify the 13 newly-added languages have rows in db.sqlite3.
set -e
cd "$(dirname "$0")"

LANGS=(ne pt-PT hr sr uk bg ro ca yue-Hant-HK cs lt sk sl)

echo "Total entries:"
sqlite3 db.sqlite3 "SELECT COUNT(*) FROM cor_entry"
echo

echo "Per-language translation counts (target ≈ 10000):"
printf "  %-14s %8s   %s\n" "code" "translated" "non-null romanization"
for code in "${LANGS[@]}"; do
  count=$(sqlite3 db.sqlite3 "SELECT COUNT(*) FROM cor_translation WHERE language_id = (SELECT id FROM cor_language WHERE code='$code')")
  rom=$(sqlite3 db.sqlite3 "SELECT COUNT(*) FROM cor_translation WHERE romanization IS NOT NULL AND romanization != '' AND language_id = (SELECT id FROM cor_language WHERE code='$code')")
  printf "  %-14s %8s   %s\n" "$code" "$count" "$rom"
done
