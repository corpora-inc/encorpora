#!/usr/bin/env python3
"""Generate the Dynawalla placeholder app icon: a brass index on a lapis field.

Pure stdlib (zlib + struct), 4x supersampled, so the file is reproducible from
this script rather than being an opaque blob in the repo.
"""
import math
import struct
import sys
import zlib

S = 512
SS = 4          # supersample factor
N = S * SS

LAPIS = (0x10, 0x1D, 0x3A)
BRASS = (0xC3, 0x9A, 0x3C)
BRASS_LIT = (0xE3, 0xC1, 0x79)


def main(out):
    cx = cy = N / 2
    acc = [[[0.0, 0.0, 0.0] for _ in range(S)] for _ in range(S)]

    r = N / 2
    r_out0, r_out1 = 0.76 * r, 0.84 * r
    r_in0, r_in1 = 0.46 * r, 0.50 * r

    # The rule: a radius, not a diameter — it points, it does not cancel.
    ang = math.radians(-58)
    ux, uy = math.cos(ang), math.sin(ang)
    half_w = 0.028 * r
    reach = 0.80 * r

    # Index lozenge riding the outer ring.
    ix, iy = cx + 0.80 * r * ux, cy + 0.80 * r * uy
    knot = 0.10 * r

    # Cardinal ticks on the outer ring.
    ticks = [math.radians(a) for a in (0, 90, 180, 270)]

    for py in range(N):
        for px in range(N):
            x, y = px + 0.5, py + 0.5
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            c = LAPIS

            if r_out0 <= d <= r_out1:
                c = BRASS
            elif r_in0 <= d <= r_in1:
                c = BRASS
            else:
                along = dx * ux + dy * uy
                across = -dx * uy + dy * ux
                if abs(across) <= half_w and 0 <= along <= reach:
                    c = BRASS_LIT

            # ticks: short radial marks just outside the outer ring
            if r_out1 < d <= r_out1 + 0.07 * r:
                a = math.atan2(dy, dx)
                for t in ticks:
                    delta = abs(((a - t + math.pi) % (2 * math.pi)) - math.pi)
                    if delta * d <= 0.022 * r:
                        c = BRASS
                        break

            # index lozenge (L1 ball) on top of everything
            if abs(x - ix) + abs(y - iy) <= knot:
                c = BRASS_LIT

            tx, ty = px // SS, py // SS
            cell = acc[ty][tx]
            cell[0] += c[0]
            cell[1] += c[1]
            cell[2] += c[2]

    n = SS * SS
    raw = bytearray()
    for row in acc:
        raw.append(0)  # filter type 0
        for cell in row:
            raw += bytes((round(cell[0] / n), round(cell[1] / n), round(cell[2] / n), 255))

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    with open(out, "wb") as fh:
        fh.write(png)
    print(f"wrote {out} ({len(png)} bytes)")


if __name__ == "__main__":
    main(sys.argv[1])
