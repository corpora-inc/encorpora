import Phaser from "phaser"
import { npcCorpus } from "../data/npcCorpus"
import type { MultiLangText, NPCEncounter, NPCResponse } from "../data/npcCorpusTypes"
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

/** Screens where riddle NPCs appear instead of vendors */
const RIDDLE_SCREENS = [20, 40, 60, 80]

const RIDDLE_DATA: {
  question: MultiLangText
  answers: [MultiLangText, MultiLangText, MultiLangText]
  correctIndex: number
}[] = [
  {
    question: { en: "I have cities but no houses, forests but no trees, water but no fish. What am I?" },
    answers: [
      { en: "A map" },
      { en: "A painting" },
      { en: "A dream" },
    ],
    correctIndex: 0,
  },
  {
    question: { en: "The more you take, the more you leave behind. What are they?" },
    answers: [
      { en: "Memories" },
      { en: "Footsteps" },
      { en: "Breaths" },
    ],
    correctIndex: 1,
  },
  {
    question: { en: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?" },
    answers: [
      { en: "A shadow" },
      { en: "An echo" },
      { en: "A thought" },
    ],
    correctIndex: 1,
  },
  {
    question: { en: "What can travel around the world while staying in a corner?" },
    answers: [
      { en: "A spider" },
      { en: "The internet" },
      { en: "A stamp" },
    ],
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
  private readonly GROWTH_PER_ACCEPT = 0.02

  // Player state
  private playerSpeed = 200
  private acceptCount = 0
  private interactionState: InteractionState = "roaming"

  // Language
  private activeLangCode = "en"
  private targetLangs: string[] = ["en"]
  private langRotationIndex = 0
  private hostApi: HostApi | null = null

  // NPCs
  private npcs: NPCInstance[] = []
  private passedSet = new Set<string>() // proximity-based re-trigger guard
  private acceptedSet = new Set<string>() // tracks NPCs already accepted (no repeat growth)

  // Response panel (camera-fixed UI)
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

  constructor() {
    super({ key: "ActionScene" })
  }

  create(data?: { returnToScene?: string }) {
    this.returnToSceneId = data?.returnToScene

    // Reset state for scene restart
    this.npcs = []
    this.passedSet.clear()
    this.acceptedSet.clear()
    this.acceptCount = 0
    this.interactionState = "roaming"
    this.activeNPC = null
    this.selectedIndex = 0

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

    // Sky background - NYC evening
    this.cameras.main.setBackgroundColor(0x1a1a2e)

    // Enable physics
    this.physics.world.setBounds(0, 0, this.WORLD_WIDTH, this.SCREEN_HEIGHT)

    // Generate procedural skyline
    this.createSkyline()

    // Create player character
    this.player = this.createPlayer()

    // Create NPCs across the world
    this.createNPCs()

    // Enable physics on player
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(40, 77)
    body.setOffset(-20, -45)
    body.setCollideWorldBounds(true)
    body.setGravityY(0)

    // Camera follows player
    this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, this.SCREEN_HEIGHT)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // Keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.keyUp = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    this.keyDown = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    // Energy bar (repurposed health bar)
    this.createEnergyBar()

    // Progress indicator
    this.progressText = this.add
      .text(400, 580, "", {
        fontSize: "14px",
        color: "#888888",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // Instructions
    this.add
      .text(400, 30, "← → move | Approach NPCs | ↑↓ choose | Enter confirm", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // Language indicator (shown during interactions)
    this.langLabel = this.add
      .text(20, 55, "", {
        fontSize: "16px",
        color: "#00ff41",
        fontFamily: '"Courier New", monospace',
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)

    // Exit button (top-right X)
    const exitBtn = this.add
      .text(780, 20, "✕", {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: "sans-serif",
      })
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

    // Create the response panel (hidden initially)
    this.createResponsePanel()
  }

  update(_time: number, _delta: number) {
    if (this.interactionState === "roaming") {
      this.handleMovement()
      this.checkNPCProximity()
    } else if (this.interactionState === "interacting") {
      this.handleResponseInput()
    }
    // "animating" state: do nothing, wait for tween callbacks

    // Update progress
    const progress = Math.floor((this.player.x / this.WORLD_WIDTH) * 100)
    this.progressText.setText(`${progress}% through NYC`)

    // Check end of world
    if (this.player.x >= this.WORLD_WIDTH - 50) {
      this.sceneComplete()
    }
  }

  // --------------- MOVEMENT ---------------

  private handleMovement() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const scale = 1 + this.acceptCount * this.GROWTH_PER_ACCEPT

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

  /** Resolve lang code for TTS (e.g. "zh-Hans" → "zh") */
  private getTTSLang(): string {
    // Most TTS engines use base language codes
    return this.activeLangCode
  }

  // --------------- NPC PROXIMITY ---------------

  private checkNPCProximity() {
    for (const npc of this.npcs) {
      const distance = Math.abs(this.player.x - npc.worldX)

      // Clear passedSet once player walks far enough away
      if (distance > this.INTERACT_DISTANCE * 2 && this.passedSet.has(npc.encounter.id)) {
        this.passedSet.delete(npc.encounter.id)
      }

      if (
        distance < this.INTERACT_DISTANCE &&
        !npc.dialogVisible &&
        !this.passedSet.has(npc.encounter.id)
      ) {
        this.startInteraction(npc)
        return // Only one interaction at a time
      }

      // Hide dialog if player walks away from a visible-but-cooled-down NPC
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

    // Rotate to next target language
    this.activeLangCode = this.getNextTargetLang()

    // Freeze player
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocityX(0)

    // Show NPC dialog bubble with offering text
    const offeringText = this.getText(npc.encounter.offering)
    npc.dialogText.setText(offeringText)
    npc.dialogBubble.setVisible(true)
    npc.dialogVisible = true

    // Show language indicator
    this.langLabel.setText(this.activeLangCode.toUpperCase())
    this.langLabel.setVisible(true)

    // TTS: speak offering
    this.speak(offeringText)

    // Show response panel with 3 choices
    this.showResponsePanel(npc)
  }

  private confirmResponse() {
    if (!this.activeNPC) return

    const npc = this.activeNPC
    const response = npc.encounter.responses[this.selectedIndex]
    const responseText = this.getText(response.text)

    // Hide response panel
    this.hideResponsePanel()
    this.interactionState = "animating"

    // TTS: speak selected response
    this.speak(responseText)

    // Mark as passed — player must walk away before re-triggering
    this.passedSet.add(npc.encounter.id)

    if (response.type === "accept") {
      const alreadyAccepted = this.acceptedSet.has(npc.encounter.id)
      this.acceptedSet.add(npc.encounter.id)
      this.playAcceptAnimation(npc, alreadyAccepted)
    } else if (response.type === "decline") {
      this.playDeclineAnimation(npc)
    } else {
      this.playArbitraryAnimation(npc)
    }
  }

  private endInteraction() {
    if (this.activeNPC) {
      // Keep bubble visible briefly then hide
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
    // Right side panel — starts offscreen, slides in
    this.responsePanel = this.add.container(850, 280).setScrollFactor(0)
    this.responsePanel.setVisible(false)
    this.responsePanel.setDepth(100)

    // Background — tall narrow panel on the right
    const panelBg = this.add
      .rectangle(0, 0, 160, 180, 0x000000, 0.9)
      .setStrokeStyle(2, 0x00ff41)
    this.responsePanel.add(panelBg)

    // Create 3 option slots
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

      // Tap input for mobile
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

      // Prefix with response type indicator
      const prefix = responses[i].type === "accept" ? "✓ " : responses[i].type === "decline" ? "✗ " : "? "
      text.setText(prefix + responseText)
    }

    this.selectedIndex = 0
    this.updateResponseHighlight()
    // Slide in from right
    this.responsePanel.setX(850)
    this.responsePanel.setVisible(true)
    this.tweens.add({
      targets: this.responsePanel,
      x: 720,
      duration: 200,
      ease: "Power2",
    })
  }

  private hideResponsePanel() {
    // Slide out to right
    this.tweens.add({
      targets: this.responsePanel,
      x: 850,
      duration: 150,
      ease: "Power2",
      onComplete: () => {
        this.responsePanel.setVisible(false)
      },
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

  // --------------- RESPONSE INPUT ---------------

  private handleResponseInput() {
    if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      this.selectedIndex = (this.selectedIndex + 2) % 3 // Wrap up
      this.updateResponseHighlight()
    } else if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      this.selectedIndex = (this.selectedIndex + 1) % 3 // Wrap down
      this.updateResponseHighlight()
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace)
    ) {
      this.confirmResponse()
    }
  }

  // --------------- ANIMATIONS ---------------

  private playAcceptAnimation(npc: NPCInstance, skipGrowth = false) {
    const itemEmoji = ACCEPT_ITEMS[npc.encounter.npcType] || "⭐"

    // Calculate screen-space positions for item float
    const cam = this.cameras.main
    const npcScreenX = npc.worldX - cam.scrollX
    const npcScreenY = npc.container.y - 60 - cam.scrollY
    const playerScreenX = this.player.x - cam.scrollX
    const playerScreenY = this.player.y - cam.scrollY

    // Item emoji floats from NPC to player (camera-fixed)
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
        if (!skipGrowth) {
          this.growPlayer()
          this.updateEnergyBar()
        }
        this.endInteraction()
      },
    })
  }

  private playAbsorptionGlow() {
    // Green glow circle around player (camera-fixed)
    const cam = this.cameras.main
    const px = this.player.x - cam.scrollX
    const py = this.player.y - cam.scrollY

    const glow = this.add
      .circle(px, py, 30, 0x00ff41, 0.6)
      .setScrollFactor(0)
      .setDepth(150)

    this.tweens.add({
      targets: glow,
      scale: 2.5,
      alpha: 0,
      duration: 400,
      ease: "Power2",
      onComplete: () => glow.destroy(),
    })
  }

  private growPlayer() {
    this.acceptCount++
    const scale = 1 + this.acceptCount * this.GROWTH_PER_ACCEPT
    // Determine facing direction
    const facingLeft = this.player.scaleX < 0
    this.player.setScale(facingLeft ? -scale : scale, scale)
    // Adjust Y so feet stay on ground
    this.player.setY(this.PLAYER_BASE_Y - 77 * (scale - 1) / 2)

    // Update physics body to match new scale
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(40, 77)
    body.setOffset(-20, -45)
  }

  private playDeclineAnimation(npc: NPCInstance) {
    // NPC shake animation
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
    // NPC confusion: show "?" above head, wobble
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

    // Wobble NPC
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

  // --------------- TTS ---------------

  private speak(text: string) {
    if (this.hostApi?.speak) {
      this.hostApi.speak(this.getTTSLang(), text)
    }
  }

  // --------------- ENERGY BAR ---------------

  private createEnergyBar() {
    // Background
    this.add.rectangle(700, 50, 150, 20, 0x333333).setScrollFactor(0).setDepth(50)
    // Fill (starts empty, fills with accepts)
    this.energyBarFill = this.add
      .rectangle(626, 50, 0, 15, 0x00ff41)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(51)
    // Label
    this.energyBarLabel = this.add
      .text(700, 50, "ENERGY 0%", {
        fontSize: "10px",
        color: "#000",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(52)
  }

  private updateEnergyBar() {
    // Energy fills based on accepts out of total NPCs (99)
    const pct = Math.min(this.acceptCount / 99, 1)
    const maxWidth = 145
    this.energyBarFill.width = maxWidth * pct
    this.energyBarLabel.setText(`ENERGY ${Math.floor(pct * 100)}%`)
  }

  // --------------- SKYLINE ---------------

  private createSkyline() {
    let x = 50
    while (x < this.WORLD_WIDTH) {
      const width = Phaser.Math.Between(60, 120)
      const height = Phaser.Math.Between(150, 350)

      this.add.rectangle(x, 500 - height / 2, width, height, 0x2a2a4e)

      for (let row = 0; row < Math.floor(height / 30); row++) {
        for (let col = 0; col < Math.floor(width / 20); col++) {
          if (Math.random() > 0.3) {
            this.add
              .rectangle(
                x - width / 2 + 10 + col * 20,
                500 - height + 15 + row * 30,
                8,
                12,
                Math.random() > 0.5 ? 0xffff66 : 0xffaa33,
              )
              .setAlpha(0.8)
          }
        }
      }

      x += width + Phaser.Math.Between(20, 60)
    }

    // Ground
    this.add.rectangle(this.WORLD_WIDTH / 2, 550, this.WORLD_WIDTH, 100, 0x444444)
  }

  // --------------- PLAYER ---------------

  private createPlayer(): Phaser.GameObjects.Container {
    const container = this.add.container(100, this.PLAYER_BASE_Y)

    const skinColor = 0xffcc99
    const hatColor = 0x4a4a8a
    const shirtColor = 0x00aa66
    const pantsColor = 0x2a2a5e
    const shoeColor = 0x1a1a1a

    // Hat
    container.add(this.add.rectangle(0, -45, 24, 10, hatColor))
    container.add(this.add.rectangle(0, -38, 16, 8, hatColor))
    // Head
    container.add(this.add.rectangle(0, -28, 16, 16, skinColor))
    // Eyes
    container.add(this.add.rectangle(-4, -30, 3, 3, 0x000000))
    container.add(this.add.rectangle(4, -30, 3, 3, 0x000000))
    // Body
    container.add(this.add.rectangle(0, -8, 20, 24, shirtColor))
    // Arms
    container.add(this.add.rectangle(-14, -8, 8, 20, shirtColor))
    container.add(this.add.rectangle(14, -8, 8, 20, shirtColor))
    container.add(this.add.rectangle(-14, 4, 6, 6, skinColor))
    container.add(this.add.rectangle(14, 4, 6, 6, skinColor))
    // Pants
    container.add(this.add.rectangle(-5, 14, 10, 16, pantsColor))
    container.add(this.add.rectangle(5, 14, 10, 16, pantsColor))
    // Shoes
    container.add(this.add.rectangle(-5, 26, 12, 6, shoeColor))
    container.add(this.add.rectangle(5, 26, 12, 6, shoeColor))

    return container
  }

  // --------------- NPCs ---------------

  private createNPCs() {
    // Build encounter map: group corpus by npcType
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
    // Track which encounter index we're on per type
    const typeIndex = new Map<string, number>()
    for (const t of typeOrder) typeIndex.set(t, 0)

    // 99 NPCs, one per screen (screens 1–99)
    let riddleIdx = 0
    for (let screen = 1; screen < 100; screen++) {
      const x = screen * 800 + Phaser.Math.Between(200, 600)

      // Place riddle NPCs at milestone screens
      if (RIDDLE_SCREENS.includes(screen)) {
        const encounter = this.createRiddleEncounter(riddleIdx)
        riddleIdx++
        this.createNPC(encounter, x)
        continue
      }

      const typeKey = typeOrder[screen % typeOrder.length]
      let encounters = encountersByType.get(typeKey) || []
      if (encounters.length === 0) {
        encounters = npcCorpus
      }
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
    const container = this.add.container(worldX, 492)
    const icon = NPC_ICONS[encounter.npcType] || "❓"

    // Cart
    container.add(this.add.rectangle(0, 18, 60, 40, 0x8b4513))
    // Umbrella
    container.add(this.add.rectangle(0, -20, 80, 10, 0xff4444))
    container.add(this.add.rectangle(0, -2, 4, 40, 0x666666))
    // Icon
    container.add(this.add.text(0, 0, icon, { fontSize: "32px" }).setOrigin(0.5))

    // NPC person
    const npcPerson = this.createNPCPerson()
    npcPerson.setPosition(40, 0)
    container.add(npcPerson)

    // Dialog bubble (hidden)
    const dialogBubble = this.add.container(0, -80)
    const bubbleBg = this.add
      .rectangle(0, 0, 220, 50, 0xffffff, 0.95)
      .setStrokeStyle(2, 0x000000)
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

  private createNPCPerson(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0)
    const skinColor = 0xdeb887
    const shirtColor = 0xcc3333
    const pantsColor = 0x333366

    container.add(this.add.rectangle(0, -25, 14, 14, skinColor))
    container.add(this.add.rectangle(0, -8, 16, 20, shirtColor))
    container.add(this.add.rectangle(-4, 8, 8, 14, pantsColor))
    container.add(this.add.rectangle(4, 8, 8, 14, pantsColor))

    return container
  }

  // --------------- SCENE LIFECYCLE ---------------

  private sceneComplete() {
    this.scene.start("MainScene", {
      returnToSceneId: this.returnToSceneId,
    })
  }
}
