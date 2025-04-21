#!/bin/bash

set -e

# Define the list of filenames
files=(
"01-08-lesson-real-number-classifications-and-properties-rational-irrational.md"
"03-06-lesson-domain-and-range-of-functions.md"
"03-07-lesson-algebra-of-functions-sums-products-and-quotients.md"
"05-06-lesson-solving-and-graphing-quadratic-inequalities.md"
"10-06-lesson-factorials-and-binomial-theorem.md"
)

# Loop through files and run `corpora workon`
for file in "${files[@]}"; do
    corpora infer "$file" --check ./build.sh
    git add "$file"
    git commit -m "Infer $file" --no-gpg-sign
    corpora sync --noinput
done
