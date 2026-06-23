import type { GameEventMap, GameEventName } from "./types";

/**
 * GameEventBus — the single, strongly-typed pub/sub surface for Lingo Hero.
 *
 * This is the cross-stream ABI. Game.ts is the ONLY emitter; the effects,
 * audio, progression, and ui (Hud) streams are subscribers. Parallel streams
 * must never reach into Game.ts directly — they wire themselves to the bus in
 * their `init…()` function and react to events.
 *
 * Usage (subscriber):
 *
 *   import type { GameEventBus } from "../events";
 *   export function initThing(bus: GameEventBus) {
 *     const offHit = bus.on("noteHit", (e) => { ... e.lane, e.combo ... });
 *     const offCombo = bus.on("comboChange", (e) => { ... e.value ... });
 *     // return a teardown that calls offHit(); offCombo(); if you need one
 *   }
 *
 * Usage (emitter — Game.ts only):
 *
 *   bus.emit("noteHit", { lane, x, y, combo, points, mode });
 *
 * Handlers are invoked synchronously in subscription order. A throwing handler
 * is caught and logged so one buggy stream can't break the game loop or starve
 * sibling subscribers.
 */
export interface GameEventBus {
  /**
   * Subscribe to an event. Returns an unsubscribe function (idempotent).
   */
  on<K extends GameEventName>(
    event: K,
    handler: (payload: GameEventMap[K]) => void
  ): () => void;

  /**
   * Subscribe for a single delivery, then auto-unsubscribe.
   * Returns an unsubscribe function in case you want to cancel early.
   */
  once<K extends GameEventName>(
    event: K,
    handler: (payload: GameEventMap[K]) => void
  ): () => void;

  /**
   * Remove a previously registered handler. Usually you'd just call the
   * function returned by `on`/`once`, but this is here for symmetry.
   */
  off<K extends GameEventName>(
    event: K,
    handler: (payload: GameEventMap[K]) => void
  ): void;

  /** Emit an event to all subscribers. Emitter = Game.ts only. */
  emit<K extends GameEventName>(event: K, payload: GameEventMap[K]): void;

  /** Remove every subscriber (called on dispose). */
  clear(): void;
}

type AnyHandler = (payload: unknown) => void;

/**
 * Create a fresh event bus. One bus instance per Game instance (created in
 * Game.mount / constructor and handed to every stream's init function).
 */
export function createEventBus(): GameEventBus {
  const handlers = new Map<GameEventName, Set<AnyHandler>>();

  const getSet = (event: GameEventName): Set<AnyHandler> => {
    let set = handlers.get(event);
    if (!set) {
      set = new Set<AnyHandler>();
      handlers.set(event, set);
    }
    return set;
  };

  const on: GameEventBus["on"] = (event, handler) => {
    const set = getSet(event);
    set.add(handler as AnyHandler);
    return () => {
      set.delete(handler as AnyHandler);
    };
  };

  const off: GameEventBus["off"] = (event, handler) => {
    handlers.get(event)?.delete(handler as AnyHandler);
  };

  const once: GameEventBus["once"] = (event, handler) => {
    const wrapped = (payload: unknown) => {
      off(event, wrapped as never);
      (handler as AnyHandler)(payload);
    };
    const set = getSet(event);
    set.add(wrapped as AnyHandler);
    return () => {
      set.delete(wrapped as AnyHandler);
    };
  };

  const emit: GameEventBus["emit"] = (event, payload) => {
    const set = handlers.get(event);
    if (!set || set.size === 0) return;
    // Snapshot so handlers that unsubscribe during dispatch don't skip peers.
    for (const handler of [...set]) {
      try {
        handler(payload as unknown);
      } catch (err) {
        console.error(`[events] handler for "${event}" threw:`, err);
      }
    }
  };

  const clear: GameEventBus["clear"] = () => {
    handlers.clear();
  };

  return { on, once, off, emit, clear };
}
