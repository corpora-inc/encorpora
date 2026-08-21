import * as THREE from "three";
import type { ScaleName } from "./audio.ts";

/**
 * Four worlds, cycled forever, hue-rotated a little further on every lap.
 *
 * This is the answer to "must hold for twenty minutes". Speed alone does not
 * hold a child for twenty minutes; the promise of *seeing the next place* does.
 * A crossing is a real event — the whole palette, the sky, the ambient debris,
 * the musical mode and the tempo all change at once, over about two seconds,
 * with the sound and the light doing it together.
 *
 * AURORA and ABYSS are dark worlds with bright geometry. VOID inverts: a pale
 * bone sky with black obsidian geometry. Inversion is the strongest visual card
 * in the deck, so it is spent at the top of the cycle.
 */

export type AmbientKind = "dust" | "ember" | "mote" | "ash";

export type Biome = {
  id: string;
  name: string;
  skyTop: number;
  skyBot: number;
  fog: number;
  deck: number;
  accent: number;
  accent2: number;
  ocean: number;
  fogDensity: number;
  /** Pale world / dark geometry. Flips numeral and HUD contrast decisions. */
  inverted: boolean;
  ambient: AmbientKind;
  ambientColor: number;
  starDensity: number;
  auroraStrength: number;
  scale: ScaleName;
  bpm: number;
};

const BASE: Biome[] = [
  {
    id: "aurora",
    name: "AURORA SHELF",
    skyTop: 0x02030c,
    skyBot: 0x071230,
    fog: 0x060a1c,
    deck: 0x070a18,
    accent: 0x37ecff,
    accent2: 0xff44a8,
    ocean: 0x081434,
    fogDensity: 1 / 235,
    inverted: false,
    ambient: "dust",
    ambientColor: 0x9fe8ff,
    starDensity: 1,
    auroraStrength: 1,
    scale: "aurora",
    bpm: 126,
  },
  {
    id: "solar",
    name: "SOLAR FLATS",
    skyTop: 0x1a0403,
    skyBot: 0x5c1405,
    fog: 0x2a0a06,
    deck: 0x150703,
    accent: 0xffb024,
    accent2: 0xff3a24,
    ocean: 0x2e0d04,
    fogDensity: 1 / 200,
    inverted: false,
    ambient: "ember",
    ambientColor: 0xffb45a,
    starDensity: 0.15,
    auroraStrength: 0.35,
    scale: "solar",
    bpm: 134,
  },
  {
    id: "abyss",
    name: "THE ABYSS",
    skyTop: 0x00060a,
    skyBot: 0x032026,
    fog: 0x02090f,
    deck: 0x030a0e,
    accent: 0x5effc9,
    accent2: 0xa46bff,
    ocean: 0x021a20,
    fogDensity: 1 / 175,
    inverted: false,
    ambient: "mote",
    ambientColor: 0x7effd8,
    starDensity: 0.4,
    auroraStrength: 0.7,
    scale: "abyss",
    bpm: 142,
  },
  {
    id: "void",
    name: "THE BLEACH",
    skyTop: 0xe9e3d4,
    skyBot: 0xfdfaf2,
    fog: 0xece6d8,
    deck: 0x0b0b0d,
    accent: 0xff2f6d,
    accent2: 0x1a1a20,
    ocean: 0xc9c3b4,
    // Far thinner fog than the dark biomes. Bone-coloured fog at 1/165 washes
    // the near deck to sage and the whole point of the inverted world — black
    // obsidian on white — disappears about forty metres out.
    fogDensity: 1 / 330,
    inverted: true,
    ambient: "ash",
    ambientColor: 0x2a2a34,
    starDensity: 0,
    auroraStrength: 0,
    scale: "void",
    bpm: 150,
  },
];

const tmpHSL = { h: 0, s: 0, l: 0 };
const tmpColor = new THREE.Color();

function rotate(hex: number, turns: number): number {
  if (turns === 0) return hex;
  tmpColor.setHex(hex);
  tmpColor.getHSL(tmpHSL);
  // Small, deliberate drift. A full lap of four biomes shifts about 50 degrees,
  // which is "somewhere new" without ever becoming a colour a child cannot name.
  tmpColor.setHSL((tmpHSL.h + turns * 0.14) % 1, tmpHSL.s, tmpHSL.l);
  return tmpColor.getHex();
}

/** Biome for the nth crossing. Endless: `index` is unbounded. */
export function biomeAt(index: number): Biome {
  const b = BASE[index % BASE.length];
  const lap = Math.floor(index / BASE.length);
  if (lap === 0) return b;
  return {
    ...b,
    name: lap === 1 ? `${b.name} II` : `${b.name} ${romanish(lap + 1)}`,
    skyTop: rotate(b.skyTop, lap),
    skyBot: rotate(b.skyBot, lap),
    fog: rotate(b.fog, lap),
    accent: rotate(b.accent, lap),
    accent2: rotate(b.accent2, lap),
    ocean: rotate(b.ocean, lap),
    ambientColor: rotate(b.ambientColor, lap),
    bpm: Math.min(168, b.bpm + lap * 4),
  };
}

function romanish(n: number): string {
  const table = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return table[n] ?? `x${n}`;
}

/**
 * Metres of causeway per biome.
 *
 * The first crossing is deliberately the shortest. A child on a five-minute
 * free session has to *see* that the world changes, or the whole escalation
 * promise is invisible to them — the first one lands around 45 seconds.
 */
export function biomeLength(index: number): number {
  if (index === 0) return 1150;
  return Math.max(1300, 2000 - index * 70);
}
