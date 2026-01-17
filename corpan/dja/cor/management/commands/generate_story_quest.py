import json
import re
import time
import sqlite3
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import connections, transaction

from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
from cor.models import (
    Language,
    StoryEdge,
    StoryEdgeCondition,
    StoryEdgeEffect,
    StoryEpisode,
    StoryNode,
    StoryNodeEffect,
    StoryQuest,
    StoryScene,
    StoryStateVar,
    StoryTextUnit,
    StoryTextUnitTranslation,
)
from cor.utils.llm import translate_entry_batch
from pydantic import BaseModel
from typing import Dict, Iterable, List, Optional, Literal, TypeVar

SCHEMA_SQL = """
CREATE TABLE story_quest(
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  default_language TEXT,
  start_scene_id TEXT,
  metadata_json TEXT
);

CREATE TABLE story_episode(
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  order_index INTEGER,
  metadata_json TEXT
);

CREATE TABLE story_scene(
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL,
  episode_id TEXT,
  title TEXT NOT NULL,
  scene_type TEXT,
  summary TEXT,
  visual_json TEXT,
  metadata_json TEXT
);

CREATE TABLE story_text_unit(
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL,
  default_text TEXT NOT NULL,
  context TEXT,
  notes TEXT
);

CREATE TABLE story_text_unit_translation(
  id INTEGER PRIMARY KEY,
  text_unit_id INTEGER NOT NULL,
  language_code TEXT NOT NULL,
  text TEXT NOT NULL,
  romanization TEXT
);

CREATE TABLE story_node(
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  text_unit_id INTEGER,
  action_key TEXT,
  order_index INTEGER,
  metadata_json TEXT
);

CREATE TABLE story_edge(
  id TEXT PRIMARY KEY,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT,
  to_scene_id TEXT,
  edge_type TEXT NOT NULL,
  label_text_unit_id INTEGER,
  order_index INTEGER,
  metadata_json TEXT
);

CREATE TABLE story_state_var(
  id INTEGER PRIMARY KEY,
  quest_id TEXT NOT NULL,
  name TEXT NOT NULL,
  var_type TEXT NOT NULL,
  min_value INTEGER,
  max_value INTEGER,
  default_value TEXT
);

CREATE TABLE story_node_effect(
  id INTEGER PRIMARY KEY,
  node_id TEXT NOT NULL,
  op TEXT NOT NULL,
  var_name TEXT NOT NULL,
  value TEXT
);

CREATE TABLE story_edge_condition(
  id INTEGER PRIMARY KEY,
  edge_id TEXT NOT NULL,
  group_key TEXT,
  op TEXT NOT NULL,
  var_name TEXT NOT NULL,
  value TEXT
);

CREATE TABLE story_edge_effect(
  id INTEGER PRIMARY KEY,
  edge_id TEXT NOT NULL,
  op TEXT NOT NULL,
  var_name TEXT NOT NULL,
  value TEXT
);

CREATE INDEX story_scene_quest_id ON story_scene(quest_id);
CREATE INDEX story_node_scene_id ON story_node(scene_id);
CREATE INDEX story_edge_from_node_id ON story_edge(from_node_id);
CREATE INDEX story_text_unit_translation_lang ON story_text_unit_translation(language_code);
"""


def json_or_none(value):
    if value in (None, "", {}, []):
        return None
    return json.dumps(value, ensure_ascii=True)


class StoryBranchChoice(BaseModel):
    label: str
    line: str


class StorySceneDraft(BaseModel):
    scene_id: str
    scene_type: Literal["scene", "action"]
    title: str
    summary: str
    lines: List[str] = []
    action_text: Optional[str] = None
    branch_choices: List[StoryBranchChoice] = []
    exit_labels: List[str] = []


class StoryDraft(BaseModel):
    scenes: List[StorySceneDraft]


STORY_MODELS = [
    StoryQuest,
    StoryEpisode,
    StoryScene,
    StoryTextUnit,
    StoryTextUnitTranslation,
    StoryNode,
    StoryEdge,
    StoryStateVar,
    StoryNodeEffect,
    StoryEdgeCondition,
    StoryEdgeEffect,
]


def find_repo_root(start: Path) -> Path:
    for parent in (start, *start.parents):
        if (parent / "encorpora").exists() and (parent / "py").exists():
            return parent
    return start


def resolve_cli_path(
    path_str: str, repo_root: Path, base_dir: Path, must_exist: bool
) -> Path:
    raw = Path(path_str)
    if raw.is_absolute():
        return raw

    repo_root_prefixes = {
        "encorpora",
        "py",
        "rs",
        "ts",
        "md",
        "tex",
        "docker",
        "host-shared",
    }
    if raw.parts and raw.parts[0] in repo_root_prefixes:
        return repo_root / raw

    candidates = [
        Path.cwd() / raw,
        base_dir / raw,
        base_dir.parent / raw,
        repo_root / raw,
    ]
    for candidate in candidates:
        if must_exist:
            if candidate.exists():
                return candidate
        else:
            if candidate.parent.exists():
                return candidate

    return candidates[0] if candidates else base_dir / raw


