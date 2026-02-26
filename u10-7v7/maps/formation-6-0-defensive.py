#!/usr/bin/env python3
"""Defensive shape: 6-0 formation diagram."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pitch import PitchDiagram

output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "images" / "formation-6-0-defensive.png"

d = PitchDiagram(title="The Defensive Shape: 6-0")

# Highlight defensive zone
d.add_zone(x_min=0, x_max=33, color="#3b82f6", alpha=0.12)

# Connections showing the compact shape
# Back line: LB-SW-RB
d.add_connection(x1=15, y1=20, x2=15, y2=50, linestyle="--", alpha=0.35)  # LB-SW
d.add_connection(x1=15, y1=50, x2=15, y2=80, linestyle="--", alpha=0.35)  # SW-RB
d.add_connection(x1=15, y1=20, x2=15, y2=80, linestyle="--", alpha=0.35)  # LB-RB

# Point connection
d.add_connection(x1=15, y1=50, x2=25, y2=50, linestyle="--", alpha=0.35)  # SW-PT

# Wings tracking back
d.add_connection(x1=25, y1=50, x2=22, y2=15, linestyle="--", alpha=0.35)  # PT-LW
d.add_connection(x1=25, y1=50, x2=22, y2=85, linestyle="--", alpha=0.35)  # PT-RW

# Players — all compressed into defensive third
d.add_player(x=4,  y=50, label="GK", color="#6b7280")  # Goalkeeper
d.add_player(x=15, y=20, label="LB", color="#1d4ed8")   # LB pinched to center
d.add_player(x=15, y=50, label="SW", color="#7c3aed")   # Sweeper center
d.add_player(x=15, y=80, label="RB", color="#1d4ed8")   # RB pinched to center
d.add_player(x=25, y=50, label="PT", color="#7c3aed")   # Point in front
d.add_player(x=22, y=15, label="LW", color="#dc2626")   # LW tracked back wide
d.add_player(x=22, y=85, label="RW", color="#dc2626")   # RW tracked back wide

d.render(output)
