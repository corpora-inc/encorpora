import Phaser from "phaser"
import { BOSS_PHRASES, type BossPhrase } from "../data/bossPhrases"
import { saveQuest } from "../util/save"

/**
 * The Rat King final-boss encounter. Runs as a phase INSIDE ActionScene (not a
 * separate Phaser scene): ActionScene constructs this with a small BossHost view
 * of itself, locks the camera onto the lair, and delegates update / tap / key.
 *
 * Theme: sound is force. The player dodges the King's attacks, grabs floating
 * language phrases, and throws them as beams of sound to break his health. When
 * he falls he reveals a fragment of the All-Hearing Ear and a clue toward the
 * next level.
 *
 * Layout note: the camera is fixed (ActionScene centers it on the lair), so
 * everything here is drawn in SCREEN space (setScrollFactor 0). The only world-
 * space actor is the player; `playerScreenX()` converts its position for hit
 * tests against our screen-fixed attacks.
 */

/** The slice of ActionScene the boss phase is allowed to touch. */
export interface BossHost {
  scene: Phaser.Scene
  getPlayer(): Phaser.GameObjects.Container
  getPlayerScale(): number
  getPlayerHearts(): number
  getScore(): number
  takePlayerDamage(step: number): void
  speakLang(lang: string, text: string): void
  playImpactSfx(): void
  resetForReplay(): void
  onBossDefeated(clue: string): void
  damageStep: number
  arenaCenterX: number
  playerBaseY: number
}

type PhraseState = "available" | "held" | "thrown"

interface PhraseToken {
  container: Phaser.GameObjects.Container
  phrase: BossPhrase
  state: PhraseState
  x: number
  y: number
  expireAt: number
}

interface RatKing {
  container: Phaser.GameObjects.Container
  hp: number
  maxHp: number
  recoiling: boolean
  alive: boolean
  healthBarFill: Phaser.GameObjects.Rectangle
}

// Screen-space anchors (800x600 design).
const KING_X = 600
const KING_Y = 290
const FLOOR_Y = 470
const WEAPON_SLOT_X = 96
const WEAPON_SLOT_Y = 540
const THROW_BTN_X = 400
const THROW_BTN_Y = 540

// Tunables (post-playtest).
const BOSS_MAX_HITS = 8
const MAX_AVAILABLE_PHRASES = 2
const PHRASE_TTL_MS = 6500
const PHRASE_SPAWN_MIN_MS = 1800
const PHRASE_SPAWN_MAX_MS = 3200
const ATTACK_MIN_MS = 1700
const ATTACK_MAX_MS = 2700
const RECOIL_MS = 450

const LATIN_TTS = "it" // Latin has no TTS voice; the Italian voice reads the King's Latin.
const KING_FINAL_WORDS = ["Vale.", "Requiescam."]

// The Rat King is a preening egomaniac — every line drips with self-conceit.
// English glosses follow each line for the team.
const KING_INTRO = [
  "Inclinate vos ante Regem Murium!", // Bow before the Rat King!
  "Quis audet regem murium provocare?", // Who dares challenge the Rat King?
  "Contemplamini maiestatem meam et desperate!", // Behold my majesty and despair!
  "Ad genua, vermes! Rex adest!", // To your knees, worms! The King has arrived!
  "Ego, Rex Murium, dominus omnium, vos saluto... vix.", // I, the Rat King, lord of all, greet you... barely.
]

const KING_LATIN_TAUNTS = [
  "Audite regem vestrum!", // Hear your king!
  "Silentium! Rex loquitur.", // Silence! The King speaks.
  "Caseus mihi! Caseus regi!", // Cheese for me! Cheese for the King!
  "Vos omnes mei estis.", // You are all mine.
  "Frustra clamatis, parvuli.", // You cry in vain, little ones.
  "Sentite iram regis!", // Feel the wrath of the King!
  "Ego sum rex regum, dominus murium!", // I am the king of kings, lord of rats!
  "Nemo me superat, nemo me aequat!", // None surpass me, none are my equal!
  "Quis tam splendidus quam ego?", // Who is as splendid as I?
  "Sol ipse mihi invidet.", // The sun itself envies me.
  "Ego perfectus sum; vos defectus.", // I am perfect; you are defective.
  "Vestra parvitas me delectat.", // Your smallness delights me.
  "Maior sum quam fortuna ipsa.", // I am greater than fortune herself.
  "Nihil magnificentia mea maius est.", // Nothing is greater than my magnificence.
  "Sceptrum meum caelum ipsum tangit.", // My scepter touches the very heavens.
  "Rex natus sum, non factus.", // I was born a king, not made one.
  "In conspectu meo, silete et adorate.", // In my presence, be silent and adore.
  "Mundus mihi soli servit.", // The world serves me alone.
  "Indigni estis qui me spectetis.", // You are unworthy even to look upon me.
  "Corona mea aeterna est, sicut gloria mea.", // My crown is eternal, as is my glory.
]

