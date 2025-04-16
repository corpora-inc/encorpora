#!/bin/bash

set -e

# Define the list of filenames
files=(
  # Unit 01: Hangul Mastery
  "01-00-intro-unit-hangul-mastery.md"
  "01-01-lesson-introduction-to-hangul-and-why-it-matters.md"
  "01-02-lesson-basic-consonants-and-vowels.md"
  "01-03-lesson-syllable-structure-blocks.md"
  "01-04-lesson-complete-vowel-system-with-diphthongs.md"
  "01-05-lesson-final-consonants-batchim.md"
  "01-06-lesson-pronunciation-shortcuts-and-phonetic-rules.md"
  "01-07-lesson-practice-hangul-with-real-words.md"
  "01-08-lesson-hangul-handwriting-and-typing.md"
  "01-09-lesson-romanization-systems-and-pronunciation-aids.md"
  "01-10-lesson-mini-reading-and-translation-practice.md"
  "01-90-culture-history-of-hangul-and-sejong-the-great.md"

  # Unit 02: Nouns, Particles, and Basic Sentences
  "02-00-intro-unit-nouns-particles-and-basic-sentences.md"
  "02-01-lesson-essential-nouns-you-will-see-everywhere.md"
  "02-02-lesson-subject-and-topic-markers-ga-and-neun.md"
  "02-03-lesson-basic-sentence-structure-svo-vs-sov.md"
  "02-04-lesson-common-pronouns-and-identification.md"
  "02-05-lesson-introduction-to-descriptive-verbs.md"
  "02-06-lesson-using-to-be-이다-in-sentences.md"
  "02-07-lesson-introducing-yourself-in-korean.md"
  "02-08-lesson-building-sentences-with-and-particles.md"
  "02-09-lesson-negative-sentences-with-an-and-mot.md"
  "02-10-lesson-mini-conversation-practice.md"
  "02-90-culture-names-and-addressing-people-in-korean-culture.md"

  # Unit 03: Verbs and Present Tense Grammar
  "03-00-intro-unit-verbs-and-present-tense-grammar.md"
  "03-01-lesson-basic-verbs-and-informal-conjugation.md"
  "03-02-lesson-present-tense-politeness-levels.md"
  "03-03-lesson-verb-stems-and-basic-conjugation-rules.md"
  "03-04-lesson-using-action-verbs-in-context.md"
  "03-05-lesson-question-forms-and-intonation.md"
  "03-06-lesson-sentence-ending-patterns.md"
  "03-07-lesson-using-particles-to-expand-meaning.md"
  "03-08-lesson-common-daily-verbs-in-dialogues.md"
  "03-09-lesson-pronunciation-variation-in-fast-speech.md"
  "03-10-lesson-mini-stories-with-verbs.md"
  "03-90-culture-honorifics-politeness-and-speech-levels.md"

  # Unit 04: Practical Communication and Vocabulary Expansion
  "04-00-intro-unit-practical-communication-and-vocabulary.md"
  "04-01-lesson-greetings-farewells-and-introductions.md"
  "04-02-lesson-asking-basic-questions.md"
  "04-03-lesson-numbers-native-and-sino-korean.md"
  "04-04-lesson-time-days-months-and-dates.md"
  "04-05-lesson-locations-and-directions.md"
  "04-06-lesson-talking-about-weather.md"
  "04-07-lesson-shopping-and-money.md"
  "04-08-lesson-ordering-food-and-drinks.md"
  "04-09-lesson-common-adjectives-and-opposites.md"
  "04-10-lesson-dialogues-in-real-life-situations.md"
  "04-90-culture-korean-food-and-restaurant-culture.md"

  # Unit 05: Past and Future Tense, More Verbs
  "05-00-intro-unit-past-and-future-tense-grammar.md"
  "05-01-lesson-past-tense-verb-conjugation.md"
  "05-02-lesson-future-intentions-and-plans.md"
  "05-03-lesson-more-on-descriptive-verbs.md"
  "05-04-lesson-talking-about-past-experiences.md"
  "05-05-lesson-expressing-wants-and-hope.md"
  "05-06-lesson-questions-in-different-tenses.md"
  "05-07-lesson-daily-routines-in-past-present-future.md"
  "05-08-lesson-talking-about-likes-and-dislikes.md"
  "05-09-lesson-mini-biographies-and-simple-stories.md"
  "05-10-lesson-roleplay-and-dialogue-practice.md"
  "05-90-culture-education-family-and-school-in-korea.md"

  # Unit 06: Advanced Sentence Structure and Reading
  "06-00-intro-unit-complex-sentences-and-reading.md"
  "06-01-lesson-sentence-connectors-and-causality.md"
  "06-02-lesson-using-지만-고-서-and-면서.md"
  "06-03-lesson-introduction-to-conditionals.md"
  "06-04-lesson-making-suggestions-and-requests.md"
  "06-05-lesson-expressing-ability-and-permission.md"
  "06-06-lesson-contrasts-and-emphasis.md"
  "06-07-lesson-reading-short-stories-and-dialogues.md"
  "06-08-lesson-writing-descriptions-and-journal-entries.md"
  "06-09-lesson-complex-questions-and-clarifications.md"
  "06-10-lesson-summarizing-information-in-korean.md"
  "06-90-culture-social-life-and-communication-in-korea.md"
)

# Loop through files and run `corpora workon`
for file in "${files[@]}"; do
    corpora infer "$file" --check ./build.sh
    git add "$file"
    git commit -m "Infer $file" --no-gpg-sign
    corpora sync --noinput
done
