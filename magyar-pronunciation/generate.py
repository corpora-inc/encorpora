import os
from openai import OpenAI

# Configure the xAI client
api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)
completion_model = "grok-2-latest"

# Directory to save Markdown files (same as script location)
output_dir = os.path.dirname(os.path.abspath(__file__))

# Hungarian phonemes with categorization for outline
hungarian_phonemes = {
    "vowels": {
        "short": ["a", "e", "i", "o", "u", "ö", "ü"],
        "long": ["á", "é", "í", "ó", "ú", "ő", "ű"],
    },
    "consonants": {
        "stops": ["b", "p", "d", "t", "g", "k"],
        "fricatives": ["f", "v", "sz", "z", "s", "zs", "h"],
        "affricates": ["c", "dz", "cs", "dzs"],
        "nasals": ["m", "n", "ny"],
        "liquids": ["l", "r"],
        "glides": ["j", "ly"],
        "digraphs": ["gy", "ty"],
    },
}


# Function to generate content via xAI API with strict header control
def generate_content(prompt):
    response = client.chat.completions.create(
        model=completion_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert in Hungarian phonology and language pedagogy. "
                    "Generate content for a specific section of a comprehensive book on Hungarian pronunciation for English speakers. "
                    "The book is a series of Markdown files, each focusing on a narrow topic (e.g., a phoneme, a rule). "
                    "Write concise, vivid explanations in Markdown with strict header hierarchy: "
                    "# for the top-level title (file title), ## for main subsections, ### only if explicitly requested. "
                    "Never skip levels (e.g., no # followed directly by ###) or add unnecessary headers. "
                    "For examples, use exactly one ## Examples section with a plain list of 3-5 words (e.g., - *word* - /IPA/ - meaning), "
                    "no additional subheaders under it (e.g., no ### Examples). "
                    "Avoid redundant introductions or conclusions—assume the reader is progressing through the book. "
                    "Tailor explanations to English speakers, comparing to familiar English sounds where possible. "
                    "Use IPA notation (e.g., /a/) for precision when describing sounds."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    )
    return response.choices[0].message.content


# Function to write Markdown file
def write_md_file(filename, content):
    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated: {filename}")


