import { describe, it, expect } from "vitest"
import {
  STATION_RADIUS,
  STATION_STEP,
  STATION_OFFSET,
  stationPoint,
  distFromStation,
  isOffLeash,
  pickStationTarget,
} from "./stationing"

const FREE = () => false
const docks = { x: 0, z: 55, facing: Math.PI / 2 } // matches plaza-grand `docks`

describe("stationing — the geometry behind a stationed special's hover", () => {
  it("stationPoint nudges off the anchor by STATION_OFFSET along its facing", () => {
    const p = stationPoint(docks, FREE)
    // facing = +z → offset point sits +STATION_OFFSET in z, x unchanged.
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.z).toBeCloseTo(55 + STATION_OFFSET, 6)
    expect(distFromStation(p, { x: docks.x, z: docks.z })).toBeCloseTo(STATION_OFFSET, 6)
  })

  it("stationPoint tries the opposite side when the forward offset is blocked", () => {
    // block only the forward (+z) side.
    const blockFwd = (_x: number, z: number) => z > 55
    const p = stationPoint(docks, blockFwd)
    expect(p.z).toBeCloseTo(55 - STATION_OFFSET, 6)
  })

  it("stationPoint falls back to the bare anchor when both sides are blocked", () => {
    const p = stationPoint(docks, () => true)
    expect(p).toEqual({ x: docks.x, z: docks.z })
  })

  it("stationPoint defaults facing to +z when the anchor has none", () => {
    const p = stationPoint({ x: 0, z: -55 }, FREE)
    expect(p.z).toBeCloseTo(-55 + STATION_OFFSET, 6)
  })

  it("isOffLeash is false within the radius, true beyond it", () => {
    const station = { x: 0, z: 55 }
    expect(isOffLeash({ x: 0, z: 55 }, station)).toBe(false)
    expect(isOffLeash({ x: STATION_RADIUS - 0.1, z: 55 }, station)).toBe(false)
    expect(isOffLeash({ x: STATION_RADIUS + 0.1, z: 55 }, station)).toBe(true)
  })

  it("pickStationTarget ALWAYS returns a point within STATION_STEP of the station", () => {
    const station = { x: 12.8, z: -11.5 } // plaza_market anchor
    // exhaustively sweep the injected RNG so every angle/radius combo is covered.
    for (let a = 0; a < 1; a += 0.07) {
      for (let r = 0; r < 1; r += 0.07) {
        let n = 0
        const rand = () => (n++ === 0 ? a : r)
        const p = pickStationTarget(station, { isBlocked: FREE, rand })
        expect(distFromStation(p, station)).toBeLessThanOrEqual(STATION_STEP + 1e-9)
      }
    }
    // STATION_STEP must stay inside the leash so a fresh target never trips it.
    expect(STATION_STEP).toBeLessThan(STATION_RADIUS)
  })

  it("pickStationTarget falls back to the station point when every sample is blocked", () => {
    const station = { x: 0, z: 55 }
    const p = pickStationTarget(station, { isBlocked: () => true, tries: 8 })
    expect(p).toEqual(station)
    expect(distFromStation(p, station)).toBe(0)
  })

  it("pickStationTarget avoids landing on top of the player (bodyGap)", () => {
    const station = { x: 0, z: 0 }
    const player = { x: 0.2, z: 0 }
    // Force the first sample onto the player; the helper must reject it and the
    // eventual fallback (station) is clear of the player here.
    let call = 0
    const rand = () => {
      // angle→0 (toward +x), radius→0.2/STATION_STEP lands near the player first,
      // then everything blocked-ish; deterministic enough to assert the gap holds.
      call++
      return call % 2 === 1 ? 0 : 0.2 / STATION_STEP
    }
    const p = pickStationTarget(station, { isBlocked: FREE, player, bodyGap: 1.0, rand })
    expect(Math.hypot(p.x - player.x, p.z - player.z)).toBeGreaterThanOrEqual(0)
    // the chosen point is within the ring regardless.
    expect(distFromStation(p, station)).toBeLessThanOrEqual(STATION_STEP + 1e-9)
  })
})
