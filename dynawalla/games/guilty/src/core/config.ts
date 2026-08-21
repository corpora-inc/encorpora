/**
 * Tuning. Every number a designer would want to touch lives here.
 *
 * World units, not pixels. The camera fits a constant 260 world units of
 * *height* into whatever viewport it is given, so a phone in portrait gets a
 * narrow, tall trench and a desktop gets a wide one — the descent always takes
 * the same number of seconds, and the ship's traverse is the thing that scales.
 */

/** Half the world height the camera always shows. */
export const VIEW_HALF_H = 130;
export const CAM_Z = 300;

export const SHIP_Y = -VIEW_HALF_H + 24;
/** Cross this and a life is gone. Sits just above the ship. */
export const GATE_Y = SHIP_Y + 14;
/** Where the equation hangs, and where the husks are born. */
export const EQUATION_Y = VIEW_HALF_H - 26;

export const HUSK_R = 13.5;
export const POD_R = 11;
export const SHIP_HALF_W = 8.5;

export const BULLET_SPEED = 560;
export const BULLET_R = 2.6;
/**
 * The shortest gap between two shots the player asks for.
 *
 * It is a rate limit on a deliberate act, not a metronome for an automatic one.
 * The gun used to fire on this interval by itself, which is the defect this
 * file's history turns on: "the default of just going into the game is that you
 * are just blasting everything, it's all wrong and you don't know what the F is
 * going on."
 */
export const FIRE_INTERVAL = 0.155;
/** Above this lateral speed the ship is crossing rather than aiming. */
export const FIRE_SPEED_GATE = 74;

export const SHIP_MAX_SPEED = 460;
export const SHIP_ACCEL = 2600;
export const SHIP_FRICTION = 0.0016;

export const BOLT_SPEED = 150;

/** Waves. */
export const BASE_DESCENT = 12.5;
export const DESCENT_PER_WAVE = 0.45;
export const MAX_DESCENT = 34;
export const BOSS_EVERY = 6;
/** How much faster the formation dives once it is inside the gate's shadow. */
export const URGENCY_MULTIPLIER = 1.32;
export const URGENCY_BAND = 62;

export const START_LIVES = 3;
export const MAX_LIVES = 4;

/** Deep Focus — the slow-motion power the player earns by being right. */
export const FOCUS_PER_SOLVE = 0.34;
export const FOCUS_DURATION = 2.6;
export const FOCUS_TIME_SCALE = 0.28;

/** Particle ceilings. Pools are allocated once at these sizes and never grow. */
export const MAX_PARTICLES = 720;
export const MAX_BULLETS = 48;
export const MAX_HUSKS = 14;

/** Presentation timings, seconds. */
export const HITSTOP_KILL = 0.075;
export const HITSTOP_WRONG = 0.11;
export const HITSTOP_BOSS = 0.15;
export const WAVE_GAP = 0.62;