# Generate the book structure and content
def generate_book():
    file_index = 0

    # 000 - Introduction
    intro_prompt = (
        "Write the introduction for a book on Hungarian pronunciation for English speakers. "
        "Use # Introduction as the title. Under ## Why Hungarian Pronunciation Matters, explain its uniqueness (e.g., phonemic length, vowel harmony). "
        "Under ## How This Book Is Organized, outline the structure (intro, vowels, consonants, rules). "
        "Under ## What to Expect, set expectations for the reader."
    )
    intro_content = generate_content(intro_prompt)
    write_md_file(f"{file_index:03d}-introduction.md", intro_content)
    file_index += 1

    # 001 - How to Use This Book
    howto_prompt = (
        "Explain how to use this book under # How to Use This Book. "
        "Under ## Reading IPA Notation, describe how to interpret IPA symbols. "
        "Under ## Understanding Examples, explain the format (Hungarian word - /IPA/ - meaning). "
        "Under ## Practice Tips, offer tips for practicing pronunciation."
    )
    howto_content = generate_content(howto_prompt)
    write_md_file(f"{file_index:03d}-how-to-use-this-book.md", howto_content)
    file_index += 1

    # Vowels Section
    # 002 - Vowels Overview
    vowels_prompt = (
        "Write an overview of Hungarian vowels under # Hungarian Vowels. "
        "Under ## Vowel Length, explain short vs. long vowels. "
        "Under ## Vowel Quality, discuss front vs. back and rounded vs. unrounded distinctions."
    )
    vowels_content = generate_content(vowels_prompt)
    write_md_file(f"{file_index:03d}-vowels-overview.md", vowels_content)
    file_index += 1

    # Short Vowels
    for phoneme in hungarian_phonemes["vowels"]["short"]:
        prompt = (
            f"Describe the Hungarian short vowel '{phoneme}' under # Short Vowel '{phoneme}'. "
            f"Under ## Pronunciation, explain its sound for English speakers, comparing to English sounds. "
            f"Under ## Examples, list 3-5 common words with this sound in the format - *word* - /IPA/ - meaning, with no subheaders."
        )
        content = generate_content(prompt)
        filename = f"{file_index:03d}-vowel-short-{phoneme}.md"
        write_md_file(filename, content)
        file_index += 1

    # Long Vowels
    for phoneme in hungarian_phonemes["vowels"]["long"]:
        prompt = (
            f"Describe the Hungarian long vowel '{phoneme}' under # Long Vowel '{phoneme}'. "
            f"Under ## Pronunciation, explain its sound for English speakers, emphasizing length, comparing to English sounds. "
            f"Under ## Examples, list 3-5 common words with this sound in the format - *word* - /IPA/ - meaning, with no subheaders."
        )
        content = generate_content(prompt)
        filename = f"{file_index:03d}-vowel-long-{phoneme}.md"
        write_md_file(filename, content)
        file_index += 1

    # Vowel Harmony
    harmony_prompt = (
        "Explain Hungarian vowel harmony under # Vowel Harmony. "
        "Under ## Front vs. Back Vowels, describe the distinction and its role. "
        "Under ## Suffix Adjustment, explain how suffixes adjust to harmony. "
        "Under ## Examples, list 3-5 examples showing harmony in action."
    )
    harmony_content = generate_content(harmony_prompt)
    write_md_file(f"{file_index:03d}-vowel-harmony.md", harmony_content)
    file_index += 1

    # Consonants Section
    # Consonants Overview
    consonants_prompt = (
        "Write an overview of Hungarian consonants under # Hungarian Consonants. "
        "Under ## Categories, list the main consonant types (stops, fricatives, etc.). "
        "Under ## Digraphs, introduce Hungarian digraphs and their importance."
    )
    consonants_content = generate_content(consonants_prompt)
    write_md_file(f"{file_index:03d}-consonants-overview.md", consonants_content)
    file_index += 1

    # Consonants by Category
    for category, phonemes in hungarian_phonemes["consonants"].items():
        for phoneme in phonemes:
            prompt = (
                f"Describe the Hungarian consonant '{phoneme}' under # Consonant '{phoneme}'. "
                f"Under ## Pronunciation, explain its sound for English speakers, comparing to English sounds, noting its category ({category}). "
                f"Under ## Examples, list 3-5 common words with this sound in the format - *word* - /IPA/ - meaning, with no subheaders."
            )
            content = generate_content(prompt)
            filename = f"{file_index:03d}-consonant-{phoneme}.md"
            write_md_file(filename, content)
            file_index += 1

    # Pronunciation Rules Section
    # Rules Overview
    rules_prompt = (
        "Write an overview of Hungarian pronunciation rules under # Pronunciation Rules. "
        "Under ## Why Rules Matter, explain their role in fluency. "
        "Under ## Key Concepts, introduce stress, length, and assimilation."
    )
    rules_content = generate_content(rules_prompt)
    write_md_file(f"{file_index:03d}-rules-overview.md", rules_content)
    file_index += 1

    # Specific Rules
    rules = [
        (
            "stress",
            "Explain Hungarian stress rules under # Stress Rules. Under ## First Syllable Stress, detail its consistency and contrast with English. Under ## Examples, list 3-5 words showing stress.",
        ),
        (
            "length-distinction",
            "Detail phonemic length under # Phonemic Length. Under ## Vowels and Consonants, explain length distinctions. Under ## Examples, list 3-5 words with length contrasts.",
        ),
        (
            "digraphs",
            "Discuss Hungarian digraphs under # Digraphs. Under ## Consistent Sounds, explain their pronunciation. Under ## Examples, list 3-5 words with digraphs.",
        ),
        (
            "assimilation",
            "Describe consonant assimilation under # Assimilation. Under ## Voicing Rules, detail how it works. Under ## Examples, list 3-5 words showing assimilation.",
        ),
    ]
    for rule_name, rule_prompt in rules:
        prompt = f"{rule_prompt} Use ## for main subsections, and keep ## Examples as a plain list with no subheaders."
        content = generate_content(prompt)
        filename = f"{file_index:03d}-rule-{rule_name}.md"
        write_md_file(filename, content)
        file_index += 1

    print(f"Generated {file_index} Markdown files in {output_dir}")


if __name__ == "__main__":
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable not set")
    generate_book()