def clean_line_text(text: str) -> str:
    if not text:
        return ""
    cleaned = text.strip()
    cleaned = re.sub(r"^\s*\d+\s*[:\.\)\-]\s*", "", cleaned)
    cleaned = re.sub(r"^\s*[A-Za-z][\w'\-]{0,20}:\s*", "", cleaned)
    return cleaned.strip()


def ensure_story_schema(db_alias: str) -> None:
    connection = connections[db_alias]
    existing = set(connection.introspection.table_names())
    with connection.schema_editor() as schema_editor:
        for model in STORY_MODELS:
            if model._meta.db_table in existing:
                continue
            schema_editor.create_model(model)


T = TypeVar("T")


def chunked(items: List[T], size: int) -> Iterable[List[T]]:
    if size <= 0:
        raise ValueError("Chunk size must be positive.")
    for i in range(0, len(items), size):
        yield items[i : i + size]


def load_backstory(path: Optional[Path]) -> str:
    if not path:
        return ""
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def generate_story_draft(
    llm,
    title: str,
    description: str,
    scene_specs: List[Dict[str, object]],
    npc_names: List[str],
    backstory: str,
    seed: int,
) -> StoryDraft:
    system = ChatCompletionTextMessage(
        role="system",
        text=(
            "You are a narrative designer for a branching quest focused on language learning. "
            "Write grounded, everyday scenes with light intrigue and subtle hints about the All-Hearing Ear. "
            "Tone: calm, clear, modern, and human; avoid surrealism, hallucinations, or metaphysical language. "
            "Each line must be a single, standalone sentence suitable for A2-B1 learners. "
            "Keep sentences short, natural, and useful; aim for 7-16 words. "
            "Limit figurative language; one mild image per scene at most. "
            "Use mostly narration with at most two dialogue lines per scene. "
            "If you include dialogue, keep it brief and realistic; avoid speaker labels like \"Kendi:\". "
            "Do not repeat character names on every line; use names sparingly and stick to 1-2 per scene. "
            "Do not prefix lines with numbers, bullets, or labels. "
            "No placeholders, no boilerplate, avoid repeating imagery across scenes. "
            "Return structured output that exactly matches the schema."
        ),
    )

    backstory_block = backstory if backstory else "No backstory provided."
    spec_payload = json.dumps(scene_specs, ensure_ascii=True, indent=2)
    user = ChatCompletionTextMessage(
        role="user",
        text=(
            f"Quest title: {title}\n"
            f"Quest description: {description}\n"
            f"Seed: {seed}\n"
            f"NPC names to weave in (use some of these, 1-2 per scene max): {', '.join(npc_names)}\n\n"
            f"Backstory:\n{backstory_block}\n\n"
            "Scene plan (JSON):\n"
            f"{spec_payload}\n\n"
            "For each scene:\n"
            "- If scene_type is 'scene', provide exactly line_count lines.\n"
            "- If scene_type is 'action', provide action_text and no lines.\n"
            "- Use branch_choice_count to determine how many branch_choices to return.\n"
            "- Use exit_label_count to determine how many exit_labels to return.\n"
            "- Keep all lines and action_text to one sentence each, 7-16 words, everyday vocabulary.\n"
            "- Make branch choice labels short and practical (2-6 words).\n"
            "- Keep the overall story grounded and coherent; intrigue should be subtle.\n"
            "- Do not include numbering or speaker labels in any line or label.\n"
            "Return a JSON tool call matching StoryDraft."
        ),
    )

    return llm.get_data_completion([system, user], StoryDraft)


