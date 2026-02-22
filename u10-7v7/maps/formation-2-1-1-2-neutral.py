#!/usr/bin/env python3
"""Neutral shape: 2-1-1-2 formation diagram."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pitch import PitchDiagram

output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "images" / "formation-2-1-1-2-neutral.png"

d = PitchDiagram(title="The Neutral Shape: 2-1-1-2")

# Formation triangle connections (back triangle: LB-RB-SW)
d.add_connection(x1=20, y1=25, x2=20, y2=75, linestyle="--", alpha=0.35)  # LB-RB
d.add_connection(x1=20, y1=25, x2=40, y2=50, linestyle="--", alpha=0.35)  # LB-SW
d.add_connection(x1=20, y1=75, x2=40, y2=50, linestyle="--", alpha=0.35)  # RB-SW

# Front triangle: SW-LW-Point-RW
d.add_connection(x1=40, y1=50, x2=60, y2=50, linestyle="--", alpha=0.35)  # SW-Point
d.add_connection(x1=60, y1=50, x2=80, y2=25, linestyle="--", alpha=0.35)  # Point-LW
d.add_connection(x1=60, y1=50, x2=80, y2=75, linestyle="--", alpha=0.35)  # Point-RW
d.add_connection(x1=40, y1=50, x2=80, y2=25, linestyle="--", alpha=0.35)  # SW-LW
d.add_connection(x1=40, y1=50, x2=80, y2=75, linestyle="--", alpha=0.35)  # SW-RW

# Players (x: 0=own goal, 100=opponent goal; y: 0=left, 100=right)
d.add_player(x=4,  y=50, label="GK", color="#6b7280")  # Goalkeeper (gray)
d.add_player(x=20, y=25, label="LB", color="#1d4ed8")   # Left Back
d.add_player(x=20, y=75, label="RB", color="#1d4ed8")   # Right Back
d.add_player(x=40, y=50, label="SW", color="#7c3aed")   # Sweeper (purple - spine)
d.add_player(x=60, y=50, label="PT", color="#7c3aed")   # Point (purple - spine)
d.add_player(x=80, y=25, label="LW", color="#dc2626")   # Left Wing (red - attackers)
d.add_player(x=80, y=75, label="RW", color="#dc2626")   # Right Wing (red - attackers)

d.render(output)
