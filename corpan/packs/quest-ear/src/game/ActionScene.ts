import Phaser from "phaser"
import { npcCorpus } from "../data/npcCorpus"
import type { MultiLangText, NPCEncounter, NPCResponse } from "../data/npcCorpusTypes"
import familyLinesJson from "../data/familyLines.json"
import { HECKLERS, type Heckler } from "../data/hecklerLines"
import type { HostApi } from "../sdk/types"

/** Icons for each NPC vendor type */
const NPC_ICONS: Record<string, string> = {
  hotdog: "🌭",
  pizza: "🍕",
  coffee: "☕",
  juice: "🧃",
  tickets: "🎫",
  newspaper: "📰",
  pretzel: "🥨",
  taxi: "🚕",
  flowers: "💐",
  fruit: "🍎",
  riddle: "🧩",
}

/** Item emojis that float to player on accept */
const ACCEPT_ITEMS: Record<string, string> = {
  hotdog: "🌭",
  pizza: "🍕",
  coffee: "☕",
  juice: "🥤",
  tickets: "🎟️",
  newspaper: "📰",
  pretzel: "🥨",
  taxi: "🚖",
  flowers: "🌹",
  fruit: "🍎",
  riddle: "🧩",
}

/** Hat color per vendor type — adds a little visual variety to NPCs. */
const HAT_COLORS: Record<string, number> = {
  hotdog: 0xcc2222,
  pizza: 0xffffff,
  coffee: 0x6f4e37,
  juice: 0x33aa55,
  tickets: 0x9933cc,
  newspaper: 0x2244aa,
  pretzel: 0xddaa33,
  taxi: 0xffcc00,
  flowers: 0xee6699,
  fruit: 0x44aa44,
  riddle: 0x8844cc,
}

/** Family dinner lines (spoken on a building smash), keyed by English source. */
const FAMILY_LINES = Object.values(familyLinesJson) as MultiLangText[]

/** Screens where riddle NPCs appear instead of vendors */
const RIDDLE_SCREENS = [20, 40, 60, 80]

