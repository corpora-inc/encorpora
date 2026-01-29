// Core geometric types
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Game specific types
export enum LaneIndex {
  Left = 0,
  Center = 1,
  Right = 2
}

export interface Note {
  id: string;
  lane: LaneIndex;
  y: number;      // Current vertical position (0 to 1, or pixels)
  text: string;   // The translation text
  isTarget: boolean; // Is this the correct answer?
  hit: boolean;   // Has it been hit?
  missed: boolean; // Did it pass the line without hit?
  spawnTime: number;
}

export enum GameState {
  MENU,
  PLAYING,
  GAME_OVER
}

export enum GameMode {
  PRACTICE, // Wait for user
  BLITZ     // Continuous stream
}

export interface GameConfig {
  mode: GameMode;
  speed: number; // Pixels per frame or similar
}
