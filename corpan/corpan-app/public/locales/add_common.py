#!/usr/bin/env python3
import json, sys, os, glob

# Map your language folder names -> translations
CTA = {
    "en": {"cancel": "Cancel", "delete": "Delete", "create": "Create"},
    "es": {"cancel": "Cancelar", "delete": "Eliminar", "create": "Crear"},
    "fr": {"cancel": "Annuler", "delete": "Supprimer", "create": "Créer"},
    "de": {"cancel": "Abbrechen", "delete": "Löschen", "create": "Erstellen"},
    "pt-BR": {"cancel": "Cancelar", "delete": "Excluir", "create": "Criar"},
    "it": {"cancel": "Annulla", "delete": "Elimina", "create": "Crea"},
    "ja": {"cancel": "キャンセル", "delete": "削除", "create": "作成"},
    "zh-Hans": {"cancel": "取消", "delete": "删除", "create": "创建"},
    "ar": {"cancel": "إلغاء", "delete": "حذف", "create": "إنشاء"},
    "ru": {"cancel": "Отмена", "delete": "Удалить", "create": "Создать"},
    "hi": {"cancel": "रद्द करें", "delete": "हटाएं", "create": "बनाएँ"},
    "vi": {"cancel": "Hủy", "delete": "Xóa", "create": "Tạo"},
    "pl": {"cancel": "Anuluj", "delete": "Usuń", "create": "Utwórz"},
    "hu": {"cancel": "Mégse", "delete": "Törlés", "create": "Létrehozás"},
    "fa": {"cancel": "لغو", "delete": "حذف", "create": "ایجاد"},
    "ko-polite": {"cancel": "취소", "delete": "삭제", "create": "생성"},
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
        if lang_dir not in CTA:
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

            data.setdefault("common", {})
            if not isinstance(data["common"], dict):
                print(f"SKIP (common not object): {jf}")
                continue

            # Merge/overwrite desired keys
            data["common"]["cancel"] = CTA[lang_dir]["cancel"]
            data["common"]["delete"] = CTA[lang_dir]["delete"]
            data["common"]["create"] = CTA[lang_dir]["create"]

            dump_json(jf, data)
            changed += 1
            print(f"Updated: {jf}")

    print(f"Done. Files updated: {changed}")


if __name__ == "__main__":
    main()
