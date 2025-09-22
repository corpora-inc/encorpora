# update_stacks_locales.py
# Overwrite/append the "stacks" translations in each locale's JSON files.
# Usage: python3 update_stacks_locales.py [root_dir]
# If root_dir is omitted, uses current working directory.

import json
import sys
from pathlib import Path
from collections import OrderedDict

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()

# Locale directories you showed:
LOCALE_DIRS = [
    "ar",
    "de",
    "en",
    "es",
    "fa",
    "fr",
    "hi",
    "hu",
    "it",
    "ja",
    "ko-polite",
    "pl",
    "pt-BR",
    "ru",
    "vi",
    "zh-Hans",
]

# Full "stacks" key set you use in code.
# Keep phrasing consistent across languages. No variables required by current usage.
STACKS_MAP = {
    "en": {
        "note": "Each stack has its own settings and history.",
        "newStackBase": "New Stack",
        "untitled": "Untitled",
        "delete": "Delete stack",
        "confirmDeleteTitle": "Delete this stack?",
        "confirmDelete": "Delete this stack? This cannot be undone.",
        "new": "New stack",
        "newName": "Name for new stack",
        "rename": "Rename",
        "selectAria": "Select a stack",
        "selectPlaceholder": "Choose…",
    },
    "ko-polite": {
        "note": "각 프로필에는 고유한 설정과 기록이 있습니다.",
        "newStackBase": "새 프로필",
        "untitled": "제목 없음",
        "delete": "프로필 삭제",
        "confirmDeleteTitle": "이 프로필을 삭제하시겠어요?",
        "confirmDelete": "이 프로필을 삭제하시겠어요? 이 작업은 취소할 수 없습니다.",
        "new": "새 프로필",
        "newName": "새 프로필 이름",
        "rename": "이름 변경",
        "selectAria": "프로필 선택",
        "selectPlaceholder": "선택…",
    },
    "es": {
        "note": "Cada perfil tiene su propia configuración e historial.",
        "newStackBase": "Nuevo perfil",
        "untitled": "Sin título",
        "delete": "Eliminar perfil",
        "confirmDeleteTitle": "¿Eliminar este perfil?",
        "confirmDelete": "¿Eliminar este perfil? Esta acción no se puede deshacer.",
        "new": "Nuevo perfil",
        "newName": "Nombre del nuevo perfil",
        "rename": "Renombrar",
        "selectAria": "Seleccionar un perfil",
        "selectPlaceholder": "Elegir…",
    },
    "fr": {
        "note": "Chaque profil possède ses propres paramètres et son historique.",
        "newStackBase": "Nouveau profil",
        "untitled": "Sans titre",
        "delete": "Supprimer le profil",
        "confirmDeleteTitle": "Supprimer ce profil ?",
        "confirmDelete": "Supprimer ce profil ? Cette action est irréversible.",
        "new": "Nouveau profil",
        "newName": "Nom du nouveau profil",
        "rename": "Renommer",
        "selectAria": "Sélectionner un profil",
        "selectPlaceholder": "Choisir…",
    },
    "de": {
        "note": "Jedes Profil hat eigene Einstellungen und einen eigenen Verlauf.",
        "newStackBase": "Neues Profil",
        "untitled": "Ohne Titel",
        "delete": "Profil löschen",
        "confirmDeleteTitle": "Dieses Profil löschen?",
        "confirmDelete": "Dieses Profil löschen? Dies kann nicht rückgängig gemacht werden.",
        "new": "Neues Profil",
        "newName": "Name des neuen Profils",
        "rename": "Umbenennen",
        "selectAria": "Profil auswählen",
        "selectPlaceholder": "Auswählen…",
    },
    "pt-BR": {
        "note": "Cada perfil tem suas próprias configurações e histórico.",
        "newStackBase": "Novo perfil",
        "untitled": "Sem título",
        "delete": "Excluir perfil",
        "confirmDeleteTitle": "Excluir este perfil?",
        "confirmDelete": "Excluir este perfil? Esta ação não pode ser desfeita.",
        "new": "Novo perfil",
        "newName": "Nome do novo perfil",
        "rename": "Renomear",
        "selectAria": "Selecionar um perfil",
        "selectPlaceholder": "Escolher…",
    },
    "ja": {
        "note": "各プロフィールにはそれぞれ独自の設定と履歴があります。",
        "newStackBase": "新しいプロフィール",
        "untitled": "無題",
        "delete": "プロフィールを削除",
        "confirmDeleteTitle": "このプロフィールを削除しますか？",
        "confirmDelete": "このプロフィールを削除しますか？ この操作は元に戻せません。",
        "new": "新しいプロフィール",
        "newName": "新しいプロフィールの名前",
        "rename": "名前を変更",
        "selectAria": "プロフィールを選択",
        "selectPlaceholder": "選択…",
    },
    "zh-Hans": {
        "note": "每个配置文件都有自己的设置和历史记录。",
        "newStackBase": "新建配置文件",
        "untitled": "未命名",
        "delete": "删除配置文件",
        "confirmDeleteTitle": "删除此配置文件？",
        "confirmDelete": "确定删除此配置文件？此操作无法撤销。",
        "new": "新建配置文件",
        "newName": "新配置文件名称",
        "rename": "重命名",
        "selectAria": "选择配置文件",
        "selectPlaceholder": "选择…",
    },
    "ar": {
        "note": "لكل ملف إعداداته وسجله الخاص.",
        "newStackBase": "مجموعة جديدة",
        "untitled": "بدون عنوان",
        "delete": "حذف المجموعة",
        "confirmDeleteTitle": "حذف هذه المجموعة؟",
        "confirmDelete": "هل تريد حذف هذه المجموعة؟ لا يمكن التراجع.",
        "new": "مجموعة جديدة",
        "newName": "اسم المجموعة الجديدة",
        "rename": "إعادة تسمية",
        "selectAria": "اختر مجموعة",
        "selectPlaceholder": "اختر…",
    },
    "ru": {
        "note": "У каждого профиля свои настройки и история.",
        "newStackBase": "Новый профиль",
        "untitled": "Без названия",
        "delete": "Удалить профиль",
        "confirmDeleteTitle": "Удалить этот профиль?",
        "confirmDelete": "Удалить этот профиль? Действие необратимо.",
        "new": "Новый профиль",
        "newName": "Название нового профиля",
        "rename": "Переименовать",
        "selectAria": "Выберите профиль",
        "selectPlaceholder": "Выбрать…",
    },
    "it": {
        "note": "Ogni profilo ha le proprie impostazioni e cronologia.",
        "newStackBase": "Nuovo profilo",
        "untitled": "Senza titolo",
        "delete": "Elimina profilo",
        "confirmDeleteTitle": "Eliminare questo profilo?",
        "confirmDelete": "Eliminare questo profilo? L'operazione è irreversibile.",
        "new": "Nuovo profilo",
        "newName": "Nome del nuovo profilo",
        "rename": "Rinomina",
        "selectAria": "Seleziona un profilo",
        "selectPlaceholder": "Scegli…",
    },
    "hi": {
        "note": "हर प्रोफ़ाइल की अपनी सेटिंग्स और इतिहास होता है।",
        "newStackBase": "नया प्रोफ़ाइल",
        "untitled": "बिना शीर्षक",
        "delete": "प्रोफ़ाइल हटाएँ",
        "confirmDeleteTitle": "क्या यह प्रोफ़ाइल हटाएँ?",
        "confirmDelete": "क्या आप यह प्रोफ़ाइल हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।",
        "new": "नया प्रोफ़ाइल",
        "newName": "नए प्रोफ़ाइल का नाम",
        "rename": "नाम बदलें",
        "selectAria": "प्रोफ़ाइल चुनें",
        "selectPlaceholder": "चुनें…",
    },
    "vi": {
        "note": "Mỗi hồ sơ có cài đặt và lịch sử riêng.",
        "newStackBase": "Hồ sơ mới",
        "untitled": "Không tiêu đề",
        "delete": "Xóa hồ sơ",
        "confirmDeleteTitle": "Xóa hồ sơ này?",
        "confirmDelete": "Xóa hồ sơ này? Hành động không thể hoàn tác.",
        "new": "Hồ sơ mới",
        "newName": "Tên hồ sơ mới",
        "rename": "Đổi tên",
        "selectAria": "Chọn hồ sơ",
        "selectPlaceholder": "Chọn…",
    },
    "pl": {
        "note": "Każdy profil ma własne ustawienia i historię.",
        "newStackBase": "Nowy profil",
        "untitled": "Bez tytułu",
        "delete": "Usuń profil",
        "confirmDeleteTitle": "Usunąć ten profil?",
        "confirmDelete": "Usunąć ten profil? Tej operacji nie można cofnąć.",
        "new": "Nowy profil",
        "newName": "Nazwa nowego profilu",
        "rename": "Zmień nazwę",
        "selectAria": "Wybierz profil",
        "selectPlaceholder": "Wybierz…",
    },
    "hu": {
        "note": "Minden profilnak saját beállításai és előzményei vannak.",
        "newStackBase": "Új profil",
        "untitled": "Névtelen",
        "delete": "Profil törlése",
        "confirmDeleteTitle": "Töröljük ezt a profilt?",
        "confirmDelete": "Biztos törlöd ezt a profilt? A művelet nem visszavonható.",
        "new": "Új profil",
        "newName": "Új profil neve",
        "rename": "Átnevezés",
        "selectAria": "Profil kiválasztása",
        "selectPlaceholder": "Válassz…",
    },
    "fa": {
        "note": "هر پروفایلی تنظیمات و تاریخچهٔ مخصوص به خود را دارد.",
        "newStackBase": "پروفایل جدید",
        "untitled": "بی‌نام",
        "delete": "حذف پروفایل",
        "confirmDeleteTitle": "این پروفایل حذف شود؟",
        "confirmDelete": "آیا از حذف این پروفایل مطمئن هستید؟ این عملیات قابل بازگشت نیست.",
        "new": "پروفایل جدید",
        "newName": "نام پروفایل جدید",
        "rename": "تغییر نام",
        "selectAria": "انتخاب پروفایل",
        "selectPlaceholder": "انتخاب…",
    },
}


def update_json_file(fp: Path, stacks_block: dict) -> bool:
    try:
        with fp.open("r", encoding="utf-8") as f:
            data = json.load(f, object_pairs_hook=OrderedDict)
    except Exception as e:
        print(f"!! skip (parse error): {fp} -> {e}")
        return False

    # Remove any existing "stacks" to re-append at the end (preserves overall order)
    if "stacks" in data:
        del data["stacks"]
    data["stacks"] = stacks_block

    try:
        with fp.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    except Exception as e:
        print(f"!! write failed: {fp} -> {e}")
        return False

    print(f"✓ updated: {fp}")
    return True


def main():
    total = 0
    for loc in LOCALE_DIRS:
        loc_dir = ROOT / loc
        if not loc_dir.is_dir():
            print(f"-- missing locale dir: {loc_dir}")
            continue

        stacks_block = STACKS_MAP.get(loc if loc in STACKS_MAP else "en")
        # Fallback to English if a locale mapping is missing
        if stacks_block is None:
            stacks_block = STACKS_MAP["en"]

        for fp in loc_dir.rglob("*.json"):
            if update_json_file(fp, stacks_block):
                total += 1

    print(f"\nDone. Updated {total} file(s).")


if __name__ == "__main__":
    main()