class Command(BaseCommand):
    help = "Generate a story quest with scenes, nodes, and translations. Optional export to a pack SQLite DB."

    def add_arguments(self, parser):
        parser.add_argument("--quest-id", type=str, default="all_hearing_ear")
        parser.add_argument(
            "--title", type=str, default="On the Trail of the All-Hearing Ear"
        )
        parser.add_argument(
            "--description", type=str, default="A branching story about the lost Ear."
        )
        parser.add_argument("--scenes", type=int, default=8)
        parser.add_argument("--episodes", type=int, default=2)
        parser.add_argument("--lines-per-scene", type=int, default=5)
        parser.add_argument("--languages", type=str, default="")
        parser.add_argument("--seed", type=int, default=17)
        parser.add_argument("--branch-every", type=int, default=2)
        parser.add_argument("--action-every", type=int, default=4)
        parser.add_argument("--force", action="store_true", default=False)
        parser.add_argument(
            "--db-path",
            type=str,
            default="encorpora/corpan/packs/quest-ear/data/story.sqlite3",
        )
        parser.add_argument("--export-path", type=str, default="")
        parser.add_argument("--llm-provider", type=str, default="")
        parser.add_argument("--llm-model", type=str, default="")
        parser.add_argument("--llm-base-url", type=str, default="")
        parser.add_argument(
            "--backstory-path",
            type=str,
            default="encorpora/corpan/packs/quest-ear/BACKSTORY.md",
        )
        parser.add_argument("--translation-batch-size", type=int, default=20)
        parser.add_argument("--draft-chunk-size", type=int, default=6)

    def handle(self, *args, **options):
        quest_id = options["quest_id"]
        title = options["title"]
        description = options["description"]
        scene_count = options["scenes"]
        episode_count = max(1, options["episodes"])
        lines_per_scene = max(1, options["lines_per_scene"])
        seed = options["seed"]
        branch_every = options["branch_every"]
        action_every = options["action_every"]
        force = options["force"]
        export_path = options["export_path"]
        db_path = options["db_path"]
        llm_provider = options["llm_provider"]
        llm_model = options["llm_model"]
        llm_base_url = options["llm_base_url"]
        backstory_path = options["backstory_path"]
        translation_batch_size = max(1, options["translation_batch_size"])
        draft_chunk_size = max(0, options["draft_chunk_size"])

        started_at = time.time()
        base_dir = Path(__file__).resolve().parents[3]
        repo_root = find_repo_root(base_dir)

        story_db_path = resolve_cli_path(db_path, repo_root, base_dir, must_exist=False)
        story_db_path.parent.mkdir(parents=True, exist_ok=True)
        if not story_db_path.exists():
            story_db_path.touch()
        db_alias = "story_pack"
        db_settings = connections.databases["default"].copy()
        db_settings["ENGINE"] = "django.db.backends.sqlite3"
        db_settings["NAME"] = str(story_db_path)
        connections.databases[db_alias] = db_settings
        ensure_story_schema(db_alias)
        self.stdout.write(f"Using story DB: {story_db_path}")

        if force:
            StoryQuest.objects.using(db_alias).filter(id=quest_id).delete()

        if StoryQuest.objects.using(db_alias).filter(id=quest_id).exists():
            raise RuntimeError(
                f"Quest '{quest_id}' already exists (use --force to replace)."
            )

        languages_arg = options["languages"].strip()
        if languages_arg:
            language_codes = [c.strip() for c in languages_arg.split(",") if c.strip()]
            available_codes = set(Language.objects.values_list("code", flat=True))
            missing = [code for code in language_codes if code not in available_codes]
            if missing:
                raise RuntimeError(
                    "Unknown language codes (add Language entries or update --languages): "
                    + ", ".join(missing)
                )
        else:
            language_codes = list(Language.objects.values_list("code", flat=True))
        if not language_codes:
            raise RuntimeError(
                "No languages available; populate Language or pass --languages."
            )
        if "en" not in language_codes:
            language_codes.insert(0, "en")
        seen_langs = set()
        language_codes = [
            code
            for code in language_codes
            if not (code in seen_langs or seen_langs.add(code))
        ]

        llm_kwargs = {}
        if llm_model:
            llm_kwargs["completion_model"] = llm_model
        if llm_provider == "local" and llm_base_url:
            llm_kwargs["base_url"] = llm_base_url
        llm = load_llm_provider(llm_provider, **llm_kwargs)

        backstory_candidate = resolve_cli_path(
            backstory_path, repo_root, base_dir, must_exist=True
        )
        backstory = load_backstory(backstory_candidate)
        if backstory_path and not backstory:
            self.stdout.write(
                f"Backstory not found at {backstory_candidate}; continuing without it."
            )

        if export_path:
            export_path = str(
                resolve_cli_path(export_path, repo_root, base_dir, must_exist=False)
            )

        themes = [
            ("Market of Whispered Tongues", "market", ["lanterns", "citrus", "cables"]),
            ("Service Tunnels", "tunnel", ["echoes", "steel", "distant water"]),
            ("Archive Loft", "archive", ["dust", "ink", "whispered notes"]),
            ("Temple Approach", "temple", ["stone", "wind", "humming air"]),
            ("Night Shift Cafe", "cafe", ["steam", "spices", "soft light"]),
        ]
        npc_names = ["Kendi", "Pari", "Luo", "Sana", "Kaito"]

        episode_ids = [f"E{i+1:02d}" for i in range(episode_count)]
        scene_theme_specs = []
        for i in range(scene_count):
            scene_id = f"S{i+1:03d}"
            theme_title, theme_key, theme_words = themes[i % len(themes)]
            scene_theme_specs.append(
                {
                    "scene_id": scene_id,
                    "episode_id": episode_ids[i % episode_count],
                    "episode_index": i % episode_count,
                    "theme_title": theme_title,
                    "theme_key": theme_key,
                    "theme_words": theme_words,
                }
            )

        scene_specs = []
        for i, spec in enumerate(scene_theme_specs):
            is_action = action_every > 0 and (i + 1) % action_every == 0
            branch_choice_count = (
                2
                if branch_every > 0
                and (i + 1) % branch_every == 0
                and lines_per_scene >= 4
                else 0
            )
            exit_targets = []
            if i % 3 == 0 and i + 2 < scene_count:
                next_spec = scene_theme_specs[i + 1]
                alt_spec = scene_theme_specs[i + 2]
                exit_targets = [
                    {
                        "to_scene_id": next_spec["scene_id"],
                        "theme_title": next_spec["theme_title"],
                    },
                    {
                        "to_scene_id": alt_spec["scene_id"],
                        "theme_title": alt_spec["theme_title"],
                    },
                ]
            scene_specs.append(
                {
                    "scene_id": spec["scene_id"],
                    "scene_type": "action" if is_action else "scene",
                    "episode_id": spec["episode_id"],
                    "episode_index": spec["episode_index"],
                    "theme_title": spec["theme_title"],
                    "theme_key": spec["theme_key"],
                    "theme_words": spec["theme_words"],
                    "line_count": 0 if is_action else lines_per_scene,
                    "branch_choice_count": branch_choice_count,
                    "exit_label_count": len(exit_targets),
                    "exit_targets": exit_targets,
                }
            )

        if draft_chunk_size == 0:
            draft_chunk_size = scene_count
        draft_chunk_size = min(scene_count, draft_chunk_size)
        draft_chunks = list(chunked(scene_specs, draft_chunk_size))
        total_chunks = len(draft_chunks)
        draft_scenes: List[StorySceneDraft] = []
        self.stdout.write(
            f"Generating story draft: {scene_count} scenes "
            f"({lines_per_scene} lines/scene), {total_chunks} LLM call(s)..."
        )
        for idx, chunk in enumerate(draft_chunks, start=1):
            chunk_scene_ids = [spec["scene_id"] for spec in chunk]
            remaining_chunks = total_chunks - idx
            self.stdout.write(
                f"  LLM draft {idx}/{total_chunks} "
                f"({len(chunk_scene_ids)} scenes: {chunk_scene_ids[0]}..{chunk_scene_ids[-1]}; "
                f"{remaining_chunks} chunk(s) left)"
            )
            chunk_start = time.time()
            chunk_draft = generate_story_draft(
                llm=llm,
                title=title,
                description=description,
                scene_specs=chunk,
                npc_names=npc_names,
                backstory=backstory,
                seed=seed,
            )
            draft_scenes.extend(chunk_draft.scenes)
            chunk_elapsed = time.time() - chunk_start
            self.stdout.write(
                f"  LLM draft {idx}/{total_chunks} done in {chunk_elapsed:.1f}s "
                f"({len(chunk_draft.scenes)} scenes)"
            )

        draft = StoryDraft(scenes=draft_scenes)
        self.stdout.write("Draft generated; validating output.")
        draft_by_id = {scene.scene_id: scene for scene in draft.scenes}
        expected_scene_ids = [spec["scene_id"] for spec in scene_specs]
        missing_ids = [
            scene_id for scene_id in expected_scene_ids if scene_id not in draft_by_id
        ]
        extra_ids = [
            scene_id for scene_id in draft_by_id if scene_id not in expected_scene_ids
        ]
        if missing_ids or extra_ids:
            raise RuntimeError(
                "LLM scene IDs mismatch. "
                f"Missing: {missing_ids or 'none'}. Extra: {extra_ids or 'none'}."
            )

        normalized_draft = {}
        for spec in scene_specs:
            scene_id = spec["scene_id"]
            scene_draft = draft_by_id[scene_id]
            if scene_draft.scene_type != spec["scene_type"]:
                raise RuntimeError(
                    f"Scene {scene_id} returned type {scene_draft.scene_type}, expected {spec['scene_type']}."
                )
            if spec["scene_type"] == "scene":
                lines = [clean_line_text(line) for line in scene_draft.lines]
                if len(lines) < lines_per_scene:
                    raise RuntimeError(
                        f"Scene {scene_id} returned {len(lines)} lines; expected {lines_per_scene}."
                    )
                lines = lines[:lines_per_scene]
                if any(not line for line in lines):
                    raise RuntimeError(f"Scene {scene_id} returned empty line content.")
                action_text = ""
            else:
                lines = []
                action_text = clean_line_text(scene_draft.action_text or "")
                if not action_text:
                    raise RuntimeError(
                        f"Scene {scene_id} is action but returned no action_text."
                    )

            branch_count = spec["branch_choice_count"]
            branch_choices = scene_draft.branch_choices[:branch_count]
            if branch_count and len(branch_choices) < branch_count:
                raise RuntimeError(
                    f"Scene {scene_id} returned {len(branch_choices)} branch choices; expected {branch_count}."
                )
            for choice in branch_choices:
                choice.label = clean_line_text(choice.label or "")
                choice.line = clean_line_text(choice.line or "")
                if not choice.label or not choice.line:
                    raise RuntimeError(
                        f"Scene {scene_id} returned a blank branch choice."
                    )
            exit_label_count = spec["exit_label_count"]
            exit_labels = [
                clean_line_text(label)
                for label in scene_draft.exit_labels[:exit_label_count]
            ]
            if exit_label_count and len(exit_labels) < exit_label_count:
                raise RuntimeError(
                    f"Scene {scene_id} returned {len(exit_labels)} exit labels; expected {exit_label_count}."
                )
            if any(not label for label in exit_labels):
                raise RuntimeError(f"Scene {scene_id} returned a blank exit label.")

            normalized_draft[scene_id] = {
                "draft": scene_draft,
                "lines": lines,
                "action_text": action_text,
                "branch_choices": branch_choices,
                "exit_labels": exit_labels,
            }

        with transaction.atomic(using=db_alias):
            quest = StoryQuest.objects.using(db_alias).create(
                id=quest_id,
                title=title,
                description=description,
                default_language="en",
                metadata_json={
                    "seed": seed,
                    "scene_count": scene_count,
                    "llm_provider": llm_provider or "default",
                    "llm_model": llm_model or "",
                    "backstory_path": backstory_path if backstory else "",
                },
            )

            StoryStateVar.objects.using(db_alias).create(
                quest=quest,
                name="ear_fragments",
                var_type="int",
                min_value=0,
                max_value=7,
                default_value=0,
            )
            StoryStateVar.objects.using(db_alias).create(
                quest=quest,
                name="trust_kendi",
                var_type="int",
                min_value=-3,
                max_value=5,
                default_value=0,
            )
            StoryStateVar.objects.using(db_alias).create(
                quest=quest,
                name="vow_silence",
                var_type="bool",
                default_value=False,
            )

            episodes = []
            for i in range(episode_count):
                ep_id = f"E{i+1:02d}"
                episodes.append(
                    StoryEpisode.objects.using(db_alias).create(
                        id=ep_id,
                        quest=quest,
                        title=f"Episode {i+1}",
                        summary=f"Arc {i+1} of the Ear's trail.",
                        order_index=i,
                        metadata_json={"index": i},
                    )
                )

            scene_order = []
            scene_last_nodes = {}

            text_units = []
            created_counts = {
                "scenes": 0,
                "nodes": 0,
                "edges": 0,
                "text_units": 0,
                "effects": 0,
                "conditions": 0,
            }

            def create_text_unit(key, text, context=""):
                unit = StoryTextUnit.objects.using(db_alias).create(
                    key=key,
                    default_text=text,
                    context=context,
                    notes="",
                )
                text_units.append(unit)
                created_counts["text_units"] += 1
                return unit

            scene_exit_labels = {}
            for i, spec in enumerate(scene_specs):
                if (i + 1) % 5 == 0 or i == 0 or i + 1 == scene_count:
                    remaining_scenes = scene_count - (i + 1)
                    self.stdout.write(
                        f"Creating scene {i+1}/{scene_count} ({remaining_scenes} left)..."
                    )
                scene_id = spec["scene_id"]
                theme_title = spec["theme_title"]
                theme_key = spec["theme_key"]
                theme_words = spec["theme_words"]
                draft_scene = normalized_draft[scene_id]["draft"]
                scene_exit_labels[scene_id] = normalized_draft[scene_id]["exit_labels"]

                scene = StoryScene.objects.using(db_alias).create(
                    id=scene_id,
                    quest=quest,
                    episode=episodes[spec["episode_index"]],
                    title=(draft_scene.title or "").strip() or f"{theme_title} {i+1}",
                    scene_type=draft_scene.scene_type,
                    summary=(draft_scene.summary or "").strip(),
                    visual_json={
                        "theme": theme_key,
                        "tags": theme_words,
                        "layers": [
                            {"id": "bg", "kind": "gradient", "palette": theme_key},
                            {
                                "id": "npc",
                                "kind": "silhouette",
                                "name": npc_names[i % len(npc_names)],
                            },
                        ],
                        "tracks": [
                            {
                                "target": "bg",
                                "prop": "x",
                                "keyframes": [{"at": 0, "v": 0}, {"at": 1, "v": -120}],
                            },
                            {
                                "target": "npc",
                                "prop": "opacity",
                                "keyframes": [{"at": 0.1, "v": 0}, {"at": 0.2, "v": 1}],
                            },
                        ],
                        "cues": [{"at": 0.35, "event": "npc_talk"}],
                    },
                    metadata_json={"theme_words": theme_words},
                )
                scene_order.append(scene)
                created_counts["scenes"] += 1

                if draft_scene.scene_type == "action":
                    action_text = normalized_draft[scene_id]["action_text"]
                    unit = create_text_unit(
                        f"{scene_id}_ACTION", action_text, context="action"
                    )
                    node = StoryNode.objects.using(db_alias).create(
                        scene=scene,
                        node_type="action",
                        text_unit=unit,
                        action_key="ActionScene",
                        order_index=0,
                    )
                    created_counts["nodes"] += 1
                    scene_last_nodes[scene.id] = node
                    continue

                main_nodes = []
                for j, line in enumerate(normalized_draft[scene_id]["lines"]):
                    unit = create_text_unit(
                        f"{scene_id}_LINE_{j+1}", line, context=theme_key
                    )
                    node = StoryNode.objects.using(db_alias).create(
                        scene=scene, node_type="text", text_unit=unit, order_index=j
                    )
                    created_counts["nodes"] += 1
                    main_nodes.append(node)

                branch_index = None
                if spec["branch_choice_count"] and len(main_nodes) >= 4:
                    branch_index = 2

                for j in range(len(main_nodes) - 1):
                    if branch_index is not None and j == branch_index:
                        continue
                    StoryEdge.objects.using(db_alias).create(
                        from_node=main_nodes[j],
                        to_node=main_nodes[j + 1],
                        edge_type="auto",
                        order_index=0,
                    )
                    created_counts["edges"] += 1

                if branch_index is not None:
                    branch_from = main_nodes[branch_index]
                    branch_to = main_nodes[branch_index + 1]
                    for choice_index, choice in enumerate(
                        normalized_draft[scene_id]["branch_choices"]
                    ):
                        branch_text = (choice.line or "").strip()
                        branch_unit = create_text_unit(
                            f"{scene_id}_BRANCH_{choice_index+1}",
                            branch_text,
                            context="branch",
                        )
                        branch_node = StoryNode.objects.using(db_alias).create(
                            scene=scene,
                            node_type="text",
                            text_unit=branch_unit,
                            order_index=branch_from.order_index + 1 + choice_index,
                        )
                        created_counts["nodes"] += 1
                        label_unit = create_text_unit(
                            f"{scene_id}_CHOICE_{choice_index+1}",
                            (choice.label or "").strip(),
                            context="choice",
                        )
                        edge = StoryEdge.objects.using(db_alias).create(
                            from_node=branch_from,
                            to_node=branch_node,
                            edge_type="choice",
                            label_text_unit=label_unit,
                            order_index=choice_index,
                        )
                        created_counts["edges"] += 1
                        StoryEdgeEffect.objects.using(db_alias).create(
                            edge=edge,
                            op="inc",
                            var_name="ear_fragments"
                            if choice_index == 0
                            else "trust_kendi",
                            value=1,
                        )
                        created_counts["effects"] += 1
                        StoryEdge.objects.using(db_alias).create(
                            from_node=branch_node,
                            to_node=branch_to,
                            edge_type="auto",
                            order_index=0,
                        )
                        created_counts["edges"] += 1

                scene_last_nodes[scene.id] = main_nodes[-1]
                if (i + 1) % 5 == 0 or i + 1 == scene_count:
                    self.stdout.write(
                        "  Totals: "
                        f"scenes={created_counts['scenes']}, "
                        f"nodes={created_counts['nodes']}, "
                        f"edges={created_counts['edges']}, "
                        f"text_units={created_counts['text_units']}, "
                        f"effects={created_counts['effects']}, "
                        f"conditions={created_counts['conditions']}"
                    )

            quest.start_scene = scene_order[0]
            quest.save(update_fields=["start_scene"], using=db_alias)

            for idx, scene in enumerate(scene_order):
                last_node = scene_last_nodes[scene.id]
                if idx == len(scene_order) - 1:
                    end_text = "The hum fades. The Ear listens back."
                    end_unit = create_text_unit(
                        f"{scene.id}_END", end_text, context="end"
                    )
                    end_node = StoryNode.objects.using(db_alias).create(
                        scene=scene,
                        node_type="end",
                        text_unit=end_unit,
                        order_index=999,
                    )
                    created_counts["nodes"] += 1
                    StoryEdge.objects.using(db_alias).create(
                        from_node=last_node,
                        to_node=end_node,
                        edge_type="auto",
                        order_index=0,
                    )
                    created_counts["edges"] += 1
                    continue

                next_scene = scene_order[idx + 1]
                if idx % 3 == 0 and idx + 2 < len(scene_order):
                    alt_scene = scene_order[idx + 2]
                    for choice_index, target_scene in enumerate(
                        [next_scene, alt_scene]
                    ):
                        fallback_label = f"Go to {target_scene.title}"
                        exit_labels = scene_exit_labels.get(scene.id, [])
                        label_text = (
                            exit_labels[choice_index]
                            if choice_index < len(exit_labels)
                            else fallback_label
                        )
                        label_unit = create_text_unit(
                            f"{scene.id}_EXIT_{choice_index+1}",
                            label_text,
                            context="exit_choice",
                        )
                        edge = StoryEdge.objects.using(db_alias).create(
                            from_node=last_node,
                            to_scene=target_scene,
                            edge_type="choice",
                            label_text_unit=label_unit,
                            order_index=choice_index,
                        )
                        created_counts["edges"] += 1
                        if choice_index == 1:
                            StoryEdgeCondition.objects.using(db_alias).create(
                                edge=edge,
                                group_key="requires_any_0",
                                op="gte",
                                var_name="ear_fragments",
                                value=1,
                            )
                            created_counts["conditions"] += 1
                else:
                    StoryEdge.objects.using(db_alias).create(
                        from_node=last_node,
                        to_scene=next_scene,
                        edge_type="auto",
                        order_index=0,
                    )
                    created_counts["edges"] += 1

            total_units = len(text_units)
            target_langs = [code for code in language_codes if code != "en"]
            total_batches = (total_units + translation_batch_size - 1) // translation_batch_size
            total_calls = total_batches * len(target_langs)
            completed_calls = 0
            self.stdout.write(
                f"Translating {total_units} text units into {len(language_codes)} languages "
                f"({len(target_langs)} via LLM, {total_batches} batch(es) each, {total_calls} call(s))..."
            )
            translations = []
            for lang in language_codes:
                if lang == "en":
                    translations.extend(
                        [
                            StoryTextUnitTranslation(
                                text_unit=unit,
                                language_code=lang,
                                text=unit.default_text,
                                romanization="",
                            )
                            for unit in text_units
                        ]
                    )
                    continue

                for batch_index, batch in enumerate(
                    chunked(text_units, translation_batch_size), start=1
                ):
                    completed_calls += 1
                    remaining_calls = total_calls - completed_calls
                    batch_first = (batch_index - 1) * translation_batch_size + 1
                    batch_last = min(batch_index * translation_batch_size, total_units)
                    self.stdout.write(
                        f"  LLM translate {lang} batch {batch_index}/{total_batches} "
                        f"(units {batch_first}-{batch_last}/{total_units}) "
                        f"overall {completed_calls}/{total_calls} ({remaining_calls} left)"
                    )
                    batch_start = time.time()
                    entries = [(unit.id, unit.default_text) for unit in batch]
                    result = translate_entry_batch(
                        lang,
                        entries,
                        llm=llm,
                        dry_run=True,
                    )
                    batch_elapsed = time.time() - batch_start
                    self.stdout.write(
                        f"  LLM translate {lang} batch {batch_index}/{total_batches} "
                        f"done in {batch_elapsed:.1f}s"
                    )
                    by_id = {
                        item.entry_id: item.translated_text
                        for item in result.translations
                    }
                    for unit in batch:
                        text = (by_id.get(unit.id) or "").strip()
                        if not text:
                            self.stdout.write(
                                f"[warn] Missing translation for {unit.key} in {lang}; "
                                "falling back to English."
                            )
                            text = unit.default_text
                        translations.append(
                            StoryTextUnitTranslation(
                                text_unit=unit,
                                language_code=lang,
                                text=text,
                                romanization="",
                            )
                        )

            StoryTextUnitTranslation.objects.using(db_alias).bulk_create(
                translations,
                ignore_conflicts=True,
            )
            total_translations = len(translations)

        elapsed = time.time() - started_at
        self.stdout.write(
            f"Generated quest '{quest_id}' with {scene_count} scenes and {episode_count} episodes."
        )
        self.stdout.write(
            "Totals: "
            f"scenes={created_counts['scenes']}, "
            f"nodes={created_counts['nodes']}, "
            f"edges={created_counts['edges']}, "
            f"text_units={created_counts['text_units']}, "
            f"effects={created_counts['effects']}, "
            f"conditions={created_counts['conditions']}, "
            f"translations={total_translations}"
        )
        self.stdout.write(f"Total time: {elapsed:.1f}s")

        if export_path:
            export_story_pack(
                Path(export_path), quest_id, stdout=self.stdout, db_alias=db_alias
            )


