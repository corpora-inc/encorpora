import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  closeDepth,
  FOR_KEY,
  isEntity,
  isLearnerId,
  MAX_LAYERS,
  readsKey,
  type Entity,
} from "./entities";

/**
 * The layers open over each screen (docs/design/ia.md, "Navigation"): the
 * one owner of a screen's layer stack. The address names the screen only;
 * opening, stepping and closing a layer change this store, never history,
 * so a layer is never a step that Back has to walk through and a screen's
 * stack is exactly where it was when the screen shows again (Back from
 * practice, Forward, a refresh, a remount for another identity).
 *
 * A stack is keyed by its screen (`layerScope`): the account, the learner
 * and the screen. A family's or a school's address names its account and
 * learner itself, so a device handing practice to a child and back keeps
 * the parent's stack; any other address (your own Pathways, /me) is the
 * signed-in account's own.
 *
 * Motion belongs to what a person does, never to a screen being restored:
 * `motion` records the last open or close a person made, and only a layer
 * drawn within moments of it moves (nav/LayerHost.tsx).
 */
export type Layer = Entity & {
  /** An answer's replay narrowed to one skill (Previous and Next). */
  skill?: string;
  /** The learner a skill, a lesson or an area was opened for (a child's
   * block on a family's Today): the practice it offers is theirs. What is
   * opened over it is for them too (`pushed`). */
  for?: string;
};

/** Whether a layer of this kind says whose it was opened for. */
const namesLearner = (layer: Entity) => readsKey(layer.kind, FOR_KEY);
/** `layer`, for the learner the layer it goes over (or replaces) was opened
 * for, unless it names its own: a lesson over a child's skill, a connected
 * skill, the next area are that child's too. */
const carried = (from: Layer | undefined, layer: Layer): Layer =>
  !layer.for && from?.for && namesLearner(layer)
    ? { ...layer, for: from.for }
    : layer;

/**
 * The skill your own Pathways names in its address (`/pathways/<skill>`):
 * the map's screen with that skill open over it, a real address that Back
 * closes and a link shares. Undefined at any other address.
 */
export function pathwaysSkill(pathname: string): string | undefined {
  const named = /^\/pathways\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (!named) return undefined;
  try {
    return decodeURIComponent(named);
  } catch (error) {
    console.warn("A skill's address didn't read; opening the map", error);
    return undefined;
  }
}

/** The screen a stack belongs to. A skill's address on your own Pathways
 * is the map's screen (`/pathways`): its view and layers are the map's. */
export function layerScope(pathname: string, accountId: string | undefined) {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  const path = /^\/pathways\/[^/]+$/.test(trimmed) ? "/pathways" : trimmed;
  return /^\/(family|school)\//.test(path)
    ? path
    : `${accountId ?? "guest"}:${path}`;
}

/** How long after a person's open or close a layer drawn still moves. */
export const MOTION_MS = 700;

type Motion = {
  scope: string;
  direction: 1 | -1;
  at: number;
  /** Going up: the layer just closed (`kind:id`). */
  closed?: string;
};
type LayerState = {
  stacks: Record<string, Layer[]>;
  /** The last open or close a person made. Never stored. */
  motion: Motion | null;
  /** Replaces a screen's stack. `direction` is a person's own step (it moves);
   * without one the stack is restored (a legacy link), and nothing moves. */
  set: (scope: string, stack: Layer[], direction?: 1 | -1) => void;
};

/** The screens remembered at once: the oldest is forgotten first. */
const SCOPES = 40;

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("Open layers not restored", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("Open layers not saved", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("Open layers not cleared", error);
    }
  },
}));

const clean = (stack: Layer[]) =>
  stack
    .filter(isEntity)
    .slice(0, MAX_LAYERS)
    .map(({ kind, id, skill, for: learner }) => ({
      kind,
      id,
      ...(skill ? { skill } : {}),
      // Only a well-formed learner id, on a layer that reads one.
      ...(isLearnerId(learner) && namesLearner({ kind, id })
        ? { for: learner }
        : {}),
    }));

