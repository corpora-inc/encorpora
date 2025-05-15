#!/usr/bin/env python3
"""
make_georgia_rivers.py

Produces a clean map of Georgia with its major rivers clipped to the state boundary.
Requires:
    pip install geopandas matplotlib
Natural Earth Data:
    data/ne/10m/10m_cultural/ne_10m_admin_1_states_provinces.shp
    data/ne/10m/10m_physical/ne_10m_rivers_lake_centerlines.shp
"""

import os
import geopandas as gpd
import matplotlib.pyplot as plt


def main():
    # ─── 1) Paths ────────────────────────────────────────────────────────────────
    data_dir = "data/ne/10m"
    states_fp = os.path.join(
        data_dir,
        "10m_cultural",
        "ne_10m_admin_1_states_provinces.shp",
    )
    rivers_fp = os.path.join(
        data_dir,
        "10m_physical",
        # "ne_10m_rivers_lake_centerlines.shp",
        "ne_10m_rivers_north_america.shp",
    )

    # ─── 2) Load Georgia boundary ───────────────────────────────────────────────
    states = gpd.read_file(states_fp).to_crs(epsg=4326)
    ga = states[states["name"] == "Georgia"]

    # ─── 3) Load rivers ─────────────────────────────────────────────────────────
    rivers = gpd.read_file(rivers_fp).to_crs(epsg=4326)

    # ─── 4) Filter major rivers ─────────────────────────────────────────────────
    major_names = [
        "Chattahoochee",
        "Savannah",
        "Flint",
        "Altamaha",
        "Oconee",
        "Ocmulgee",
        "Tallapoosa",
        "Chattooga",
    ]
    major = rivers[rivers["name"].isin(major_names)]
    print(f"Major rivers: {major['name'].unique()}")

    # ─── 5) Clip rivers to Georgia ───────────────────────────────────────────────
    # major_clipped = gpd.clip(major, ga)

    # ─── 6) Plot ─────────────────────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(8, 8))

    # Georgia outline (black)
    ga.boundary.plot(ax=ax, linewidth=1, edgecolor="black")

    # s (blue)
    rivers.plot(ax=ax, linewidth=1.0, color="blue")

    # Force equal aspect to avoid GeoPandas auto-aspect error
    ax.set_aspect("equal")

    # Zoom to Georgia bounds with a small margin
    minx, miny, maxx, maxy = ga.total_bounds
    ax.set_xlim(minx - 0.5, maxx + 0.5)
    ax.set_ylim(miny - 0.5, maxy + 0.5)

    ax.set_title("Georgia and Its Majors")
    ax.axis("off")

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