// Fragment I of VII and where the next one hides — the level-2 pointer.
const LEVEL2_CLUE =
  "FRAGMENT I / VII recovered.\n\nThe next ear lies where the iron rivers cross:\n40.7527° N, 73.9772° W — beneath the great clock."

export class BossArena {
  private host: BossHost
  private scene: Phaser.Scene
  private camOffsetX: number

  private objects: Phaser.GameObjects.GameObject[] = []
  private timers: Phaser.Time.TimerEvent[] = []
  private tweens: Phaser.Tweens.Tween[] = []

  private king?: RatKing
  private titleText?: Phaser.GameObjects.Text
  private heartsText?: Phaser.GameObjects.Text
  private scoreText?: Phaser.GameObjects.Text
  private weaponSlotLabel?: Phaser.GameObjects.Text
  private throwBtn?: Phaser.GameObjects.Container

  private available: PhraseToken[] = []
  private held: PhraseToken | null = null
  private phraseRotation = 0

  private inDeathSequence = false
  private fragment?: Phaser.GameObjects.Container
  private fragmentGrabbed = false
  private returnBtn?: Phaser.GameObjects.Container
  private replayBtn?: Phaser.GameObjects.Container

  private keyGrab?: Phaser.Input.Keyboard.Key
  private keyThrow?: Phaser.Input.Keyboard.Key

  constructor(host: BossHost) {
    this.host = host
    this.scene = host.scene
    this.camOffsetX = host.arenaCenterX - 400
  }

  // --------------- LIFECYCLE ---------------

  start() {
    this.inDeathSequence = false
    this.fragmentGrabbed = false
    this.buildLair()
    this.buildKing()
    this.buildMinions()
    this.buildBossHud()

    const kb = this.scene.input.keyboard
    if (kb) {
      this.keyGrab = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      this.keyThrow = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    }

    // The King announces himself in Latin as the lair opens.
    this.addTimer(600, () => this.kingSay(KING_INTRO[Phaser.Math.Between(0, KING_INTRO.length - 1)]))

    this.scheduleNextPhrase()
    this.scheduleNextAttack()
  }

  /** King speaks Latin (Italian TTS voice) + shows a parchment speech bubble. */
  private kingSay(text: string) {
    this.host.speakLang(LATIN_TTS, text)
    if (!this.king) return
    const bx = this.king.container.x
    const by = this.king.container.y - 100
    const bubble = this.scene.add.container(bx, by).setScrollFactor(0).setDepth(135)
    const label = this.scene.add
      .text(0, 0, text, {
        fontSize: "13px",
        fontFamily: '"Courier New", monospace',
        color: "#2a1a08",
        align: "center",
        fontStyle: "italic",
        wordWrap: { width: 220 },
      })
      .setOrigin(0.5)
    const bg = this.scene.add
      .rectangle(0, 0, Math.max(90, label.width + 24), label.height + 18, 0xf2e2b8)
      .setStrokeStyle(2, 0x000000)
    bubble.add(bg)
    bubble.add(label)
    bubble.setScale(0.7)
    this.track(bubble)
    this.addTween({ targets: bubble, scale: 1, alpha: { from: 0, to: 1 }, duration: 160, ease: "Back.out" })
    this.addTimer(2600, () => {
      this.addTween({ targets: bubble, alpha: 0, duration: 260, onComplete: () => bubble.destroy() })
    })
  }

  destroy() {
    this.teardown()
  }

  private teardown() {
    this.timers.forEach((t) => t.remove(false))
    this.timers = []
    this.tweens.forEach((tw) => tw.stop())
    this.tweens = []
    this.objects.forEach((o) => o.destroy())
    this.objects = []
    this.king = undefined
    this.available = []
    this.held = null
    this.fragment = undefined
    this.throwBtn = undefined
    this.returnBtn = undefined
    this.replayBtn = undefined
  }

