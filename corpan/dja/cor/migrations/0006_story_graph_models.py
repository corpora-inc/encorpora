import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cor", "0005_alter_entry_level"),
    ]

    operations = [
        migrations.CreateModel(
            name="StoryQuest",
            fields=[
                ("id", models.SlugField(primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("default_language", models.CharField(default="en", max_length=10)),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
            ],
            options={
                "db_table": "story_quest",
            },
        ),
        migrations.CreateModel(
            name="StoryEpisode",
            fields=[
                ("id", models.SlugField(primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=200)),
                ("summary", models.TextField(blank=True)),
                ("order_index", models.PositiveIntegerField(default=0)),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
                (
                    "quest",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="episodes",
                        to="cor.storyquest",
                    ),
                ),
            ],
            options={
                "db_table": "story_episode",
                "ordering": ["order_index"],
            },
        ),
        migrations.CreateModel(
            name="StoryScene",
            fields=[
                ("id", models.SlugField(primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=200)),
                ("scene_type", models.CharField(default="scene", max_length=32)),
                ("summary", models.TextField(blank=True)),
                ("visual_json", models.JSONField(blank=True, default=dict)),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
                (
                    "episode",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="scenes",
                        to="cor.storyepisode",
                    ),
                ),
                (
                    "quest",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="scenes",
                        to="cor.storyquest",
                    ),
                ),
            ],
            options={
                "db_table": "story_scene",
            },
        ),
        migrations.CreateModel(
            name="StoryTextUnit",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("key", models.SlugField(unique=True)),
                ("default_text", models.TextField()),
                ("context", models.CharField(blank=True, max_length=200)),
                ("notes", models.TextField(blank=True)),
            ],
            options={
                "db_table": "story_text_unit",
            },
        ),
        migrations.CreateModel(
            name="StoryTextUnitTranslation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("language_code", models.CharField(max_length=10)),
                ("text", models.TextField()),
                ("romanization", models.TextField(blank=True, default="")),
                (
                    "text_unit",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="translations",
                        to="cor.storytextunit",
                    ),
                ),
            ],
            options={
                "db_table": "story_text_unit_translation",
                "unique_together": {("text_unit", "language_code")},
            },
        ),
        migrations.CreateModel(
            name="StoryNode",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("node_type", models.CharField(choices=[("text", "Text"), ("action", "Action"), ("end", "End")], default="text", max_length=16)),
                (
                    "text_unit",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="nodes",
                        to="cor.storytextunit",
                    ),
                ),
                ("action_key", models.CharField(blank=True, default="", max_length=64)),
                ("order_index", models.PositiveIntegerField(default=0)),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
                (
                    "scene",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="nodes",
                        to="cor.storyscene",
                    ),
                ),
            ],
            options={
                "db_table": "story_node",
                "ordering": ["order_index"],
            },
        ),
        migrations.CreateModel(
            name="StoryEdge",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("edge_type", models.CharField(choices=[("auto", "Auto"), ("choice", "Choice")], default="auto", max_length=16)),
                ("order_index", models.PositiveIntegerField(default=0)),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
                (
                    "from_node",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="out_edges",
                        to="cor.storynode",
                    ),
                ),
                (
                    "label_text_unit",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="edge_labels",
                        to="cor.storytextunit",
                    ),
                ),
                (
                    "to_node",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="in_edges",
                        to="cor.storynode",
                    ),
                ),
                (
                    "to_scene",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="incoming_edges",
                        to="cor.storyscene",
                    ),
                ),
            ],
            options={
                "db_table": "story_edge",
                "ordering": ["order_index"],
            },
        ),
        migrations.CreateModel(
            name="StoryStateVar",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("name", models.CharField(max_length=64)),
                ("var_type", models.CharField(choices=[("int", "Integer"), ("bool", "Boolean"), ("string", "String"), ("set_string", "Set[String]")], default="int", max_length=16)),
                ("min_value", models.IntegerField(blank=True, null=True)),
                ("max_value", models.IntegerField(blank=True, null=True)),
                ("default_value", models.JSONField(blank=True, default=None, null=True)),
                (
                    "quest",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="state_vars",
                        to="cor.storyquest",
                    ),
                ),
            ],
            options={
                "db_table": "story_state_var",
                "unique_together": {("quest", "name")},
            },
        ),
        migrations.CreateModel(
            name="StoryNodeEffect",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("op", models.CharField(max_length=16)),
                ("var_name", models.CharField(max_length=64)),
                ("value", models.JSONField(blank=True, default=dict)),
                (
                    "node",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="effects",
                        to="cor.storynode",
                    ),
                ),
            ],
            options={
                "db_table": "story_node_effect",
            },
        ),
        migrations.CreateModel(
            name="StoryEdgeCondition",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("group_key", models.CharField(blank=True, default="", max_length=64)),
                ("op", models.CharField(max_length=16)),
                ("var_name", models.CharField(max_length=64)),
                ("value", models.JSONField(blank=True, default=dict)),
                (
                    "edge",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="conditions",
                        to="cor.storyedge",
                    ),
                ),
            ],
            options={
                "db_table": "story_edge_condition",
            },
        ),
        migrations.CreateModel(
            name="StoryEdgeEffect",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("op", models.CharField(max_length=16)),
                ("var_name", models.CharField(max_length=64)),
                ("value", models.JSONField(blank=True, default=dict)),
                (
                    "edge",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="effects",
                        to="cor.storyedge",
                    ),
                ),
            ],
            options={
                "db_table": "story_edge_effect",
            },
        ),
        migrations.AddField(
            model_name="storyquest",
            name="start_scene",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="start_for_quests",
                to="cor.storyscene",
            ),
        ),
    ]