const RIDDLE_DATA: {
  question: MultiLangText
  answers: [MultiLangText, MultiLangText, MultiLangText]
  correctIndex: number
}[] = [
  {
    question: { en: "I have cities but no houses, forests but no trees, water but no fish. What am I?" },
    answers: [{ en: "A map" }, { en: "A painting" }, { en: "A dream" }],
    correctIndex: 0,
  },
  {
    question: { en: "The more you take, the more you leave behind. What are they?" },
    answers: [{ en: "Memories" }, { en: "Footsteps" }, { en: "Breaths" }],
    correctIndex: 1,
  },
  {
    question: { en: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?" },
    answers: [{ en: "A shadow" }, { en: "An echo" }, { en: "A thought" }],
    correctIndex: 1,
  },
  {
    question: { en: "What can travel around the world while staying in a corner?" },
    answers: [{ en: "A spider" }, { en: "The internet" }, { en: "A stamp" }],
    correctIndex: 2,
  },
]

type InteractionState = "roaming" | "interacting" | "animating"

interface NPCInstance {
  container: Phaser.GameObjects.Container
  encounter: NPCEncounter
  worldX: number
  dialogBubble: Phaser.GameObjects.Container
  dialogText: Phaser.GameObjects.Text
  npcPerson: Phaser.GameObjects.Container
  dialogVisible: boolean
}

interface BuildingInstance {
  x: number
  width: number
  height: number
  container: Phaser.GameObjects.Container
  smashed: boolean
}

export class ActionScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private progressText!: Phaser.GameObjects.Text
  private returnToSceneId?: string

  // Constants
  private readonly WORLD_WIDTH = 80000
  private readonly SCREEN_HEIGHT = 600
  private readonly INTERACT_DISTANCE = 100
  private readonly PLAYER_BASE_Y = 474
  private readonly FOOT_OFFSET = 26 // feet's local Y below the container origin
  private readonly GROWTH_PER_ACCEPT = 0.1
  private readonly GROWTH_CAP = 30 // max growth level → ~scale 4 (tall-building height) & full energy

  // Tunables (post-playtest)
  private readonly SMASH_COOLDOWN_MS = 8000
  private readonly DAMAGE_STEP = 3 // growth levels lost per hit
  private readonly HECKLER_MIN_MS = 14000
  private readonly HECKLER_MAX_MS = 26000

  // Player state
  private playerSpeed = 200
  private growthLevel = 0 // drives BOTH size and energy
  private interactionState: InteractionState = "roaming"
  private invulnUntil = 0

  // Language
  private activeLangCode = "en"
  private targetLangs: string[] = ["en"]
  private langRotationIndex = 0
  private hostApi: HostApi | null = null

  // NPCs
  private npcs: NPCInstance[] = []
  private passedSet = new Set<string>()
  private acceptedSet = new Set<string>()

  // Response panel
  private responsePanel!: Phaser.GameObjects.Container
  private responseOptions: Phaser.GameObjects.Container[] = []
  private selectedIndex = 0
  private activeNPC: NPCInstance | null = null

  // HUD
  private langLabel!: Phaser.GameObjects.Text

  // Energy bar
  private energyBarFill!: Phaser.GameObjects.Rectangle
  private energyBarLabel!: Phaser.GameObjects.Text

  // Input keys
  private keyUp!: Phaser.Input.Keyboard.Key
  private keyDown!: Phaser.Input.Keyboard.Key
  private keyEnter!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private keySmash!: Phaser.Input.Keyboard.Key

  // Player body parts (for walk animation)
  private pLegL!: Phaser.GameObjects.Container
  private pLegR!: Phaser.GameObjects.Container
  private pArmL!: Phaser.GameObjects.Container
  private pArmR!: Phaser.GameObjects.Container
  private pTorso!: Phaser.GameObjects.Container
  private walkPhase = 0

  // Atmosphere
  private moon!: Phaser.GameObjects.Container
  private starLayer!: Phaser.GameObjects.Container

  // Buildings + smash
  private buildings: BuildingInstance[] = []
  private smashBtn!: Phaser.GameObjects.Container
  private smashTarget: BuildingInstance | null = null
  private smashReadyAt = 0

  constructor() {
    super({ key: "ActionScene" })
  }

  create(data?: { returnToScene?: string }) {
    this.returnToSceneId = data?.returnToScene

    // Reset state for scene restart
    this.npcs = []
    this.buildings = []
    this.passedSet.clear()
    this.acceptedSet.clear()
    this.growthLevel = 0
    this.interactionState = "roaming"
    this.activeNPC = null
    this.selectedIndex = 0
    this.smashTarget = null
    this.smashReadyAt = 0
    this.invulnUntil = 0
    this.walkPhase = 0

    // Read languages from host API
    this.hostApi = (globalThis as any).__questEarHostApi ?? null
    try {
      const config = this.hostApi?.getStackConfig?.()
      const langs = config?.languages
      this.targetLangs = langs && langs.length > 0 ? langs : ["en"]
    } catch {
      this.targetLangs = ["en"]
    }
    this.langRotationIndex = 0
    this.activeLangCode = this.targetLangs[0]

    this.cameras.main.setBackgroundColor(0x1a1a2e)
    this.physics.world.setBounds(0, 0, this.WORLD_WIDTH, this.SCREEN_HEIGHT)

    this.createAtmosphere()
    this.createSkyline()
    this.player = this.createPlayer()
    this.createNPCs()

    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(40, 77)
    body.setOffset(-20, -45)
    body.setCollideWorldBounds(true)
    body.setGravityY(0)

    this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, this.SCREEN_HEIGHT)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.keyUp = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    this.keyDown = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.keySmash = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S)

    this.createEnergyBar()

    this.progressText = this.add
      .text(400, 580, "", {
        fontSize: "14px",
        color: "#888888",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    this.add
      .text(400, 30, "← → move | Approach NPCs | ↑↓ choose | Enter confirm | dodge attacks!", {
        fontSize: "13px",
        color: "#ffffff",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    this.langLabel = this.add
      .text(20, 55, "", {
        fontSize: "16px",
        color: "#00ff41",
        fontFamily: '"Courier New", monospace',
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)

    const exitBtn = this.add
      .text(780, 20, "✕", { fontSize: "24px", color: "#ffffff", fontFamily: "sans-serif" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive({ useHandCursor: true })
    exitBtn.on("pointerover", () => exitBtn.setColor("#ff4444"))
    exitBtn.on("pointerout", () => exitBtn.setColor("#ffffff"))
    exitBtn.on("pointerdown", () => {
      this.hostApi?.stopSpeech?.()
      window.dispatchEvent(new CustomEvent("corpan:exit"))
    })

    this.createSmashButton()
    this.createResponsePanel()

    // Start spawning hecklers.
    this.scheduleHeckler()
  }

  update(_time: number, delta: number) {
    if (this.interactionState === "roaming") {
      this.handleMovement()
      this.checkNPCProximity()
      this.updateSmashEligibility()
      if (Phaser.Input.Keyboard.JustDown(this.keySmash)) this.trySmash()
    } else if (this.interactionState === "interacting") {
      this.handleResponseInput()
    }

    const moving =
      this.interactionState === "roaming" &&
      (this.cursors.left.isDown || this.cursors.right.isDown)
    this.animatePlayer(moving, delta)

    const progress = Phaser.Math.Clamp(this.player.x / this.WORLD_WIDTH, 0, 1)
    this.updateAtmosphere(progress)
    this.progressText.setText(`${Math.floor(progress * 100)}% through NYC`)

    if (this.player.x >= this.WORLD_WIDTH - 50) {
      this.sceneComplete()
    }
  }

  // --------------- MOVEMENT ---------------

  private currentScale(): number {
    return 1 + this.growthLevel * this.GROWTH_PER_ACCEPT
  }

  private handleMovement() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const scale = this.currentScale()

    if (this.cursors.left.isDown) {
      body.setVelocityX(-this.playerSpeed)
      this.player.setScale(-scale, scale)
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(this.playerSpeed)
      this.player.setScale(scale, scale)
    } else {
      body.setVelocityX(0)
    }
  }

  private animatePlayer(moving: boolean, delta: number) {
    if (!this.pTorso) return
    if (moving) {
      this.walkPhase += delta * 0.013
      const s = Math.sin(this.walkPhase)
      this.pLegL.angle = s * 22
      this.pLegR.angle = -s * 22
      this.pArmL.angle = -s * 24
      this.pArmR.angle = s * 24
      this.pTorso.y = -Math.abs(Math.sin(this.walkPhase)) * 2
    } else {
      this.walkPhase += delta * 0.004
      this.pLegL.angle *= 0.8
      this.pLegR.angle *= 0.8
      this.pArmL.angle *= 0.8
      this.pArmR.angle *= 0.8
      this.pTorso.y = Math.sin(this.walkPhase) * 0.8
    }
  }

  // --------------- LANGUAGE HELPERS ---------------

  private getText(multiLang: MultiLangText): string {
    return (
      multiLang[this.activeLangCode] ||
      multiLang[this.activeLangCode.split("-")[0]] ||
      multiLang.en ||
      Object.values(multiLang)[0]
    )
  }

  private getNextTargetLang(): string {
    const lang = this.targetLangs[this.langRotationIndex % this.targetLangs.length]
    this.langRotationIndex++
    return lang
  }

  private getTTSLang(): string {
    return this.activeLangCode
  }

  // --------------- NPC PROXIMITY ---------------

  private checkNPCProximity() {
    for (const npc of this.npcs) {
      const distance = Math.abs(this.player.x - npc.worldX)

      if (distance > this.INTERACT_DISTANCE * 2 && this.passedSet.has(npc.encounter.id)) {
        this.passedSet.delete(npc.encounter.id)
      }

      if (
        distance < this.INTERACT_DISTANCE &&
        !npc.dialogVisible &&
        !this.passedSet.has(npc.encounter.id)
      ) {
        this.startInteraction(npc)
        return
      }

      if (distance >= this.INTERACT_DISTANCE && npc.dialogVisible) {
        npc.dialogBubble.setVisible(false)
        npc.dialogVisible = false
      }
    }
  }

  // --------------- INTERACTION STATE MACHINE ---------------

  private startInteraction(npc: NPCInstance) {
    this.interactionState = "interacting"
    this.activeNPC = npc
    this.selectedIndex = 0
    this.activeLangCode = this.getNextTargetLang()

    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocityX(0)

    const offeringText = this.getText(npc.encounter.offering)
    npc.dialogText.setText(offeringText)
    npc.dialogBubble.setVisible(true)
    npc.dialogVisible = true

    this.langLabel.setText(this.activeLangCode.toUpperCase())
    this.langLabel.setVisible(true)
    this.speak(offeringText)
    this.showResponsePanel(npc)
  }

  private confirmResponse() {
    if (!this.activeNPC) return
    const npc = this.activeNPC
    const response = npc.encounter.responses[this.selectedIndex]
    const responseText = this.getText(response.text)

    this.hideResponsePanel()
    this.interactionState = "animating"
    this.speak(responseText)
    this.passedSet.add(npc.encounter.id)

    if (response.type === "accept") {
      const alreadyAccepted = this.acceptedSet.has(npc.encounter.id)
      this.acceptedSet.add(npc.encounter.id)
      if (npc.encounter.npcType === "taxi") {
        this.playTaxiRide(npc, alreadyAccepted)
      } else {
        this.playAcceptAnimation(npc, alreadyAccepted)
      }
    } else if (response.type === "decline") {
      this.playDeclineAnimation(npc)
    } else {
      this.playArbitraryAnimation(npc)
    }
  }

  private endInteraction() {
    if (this.activeNPC) {
      const npc = this.activeNPC
      this.time.delayedCall(600, () => {
        npc.dialogBubble.setVisible(false)
        npc.dialogVisible = false
      })
    }
    this.activeNPC = null
    this.interactionState = "roaming"
    this.langLabel.setVisible(false)
  }

  // --------------- RESPONSE PANEL ---------------

  private createResponsePanel() {
    this.responsePanel = this.add.container(850, 280).setScrollFactor(0)
    this.responsePanel.setVisible(false)
    this.responsePanel.setDepth(100)

    const panelBg = this.add.rectangle(0, 0, 160, 180, 0x000000, 0.9).setStrokeStyle(2, 0x00ff41)
    this.responsePanel.add(panelBg)

    for (let i = 0; i < 3; i++) {
      const optContainer = this.add.container(0, -50 + i * 52)
      const optBg = this.add.rectangle(0, 0, 140, 42, 0x1a1a2e).setStrokeStyle(1, 0x444444)
      optContainer.add(optBg)
      const optText = this.add
        .text(0, 0, "", {
          fontSize: "12px",
          color: "#ffffff",
          fontFamily: '"Courier New", monospace',
          wordWrap: { width: 125 },
        })
        .setOrigin(0.5)
      optContainer.add(optText)
      optBg.setInteractive()
      optBg.on("pointerdown", () => {
        this.selectedIndex = i
        this.updateResponseHighlight()
        this.confirmResponse()
      })
      this.responsePanel.add(optContainer)
      this.responseOptions.push(optContainer)
    }
  }

  private showResponsePanel(npc: NPCInstance) {
    const responses = npc.encounter.responses
    for (let i = 0; i < 3; i++) {
      const opt = this.responseOptions[i]
      const text = opt.getAt(1) as Phaser.GameObjects.Text
      const responseText = this.getText(responses[i].text)
      const prefix = responses[i].type === "accept" ? "✓ " : responses[i].type === "decline" ? "✗ " : "? "
      text.setText(prefix + responseText)
    }
    this.selectedIndex = 0
    this.updateResponseHighlight()
    this.responsePanel.setX(850)
    this.responsePanel.setVisible(true)
    this.tweens.add({ targets: this.responsePanel, x: 720, duration: 200, ease: "Power2" })
  }

  private hideResponsePanel() {
    this.tweens.add({
      targets: this.responsePanel,
      x: 850,
      duration: 150,
      ease: "Power2",
      onComplete: () => this.responsePanel.setVisible(false),
    })
  }

  private updateResponseHighlight() {
    for (let i = 0; i < 3; i++) {
      const opt = this.responseOptions[i]
      const bg = opt.getAt(0) as Phaser.GameObjects.Rectangle
      const text = opt.getAt(1) as Phaser.GameObjects.Text
      if (i === this.selectedIndex) {
        bg.setFillStyle(0x003300)
        bg.setStrokeStyle(2, 0x00ff41)
        text.setColor("#00ff41")
      } else {
        bg.setFillStyle(0x1a1a2e)
        bg.setStrokeStyle(1, 0x444444)
        text.setColor("#ffffff")
      }
    }
  }

  private handleResponseInput() {
    if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      this.selectedIndex = (this.selectedIndex + 2) % 3
      this.updateResponseHighlight()
    } else if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      this.selectedIndex = (this.selectedIndex + 1) % 3
      this.updateResponseHighlight()
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace)
    ) {
      this.confirmResponse()
    }
  }

  // --------------- ACCEPT / DECLINE / ARBITRARY ANIMATIONS ---------------

  private playAcceptAnimation(npc: NPCInstance, skipGrowth = false) {
    const itemEmoji = ACCEPT_ITEMS[npc.encounter.npcType] || "⭐"
    const cam = this.cameras.main
    const npcScreenX = npc.worldX - cam.scrollX
    const npcScreenY = npc.container.y - 60 - cam.scrollY
    const playerScreenX = this.player.x - cam.scrollX
    const playerScreenY = this.player.y - cam.scrollY

    const floatItem = this.add
      .text(npcScreenX, npcScreenY, itemEmoji, { fontSize: "32px" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)

    this.tweens.add({
      targets: floatItem,
      x: playerScreenX,
      y: playerScreenY,
      scale: { from: 1.5, to: 0.5 },
      duration: 600,
      ease: "Power2",
      onComplete: () => {
        floatItem.destroy()
        this.playAbsorptionGlow()
        if (!skipGrowth) this.growPlayer()
        this.endInteraction()
      },
    })
  }

  private playAbsorptionGlow() {
    const cam = this.cameras.main
    const px = this.player.x - cam.scrollX
    const py = this.player.y - cam.scrollY
    const glow = this.add.circle(px, py, 30, 0x00ff41, 0.6).setScrollFactor(0).setDepth(150)
    this.tweens.add({
      targets: glow,
      scale: 2.5,
      alpha: 0,
      duration: 400,
      ease: "Power2",
      onComplete: () => glow.destroy(),
    })
  }

  /** Apply the current growthLevel to the player's scale, ground position and energy. */
  private applySize() {
    const scale = this.currentScale()
    const facingLeft = this.player.scaleX < 0
    this.player.setScale(facingLeft ? -scale : scale, scale)
    // Feet stay anchored to the ground line at every size.
    this.player.setY(this.PLAYER_BASE_Y - this.FOOT_OFFSET * (scale - 1))
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(40, 77)
    body.setOffset(-20, -45)
    this.updateEnergyBar()
  }

  private growPlayer() {
    this.growthLevel = Math.min(this.growthLevel + 1, this.GROWTH_CAP)
    this.applySize()
  }

  private playDeclineAnimation(npc: NPCInstance) {
    const origX = npc.container.x
    this.tweens.add({
      targets: npc.container,
      x: origX + 5,
      duration: 50,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        npc.container.x = origX
        this.endInteraction()
      },
    })
  }

  private playArbitraryAnimation(npc: NPCInstance) {
    const cam = this.cameras.main
    const qX = npc.worldX - cam.scrollX
    const qY = npc.container.y - 100 - cam.scrollY
    const confusionMark = this.add
      .text(qX, qY, "❓", { fontSize: "28px" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
    this.tweens.add({
      targets: confusionMark,
      y: qY - 30,
      alpha: 0,
      duration: 800,
      ease: "Power1",
      onComplete: () => confusionMark.destroy(),
    })
    const origAngle = npc.npcPerson.angle
    this.tweens.add({
      targets: npc.npcPerson,
      angle: { from: -10, to: 10 },
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        npc.npcPerson.angle = origAngle
        this.endInteraction()
      },
    })
  }

  // --------------- TAXI RIDE ---------------

  private playTaxiRide(npc: NPCInstance, skipGrowth = false) {
    if (!skipGrowth) this.growPlayer()

    let next: NPCInstance | null = null
    let best = Infinity
    for (const n of this.npcs) {
      if (n === npc) continue
      const d = n.worldX - this.player.x
      if (d > 60 && d < best) {
        best = d
        next = n
      }
    }
    const destX = next ? next.worldX - 120 : Math.min(this.player.x + 3000, this.WORLD_WIDTH - 100)

    const cam = this.cameras.main
    const sx = this.player.x - cam.scrollX
    const sy = this.PLAYER_BASE_Y + 6 - cam.scrollY
    const taxi = this.add.container(sx, sy).setScrollFactor(0).setDepth(190)
    taxi.add(this.add.rectangle(0, 0, 86, 34, 0xffcc00))
    taxi.add(this.add.rectangle(0, -16, 48, 16, 0xffe066))
    taxi.add(this.add.rectangle(0, 4, 86, 6, 0x222222))
    taxi.add(this.add.text(0, -2, "🚕", { fontSize: "26px" }).setOrigin(0.5))
    const wheelL = this.add.circle(-26, 20, 8, 0x111111)
    const wheelR = this.add.circle(26, 20, 8, 0x111111)
    taxi.add(wheelL)
    taxi.add(wheelR)
    this.tweens.add({ targets: [wheelL, wheelR], angle: 360, duration: 300, repeat: -1 })

    const lines: Phaser.GameObjects.Rectangle[] = []
    for (let i = 0; i < 5; i++) {
      const ln = this.add
        .rectangle(sx + 80 + i * 30, sy - 10 + i * 6, 24, 2, 0xffffff, 0.6)
        .setScrollFactor(0)
        .setDepth(189)
      lines.push(ln)
      this.tweens.add({ targets: ln, x: ln.x - 200, alpha: 0, duration: 350, repeat: -1 })
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocityX(0)
    body.enable = false
    this.player.setVisible(false)

    this.tweens.add({
      targets: this.player,
      x: destX,
      duration: 1500,
      ease: "Sine.inOut",
      onComplete: () => {
        this.player.setVisible(true)
        body.enable = true
        body.reset(this.player.x, this.player.y)
        taxi.destroy()
        for (const ln of lines) ln.destroy()
        this.endInteraction()
      },
    })
  }

  // --------------- BUILDING SMASH ---------------

  private createSmashButton() {
    this.smashBtn = this.add.container(400, 540).setScrollFactor(0).setDepth(120).setVisible(false)
    const bg = this.add.rectangle(0, 0, 200, 40, 0xaa2222).setStrokeStyle(2, 0xffff66)
    const label = this.add
      .text(0, 0, "💥 SMASH  (S)", {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5)
    this.smashBtn.add(bg)
    this.smashBtn.add(label)
    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerdown", () => this.trySmash())
    this.tweens.add({
      targets: this.smashBtn,
      scale: { from: 1, to: 1.08 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    })
  }

  private updateSmashEligibility() {
    // On cooldown → never eligible.
    if (this.time.now < this.smashReadyAt) {
      this.smashTarget = null
      if (this.smashBtn.visible) this.smashBtn.setVisible(false)
      return
    }
    const playerHeight = 77 * this.currentScale()
    let near: BuildingInstance | null = null
    let best = Infinity
    for (const b of this.buildings) {
      if (b.smashed) continue
      const d = Math.abs(b.x - this.player.x)
      if (d < best) {
        best = d
        near = b
      }
    }
    const eligible = !!near && best < 170 && playerHeight >= near!.height * 0.85
    this.smashTarget = eligible ? near : null
    if (this.smashBtn.visible !== eligible) this.smashBtn.setVisible(eligible)
  }

  private trySmash() {
    if (this.interactionState !== "roaming" || !this.smashTarget) return
    const b = this.smashTarget
    b.smashed = true
    this.smashTarget = null
    this.smashBtn.setVisible(false)
    this.smashReadyAt = this.time.now + this.SMASH_COOLDOWN_MS
    this.interactionState = "animating"

    this.cameras.main.shake(220, 0.012)
    this.spawnDebris(b)

    // Quick shake of the building, then reveal the interior (building stays standing).
    const origX = b.container.x
    this.tweens.add({
      targets: b.container,
      x: origX + 7,
      duration: 45,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        b.container.x = origX
        this.revealFamily(b)
      },
    })
  }

  private spawnDebris(b: BuildingInstance) {
    const topY = 500 - b.height
    for (let i = 0; i < 10; i++) {
      const d = this.add
        .rectangle(
          b.x + Phaser.Math.Between(-b.width / 2, b.width / 2),
          topY + Phaser.Math.Between(0, 80),
          Phaser.Math.Between(4, 10),
          Phaser.Math.Between(4, 10),
          0x2a2a4e,
        )
        .setDepth(8)
      this.tweens.add({
        targets: d,
        x: d.x + Phaser.Math.Between(-90, 90),
        y: d.y - Phaser.Math.Between(20, 70),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(500, 800),
        ease: "Quad.out",
        onComplete: () => d.destroy(),
      })
    }
  }

  private revealFamily(b: BuildingInstance) {
    this.activeLangCode = this.getNextTargetLang()
    const line = FAMILY_LINES[Math.floor(Math.random() * FAMILY_LINES.length)] || { en: "Hey!" }
    const text = this.getText(line)

    // Cut a lit room into an upper floor of the (still-standing) building.
    const roomW = Math.min(b.width + 8, 132)
    const roomH = 92
    const roomY = 500 - Math.min(b.height, 300) + roomH / 2 + 16
    const room = this.add.container(b.x, roomY).setDepth(3)

    room.add(this.add.rectangle(0, 0, roomW + 8, roomH + 8, 0x12121c)) // smashed opening / shadow
    room.add(this.add.rectangle(0, 0, roomW, roomH, 0x7a5a3a)) // back wall
    room.add(this.add.rectangle(0, -roomH / 2 + 8, roomW, 14, 0xffe7a8, 0.9)) // warm ceiling light
    room.add(this.add.rectangle(0, roomH / 2 - 6, roomW, 12, 0x4a3424)) // floor

    // Table with cloth, plates and food
    const tableY = 16
    room.add(this.add.rectangle(0, tableY + 8, roomW - 30, 8, 0x3a2418)) // table top
    room.add(this.add.rectangle(0, tableY + 4, roomW - 36, 6, 0xf2e9d8)) // tablecloth
    room.add(this.add.text(0, tableY - 1, "🍲", { fontSize: "15px" }).setOrigin(0.5))
    room.add(this.add.circle(-22, tableY + 2, 4, 0xffffff))
    room.add(this.add.circle(22, tableY + 2, 4, 0xffffff))

    // 2–3 seated family members (chair + body + head + face + hair)
    const fam = [
      { x: -34, body: 0x4477aa, hair: 0x3a2a1a },
      { x: 0, body: 0xaa5577, hair: 0x6a4a2a },
      { x: 30, body: 0x55aa77, hair: 0x222222 },
    ]
    for (const f of fam) {
      room.add(this.add.rectangle(f.x, tableY + 16, 16, 18, 0x5a3a24)) // chair back
      room.add(this.add.rectangle(f.x, tableY - 2, 14, 16, f.body)) // torso (seated)
      room.add(this.add.rectangle(f.x, tableY - 14, 12, 12, 0xdeb887)) // head
      room.add(this.add.rectangle(f.x, tableY - 19, 13, 4, f.hair)) // hair
      room.add(this.add.rectangle(f.x - 3, tableY - 14, 2, 2, 0x000000)) // eye
      room.add(this.add.rectangle(f.x + 3, tableY - 14, 2, 2, 0x000000)) // eye
      room.add(this.add.rectangle(f.x, tableY - 10, 4, 1.5, 0x803333)) // mouth
    }

    room.setScale(0.5)
    this.tweens.add({ targets: room, scale: 1, duration: 320, ease: "Back.out" })

    // Speech bubble above the room
    const bubble = this.add.container(b.x, roomY - roomH / 2 - 36).setDepth(120)
    const bg = this.add.rectangle(0, 0, 250, 52, 0xffffff, 0.97).setStrokeStyle(2, 0x000000)
    const t = this.add
      .text(0, 0, text, {
        fontSize: "13px",
        color: "#000000",
        fontFamily: "monospace",
        wordWrap: { width: 225 },
      })
      .setOrigin(0.5)
    bubble.add(bg)
    bubble.add(t)

    this.langLabel.setText(this.activeLangCode.toUpperCase())
    this.langLabel.setVisible(true)
    this.speak(text)

    this.time.delayedCall(3800, () => {
      this.tweens.add({
        targets: [room, bubble],
        alpha: 0,
        duration: 350,
        onComplete: () => {
          room.destroy()
          bubble.destroy()
        },
      })
      this.langLabel.setVisible(false)
      this.interactionState = "roaming"
    })
  }

  // --------------- DAMAGE ---------------

  private takeDamage(step: number) {
    if (this.time.now < this.invulnUntil) return
    this.invulnUntil = this.time.now + 1300

    this.growthLevel = Math.max(0, this.growthLevel - step)
    this.applySize()

    this.cameras.main.shake(160, 0.01)
    const flash = this.add
      .rectangle(400, 300, 800, 600, 0xff0000, 0.32)
      .setScrollFactor(0)
      .setDepth(180)
    this.tweens.add({ targets: flash, alpha: 0, duration: 320, onComplete: () => flash.destroy() })
    // i-frame blink
    this.tweens.add({ targets: this.player, alpha: { from: 0.35, to: 1 }, duration: 150, repeat: 3 })
  }

  // --------------- HECKLERS ---------------

  private scheduleHeckler() {
    this.time.addEvent({
      delay: Phaser.Math.Between(this.HECKLER_MIN_MS, this.HECKLER_MAX_MS),
      callback: () => this.spawnHeckler(),
    })
  }

  private spawnHeckler() {
    if (!this.scene.isActive()) return
    // Only heckle while the player is free to dodge.
    if (this.interactionState !== "roaming") {
      this.scheduleHeckler()
      return
    }

    const h = HECKLERS[Phaser.Math.Between(0, HECKLERS.length - 1)]
    const fromLeft = Math.random() < 0.5
    const startX = this.player.x + (fromLeft ? -520 : 520)
    const standX = this.player.x + (fromLeft ? -250 : 250)

    const figure = this.createHecklerFigure(h, fromLeft)
    figure.setPosition(startX, this.PLAYER_BASE_Y)

    this.tweens.add({
      targets: figure,
      x: standX,
      duration: 700,
      ease: "Sine.out",
      onComplete: () => {
        const line = h.lines[Phaser.Math.Between(0, h.lines.length - 1)]
        this.showHecklerBubble(figure, line)
        this.hostApi?.speak?.(h.lang, line)

        const n = Phaser.Math.Between(1, 2)
        for (let i = 0; i < n; i++) {
          this.time.delayedCall(450 + i * 750, () => {
            if (figure.active) this.throwProjectile(h, figure.x, this.PLAYER_BASE_Y - 30)
          })
        }
        // Run off, then reschedule.
        this.time.delayedCall(550 + n * 750 + 1400, () => {
          this.tweens.add({
            targets: figure,
            x: startX,
            alpha: 0.1,
            duration: 700,
            onComplete: () => figure.destroy(),
          })
          this.scheduleHeckler()
        })
      },
    })
  }

  private createHecklerFigure(h: Heckler, faceRight: boolean): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(6)
    const skin = 0xeccaa0
    const dir = faceRight ? 1 : -1

    c.add(this.add.rectangle(-5, 18, 9, 18, 0x333333)) // legs
    c.add(this.add.rectangle(5, 18, 9, 18, 0x333333))
    c.add(this.add.rectangle(0, 0, 22, 30, h.coatColor)) // coat
    c.add(this.add.rectangle(-dir * 12, 2, 6, 18, h.coatColor)) // back arm
    const raised = this.add.container(dir * 12, -6)
    raised.add(this.add.rectangle(0, -6, 6, 16, h.coatColor))
    raised.angle = dir * -45
    c.add(raised) // raised throwing arm
    c.add(this.add.rectangle(0, -22, 15, 15, skin)) // head
    // angry eyes + brows + frown
    c.add(this.add.rectangle(-4, -22, 3, 3, 0xffffff))
    c.add(this.add.rectangle(-4, -22, 1.5, 1.5, 0x000000))
    c.add(this.add.rectangle(4, -22, 3, 3, 0xffffff))
    c.add(this.add.rectangle(4, -22, 1.5, 1.5, 0x000000))
    c.add(this.add.rectangle(-4, -26, 6, 2, 0x000000).setAngle(20))
    c.add(this.add.rectangle(4, -26, 6, 2, 0x000000).setAngle(-20))
    c.add(this.add.rectangle(0, -16, 7, 2, 0x803333))
    // hat
    if (h.type === "french") {
      c.add(this.add.rectangle(0, -31, 18, 5, h.hatColor))
      c.add(this.add.circle(6, -33, 3, h.hatColor))
    } else {
      c.add(this.add.rectangle(0, -30, 18, 4, h.hatColor))
      c.add(this.add.rectangle(0, -35, 12, 7, h.hatColor))
      c.add(this.add.rectangle(7, -38, 3, 9, 0xffffff)) // feather
    }
    return c
  }

  private showHecklerBubble(figure: Phaser.GameObjects.Container, line: string) {
    const bubble = this.add.container(0, -56)
    const bg = this.add.rectangle(0, 0, 200, 40, 0xffffee, 0.97).setStrokeStyle(2, 0x884400)
    const t = this.add
      .text(0, 0, line, {
        fontSize: "11px",
        color: "#552200",
        fontFamily: "monospace",
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5)
    bubble.add(bg)
    bubble.add(t)
    figure.add(bubble)
    this.time.delayedCall(2600, () => bubble.destroy())
  }

  private throwProjectile(h: Heckler, fromX: number, fromY: number) {
    if (!this.scene.isActive()) return
    const targetX = this.player.x
    const groundY = this.PLAYER_BASE_Y
    const emoji = h.projectiles[Phaser.Math.Between(0, h.projectiles.length - 1)]
    const proj = this.add.text(fromX, fromY, emoji, { fontSize: "22px" }).setOrigin(0.5).setDepth(150)
    const startX = fromX
    const arcH = 130
    const state = { t: 0 }
    this.tweens.add({
      targets: state,
      t: 1,
      duration: 950,
      ease: "Linear",
      onUpdate: () => {
        proj.x = Phaser.Math.Linear(startX, targetX, state.t)
        proj.y = Phaser.Math.Linear(fromY, groundY, state.t) - Math.sin(Math.PI * state.t) * arcH
        proj.angle = state.t * 360
      },
      onComplete: () => {
        const radius = 42 + 8 * this.currentScale()
        const hit =
          this.interactionState === "roaming" && Math.abs(this.player.x - proj.x) < radius
        const splat = this.add
          .text(proj.x, groundY, "💥", { fontSize: "20px" })
          .setOrigin(0.5)
          .setDepth(150)
        this.tweens.add({
          targets: splat,
          alpha: 0,
          scale: 1.6,
          duration: 300,
          onComplete: () => splat.destroy(),
        })
        proj.destroy()
        if (hit) this.takeDamage(this.DAMAGE_STEP)
      },
    })
  }

  // --------------- TTS ---------------

  private speak(text: string) {
    if (this.hostApi?.speak) {
      this.hostApi.speak(this.getTTSLang(), text)
    }
  }

  // --------------- ENERGY BAR ---------------

  private createEnergyBar() {
    this.add.rectangle(700, 50, 150, 20, 0x333333).setScrollFactor(0).setDepth(50)
    this.energyBarFill = this.add
      .rectangle(626, 50, 0, 15, 0x00ff41)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(51)
    this.energyBarLabel = this.add
      .text(700, 50, "ENERGY 0%", { fontSize: "10px", color: "#000", fontFamily: "monospace" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(52)
    this.updateEnergyBar()
  }

  private updateEnergyBar() {
    const pct = Math.min(this.growthLevel / this.GROWTH_CAP, 1)
    const maxWidth = 145
    this.energyBarFill.width = maxWidth * pct
    // tint shifts green→amber→red as energy drops
    const color = pct > 0.5 ? 0x00ff41 : pct > 0.2 ? 0xffaa33 : 0xff4444
    this.energyBarFill.setFillStyle(color)
    this.energyBarLabel.setText(`ENERGY ${Math.floor(pct * 100)}%`)
  }

  // --------------- ATMOSPHERE ---------------

  private createAtmosphere() {
    this.starLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(-100)
    for (let i = 0; i < 70; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, 800),
        Phaser.Math.Between(0, 300),
        Phaser.Math.Between(1, 2),
        0xffffff,
        0.9,
      )
      this.starLayer.add(star)
      if (Math.random() > 0.5) {
        this.tweens.add({
          targets: star,
          alpha: { from: 0.3, to: 1 },
          duration: Phaser.Math.Between(800, 2200),
          yoyo: true,
          repeat: -1,
        })
      }
    }

    this.moon = this.add.container(650, 520).setScrollFactor(0).setDepth(-90)
    this.moon.add(this.add.circle(0, 0, 46, 0xfff4cc, 0.18))
    this.moon.add(this.add.circle(0, 0, 34, 0xfff4cc, 0.28))
    this.moon.add(this.add.circle(0, 0, 24, 0xfdf6e3, 1))
    this.moon.add(this.add.circle(-7, -5, 4, 0xe8dcc0, 0.7))
    this.moon.add(this.add.circle(6, 4, 5, 0xe8dcc0, 0.6))

    this.time.addEvent({
      delay: Phaser.Math.Between(8000, 16000),
      callback: () => this.spawnHelicopter(),
    })
  }

  private spawnHelicopter() {
    if (!this.scene.isActive()) return
    const y = Phaser.Math.Between(60, 130)
    const dir = Math.random() < 0.5 ? 1 : -1
    const startX = dir === 1 ? -80 : 880
    const endX = dir === 1 ? 880 : -80

    const heli = this.add.container(startX, y).setScrollFactor(0).setDepth(-80)
    const bodyColor = 0x223344
    heli.add(this.add.rectangle(0, 0, 34, 14, bodyColor))
    heli.add(this.add.rectangle(dir * -22, 2, 18, 5, bodyColor))
    heli.add(this.add.rectangle(dir * -30, -2, 4, 12, bodyColor))
    heli.add(this.add.rectangle(0, -10, 44, 3, 0x111111))
    heli.add(this.add.rectangle(0, -10, 3, 8, 0x111111))
    const light = this.add.circle(dir * 16, 4, 3, 0xff3333, 1)
    heli.add(light)
    this.tweens.add({ targets: light, alpha: { from: 1, to: 0.2 }, duration: 350, yoyo: true, repeat: -1 })

    this.tweens.add({
      targets: heli,
      x: endX,
      duration: Phaser.Math.Between(5000, 8000),
      ease: "Linear",
      onComplete: () => heli.destroy(),
    })

    this.time.addEvent({
      delay: Phaser.Math.Between(18000, 34000),
      callback: () => this.spawnHelicopter(),
    })
  }

  private updateAtmosphere(progress: number) {
    if (this.moon) {
      this.moon.setPosition(650 - progress * 120, 520 - progress * 430)
    }
    const top = Phaser.Display.Color.Interpolate.ColorWithColor(
      new Phaser.Display.Color(0x1a, 0x1a, 0x2e),
      new Phaser.Display.Color(0x35, 0x35, 0x6a),
      100,
      Math.floor(progress * 100),
    )
    this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(top.r, top.g, top.b))
  }

  // --------------- SKYLINE ---------------

  private createSkyline() {
    let x = 50
    while (x < this.WORLD_WIDTH) {
      const width = Phaser.Math.Between(60, 120)
      const height = Phaser.Math.Between(150, 350)

      const b = this.add.container(x, 0).setDepth(0)
      b.add(this.add.rectangle(0, 500 - height / 2, width, height, 0x2a2a4e))

      for (let row = 0; row < Math.floor(height / 30); row++) {
        for (let col = 0; col < Math.floor(width / 20); col++) {
          if (Math.random() > 0.3) {
            b.add(
              this.add
                .rectangle(
                  -width / 2 + 10 + col * 20,
                  500 - height + 15 + row * 30,
                  8,
                  12,
                  Math.random() > 0.5 ? 0xffff66 : 0xffaa33,
                )
                .setAlpha(0.8),
            )
          }
        }
      }

      this.buildings.push({ x, width, height, container: b, smashed: false })
      x += width + Phaser.Math.Between(20, 60)
    }

    this.add.rectangle(this.WORLD_WIDTH / 2, 550, this.WORLD_WIDTH, 100, 0x444444).setDepth(1)
  }

  // --------------- PLAYER ---------------

  private createPlayer(): Phaser.GameObjects.Container {
    const container = this.add.container(100, this.PLAYER_BASE_Y).setDepth(10)

    const skin = 0xffcc99
    const hatColor = 0x4a4a8a
    const shirtColor = 0x00aa66
    const pantsColor = 0x2a2a5e
    const shoeColor = 0x1a1a1a

    const legL = this.add.container(-5, 8)
    legL.add(this.add.rectangle(0, 6, 10, 16, pantsColor))
    legL.add(this.add.rectangle(0, 18, 12, 6, shoeColor))
    const legR = this.add.container(5, 8)
    legR.add(this.add.rectangle(0, 6, 10, 16, pantsColor))
    legR.add(this.add.rectangle(0, 18, 12, 6, shoeColor))
    container.add(legL)
    container.add(legR)

    const torso = this.add.container(0, 0)
    torso.add(this.add.rectangle(0, -8, 20, 24, shirtColor))

    const armL = this.add.container(-14, -16)
    armL.add(this.add.rectangle(0, 8, 8, 20, shirtColor))
    armL.add(this.add.rectangle(0, 20, 6, 6, skin))
    const armR = this.add.container(14, -16)
    armR.add(this.add.rectangle(0, 8, 8, 20, shirtColor))
    armR.add(this.add.rectangle(0, 20, 6, 6, skin))
    torso.add(armL)
    torso.add(armR)

    torso.add(this.add.rectangle(0, -20, 8, 6, skin)) // neck
    torso.add(this.add.rectangle(0, -28, 16, 16, skin)) // head
    torso.add(this.add.rectangle(0, -37, 26, 6, hatColor)) // hat brim
    torso.add(this.add.rectangle(0, -43, 16, 8, hatColor)) // hat crown
    torso.add(this.add.rectangle(-4, -30, 4, 4, 0xffffff))
    torso.add(this.add.rectangle(-4, -30, 2, 2, 0x000000))
    torso.add(this.add.rectangle(4, -30, 4, 4, 0xffffff))
    torso.add(this.add.rectangle(4, -30, 2, 2, 0x000000))
    torso.add(this.add.rectangle(-4, -34, 5, 1, 0x3a2a1a))
    torso.add(this.add.rectangle(4, -34, 5, 1, 0x3a2a1a))
    torso.add(this.add.rectangle(0, -27, 2, 3, 0xcc9966))
    torso.add(this.add.rectangle(0, -23, 8, 2, 0x803333))
    container.add(torso)

    this.pLegL = legL
    this.pLegR = legR
    this.pArmL = armL
    this.pArmR = armR
    this.pTorso = torso

    return container
  }

  // --------------- NPCs ---------------

  private createNPCs() {
    const encountersByType = new Map<string, NPCEncounter[]>()
    for (const enc of npcCorpus) {
      const list = encountersByType.get(enc.npcType) || []
      list.push(enc)
      encountersByType.set(enc.npcType, list)
    }

    const typeOrder = [
      "hotdog", "pizza", "coffee", "juice", "tickets",
      "newspaper", "pretzel", "taxi", "flowers", "fruit",
    ]
    const typeIndex = new Map<string, number>()
    for (const t of typeOrder) typeIndex.set(t, 0)

    let riddleIdx = 0
    for (let screen = 1; screen < 100; screen++) {
      const x = screen * 800 + Phaser.Math.Between(200, 600)

      if (RIDDLE_SCREENS.includes(screen)) {
        const encounter = this.createRiddleEncounter(riddleIdx)
        riddleIdx++
        this.createNPC(encounter, x)
        continue
      }

      const typeKey = typeOrder[screen % typeOrder.length]
      let encounters = encountersByType.get(typeKey) || []
      if (encounters.length === 0) encounters = npcCorpus
      const idx = typeIndex.get(typeKey) || 0
      const encounter = encounters[idx % encounters.length]
      typeIndex.set(typeKey, idx + 1)

      this.createNPC(encounter, x)
    }
  }

  private createRiddleEncounter(riddleIdx: number): NPCEncounter {
    const riddle = RIDDLE_DATA[riddleIdx % RIDDLE_DATA.length]
    const responses: [NPCResponse, NPCResponse, NPCResponse] = [
      { type: riddle.correctIndex === 0 ? "accept" : "arbitrary", text: riddle.answers[0] },
      { type: riddle.correctIndex === 1 ? "accept" : "arbitrary", text: riddle.answers[1] },
      { type: riddle.correctIndex === 2 ? "accept" : "arbitrary", text: riddle.answers[2] },
    ]
    return {
      id: `riddle_${riddleIdx}`,
      npcType: "riddle",
      offering: riddle.question,
      responses,
    }
  }

  private createNPC(encounter: NPCEncounter, worldX: number) {
    const container = this.add.container(worldX, 492).setDepth(5)
    const icon = NPC_ICONS[encounter.npcType] || "❓"

    container.add(this.add.rectangle(0, 18, 60, 40, 0x8b4513))
    container.add(this.add.rectangle(0, -20, 80, 10, 0xff4444))
    container.add(this.add.rectangle(0, -2, 4, 40, 0x666666))
    container.add(this.add.text(0, 0, icon, { fontSize: "32px" }).setOrigin(0.5))

    const npcPerson = this.createNPCPerson(encounter.npcType)
    npcPerson.setPosition(40, 0)
    container.add(npcPerson)
    this.tweens.add({
      targets: npcPerson,
      y: -3,
      duration: Phaser.Math.Between(1000, 1600),
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    })

    const dialogBubble = this.add.container(0, -80)
    const bubbleBg = this.add.rectangle(0, 0, 220, 50, 0xffffff, 0.95).setStrokeStyle(2, 0x000000)
    dialogBubble.add(bubbleBg)
    const dialogText = this.add
      .text(0, 0, "", {
        fontSize: "13px",
        color: "#000000",
        fontFamily: "monospace",
        wordWrap: { width: 200 },
      })
      .setOrigin(0.5)
    dialogBubble.add(dialogText)
    dialogBubble.setVisible(false)
    container.add(dialogBubble)

    this.npcs.push({
      container,
      encounter,
      worldX,
      dialogBubble,
      dialogText,
      npcPerson,
      dialogVisible: false,
    })
  }

  private createNPCPerson(npcType: string): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0)
    const skinColor = 0xdeb887
    const shirtColor = 0xcc3333
    const pantsColor = 0x333366
    const hatColor = HAT_COLORS[npcType] ?? 0x222222

    container.add(this.add.rectangle(-4, 8, 8, 14, pantsColor))
    container.add(this.add.rectangle(4, 8, 8, 14, pantsColor))
    container.add(this.add.rectangle(0, -8, 16, 20, shirtColor))
    container.add(this.add.rectangle(0, -6, 12, 14, 0xffffff, 0.85))
    container.add(this.add.rectangle(-9, -8, 5, 16, shirtColor))
    container.add(this.add.rectangle(9, -8, 5, 16, shirtColor))
    container.add(this.add.rectangle(0, -25, 14, 14, skinColor))
    container.add(this.add.rectangle(-3, -26, 3, 3, 0xffffff))
    container.add(this.add.rectangle(-3, -26, 1.5, 1.5, 0x000000))
    container.add(this.add.rectangle(3, -26, 3, 3, 0xffffff))
    container.add(this.add.rectangle(3, -26, 1.5, 1.5, 0x000000))
    container.add(this.add.rectangle(0, -21, 6, 1.5, 0x803333))
    container.add(this.add.rectangle(0, -33, 18, 4, hatColor))
    container.add(this.add.rectangle(0, -37, 12, 6, hatColor))

    return container
  }

  // --------------- SCENE LIFECYCLE ---------------

  private sceneComplete() {
    this.scene.start("MainScene", { returnToSceneId: this.returnToSceneId })
  }
}