def export_story_pack(
    path: Path, quest_id: str, stdout=None, db_alias: str = "default"
):
    quest = StoryQuest.objects.using(db_alias).get(id=quest_id)
    episodes = list(StoryEpisode.objects.using(db_alias).filter(quest=quest))
    scenes = list(StoryScene.objects.using(db_alias).filter(quest=quest))
    nodes = list(StoryNode.objects.using(db_alias).filter(scene__quest=quest))
    edges = list(
        StoryEdge.objects.using(db_alias).filter(from_node__scene__quest=quest)
    )
    state_vars = list(StoryStateVar.objects.using(db_alias).filter(quest=quest))
    node_effects = list(
        StoryNodeEffect.objects.using(db_alias).filter(node__scene__quest=quest)
    )
    edge_conditions = list(
        StoryEdgeCondition.objects.using(db_alias).filter(edge__in=edges)
    )
    edge_effects = list(StoryEdgeEffect.objects.using(db_alias).filter(edge__in=edges))

    text_unit_ids = {n.text_unit_id for n in nodes if n.text_unit_id}
    text_unit_ids.update({e.label_text_unit_id for e in edges if e.label_text_unit_id})
    text_units = list(
        StoryTextUnit.objects.using(db_alias).filter(id__in=text_unit_ids)
    )
    translations = list(
        StoryTextUnitTranslation.objects.using(db_alias).filter(
            text_unit_id__in=text_unit_ids
        )
    )

    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()

    conn = sqlite3.connect(str(path))
    conn.executescript(SCHEMA_SQL)
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO story_quest(id, title, description, default_language, start_scene_id, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            quest.id,
            quest.title,
            quest.description,
            quest.default_language,
            quest.start_scene_id,
            json_or_none(quest.metadata_json),
        ),
    )

    cur.executemany(
        """
        INSERT INTO story_episode(id, quest_id, title, summary, order_index, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                ep.id,
                ep.quest_id,
                ep.title,
                ep.summary,
                ep.order_index,
                json_or_none(ep.metadata_json),
            )
            for ep in episodes
        ],
    )

    cur.executemany(
        """
        INSERT INTO story_scene(id, quest_id, episode_id, title, scene_type, summary, visual_json, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                s.id,
                s.quest_id,
                s.episode_id,
                s.title,
                s.scene_type,
                s.summary,
                json_or_none(s.visual_json),
                json_or_none(s.metadata_json),
            )
            for s in scenes
        ],
    )

    cur.executemany(
        """
        INSERT INTO story_text_unit(id, key, default_text, context, notes)
        VALUES (?, ?, ?, ?, ?)
        """,
        [(tu.id, tu.key, tu.default_text, tu.context, tu.notes) for tu in text_units],
    )

    cur.executemany(
        """
        INSERT INTO story_text_unit_translation(id, text_unit_id, language_code, text, romanization)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (tr.id, tr.text_unit_id, tr.language_code, tr.text, tr.romanization)
            for tr in translations
        ],
    )

    cur.executemany(
        """
        INSERT INTO story_node(id, scene_id, node_type, text_unit_id, action_key, order_index, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                str(n.id),
                n.scene_id,
                n.node_type,
                n.text_unit_id,
                n.action_key,
                n.order_index,
                json_or_none(n.metadata_json),
            )
            for n in nodes
        ],
    )

    cur.executemany(
        """
        INSERT INTO story_edge(id, from_node_id, to_node_id, to_scene_id, edge_type, label_text_unit_id, order_index, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                str(e.id),
                str(e.from_node_id),
                str(e.to_node_id) if e.to_node_id else None,
                e.to_scene_id,
                e.edge_type,
                e.label_text_unit_id,
                e.order_index,
                json_or_none(e.metadata_json),
            )
            for e in edges
        ],
    )

    cur.executemany(
        """
        INSERT INTO story_state_var(id, quest_id, name, var_type, min_value, max_value, default_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                sv.id,
                sv.quest_id,
                sv.name,
                sv.var_type,
                sv.min_value,
                sv.max_value,
                json_or_none(sv.default_value),
            )
            for sv in state_vars
        ],
    )

    cur.executemany(
        """
        INSERT INTO story_node_effect(id, node_id, op, var_name, value)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (
                ne.id,
                str(ne.node_id),
                ne.op,
                ne.var_name,
                json_or_none(ne.value),
            )
            for ne in node_effects
        ],
    )

    cur.executemany(
        """
        INSERT INTO story_edge_condition(id, edge_id, group_key, op, var_name, value)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                ec.id,
                str(ec.edge_id),
                ec.group_key,
                ec.op,
                ec.var_name,
                json_or_none(ec.value),
            )
            for ec in edge_conditions
        ],
    )

    cur.executemany(
        """
        INSERT INTO story_edge_effect(id, edge_id, op, var_name, value)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (
                ee.id,
                str(ee.edge_id),
                ee.op,
                ee.var_name,
                json_or_none(ee.value),
            )
            for ee in edge_effects
        ],
    )

    conn.commit()
    conn.close()
    if stdout:
        stdout.write(f"Exported story pack DB: {path}")
