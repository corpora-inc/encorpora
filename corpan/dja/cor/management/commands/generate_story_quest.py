import json
import random
import sqlite3
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from cor.models import (
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


def stub_translate(lang_code: str, text: str) -> str:
    if lang_code == "en":
        return text
    return f"[{lang_code}] {text}"


class Command(BaseCommand):
    help = "Generate a story quest with scenes, nodes, and translations. Optional export to a pack SQLite DB."

    def add_arguments(self, parser):
        parser.add_argument("--quest-id", type=str, default="all_hearing_ear")
        parser.add_argument("--title", type=str, default="On the Trail of the All-Hearing Ear")
        parser.add_argument("--description", type=str, default="A branching story about the lost Ear.")
        parser.add_argument("--scenes", type=int, default=8)
        parser.add_argument("--episodes", type=int, default=2)
        parser.add_argument("--lines-per-scene", type=int, default=5)
        parser.add_argument("--languages", type=str, default="en,es,fr")
        parser.add_argument("--seed", type=int, default=17)
        parser.add_argument("--branch-every", type=int, default=2)
        parser.add_argument("--action-every", type=int, default=4)
        parser.add_argument("--force", action="store_true", default=False)
        parser.add_argument("--export-path", type=str, default="")

    def handle(self, *args, **options):
        quest_id = options["quest_id"]
        title = options["title"]
        description = options["description"]
        scene_count = options["scenes"]
        episode_count = max(1, options["episodes"])
        lines_per_scene = max(1, options["lines_per_scene"])
        language_codes = [c.strip() for c in options["languages"].split(",") if c.strip()]
        seed = options["seed"]
        branch_every = options["branch_every"]
        action_every = options["action_every"]
        force = options["force"]
        export_path = options["export_path"]

        random.seed(seed)

        if force:
            StoryQuest.objects.filter(id=quest_id).delete()

        if StoryQuest.objects.filter(id=quest_id).exists():
            raise RuntimeError(f"Quest '{quest_id}' already exists (use --force to replace).")

        with transaction.atomic():
            quest = StoryQuest.objects.create(
                id=quest_id,
                title=title,
                description=description,
                default_language="en",
                metadata_json={"seed": seed, "scene_count": scene_count},
            )

            StoryStateVar.objects.create(
                quest=quest,
                name="ear_fragments",
                var_type="int",
                min_value=0,
                max_value=7,
                default_value=0,
            )
            StoryStateVar.objects.create(
                quest=quest,
                name="trust_kendi",
                var_type="int",
                min_value=-3,
                max_value=5,
                default_value=0,
            )
            StoryStateVar.objects.create(
                quest=quest,
                name="vow_silence",
                var_type="bool",
                default_value=False,
            )

            episodes = []
            for i in range(episode_count):
                ep_id = f"E{i+1:02d}"
                episodes.append(
                    StoryEpisode.objects.create(
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

            themes = [
                ("Market of Whispered Tongues", "market", ["lanterns", "citrus", "cables"]),
                ("Service Tunnels", "tunnel", ["echoes", "steel", "distant water"]),
                ("Archive Loft", "archive", ["dust", "ink", "whispered notes"]),
                ("Temple Approach", "temple", ["stone", "wind", "humming air"]),
                ("Night Shift Cafe", "cafe", ["steam", "spices", "soft light"]),
            ]
            choice_labels = [
                "Ask about the Ear",
                "Change the subject",
                "Offer a trade",
                "Share a rumor",
            ]
            npc_names = ["Kendi", "Pari", "Luo", "Sana", "Kaito"]
            clues = ["signal", "artifact", "tone", "map", "cipher"]
            moods = ["low", "urgent", "careful", "playful", "measured"]

            def create_text_unit(key, text, context=""):
                unit = StoryTextUnit.objects.create(
                    key=key,
                    default_text=text,
                    context=context,
                    notes="",
                )
                for lang in language_codes:
                    StoryTextUnitTranslation.objects.create(
                        text_unit=unit,
                        language_code=lang,
                        text=stub_translate(lang, text),
                        romanization="",
                    )
                return unit

            for i in range(scene_count):
                scene_id = f"S{i+1:03d}"
                theme_title, theme_key, theme_words = themes[i % len(themes)]
                is_action = action_every > 0 and (i + 1) % action_every == 0

                scene = StoryScene.objects.create(
                    id=scene_id,
                    quest=quest,
                    episode=episodes[i % episode_count],
                    title=f"{theme_title} {i+1}",
                    scene_type="action" if is_action else "scene",
                    summary=f"{theme_title} scene {i+1}.",
                    visual_json={
                        "theme": theme_key,
                        "layers": [
                            {"id": "bg", "kind": "gradient", "palette": theme_key},
                            {"id": "npc", "kind": "silhouette", "name": npc_names[i % len(npc_names)]},
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
                )
                scene_order.append(scene)

                if is_action:
                    action_text = f"You chase a faint {random.choice(clues)} through {theme_words[0]}."
                    unit = create_text_unit(f"{scene_id}_ACTION", action_text, context="action")
                    node = StoryNode.objects.create(
                        scene=scene,
                        node_type="action",
                        text_unit=unit,
                        action_key="ActionScene",
                        order_index=0,
                    )
                    scene_last_nodes[scene.id] = node
                    continue

                main_nodes = []
                for j in range(lines_per_scene):
                    npc = npc_names[(i + j) % len(npc_names)]
                    clue = random.choice(clues)
                    mood = random.choice(moods)
                    line = (
                        f"{npc} says the {clue} feels {mood} tonight, like {theme_words[j % len(theme_words)]}."
                    )
                    unit = create_text_unit(f"{scene_id}_LINE_{j+1}", line, context=theme_key)
                    node = StoryNode.objects.create(
                        scene=scene, node_type="text", text_unit=unit, order_index=j
                    )
                    main_nodes.append(node)

                branch_index = None
                if branch_every > 0 and (i + 1) % branch_every == 0 and len(main_nodes) >= 4:
                    branch_index = 2

                for j in range(len(main_nodes) - 1):
                    if branch_index is not None and j == branch_index:
                        continue
                    StoryEdge.objects.create(
                        from_node=main_nodes[j],
                        to_node=main_nodes[j + 1],
                        edge_type="auto",
                        order_index=0,
                    )

                if branch_index is not None:
                    branch_from = main_nodes[branch_index]
                    branch_to = main_nodes[branch_index + 1]
                    for choice_index in range(2):
                        branch_text = (
                            f"You ask about the {random.choice(clues)} and {npc_names[i % len(npc_names)]} nods."
                            if choice_index == 0
                            else f"You mention a side rumor about the Ear and the room shifts."
                        )
                        branch_unit = create_text_unit(
                            f"{scene_id}_BRANCH_{choice_index+1}", branch_text, context="branch"
                        )
                        branch_node = StoryNode.objects.create(
                            scene=scene,
                            node_type="text",
                            text_unit=branch_unit,
                            order_index=branch_from.order_index + 1 + choice_index,
                        )
                        label_unit = create_text_unit(
                            f"{scene_id}_CHOICE_{choice_index+1}",
                            choice_labels[choice_index % len(choice_labels)],
                            context="choice",
                        )
                        edge = StoryEdge.objects.create(
                            from_node=branch_from,
                            to_node=branch_node,
                            edge_type="choice",
                            label_text_unit=label_unit,
                            order_index=choice_index,
                        )
                        StoryEdgeEffect.objects.create(
                            edge=edge,
                            op="inc",
                            var_name="ear_fragments" if choice_index == 0 else "trust_kendi",
                            value=1,
                        )
                        StoryEdge.objects.create(
                            from_node=branch_node,
                            to_node=branch_to,
                            edge_type="auto",
                            order_index=0,
                        )

                scene_last_nodes[scene.id] = main_nodes[-1]

            quest.start_scene = scene_order[0]
            quest.save(update_fields=["start_scene"])

            for idx, scene in enumerate(scene_order):
                last_node = scene_last_nodes[scene.id]
                if idx == len(scene_order) - 1:
                    end_text = "The hum fades. The Ear listens back."
                    end_unit = create_text_unit(f"{scene.id}_END", end_text, context="end")
                    end_node = StoryNode.objects.create(
                        scene=scene,
                        node_type="end",
                        text_unit=end_unit,
                        order_index=999,
                    )
                    StoryEdge.objects.create(
                        from_node=last_node,
                        to_node=end_node,
                        edge_type="auto",
                        order_index=0,
                    )
                    continue

                next_scene = scene_order[idx + 1]
                if idx % 3 == 0 and idx + 2 < len(scene_order):
                    alt_scene = scene_order[idx + 2]
                    for choice_index, target_scene in enumerate([next_scene, alt_scene]):
                        label_unit = create_text_unit(
                            f"{scene.id}_EXIT_{choice_index+1}",
                            f"Go to {target_scene.title}",
                            context="exit_choice",
                        )
                        edge = StoryEdge.objects.create(
                            from_node=last_node,
                            to_scene=target_scene,
                            edge_type="choice",
                            label_text_unit=label_unit,
                            order_index=choice_index,
                        )
                        if choice_index == 1:
                            StoryEdgeCondition.objects.create(
                                edge=edge,
                                group_key="requires_any_0",
                                op="gte",
                                var_name="ear_fragments",
                                value=1,
                            )
                else:
                    StoryEdge.objects.create(
                        from_node=last_node,
                        to_scene=next_scene,
                        edge_type="auto",
                        order_index=0,
                    )

        self.stdout.write(
            f"Generated quest '{quest_id}' with {scene_count} scenes and {episode_count} episodes."
        )

        if export_path:
            export_story_pack(Path(export_path), quest_id, stdout=self.stdout)


def export_story_pack(path: Path, quest_id: str, stdout=None):
    quest = StoryQuest.objects.get(id=quest_id)
    episodes = list(StoryEpisode.objects.filter(quest=quest))
    scenes = list(StoryScene.objects.filter(quest=quest))
    nodes = list(StoryNode.objects.filter(scene__quest=quest))
    edges = list(StoryEdge.objects.filter(from_node__scene__quest=quest))
    state_vars = list(StoryStateVar.objects.filter(quest=quest))
    node_effects = list(StoryNodeEffect.objects.filter(node__scene__quest=quest))
    edge_conditions = list(StoryEdgeCondition.objects.filter(edge__in=edges))
    edge_effects = list(StoryEdgeEffect.objects.filter(edge__in=edges))

    text_unit_ids = {n.text_unit_id for n in nodes if n.text_unit_id}
    text_unit_ids.update({e.label_text_unit_id for e in edges if e.label_text_unit_id})
    text_units = list(StoryTextUnit.objects.filter(id__in=text_unit_ids))
    translations = list(
        StoryTextUnitTranslation.objects.filter(text_unit_id__in=text_unit_ids)
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
        [
            (tu.id, tu.key, tu.default_text, tu.context, tu.notes)
            for tu in text_units
        ],
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