  private replay() {
    this.teardown()
    this.host.resetForReplay()
    this.start()
  }

  // --------------- TRACKING HELPERS ---------------

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o)
    return o
  }

  private addTween(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const tw = this.scene.tweens.add(config)
    this.tweens.push(tw)
    return tw
  }

  private addTimer(delay: number, callback: () => void): Phaser.Time.TimerEvent {
    const t = this.scene.time.addEvent({ delay, callback })
    this.timers.push(t)
    return t
  }

  private playerScreenX(): number {
    return this.host.getPlayer().x - this.camOffsetX
  }

  // --------------- BUILD: LAIR ---------------

  private buildLair() {
    // The lair is an OPAQUE screen-fixed backdrop at a depth ABOVE all street
    // content (NPCs/booths ≤5, buildings ≤8, energy bar ≤52) so the King's hall
    // fully replaces the NYC scene rather than layering over it. King/rats/player
    // sit above this band (see DEPTH_* below); HUD/tokens are 100+.
    // Dark stone backdrop.
    this.track(
      this.scene.add.rectangle(400, 300, 800, 600, 0x14101a).setScrollFactor(0).setDepth(60),
    )
    // Brick courses.
    for (let row = 0; row < 7; row++) {
      const y = 30 + row * 60
      this.track(
        this.scene.add
          .rectangle(400, y, 800, 2, 0x251c2e, 0.6)
          .setScrollFactor(0)
          .setDepth(60),
      )
    }
    // Side columns.
    for (const cx of [40, 760]) {
      this.track(
        this.scene.add.rectangle(cx, 250, 56, 420, 0x1c1626).setScrollFactor(0).setDepth(61),
      )
    }
    // A crowned banner behind the throne.
    this.track(
      this.scene.add.rectangle(KING_X, 130, 120, 150, 0x3a1f4a).setScrollFactor(0).setDepth(62),
    )
    this.track(
      this.scene.add
        .text(KING_X, 120, "👑", { fontSize: "44px" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(62),
    )
    // Murky green floor.
    this.track(
      this.scene.add.rectangle(400, 540, 800, 130, 0x1d2a1c).setScrollFactor(0).setDepth(63),
    )
    this.track(
      this.scene.add
        .rectangle(400, FLOOR_Y + 6, 800, 3, 0x2f4a2b, 0.8)
        .setScrollFactor(0)
        .setDepth(64),
    )
  }

  // --------------- BUILD: KING ---------------

  private buildKing() {
    const c = this.scene.add.container(KING_X, KING_Y).setScrollFactor(0).setDepth(72)

    // Stone throne.
    c.add(this.scene.add.rectangle(0, 70, 150, 150, 0x4a4452))
    c.add(this.scene.add.rectangle(0, -10, 110, 130, 0x5a5263))
    c.add(this.scene.add.rectangle(-66, 30, 22, 170, 0x403a4a))
    c.add(this.scene.add.rectangle(66, 30, 22, 170, 0x403a4a))

    // Purple ermine robe draped over the throne.
    c.add(this.scene.add.triangle(0, 60, -70, 80, 70, 80, 0, -40, 0x6a2d8a))
    c.add(this.scene.add.rectangle(0, 96, 150, 24, 0xf2efe9)) // white ermine trim
    c.add(this.scene.add.rectangle(0, 96, 150, 24, 0x000000, 0).setStrokeStyle(0, 0))

    // The King himself — a giant nutria (beaver glyph reads close at this size).
    c.add(this.scene.add.text(0, -6, "🦫", { fontSize: "92px" }).setOrigin(0.5))
    // Gold crown.
    c.add(this.scene.add.text(0, -70, "👑", { fontSize: "40px" }).setOrigin(0.5))
    // Skull-topped scepter.
    c.add(this.scene.add.rectangle(64, 4, 6, 86, 0xcaa64a))
    c.add(this.scene.add.text(64, -44, "💀", { fontSize: "22px" }).setOrigin(0.5))

    this.track(c)

    // Health bar fill is built in buildBossHud; create the king record now.
    this.king = {
      container: c,
      hp: BOSS_MAX_HITS,
      maxHp: BOSS_MAX_HITS,
      recoiling: false,
      alive: true,
      healthBarFill: undefined as unknown as Phaser.GameObjects.Rectangle,
    }

    // Gentle idle breathing.
    this.addTween({
      targets: c,
      scaleX: { from: 1, to: 1.03 },
      scaleY: { from: 1, to: 0.97 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    })
  }

  private buildMinions() {
    // Regular rats + a few crowned lieutenants flanking the throne.
    const spots: { x: number; y: number; crowned: boolean }[] = [
      { x: 470, y: 452, crowned: false },
      { x: 510, y: 478, crowned: true },
      { x: 700, y: 452, crowned: false },
      { x: 730, y: 480, crowned: true },
      { x: 560, y: 500, crowned: false },
      { x: 650, y: 500, crowned: false },
      { x: 430, y: 500, crowned: false },
      { x: 760, y: 502, crowned: true },
      { x: 600, y: 510, crowned: false },
      { x: 690, y: 512, crowned: false },
      { x: 500, y: 514, crowned: false },
      { x: 740, y: 460, crowned: false },
    ]
    for (const s of spots) {
      const rat = this.scene.add
        .text(s.x, s.y, "🐀", { fontSize: s.crowned ? "28px" : "24px" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(70)
      this.track(rat)
      if (s.crowned) {
        this.track(
          this.scene.add
            .text(s.x, s.y - 16, "👑", { fontSize: "14px" })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(71),
        )
      }
      // Tiny skitter.
      this.addTween({
        targets: rat,
        x: s.x + Phaser.Math.Between(-6, 6),
        duration: Phaser.Math.Between(600, 1100),
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      })
    }
  }

  // --------------- BUILD: HUD ---------------

  private buildBossHud() {
    // Player hearts + score, top-left.
    this.heartsText = this.scene.add
      .text(20, 24, "", { fontSize: "18px", fontFamily: "monospace", color: "#ff5b6e" })
      .setScrollFactor(0)
      .setDepth(110)
    this.track(this.heartsText)
    this.scoreText = this.scene.add
      .text(20, 46, "", { fontSize: "12px", fontFamily: "monospace", color: "#cccccc" })
      .setScrollFactor(0)
      .setDepth(110)
    this.track(this.scoreText)

    // Boss title + health bar, top-center.
    this.titleText = this.scene.add
      .text(400, 36, "THE RAT KING", {
        fontSize: "18px",
        fontFamily: '"Courier New", monospace',
        color: "#ff3b3b",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(110)
    this.track(this.titleText)
    this.track(
      this.scene.add
        .rectangle(400, 60, 320, 16, 0x331111)
        .setScrollFactor(0)
        .setDepth(109)
        .setStrokeStyle(2, 0x000000),
    )
    const fill = this.scene.add
      .rectangle(242, 60, 316, 12, 0xcc2b2b)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(110)
    this.track(fill)
    if (this.king) this.king.healthBarFill = fill

    // Weapon slot (holds the grabbed phrase), bottom-left.
    this.track(
      this.scene.add
        .rectangle(WEAPON_SLOT_X, WEAPON_SLOT_Y, 150, 50, 0x000000, 0.45)
        .setScrollFactor(0)
        .setDepth(108)
        .setStrokeStyle(2, 0x55ccff, 0.7),
    )
    this.track(
      this.scene.add
        .text(WEAPON_SLOT_X, WEAPON_SLOT_Y - 32, "PHRASE", {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#88ddff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(110),
    )
    this.weaponSlotLabel = this.scene.add
      .text(WEAPON_SLOT_X, WEAPON_SLOT_Y, "—", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 140 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(111)
    this.track(this.weaponSlotLabel)

    // Item slot (cheese ×2), bottom-right — flavor from the reference art.
    this.track(
      this.scene.add
        .rectangle(704, WEAPON_SLOT_Y, 90, 50, 0x000000, 0.45)
        .setScrollFactor(0)
        .setDepth(108)
        .setStrokeStyle(2, 0xddaa33, 0.6),
    )
    this.track(
      this.scene.add
        .text(690, WEAPON_SLOT_Y, "🧀", { fontSize: "22px" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(110),
    )
    this.track(
      this.scene.add
        .text(716, WEAPON_SLOT_Y + 6, "×2", { fontSize: "13px", fontFamily: "monospace", color: "#fff" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(110),
    )

    // Hint line.
    this.track(
      this.scene.add
        .text(400, 92, "Grab a phrase · hurl it at the King · dodge!", {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#dddddd",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(110),
    )

    this.buildThrowButton()
    this.refreshHud()
  }

  private buildThrowButton() {
    const c = this.scene.add.container(THROW_BTN_X, THROW_BTN_Y).setScrollFactor(0).setDepth(130)
    c.add(this.scene.add.rectangle(0, 0, 220, 50, 0x55ccff, 0.92).setStrokeStyle(3, 0xffffff))
    c.add(
      this.scene.add
        .text(0, 0, "THROW ►", {
          fontSize: "20px",
          fontFamily: '"Courier New", monospace',
          color: "#06222e",
        })
        .setOrigin(0.5),
    )
    c.setVisible(false)
    this.throwBtn = c
    this.track(c)
  }

  private refreshHud() {
    if (this.heartsText) {
      const n = Math.max(0, Math.min(10, this.host.getPlayerHearts()))
      this.heartsText.setText("PLAYER  " + "♥".repeat(n) + "♡".repeat(Math.max(0, 5 - n)))
    }
    if (this.scoreText) {
      this.scoreText.setText(`SCORE ${this.host.getScore()}`)
    }
  }

  // --------------- UPDATE LOOP ---------------

  update(time: number, _delta: number) {
    this.refreshHud()

    // Expire stale phrases.
    for (const tok of [...this.available]) {
      if (time >= tok.expireAt) this.expirePhrase(tok)
    }
  }

  handleKey() {
    if (this.inDeathSequence) return
    if (this.keyGrab && Phaser.Input.Keyboard.JustDown(this.keyGrab)) {
      if (!this.held && this.available.length > 0) this.grabPhrase(this.available[0])
    }
    if (this.keyThrow && Phaser.Input.Keyboard.JustDown(this.keyThrow)) {
      if (this.held) this.throwHeldPhrase()
    }
  }

  // --------------- TAP ROUTER ---------------

  /** Returns true if the boss UI consumed the tap. */
  handleTap(x: number, y: number): boolean {
    if (this.inDeathSequence) {
      if (!this.fragmentGrabbed && this.fragment) {
        if (Phaser.Math.Distance.Between(x, y, this.fragment.x, this.fragment.y) < 60) {
          this.grabFragment()
          return true
        }
      }
      if (this.returnBtn?.visible && this.hitBtn(this.returnBtn, x, y)) {
        this.host.onBossDefeated(LEVEL2_CLUE)
        return true
      }
      if (this.replayBtn?.visible && this.hitBtn(this.replayBtn, x, y)) {
        this.replay()
        return true
      }
      return true // swallow taps during the death beat
    }

    // Throw (only while holding).
    if (this.held && this.throwBtn?.visible) {
      if (Math.abs(x - THROW_BTN_X) <= 110 && Math.abs(y - THROW_BTN_Y) <= 26) {
        this.throwHeldPhrase()
        return true
      }
    }

    // Grab the topmost available token under the point.
    if (!this.held) {
      for (let i = this.available.length - 1; i >= 0; i--) {
        const tok = this.available[i]
        if (Math.abs(x - tok.x) <= 84 && Math.abs(y - tok.y) <= 36) {
          this.grabPhrase(tok)
          return true
        }
      }
    }
    return false
  }

  private hitBtn(btn: Phaser.GameObjects.Container, x: number, y: number): boolean {
    return Math.abs(x - btn.x) <= 120 && Math.abs(y - btn.y) <= 26
  }

  // --------------- PHRASES ---------------

  private scheduleNextPhrase() {
    this.addTimer(Phaser.Math.Between(PHRASE_SPAWN_MIN_MS, PHRASE_SPAWN_MAX_MS), () => {
      if (!this.scene.scene.isActive()) return
      this.spawnPhrase()
      this.scheduleNextPhrase()
    })
  }

  private spawnPhrase() {
    if (this.inDeathSequence) return
    if (this.available.length >= MAX_AVAILABLE_PHRASES) return

    const phrase = BOSS_PHRASES[this.phraseRotation % BOSS_PHRASES.length]
    this.phraseRotation++

    const x = Phaser.Math.Between(150, 650)
    const y = Phaser.Math.Between(130, 250)
    const c = this.scene.add.container(x, y).setScrollFactor(0).setDepth(120)
    c.add(this.scene.add.rectangle(0, 0, 160, 56, 0x101820, 0.92).setStrokeStyle(2, 0xffd34d))
    c.add(
      this.scene.add
        .text(0, -12, phrase.display, { fontSize: "18px", fontFamily: "monospace", color: "#ffe9a8" })
        .setOrigin(0.5),
    )
    c.add(
      this.scene.add
        .text(0, 10, `${phrase.gloss} · ${phrase.label}`, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#9fd0ff",
        })
        .setOrigin(0.5),
    )
    this.track(c)

    // Bob + a fade-in pulse so it reads as "grabbable".
    this.addTween({
      targets: c,
      y: y - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    })

    const tok: PhraseToken = { container: c, phrase, state: "available", x, y, expireAt: this.scene.time.now + PHRASE_TTL_MS }
    this.available.push(tok)
  }

  private expirePhrase(tok: PhraseToken) {
    this.available = this.available.filter((t) => t !== tok)
    this.addTween({
      targets: tok.container,
      alpha: 0,
      duration: 250,
      onComplete: () => tok.container.destroy(),
    })
  }

  private grabPhrase(tok: PhraseToken) {
    if (this.held) return
    this.available = this.available.filter((t) => t !== tok)
    tok.state = "held"
    this.held = tok

    // Speak the phrase as it's drawn — the sound IS the weapon.
    this.host.speakLang(tok.phrase.ttsLang, tok.phrase.display)

    // Fly the token into the weapon slot.
    this.addTween({
      targets: tok.container,
      x: WEAPON_SLOT_X,
      y: WEAPON_SLOT_Y,
      scale: 0.85,
      duration: 220,
      ease: "Quad.out",
      onComplete: () => {
        tok.container.setVisible(false)
      },
    })
    if (this.weaponSlotLabel) {
      this.weaponSlotLabel.setText(tok.phrase.display)
    }
    this.throwBtn?.setVisible(true)
  }

  private throwHeldPhrase() {
    const tok = this.held
    if (!tok || !this.king?.alive) return
    this.held = null
    tok.state = "thrown"
    tok.container.destroy()
    this.throwBtn?.setVisible(false)
    if (this.weaponSlotLabel) this.weaponSlotLabel.setText("—")

    // A straight beam of sound from the weapon slot to the King.
    const targetX = this.king.container.x
    const targetY = this.king.container.y - 6
    const beam = this.scene.add.container(WEAPON_SLOT_X, WEAPON_SLOT_Y).setScrollFactor(0).setDepth(125)
    const core = this.scene.add.rectangle(0, 0, 46, 10, 0xbdefff, 0.95)
    const glow = this.scene.add.rectangle(0, 0, 60, 20, 0x55ccff, 0.45)
    const glyph = this.scene.add
      .text(0, 0, tok.phrase.display, { fontSize: "16px", fontFamily: "monospace", color: "#ffffff" })
      .setOrigin(0.5)
    beam.add(glow)
    beam.add(core)
    beam.add(glyph)
    const angle = Phaser.Math.Angle.Between(WEAPON_SLOT_X, WEAPON_SLOT_Y, targetX, targetY)
    beam.setRotation(angle)
    this.track(beam)

    this.addTween({
      targets: beam,
      x: targetX,
      y: targetY,
      duration: 260,
      ease: "Quad.in",
      onComplete: () => {
        beam.destroy()
        this.onBeamImpact()
      },
    })
  }

  private onBeamImpact() {
    if (!this.king?.alive) return
    this.host.playImpactSfx()
    this.scene.cameras.main.shake(220, 0.012)

    // Impact burst at the King.
    const kx = this.king.container.x
    const ky = this.king.container.y - 6
    const burst = this.scene.add
      .text(kx, ky, "💥", { fontSize: "30px" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(126)
    this.track(burst)
    this.addTween({
      targets: burst,
      scale: 1.8,
      alpha: 0,
      duration: 320,
      onComplete: () => burst.destroy(),
    })

    this.damageBoss(1)
  }

  // --------------- BOSS DAMAGE ---------------

  private damageBoss(hits: number) {
    if (!this.king || !this.king.alive) return
    this.king.hp = Math.max(0, this.king.hp - hits)
    const pct = this.king.hp / this.king.maxHp
    this.king.healthBarFill.width = 316 * pct

    // Recoil: flash + knock back briefly, pausing his attacks.
    this.king.recoiling = true
    const c = this.king.container
    this.addTween({
      targets: c,
      x: KING_X + 10,
      duration: 60,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        c.x = KING_X
      },
    })
    this.addTimer(RECOIL_MS, () => {
      if (this.king) this.king.recoiling = false
    })

    if (this.king.hp <= 0) this.deathSequence()
  }

  // --------------- KING ATTACKS ---------------

  private scheduleNextAttack() {
    this.addTimer(Phaser.Math.Between(ATTACK_MIN_MS, ATTACK_MAX_MS), () => {
      if (!this.scene.scene.isActive()) return
      if (this.king?.alive && !this.king.recoiling && !this.inDeathSequence) {
        const roll = Phaser.Math.Between(0, 2)
        if (roll === 0) this.attackCheeseVomit()
        else if (roll === 1) this.attackSpin()
        else this.attackTailKick()
        // Latin bluster on ~half his attacks.
        if (Phaser.Math.Between(0, 1) === 0) {
          this.kingSay(KING_LATIN_TAUNTS[Phaser.Math.Between(0, KING_LATIN_TAUNTS.length - 1)])
        }
      }
      this.scheduleNextAttack()
    })
  }

  /** Cheese-vomit: a lobbed projectile toward the player's position. */
  private attackCheeseVomit() {
    if (!this.king) return
    const fromX = this.king.container.x - 40
    const fromY = this.king.container.y + 10
    const targetX = this.playerScreenX()
    const proj = this.scene.add
      .text(fromX, fromY, "🧀", { fontSize: "26px" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(124)
    this.track(proj)
    const arcH = 120
    const state = { t: 0 }
    this.addTween({
      targets: state,
      t: 1,
      duration: 720,
      ease: "Linear",
      onUpdate: () => {
        proj.x = Phaser.Math.Linear(fromX, targetX, state.t)
        proj.y = Phaser.Math.Linear(fromY, FLOOR_Y, state.t) - Math.sin(Math.PI * state.t) * arcH
        proj.angle = state.t * 300
      },
      onComplete: () => {
        const radius = 44 + 8 * this.host.getPlayerScale()
        const hit = Math.abs(this.playerScreenX() - proj.x) < radius
        const splat = this.scene.add
          .text(proj.x, FLOOR_Y, "💥", { fontSize: "20px" })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(124)
        this.track(splat)
        this.addTween({ targets: splat, alpha: 0, scale: 1.6, duration: 280, onComplete: () => splat.destroy() })
        proj.destroy()
        if (hit) this.host.takePlayerDamage(this.host.damageStep)
      },
    })
  }

  /** Spin: telegraphed screen-wide shockwave; dodge by hugging a side edge. */
  private attackSpin() {
    if (!this.king) return
    const cx = this.king.container.x
    const cy = this.king.container.y
    // Telegraph ring.
    const ring = this.scene.add
      .circle(cx, cy, 30, 0xffaa33, 0)
      .setScrollFactor(0)
      .setDepth(123)
      .setStrokeStyle(4, 0xffaa33, 0.9)
    this.track(ring)
    this.king.container.setAngle(0)
    this.addTween({ targets: this.king.container, angle: 360, duration: 700, ease: "Cubic.in" })
    this.addTween({
      targets: ring,
      radius: 520,
      duration: 700,
      ease: "Cubic.in",
      onUpdate: () => ring.setRadius(ring.radius), // keep stroke in sync
      onComplete: () => {
        ring.destroy()
        this.king?.container.setAngle(0)
        // Safe only near a side edge.
        const px = this.playerScreenX()
        const safe = px < 130 || px > 670
        if (!safe) this.host.takePlayerDamage(this.host.damageStep)
      },
    })
  }

  /** Tail-kick: close-range swipe; only connects if the player is near the throne. */
  private attackTailKick() {
    if (!this.king) return
    const kx = this.king.container.x
    // Telegraph swipe.
    const swipe = this.scene.add
      .rectangle(kx - 90, FLOOR_Y - 20, 160, 24, 0xff5544, 0.0)
      .setScrollFactor(0)
      .setDepth(123)
    this.track(swipe)
    this.addTween({
      targets: swipe,
      alpha: { from: 0.0, to: 0.8 },
      duration: 240,
      yoyo: true,
      onComplete: () => {
        swipe.destroy()
        const px = this.playerScreenX()
        if (Math.abs(px - (kx - 90)) < 120) this.host.takePlayerDamage(this.host.damageStep)
      },
    })
  }

  // --------------- DEATH / FRAGMENT / CLUE ---------------

  private deathSequence() {
    if (this.inDeathSequence) return
    this.inDeathSequence = true
    if (this.king) this.king.alive = false

    // Stop attack/phrase timers and clear floating phrases.
    this.timers.forEach((t) => t.remove(false))
    this.timers = []
    for (const tok of this.available) tok.container.destroy()
    this.available = []
    if (this.held) {
      this.held.container.destroy()
      this.held = null
    }
    this.throwBtn?.setVisible(false)
    this.titleText?.setText("THE RAT KING falls…")

    // Final Latin word as he fades to oblivion.
    this.kingSay(KING_FINAL_WORDS[Phaser.Math.Between(0, KING_FINAL_WORDS.length - 1)])

    if (this.king) {
      this.addTween({
        targets: this.king.container,
        alpha: 0,
        y: KING_Y - 60,
        scale: 0.7,
        duration: 1500,
        ease: "Sine.in",
        onComplete: () => this.revealFragment(),
      })
    } else {
      this.revealFragment()
    }
  }

  private revealFragment() {
    const c = this.scene.add.container(KING_X, KING_Y - 10).setScrollFactor(0).setDepth(140)
    // A glowing ear-shaped shard.
    c.add(this.scene.add.circle(0, 0, 46, 0xfff4cc, 0.18))
    c.add(this.scene.add.circle(0, 0, 30, 0xfff4cc, 0.32))
    c.add(this.scene.add.text(0, 0, "👂", { fontSize: "44px" }).setOrigin(0.5))
    c.add(this.scene.add.text(0, 0, "✦", { fontSize: "22px", color: "#fff" }).setOrigin(0.5))
    c.setScale(0.2)
    this.fragment = c
    this.track(c)

    this.addTween({ targets: c, scale: 1, duration: 500, ease: "Back.out" })
    this.addTween({
      targets: c,
      angle: { from: -4, to: 4 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    })

    const prompt = this.scene.add
      .text(KING_X, KING_Y - 80, "A fragment of the All-Hearing Ear!\nTap to take it.", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ffe9a8",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(140)
    this.track(prompt)
    this.addTween({ targets: prompt, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 })
  }

  private grabFragment() {
    if (this.fragmentGrabbed) return
    this.fragmentGrabbed = true

    // Persist immediately — survives replays + app restart.
    // (ActionScene also writes on Return Home; both are idempotent.)
    this.host.playImpactSfx()

    if (this.fragment) {
      this.addTween({
        targets: this.fragment,
        y: 70,
        x: 400,
        scale: 0.7,
        duration: 500,
        ease: "Quad.out",
      })
    }
    this.showCluePanel()
    // Persist on grab (not just on Return Home) so closing the app still keeps the
    // fragment. Idempotent with ActionScene.onBossDefeated.
    saveQuest({ level1FragmentCollected: true, level1Clue: LEVEL2_CLUE })
  }

  private showCluePanel() {
    const panel = this.scene.add.container(400, 300).setScrollFactor(0).setDepth(150)
    panel.add(this.scene.add.rectangle(0, 0, 560, 220, 0x0c0c16, 0.96).setStrokeStyle(2, 0xffd34d))
    panel.add(
      this.scene.add
        .text(0, -78, "THE EAR REMEMBERS", {
          fontSize: "16px",
          fontFamily: '"Courier New", monospace',
          color: "#ffd34d",
        })
        .setOrigin(0.5),
    )
    panel.add(
      this.scene.add
        .text(0, -8, LEVEL2_CLUE, {
          fontSize: "13px",
          fontFamily: "monospace",
          color: "#e8e8f0",
          align: "center",
          wordWrap: { width: 510 },
        })
        .setOrigin(0.5),
    )
    panel.setScale(0.8)
    this.track(panel)
    this.addTween({ targets: panel, scale: 1, duration: 300, ease: "Back.out" })

    this.returnBtn = this.makeButton(400, 472, "RETURN HOME", 0x33aa55)
    this.replayBtn = this.makeButton(400, 540, "REPLAY", 0x55ccff)
  }

  private makeButton(x: number, y: number, label: string, color: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y).setScrollFactor(0).setDepth(151)
    c.add(this.scene.add.rectangle(0, 0, 240, 48, color, 0.95).setStrokeStyle(3, 0xffffff))
    c.add(
      this.scene.add
        .text(0, 0, label, { fontSize: "18px", fontFamily: '"Courier New", monospace', color: "#06222e" })
        .setOrigin(0.5),
    )
    this.track(c)
    return c
  }
}
