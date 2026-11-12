"""Archimedes' hat-box theorem as exact geometry (no Blender, no numpy).

A sphere of radius R sits inside a cylinder of radius R and height 2R. Push
every point of the sphere straight out from the axis until it meets the
cylinder: (r cos t, r sin t, z) -> (R cos t, R sin t, z). The band of sphere
between heights z1 and z2 has area 2 pi R (z2 - z1), exactly the area of the
cylinder band it lands on. Unroll the cylinder and the sphere's surface is a
2 pi R by 2R rectangle: area 4 pi R^2.

`vertex(p, i, j, state)` is the only source of positions for the Blender
scene, so the picture cannot drift from the mathematics tested here.
"""
import math

R = 1.0


class Grid:
    """bands x segments quads. Rows are equally spaced in HEIGHT (not in
    latitude), so every band has the same area in every state of the proof."""

    def __init__(self, bands=12, segments=96, rows_per_band=4):
        self.bands, self.segments, self.rows_per_band = bands, segments, rows_per_band
        self.rows = bands * rows_per_band

    def z(self, i):
        return -R + 2 * R * i / self.rows

    def theta(self, j):
        """Angle from the front of the cylinder, -pi..pi. j = 0 and j =
        segments are the same line on the cylinder (the back seam) and the two
        ends of the unrolled rectangle."""
        return -math.pi + 2 * math.pi * j / self.segments

    def band(self, i):
        return min(i // self.rows_per_band, self.bands - 1)

    def faces(self):
        n = self.segments + 1
        return [(i * n + j, i * n + j + 1, (i + 1) * n + j + 1, (i + 1) * n + j)  # wound to face outward
                for i in range(self.rows) for j in range(self.segments)]

    def vertices(self, push, unroll, spin=0.0):
        return [vertex(self.z(i), self.theta(j), push, unroll, spin)
                for i in range(self.rows + 1) for j in range(self.segments + 1)]


def vertex(z, theta, push, unroll, spin=0.0):
    """Position at height z, angle theta.

    push 0..1: sphere -> cylinder, radially (the hat-box projection).
    unroll 0..1: cylinder -> flat sheet, by bending with constant curvature
    (1 - unroll) / R about the front line. Every unroll state is an isometry of
    the cylinder, so areas are preserved throughout, not just at the ends.
    spin rotates about the axis (only meaningful before unrolling)."""
    r = math.sqrt(max(R * R - z * z, 0.0))
    r += (R - r) * push
    if unroll <= 0:
        a = theta + spin
        return (r * math.sin(a), -r * math.cos(a), z)
    s = R * theta                      # arc length from the front line
    k = (1 - unroll) / R               # curvature of the bending sheet
    if k < 1e-9:
        return (s, -R, z)
    scale = r / R                      # 1 once push is complete
    return (scale * math.sin(k * s) / k, -R + scale * (1 - math.cos(k * s)) / k, z)


def _tri(a, b, c):
    u = [b[n] - a[n] for n in range(3)]
    v = [c[n] - a[n] for n in range(3)]
    x = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
    return 0.5 * math.sqrt(sum(n * n for n in x))


def band_areas(grid, verts):
    """Mesh area of each band (the faceted approximation the renderer draws)."""
    out = [0.0] * grid.bands
    n = grid.segments + 1
    for i in range(grid.rows):
        for j in range(grid.segments):
            a, b, c, d = (verts[i * n + j], verts[i * n + j + 1],
                          verts[(i + 1) * n + j + 1], verts[(i + 1) * n + j])
            out[grid.band(i)] += _tri(a, b, c) + _tri(a, c, d)
    return out


def exact_band_area(grid):
    return 2 * math.pi * R * (2 * R / grid.bands)


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def state(t):
    """Normalised time 0..1 -> (push, unroll, spin, pull). One cause, one
    effect at a time: turn, push out, unroll, hold."""
    push = ease((t - 0.20) / 0.25)
    unroll = ease((t - 0.50) / 0.35)
    spin = 2 * math.pi * (1 - ease(t / 0.45)) if t < 0.45 else 0.0
    pull = ease((t - 0.45) / 0.40)     # camera pulls back to hold the full sheet
    return push, unroll, spin, pull
