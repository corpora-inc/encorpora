#!/usr/bin/env python3
"""Attacking shape: 2-1-3 formation diagram."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pitch import PitchDiagram

output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "images" / "formation-2-1-3-attacking.png"

d = PitchDiagram(title="The Attacking Shape: 2-1-3")

# Highlight attacking zone
d.add_zone(x_min=67, x_max=100, color="#ef4444", alpha=0.08)

# Back triangle: LB-RB-SW
d.add_connection(x1=22, y1=25, x2=22, y2=75, linestyle="--", alpha=0.35)  # LB-RB
d.add_connection(x1=22, y1=25, x2=45, y2=50, linestyle="--", alpha=0.35)  # LB-SW
d.add_connection(x1=22, y1=75, x2=45, y2=50, linestyle="--", alpha=0.35)  # RB-SW

# Front three connections: SW to each attacker
d.add_connection(x1=45, y1=50, x2=82, y2=50, linestyle="--", alpha=0.35)  # SW-PT
d.add_connection(x1=45, y1=50, x2=82, y2=18, linestyle="--", alpha=0.35)  # SW-LW
d.add_connection(x1=45, y1=50, x2=82, y2=82, linestyle="--", alpha=0.35)  # SW-RW

# Front three line
d.add_connection(x1=82, y1=18, x2=82, y2=50, linestyle="--", alpha=0.35)
d.add_connection(x1=82, y1=50, x2=82, y2=82, linestyle="--", alpha=0.35)

# Players
d.add_player(x=4,  y=50, label="GK", color="#6b7280")   # Goalkeeper
d.add_player(x=22, y=25, label="LB", color="#1d4ed8")    # Left Back holding
d.add_player(x=22, y=75, label="RB", color="#1d4ed8")    # Right Back holding
d.add_player(x=45, y=50, label="SW", color="#7c3aed")    # Sweeper center
d.add_player(x=82, y=50, label="PT", color="#dc2626")    # Point pushed high
d.add_player(x=82, y=18, label="LW", color="#dc2626")    # Left Wing high
d.add_player(x=82, y=82, label="RW", color="#dc2626")    # Right Wing high

d.render(output)
