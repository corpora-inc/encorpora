#!/usr/bin/env python3
import json, sys, os, glob

# Onboarding translations
ONBOARDING_KEYS = {
    "en": {
        "learning": "Learning languages",
        "ttsStepTitle": "Text-to-speech",
        "socials": "Follow & connect",
        "noVoices": "No voices",
        "noVoicesHint": "Install voices to enable this language."
    },
    # For other languages, we'll use English as fallback for now
}

# Dialect translations
DIALECT_KEYS = {
    "en": {
        "bn-IN": "Bengali (India)",
        "te-IN": "Telugu (India)",
        "kn-IN": "Kannada (India)",
        "mr": "Marathi",
        "mr-IN": "Marathi (India)",
        "gu": "Gujarati",
        "gu-IN": "Gujarati (India)",
        "pa": "Punjabi",
        "pa-IN": "Punjabi (India)",
        "pa-Guru-IN": "Punjabi (Gurmukhi, India)",
        "ur": "Urdu",
        "ur-IN": "Urdu (India)",
        "ur-PK": "Urdu (Pakistan)"
    },
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
    # Keep $schema first if present
    if isinstance(data, dict) and "$schema" in data:
        ordered = {"$schema": data["$schema"]}
        for k, v in data.items():
            if k == "$schema":
                continue
            ordered[k] = v
        data = ordered
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    if not os.path.isdir(root):
        print(f"Not a directory: {root}")
        sys.exit(1)

    changed = 0
    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue

        for jf in glob.glob(os.path.join(lang_path, "*.json")):
            try:
                data = load_json(jf)
            except Exception as e:
                print(f"SKIP (invalid JSON): {jf} -> {e}")
                continue

            if not isinstance(data, dict):
                print(f"SKIP (not object): {jf}")
                continue

            # Ensure onboarding section exists
            data.setdefault("onboarding", {})
            if not isinstance(data["onboarding"], dict):
                print(f"SKIP (onboarding not object): {jf}")
                continue

            # Ensure dialects section exists
            data.setdefault("dialects", {})
            if not isinstance(data["dialects"], dict):
                print(f"SKIP (dialects not object): {jf}")
                continue

            # Get translations for this language (fallback to English)
            onboarding_trans = ONBOARDING_KEYS.get(lang_dir, ONBOARDING_KEYS["en"])
            dialect_trans = DIALECT_KEYS.get(lang_dir, DIALECT_KEYS["en"])

            # Add onboarding keys if missing
            for key, value in onboarding_trans.items():
                if key not in data["onboarding"]:
                    data["onboarding"][key] = value
                    print(f"  Added onboarding.{key} to {jf}")

            # Add dialect keys if missing
            for key, value in dialect_trans.items():
                if key not in data["dialects"]:
                    data["dialects"][key] = value
                    print(f"  Added dialects.{key} to {jf}")

            dump_json(jf, data)
            changed += 1
            print(f"Updated: {jf}")

    print(f"\nDone. Files updated: {changed}")


if __name__ == "__main__":
    main()
