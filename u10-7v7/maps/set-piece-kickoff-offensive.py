#!/usr/bin/env python3
"""Set piece: Offensive kickoff positions."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pitch import PitchDiagram

output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "images" / "set-piece-kickoff-offensive.png"

d = PitchDiagram(title="Offensive Kickoff")

# Arrow showing the kickoff tap
d.add_arrow(x1=50, y1=45, x2=47, y2=50, color="#fbbf24", width=2.0, style="->")

# Players in 2-1-1-2 kickoff positions
d.add_player(x=4,  y=50, label="GK", color="#6b7280")   # Goalkeeper
d.add_player(x=20, y=25, label="LB", color="#1d4ed8")    # Left Back
d.add_player(x=20, y=75, label="RB", color="#1d4ed8")    # Right Back

# Point and Sweeper at center circle
d.add_player(x=50, y=45, label="PT", color="#7c3aed")    # Point takes the kick
d.add_player(x=47, y=55, label="SW", color="#7c3aed")    # Sweeper receives

# Wings in attacking third, ready for runs
d.add_player(x=75, y=25, label="LW", color="#dc2626")    # Left Wing
d.add_player(x=75, y=75, label="RW", color="#dc2626")    # Right Wing

# Label the action
d.add_label(x=55, y=35, text="tap forward", fontsize=7, color="#fbbf24", alpha=0.8)

d.render(output)
