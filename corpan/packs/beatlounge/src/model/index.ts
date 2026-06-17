/** beatlounge model barrel — the frozen pure spine.
 *  document re-exports the shared time/id types, so we surface timing here
 *  as value helpers only (avoids duplicate type star-exports). */
export * from "./document"
export {
  PPQ,
  MAX_BEATS,
  MAX_LOOP_TICKS,
  TICKS_PER_BAR_4_4,
  gridTicks,
  tickForStep,
  stepForTick,
  quantizeTick,
  stepsInLoop,
  secondsPerTick,
  ticksPerBar,
  swingOffsetTicks,
  clampLoopTicks,
  wrapTick,
} from "./timing"
export { newId } from "./ids"
export * from "./command"
export * from "./reduce"
export * from "./commandBus"
