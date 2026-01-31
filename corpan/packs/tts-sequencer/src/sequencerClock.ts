export type SequencerClockOptions = {
  bpm: number
  loopTicks: number
  stepTicks: number
  onStep?: (stepIndex: number, time: number, tick: number) => void
  onTick?: (tick: number, time: number) => void
}

export class SequencerClock {
  private context: AudioContext
  private bpm: number
  private loopTicks: number
  private stepTicks: number
  private onStep?: (stepIndex: number, time: number, tick: number) => void
  private onTick?: (tick: number, time: number) => void

  private isRunning = false
  private currentTick = 0
  private nextTickTime = 0
  private startTime = 0
  private timerId: number | null = null

  private readonly lookaheadMs = 25
  private readonly scheduleAheadTime = 0.2

  constructor(context: AudioContext, options: SequencerClockOptions) {
    this.context = context
    this.bpm = options.bpm
    this.loopTicks = Math.max(1, options.loopTicks)
    this.stepTicks = Math.max(1, options.stepTicks)
    this.onStep = options.onStep
    this.onTick = options.onTick
  }

  update(options: Partial<SequencerClockOptions>) {
    if (typeof options.bpm === "number") {
      this.bpm = Math.max(20, options.bpm)
    }
    if (typeof options.loopTicks === "number") {
      this.loopTicks = Math.max(1, Math.floor(options.loopTicks))
    }
    if (typeof options.stepTicks === "number") {
      this.stepTicks = Math.max(1, Math.floor(options.stepTicks))
    }
    if (typeof options.onStep === "function") {
      this.onStep = options.onStep
    }
    if (typeof options.onTick === "function") {
      this.onTick = options.onTick
    }

    if (this.isRunning) {
      this.stop()
      this.start()
    }
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.currentTick = 0
    const now = this.context.currentTime
    this.nextTickTime = now + 0.05
    this.startTime = this.nextTickTime

    this.timerId = window.setInterval(() => {
      this.scheduler()
    }, this.lookaheadMs)
  }

  stop() {
    if (!this.isRunning) return
    this.isRunning = false
    if (this.timerId !== null) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }
  }

  isPlaying() {
    return this.isRunning
  }

  getStartTime() {
    return this.startTime
  }

  getSecondsPerTick() {
    return 60 / (this.bpm * 48)
  }

  getCurrentTick() {
    if (!this.isRunning) return 0
    const elapsed = this.context.currentTime - this.startTime
    const ticks = Math.floor(elapsed / this.getSecondsPerTick())
    if (this.loopTicks <= 0) return 0
    return ticks % this.loopTicks
  }

  private scheduler() {
    if (!this.isRunning) return
    const now = this.context.currentTime
    while (this.nextTickTime < now + this.scheduleAheadTime) {
      this.emitTick(this.currentTick, this.nextTickTime)
      this.advanceTick()
    }
  }

  private emitTick(tick: number, time: number) {
    if (this.onTick) {
      this.onTick(tick, time)
    }
    if (tick % this.stepTicks === 0) {
      const stepIndex = Math.floor(tick / this.stepTicks)
      if (this.onStep) {
        this.onStep(stepIndex, time, tick)
      }
    }
  }

  private advanceTick() {
    this.currentTick += 1
    if (this.currentTick >= this.loopTicks) {
      this.currentTick = 0
    }
    this.nextTickTime += this.getSecondsPerTick()
  }
}
