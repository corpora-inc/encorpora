"""Reusable 7v7 soccer pitch diagram renderer.

Usage:
    from _pitch import PitchDiagram

    d = PitchDiagram()
    d.add_player(x=20, y=50, label="GK", color="#2563EB")
    d.add_player(x=35, y=25, label="LB", color="#2563EB")
    d.add_zone(y_min=0, y_max=33, label="Defensive Third", alpha=0.04)
    d.add_arrow(x1=50, y1=50, x2=70, y2=50)
    d.render("output.png")

Coordinate system:
    x: 0 (own goal line) to 100 (opponent goal line)
    y: 0 (left touchline) to 100 (right touchline)
    Pitch is drawn in landscape; own goal at bottom, opponent goal at top.
"""

from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyArrowPatch


# --- 7v7 pitch proportions (meters) ---
PITCH_LENGTH = 60.0  # goal-to-goal
PITCH_WIDTH = 40.0
GOAL_WIDTH = 5.0  # ~16 ft
PENALTY_AREA_DEPTH = 10.0
PENALTY_AREA_WIDTH = 20.0
CENTER_CIRCLE_RADIUS = 6.0
CORNER_ARC_RADIUS = 1.0

# --- Colours ---
PITCH_GREEN = "#3a8f3e"
LINE_WHITE = "#ffffff"
ZONE_BLUE = "#93c5fd"
ZONE_RED = "#fca5a5"
ZONE_GREEN = "#86efac"

# Default team colour
TEAM_BLUE = "#1d4ed8"


