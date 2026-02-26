#!/usr/bin/env python3
"""Set piece: Offensive corner kick setup."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pitch import PitchDiagram

output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "images" / "set-piece-corner-offensive.png"

d = PitchDiagram(title="Offensive Corner Kick")

# Corner kick delivery arc (from right corner)
d.add_arrow(x1=99, y1=99, x2=92, y2=60, color="#fbbf24", width=2.0, style="->")
d.add_label(x=97, y=82, text="delivery", fontsize=7, color="#fbbf24", alpha=0.8)

# Players
d.add_player(x=4,  y=50, label="GK", color="#6b7280")   # Goalkeeper in own goal

# Backs at halfway line (safety)
d.add_player(x=50, y=25, label="LB", color="#1d4ed8")    # Left Back at halfway
d.add_player(x=50, y=75, label="RB", color="#1d4ed8")    # Right Back at halfway

# Kicker at corner flag (RW taking from right side)
d.add_player(x=99, y=99, label="RW", color="#dc2626")    # Kicker at corner

# Attackers in the box
d.add_player(x=93, y=40, label="PT", color="#7c3aed")    # Point near post
d.add_player(x=90, y=55, label="SW", color="#7c3aed")    # Sweeper at penalty spot
d.add_player(x=86, y=65, label="LW", color="#dc2626")    # Opposite wing top of box

d.render(output)