export const useLayerStore = create<LayerState>()(
  persist(
    (set) => ({
      stacks: {},
      motion: null,
      set: (scope, stack, direction) =>
        set((state) => {
          const { [scope]: _old, ...others } = state.stacks;
          const next = clean(stack);
          // The newest screen last, so the oldest goes first.
          const kept = Object.entries(others).slice(-(SCOPES - 1));
          return {
            stacks: Object.fromEntries(
              next.length ? [...kept, [scope, next]] : kept,
            ),
            motion: direction
              ? {
                  scope,
                  direction,
                  at: performance.now(),
                  closed:
                    direction < 0 && _old?.[next.length]
                      ? `${_old[next.length]!.kind}:${_old[next.length]!.id}`
                      : undefined,
                }
              : state.motion,
          };
        }),
    }),
    {
      name: "amp.layers",
      storage,
      version: 1,
      partialize: (state) => ({ stacks: state.stacks }),
    },
  ),
);

const EMPTY: Layer[] = [];
/** A screen's stack (stable while it is unchanged). */
export const stackOf = (scope: string) => (state: LayerState) =>
  state.stacks[scope] ?? EMPTY;

const same = (a: Entity, b: Entity) => a.kind === b.kind && a.id === b.id;

/** The stack with `layer` opened over it. Opening what is already on top
 * changes nothing; opening something already lower brings the stack back to
 * it; deeper than MAX_LAYERS, the newest replaces the top. */
export function pushed(stack: Layer[], layer: Layer): Layer[] {
  const at = stack.findIndex((entry) => same(entry, layer));
  if (at >= 0) return stack.slice(0, at + 1);
  // Opened over a child's layer, it is that child's too.
  const over = carried(stack.at(-1), layer);
  const next = [...stack, over];
  return next.length > MAX_LAYERS ? [...stack.slice(0, -1), over] : next;
}
/** The stack with its top layer swapped (Previous and Next, one area for
 * another): the new one is for whoever the old one was. */
export const swapped = (stack: Layer[], layer: Layer): Layer[] => [
  ...stack.slice(0, -1),
  carried(stack.at(-1), layer),
];

/** What a person can do with a screen's stack (nav/links.tsx `useLayers`). */
export function layerActions(scope: string) {
  const get = () => useLayerStore.getState().stacks[scope] ?? EMPTY;
  const set = (stack: Layer[], direction: 1 | -1) =>
    useLayerStore.getState().set(scope, stack, direction);
  return {
    open: (layers: Layer | Layer[]) =>
      set([layers].flat().reduce(pushed, get()), 1),
    /** One layer down (Escape, a replay's own close). */
    close: () => set(get().slice(0, -1), -1),
    /** Keeps only the first `depth` layers (a trail's crumb). */
    closeToDepth: (depth: number) => set(get().slice(0, depth), -1),
    /** The whole overlay away (its ✕ or scrim), back to the page, except
     * that an answer's replay is a base of its own (entities closeDepth). */
    closeAll: () => {
      const stack = get();
      set(stack.slice(0, closeDepth(stack, stack.length - 1)), -1);
    },
    /** Closes the layer at `index` and every layer over it, back to where
     * it closes to (entities closeDepth): an answer's replay to the page it
     * was opened over, never to the student under it. */
    closeLayer: (index: number) => {
      const stack = get();
      set(stack.slice(0, closeDepth(stack, index)), -1);
    },
    /** Swaps the top layer (Previous and Next through answers). */
    replaceTop: (layer: Layer) => set(swapped(get(), layer), 1),
  };
}

/** Restores a stack for a screen, without motion: a link from before
 * layers left the address (`?open=`), or a screen another opens with its
 * layers already in place (a student moved to another school). */
export function seedLayers(scope: string, stack: Layer[]) {
  useLayerStore.getState().set(scope, stack);
}