class PitchDiagram:
    """Draw a 7v7 pitch and overlay player positions."""

    def __init__(
        self,
        figsize: tuple[float, float] = (7.5, 10),
        dpi: int = 300,
        title: str = "",
        show_thirds: bool = True,
    ) -> None:
        self.figsize = figsize
        self.dpi = dpi
        self.title = title
        self.show_thirds = show_thirds
        self._players: list[dict] = []
        self._zones: list[dict] = []
        self._arrows: list[dict] = []
        self._labels: list[dict] = []
        self._connections: list[dict] = []

    # --- Public API ---

    def add_player(
        self,
        x: float,
        y: float,
        label: str,
        color: str = TEAM_BLUE,
        text_color: str = "white",
        size: float = 2.4,
    ) -> None:
        """Add a player marker. x/y in 0-100 pitch coords."""
        self._players.append(dict(
            x=x, y=y, label=label, color=color,
            text_color=text_color, size=size,
        ))

    def add_zone(
        self,
        x_min: float = 0,
        x_max: float = 100,
        y_min: float = 0,
        y_max: float = 100,
        color: str = ZONE_BLUE,
        alpha: float = 0.12,
        label: str = "",
    ) -> None:
        """Shade a rectangular zone on the pitch."""
        self._zones.append(dict(
            x_min=x_min, x_max=x_max, y_min=y_min, y_max=y_max,
            color=color, alpha=alpha, label=label,
        ))

    def add_arrow(
        self,
        x1: float, y1: float,
        x2: float, y2: float,
        color: str = "#ffffff",
        width: float = 1.5,
        style: str = "->",
    ) -> None:
        """Draw an arrow between two points."""
        self._arrows.append(dict(
            x1=x1, y1=y1, x2=x2, y2=y2,
            color=color, width=width, style=style,
        ))

    def add_connection(
        self,
        x1: float, y1: float,
        x2: float, y2: float,
        color: str = "#ffffff",
        linewidth: float = 1.0,
        linestyle: str = "--",
        alpha: float = 0.5,
    ) -> None:
        """Draw a line connecting two points (e.g. formation triangles)."""
        self._connections.append(dict(
            x1=x1, y1=y1, x2=x2, y2=y2,
            color=color, linewidth=linewidth,
            linestyle=linestyle, alpha=alpha,
        ))

    def add_label(
        self,
        x: float, y: float,
        text: str,
        color: str = "white",
        fontsize: float = 9,
        alpha: float = 0.7,
    ) -> None:
        """Add a text label at a position."""
        self._labels.append(dict(
            x=x, y=y, text=text, color=color,
            fontsize=fontsize, alpha=alpha,
        ))

    def render(self, output_path: str | Path) -> Path:
        """Render the diagram to a PNG file."""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)

        self._draw_pitch(ax)
        self._draw_zones(ax)
        self._draw_connections(ax)
        self._draw_arrows(ax)
        self._draw_players(ax)
        self._draw_labels(ax)

        if self.title:
            ax.set_title(
                self.title,
                fontsize=14, fontweight="bold", color="#1e293b",
                pad=12,
            )

        ax.set_xlim(-3, PITCH_WIDTH + 5)
        ax.set_ylim(-5, PITCH_LENGTH + 5)
        ax.set_aspect("equal")
        ax.axis("off")
        fig.patch.set_facecolor("white")

        fig.savefig(
            output_path,
            dpi=self.dpi,
            bbox_inches="tight",
            facecolor="white",
            pad_inches=0.3,
        )
        plt.close(fig)
        print(f"Saved: {output_path}")
        return output_path

    # --- Internal drawing ---

    def _to_pitch(self, x_pct: float, y_pct: float) -> tuple[float, float]:
        """Convert 0-100 percentage coords to pitch coords.

        x_pct: 0=own goal, 100=opponent goal  -> maps to pitch Y axis (length)
        y_pct: 0=left touchline, 100=right touchline -> maps to pitch X axis (width)
        """
        px = (y_pct / 100.0) * PITCH_WIDTH
        py = (x_pct / 100.0) * PITCH_LENGTH
        return px, py

    def _draw_pitch(self, ax: plt.Axes) -> None:
        """Draw the green pitch with white markings."""
        # Pitch background
        pitch = patches.Rectangle(
            (0, 0), PITCH_WIDTH, PITCH_LENGTH,
            facecolor=PITCH_GREEN, edgecolor=LINE_WHITE, linewidth=2,
        )
        ax.add_patch(pitch)

        # Halfway line
        ax.plot(
            [0, PITCH_WIDTH], [PITCH_LENGTH / 2, PITCH_LENGTH / 2],
            color=LINE_WHITE, linewidth=1.5,
        )

        # Center circle
        center_circle = patches.Circle(
            (PITCH_WIDTH / 2, PITCH_LENGTH / 2), CENTER_CIRCLE_RADIUS,
            fill=False, edgecolor=LINE_WHITE, linewidth=1.5,
        )
        ax.add_patch(center_circle)

        # Center spot
        ax.plot(
            PITCH_WIDTH / 2, PITCH_LENGTH / 2,
            "o", color=LINE_WHITE, markersize=3,
        )

        # Penalty areas (bottom = own, top = opponent)
        for y_start in [0, PITCH_LENGTH - PENALTY_AREA_DEPTH]:
            pa_x = (PITCH_WIDTH - PENALTY_AREA_WIDTH) / 2
            pa = patches.Rectangle(
                (pa_x, y_start), PENALTY_AREA_WIDTH, PENALTY_AREA_DEPTH,
                fill=False, edgecolor=LINE_WHITE, linewidth=1.5,
            )
            ax.add_patch(pa)

        # Goals (bottom and top)
        goal_half = GOAL_WIDTH / 2
        for y_pos in [0, PITCH_LENGTH]:
            ax.plot(
                [PITCH_WIDTH / 2 - goal_half, PITCH_WIDTH / 2 - goal_half],
                [y_pos, y_pos - 1.5 if y_pos > 0 else y_pos + 1.5],
                color=LINE_WHITE, linewidth=2.5,
            )
            ax.plot(
                [PITCH_WIDTH / 2 + goal_half, PITCH_WIDTH / 2 + goal_half],
                [y_pos, y_pos - 1.5 if y_pos > 0 else y_pos + 1.5],
                color=LINE_WHITE, linewidth=2.5,
            )
            ax.plot(
                [PITCH_WIDTH / 2 - goal_half, PITCH_WIDTH / 2 + goal_half],
                [y_pos - 1.5 if y_pos > 0 else y_pos + 1.5,
                 y_pos - 1.5 if y_pos > 0 else y_pos + 1.5],
                color=LINE_WHITE, linewidth=2.5,
            )

        # Corner arcs
        for cx, cy in [(0, 0), (PITCH_WIDTH, 0), (0, PITCH_LENGTH), (PITCH_WIDTH, PITCH_LENGTH)]:
            t1 = 0 if cx == 0 else 90
            if cy == 0:
                t1 = 0 if cx == 0 else 270
                t2 = t1 + 90
            else:
                t1 = 90 if cx == 0 else 180
                t2 = t1 + 90
            arc = patches.Arc(
                (cx, cy), CORNER_ARC_RADIUS * 2, CORNER_ARC_RADIUS * 2,
                angle=0, theta1=t1, theta2=t2,
                edgecolor=LINE_WHITE, linewidth=1.5,
            )
            ax.add_patch(arc)

        # Thirds (dashed lines + labels outside right touchline)
        if self.show_thirds:
            for frac in [1 / 3, 2 / 3]:
                y = frac * PITCH_LENGTH
                ax.plot(
                    [0, PITCH_WIDTH], [y, y],
                    color=LINE_WHITE, linewidth=0.8, linestyle=":",
                    alpha=0.5,
                )

            label_x = PITCH_WIDTH + 1.5
            third_labels = [
                (PITCH_LENGTH * 1 / 6, "Defensive\nThird"),
                (PITCH_LENGTH * 3 / 6, "Middle\nThird"),
                (PITCH_LENGTH * 5 / 6, "Attacking\nThird"),
            ]
            for ly, text in third_labels:
                ax.text(
                    label_x, ly, text,
                    ha="left", va="center",
                    fontsize=6.5, color="#4b5563",
                    fontstyle="italic", alpha=0.7,
                )

    def _draw_zones(self, ax: plt.Axes) -> None:
        for z in self._zones:
            px1, py1 = self._to_pitch(z["x_min"], z["y_min"])
            px2, py2 = self._to_pitch(z["x_max"], z["y_max"])
            rect = patches.Rectangle(
                (min(px1, px2), min(py1, py2)),
                abs(px2 - px1), abs(py2 - py1),
                facecolor=z["color"], alpha=z["alpha"], edgecolor="none",
            )
            ax.add_patch(rect)
            if z["label"]:
                cx = (px1 + px2) / 2
                cy = (py1 + py2) / 2
                ax.text(
                    cx, cy, z["label"],
                    ha="center", va="center",
                    fontsize=8, color=z["color"], alpha=0.6,
                    fontweight="bold",
                )

    def _draw_connections(self, ax: plt.Axes) -> None:
        for c in self._connections:
            px1, py1 = self._to_pitch(c["x1"], c["y1"])
            px2, py2 = self._to_pitch(c["x2"], c["y2"])
            ax.plot(
                [px1, px2], [py1, py2],
                color=c["color"], linewidth=c["linewidth"],
                linestyle=c["linestyle"], alpha=c["alpha"],
            )

    def _draw_arrows(self, ax: plt.Axes) -> None:
        for a in self._arrows:
            px1, py1 = self._to_pitch(a["x1"], a["y1"])
            px2, py2 = self._to_pitch(a["x2"], a["y2"])
            arrow = FancyArrowPatch(
                (px1, py1), (px2, py2),
                arrowstyle=a["style"],
                color=a["color"],
                linewidth=a["width"],
                mutation_scale=15,
            )
            ax.add_patch(arrow)

    def _draw_players(self, ax: plt.Axes) -> None:
        for p in self._players:
            px, py = self._to_pitch(p["x"], p["y"])
            circle = patches.Circle(
                (px, py), p["size"],
                facecolor=p["color"],
                edgecolor="white",
                linewidth=1.5,
                zorder=10,
            )
            ax.add_patch(circle)
            ax.text(
                px, py, p["label"],
                ha="center", va="center",
                fontsize=7, fontweight="bold",
                color=p["text_color"],
                zorder=11,
            )

    def _draw_labels(self, ax: plt.Axes) -> None:
        for lb in self._labels:
            px, py = self._to_pitch(lb["x"], lb["y"])
            ax.text(
                px, py, lb["text"],
                ha="center", va="center",
                fontsize=lb["fontsize"],
                color=lb["color"],
                alpha=lb["alpha"],
                fontstyle="italic",
            )
