#!/usr/bin/env python3
"""Ring of Fire map — Japan and East Asia's volcanic belt.

Focused on Japan with real volcano locations plotted as eruption dots.
Usage: python ring-of-fire-map.py [output_path]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "projects" / "bookctl"))

from bookctl.backends.mapmaker import MapMaker

output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "images" / "ring-of-fire-map.png"

m = MapMaker(
    width=1800,
    height=1400,
    center=(138, 33),   # Centered on Japan
    zoom=5,             # Regional: Japan + neighbors visible
    tiles="esri_world_imagery",
)

# ── Real volcano locations along the Ring of Fire in the region ──
# (lon, lat) — major active/notable volcanoes

# Japan's volcanoes (north to south)
japan_volcanoes = [
    (141.17, 43.39, "Mt. Meakan"),         # Hokkaido
    (140.84, 42.07, "Mt. Usu"),            # Hokkaido
    (140.05, 39.98, "Mt. Iwate"),          # Northern Honshu
    (140.44, 38.14, "Mt. Zao"),            # Honshu
    (139.53, 36.40, "Mt. Asama"),          # Central Honshu
    (138.52, 36.57, "Mt. Myoko"),          # Honshu
    (138.73, 35.36, "Mt. Fuji"),           # The big one
    (131.10, 32.88, "Mt. Aso"),            # Kyushu
    (130.66, 31.59, "Sakurajima"),         # Kyushu (very active)
    (130.30, 30.49, "Suwanosejima"),       # Ryukyu Islands
]

# Kuril Islands / Kamchatka
kuril_volcanoes = [
    (145.50, 43.77, ""),    # Kunashir
    (147.92, 44.35, ""),    # Iturup
    (149.70, 45.38, ""),    # Urup
    (152.55, 46.93, ""),    # Paramushir
    (156.01, 50.33, ""),    # Kamchatka south
    (158.83, 52.35, ""),    # Kamchatka mid
    (160.59, 53.26, ""),    # Klyuchevskoy area
]

# Philippines
philippines_volcanoes = [
    (120.99, 14.14, ""),    # Taal
    (123.69, 13.26, ""),    # Mayon
    (124.89, 11.33, ""),    # Canlaon region
]

# Indonesia (northern part visible)
indonesia_volcanoes = [
    (124.17, 1.35, ""),     # Northern Sulawesi
    (127.32, 0.80, ""),     # Halmahera
]

# Taiwan
taiwan_volcanoes = [
    (121.52, 25.17, ""),    # Taipei volcanic group
]

# Plot all volcanoes
for lon, lat, name in japan_volcanoes:
    m.add_marker((lon, lat), color="#FF2200", size=10)

for lon, lat, name in kuril_volcanoes + philippines_volcanoes + indonesia_volcanoes + taiwan_volcanoes:
    m.add_marker((lon, lat), color="#FF6600", size=6)

# Highlight Mt. Fuji specially
m.add_marker((138.73, 35.36), color="#FFD700", size=14)
m.add_label((140.5, 35.0), "Mt. Fuji", color="#FFD700", size=16, bold=True)

# Label Japan prominently
m.add_label((136, 38.5), "JAPAN", color="white", size=28, bold=True)

# Neighbor labels (smaller)
m.add_label((127.5, 37.5), "Korea", color="#CCCCCC", size=14)
m.add_label((117, 35), "China", color="#CCCCCC", size=14)
m.add_label((121, 17), "Philippines", color="#CCCCCC", size=12)
m.add_label((150, 48), "Kamchatka", color="#CCCCCC", size=12)

# Tectonic plate boundary hint — the subduction zones
# Pacific Plate boundary (simplified, east of Japan)
plate_boundary = [
    (144.0, 24.0),
    (143.5, 28.0),
    (143.0, 32.0),
    (143.5, 36.0),
    (144.5, 40.0),
    (146.0, 44.0),
    (150.0, 48.0),
    (154.0, 51.0),
    (158.0, 53.0),
]
m.add_line(plate_boundary, color="#FF6644", width=2)

# Philippine Sea Plate boundary
phil_plate = [
    (126.0, 10.0),
    (126.5, 15.0),
    (128.0, 20.0),
    (130.0, 25.0),
    (133.0, 30.0),
    (137.0, 33.0),
    (140.0, 35.0),
    (143.0, 36.0),
]
m.add_line(phil_plate, color="#FF6644", width=2)

m.render(output)
