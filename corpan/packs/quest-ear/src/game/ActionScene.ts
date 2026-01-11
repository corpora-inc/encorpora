import Phaser from "phaser"

interface NPCData {
  id: string
  x: number
  type: string
  icon: string // Emoji for now
  dialog: string // Text they say (English for now, will translate later)
  langCode: string // Target language
}

export class ActionScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private escKey!: Phaser.Input.Keyboard.Key
  private progressText!: Phaser.GameObjects.Text
  private returnToSceneId?: string

  // Constants
  private readonly WORLD_WIDTH = 80000 // 100 screens × 800px
  private readonly SCREEN_HEIGHT = 600

  // Player state
  private playerSpeed = 200

  // NPCs
  private npcs: {
    container: Phaser.GameObjects.Container
    data: NPCData
    dialogVisible: boolean
  }[] = []

  constructor() {
    super({ key: "ActionScene" })
  }

  create(data?: { returnToScene?: string }) {
    this.returnToSceneId = data?.returnToScene

    // Sky background - NYC evening
    this.cameras.main.setBackgroundColor(0x1a1a2e)

    // Enable physics
    this.physics.world.setBounds(0, 0, this.WORLD_WIDTH, this.SCREEN_HEIGHT)

    // Generate procedural skyline across entire world
    this.createSkyline()

    // Create player character
    this.player = this.createPlayer()

    // Create NPCs across the world
    this.createNPCs()

    // Enable physics on the container
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    // Character visual bounds: ~40 wide, ~77 tall (from hat top to shoe bottom)
    body.setSize(40, 77)
    body.setOffset(-20, -45) // Align body with visual character (top at hat, centered horizontally)
    body.setCollideWorldBounds(true)
    body.setGravityY(0) // No gravity for side-scrolling

    // Camera follows player
    this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, this.SCREEN_HEIGHT)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // Enable keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    // Health bar
    this.createHealthBar()

    // Create exit button
    this.createExitButton()

    // Progress indicator (fixed to camera)
    this.progressText = this.add
      .text(400, 580, "", {
        fontSize: "14px",
        color: "#888888",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // Instructions (fixed to camera)
    this.add
      .text(400, 30, "← → to move | Approach NPCs to interact | ESC to exit", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
  }

  private createExitButton() {
    const padding = 20

    // Container for exit button (top-left)
    const exitButton = this.add.container(padding, padding)

    // Background
    const bg = this.add
      .rectangle(0, 0, 70, 32, 0x333344, 0.9)
      .setStrokeStyle(1, 0x666688)
      .setOrigin(0, 0)

    // Text
    const text = this.add
      .text(35, 16, "ESC Exit", {
        fontSize: "14px",
        color: "#aaaacc",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5, 0.5)

    exitButton.add([bg, text])
    exitButton.setScrollFactor(0)

    // Make interactive
    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerover", () => {
      bg.setFillStyle(0x444466, 1)
      text.setColor("#ffffff")
    })
    bg.on("pointerout", () => {
      bg.setFillStyle(0x333344, 0.9)
      text.setColor("#aaaacc")
    })
    bg.on("pointerdown", () => {
      this.exitGame()
    })
  }

  private exitGame() {
    // Stop any ongoing speech
    const hostApi = (globalThis as any).__questEarHostApi
    hostApi?.stopSpeech?.()

    // Dispatch the exit event that the host app listens for
    window.dispatchEvent(new Event("corpan:exit"))
  }

  update(_time: number, _delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body

    // Movement - continuous while held
    if (this.cursors.left.isDown) {
      body.setVelocityX(-this.playerSpeed)
      this.player.setScale(-1, 1) // Flip to face left
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(this.playerSpeed)
      this.player.setScale(1, 1) // Face right
    } else {
      body.setVelocityX(0)
    }

    // ESC to exit
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.exitGame()
    }

    // Update progress indicator
    const progress = Math.floor((this.player.x / this.WORLD_WIDTH) * 100)
    this.progressText.setText(`${progress}% through NYC`)

    // Check NPC proximity
    const INTERACT_DISTANCE = 100

    this.npcs.forEach((npc) => {
      const distance = Math.abs(this.player.x - npc.data.x)

      if (distance < INTERACT_DISTANCE && !npc.dialogVisible) {
        // Show dialog and speak
        const bubble = npc.container.getAt(npc.container.length - 1) as Phaser.GameObjects.Container
        bubble.setVisible(true)
        npc.dialogVisible = true
        this.speakNPCDialog(npc.data)
      } else if (distance >= INTERACT_DISTANCE && npc.dialogVisible) {
        // Hide dialog
        const bubble = npc.container.getAt(npc.container.length - 1) as Phaser.GameObjects.Container
        bubble.setVisible(false)
        npc.dialogVisible = false
      }
    })

    // Check if reached end of world
    if (this.player.x >= this.WORLD_WIDTH - 50) {
      this.sceneComplete()
    }
  }

  private createSkyline() {
    // Generate buildings across the entire world
    let x = 50
    while (x < this.WORLD_WIDTH) {
      const width = Phaser.Math.Between(60, 120)
      const height = Phaser.Math.Between(150, 350)

      // Building silhouette
      this.add.rectangle(x, 500 - height / 2, width, height, 0x2a2a4e)

      // Windows
      for (let row = 0; row < Math.floor(height / 30); row++) {
        for (let col = 0; col < Math.floor(width / 20); col++) {
          if (Math.random() > 0.3) {
            this.add
              .rectangle(
                x - width / 2 + 10 + col * 20,
                500 - height + 15 + row * 30,
                8,
                12,
                Math.random() > 0.5 ? 0xffff66 : 0xffaa33
              ) // Yellow or orange lights
              .setAlpha(0.8)
          }
        }
      }

      x += width + Phaser.Math.Between(20, 60) // Gap between buildings
    }

    // Extended ground across entire world
    this.add.rectangle(this.WORLD_WIDTH / 2, 550, this.WORLD_WIDTH, 100, 0x444444)
  }

  private createPlayer(): Phaser.GameObjects.Container {
    // Character's feet (shoes) are at y=26 relative to container
    // Ground level is at y=500 (center of ground rectangle, top at y=500-50=450)
    // Want feet to be at y≈500, so container y = 500 - 26 = 474
    const container = this.add.container(100, 474)

    // Colors
    const skinColor = 0xffcc99
    const hatColor = 0x4a4a8a // Purple-ish hat
    const shirtColor = 0x00aa66 // Green shirt
    const pantsColor = 0x2a2a5e // Dark pants
    const shoeColor = 0x1a1a1a // Black shoes

    // Hat (top)
    container.add(this.add.rectangle(0, -45, 24, 10, hatColor))
    container.add(this.add.rectangle(0, -38, 16, 8, hatColor))

    // Head
    container.add(this.add.rectangle(0, -28, 16, 16, skinColor))

    // Eyes
    container.add(this.add.rectangle(-4, -30, 3, 3, 0x000000))
    container.add(this.add.rectangle(4, -30, 3, 3, 0x000000))

    // Body/shirt
    container.add(this.add.rectangle(0, -8, 20, 24, shirtColor))

    // Arms
    container.add(this.add.rectangle(-14, -8, 8, 20, shirtColor)) // Left arm
    container.add(this.add.rectangle(14, -8, 8, 20, shirtColor)) // Right arm
    container.add(this.add.rectangle(-14, 4, 6, 6, skinColor)) // Left hand
    container.add(this.add.rectangle(14, 4, 6, 6, skinColor)) // Right hand

    // Pants
    container.add(this.add.rectangle(-5, 14, 10, 16, pantsColor)) // Left leg
    container.add(this.add.rectangle(5, 14, 10, 16, pantsColor)) // Right leg

    // Shoes
    container.add(this.add.rectangle(-5, 26, 12, 6, shoeColor)) // Left shoe
    container.add(this.add.rectangle(5, 26, 12, 6, shoeColor)) // Right shoe

    return container
  }

  private createNPCs() {
    const npcTypes = [
      { type: "hotdog", icon: "🌭", dialog: "¿Con todo?" },
      { type: "pizza", icon: "🍕", dialog: "¿Una porción?" },
      { type: "coffee", icon: "☕", dialog: "¿Café caliente?" },
      { type: "juice", icon: "🧃", dialog: "¿Jugo fresco?" },
      { type: "tickets", icon: "🎫", dialog: "¿Boletos para el show?" },
      { type: "newspaper", icon: "📰", dialog: "¡Noticias del día!" },
      { type: "pretzel", icon: "🥨", dialog: "¿Pretzel con sal?" },
      { type: "taxi", icon: "🚕", dialog: "¿A dónde va?" },
      { type: "flowers", icon: "💐", dialog: "¿Flores para alguien especial?" },
      { type: "fruit", icon: "🍎", dialog: "¡Frutas frescas!" },
    ]

    // One NPC per screen (every ~800px), starting at screen 2
    for (let screen = 1; screen < 100; screen++) {
      const npcType = npcTypes[screen % npcTypes.length]
      const x = screen * 800 + Phaser.Math.Between(200, 600)

      const npcData: NPCData = {
        id: `npc_${screen}`,
        x,
        type: npcType.type,
        icon: npcType.icon,
        dialog: npcType.dialog,
        langCode: "es", // Spanish for now
      }

      this.createNPC(npcData)
    }
  }

  private createNPC(data: NPCData) {
    // NPC person's feet are at y≈8 relative to NPC person container
    // Want feet at ground level (y≈500), similar to player
    // Main container at y=500, NPC person at (40, 0) relative, feet at y=8, so world y = 500 + 0 + 8 = 508
    // Actually, let's adjust: NPC person feet should be at y≈500, so if feet are at y=8 relative,
    // and NPC person is at (40, 0), then main container should be at y = 500 - 8 = 492
    const container = this.add.container(data.x, 492)

    // Stand/cart (simple box, positioned to sit on ground)
    // Ground is at y≈500, so cart bottom should be around y=500
    // Cart is 40px tall, centered at y=10 relative, so bottom is at y=-10, top at y=30
    // Adjust so cart sits on ground: container at y=492, cart at y=10 means cart center at y=502, so bottom at y=482, top at y=522
    // Actually, let's position cart bottom at ground: if ground is y=500 and cart is 40 tall, cart center should be at y=520
    // Relative to container at y=492, cart center should be at y=520-492=28
    const stand = this.add.rectangle(0, 18, 60, 40, 0x8b4513) // Brown cart, positioned to sit on ground
    container.add(stand)

    // Umbrella (positioned above cart)
    const umbrella = this.add.rectangle(0, -20, 80, 10, 0xff4444) // Red umbrella
    container.add(umbrella)
    const umbrellaPost = this.add.rectangle(0, -2, 4, 40, 0x666666)
    container.add(umbrellaPost)

    // Icon (using text for emoji)
    const icon = this.add.text(0, 0, data.icon, { fontSize: "32px" }).setOrigin(0.5)
    container.add(icon)

    // NPC person (simple pixel person, different color than player)
    const npcPerson = this.createNPCPerson()
    npcPerson.setPosition(40, 0) // Standing beside cart
    container.add(npcPerson)

    // Dialog bubble (hidden initially)
    const bubble = this.add.container(0, -80)
    const bubbleBg = this.add
      .rectangle(0, 0, 200, 50, 0xffffff, 0.95)
      .setStrokeStyle(2, 0x000000)
    bubble.add(bubbleBg)
    const dialogText = this.add
      .text(0, 0, data.dialog, {
        fontSize: "14px",
        color: "#000000",
        fontFamily: "monospace",
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5)
    bubble.add(dialogText)
    bubble.setVisible(false)
    container.add(bubble)

    this.npcs.push({ container, data, dialogVisible: false })
  }

  private createNPCPerson(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0)

    // Different colors than player
    const skinColor = 0xdeb887
    const shirtColor = 0xcc3333 // Red shirt
    const pantsColor = 0x333366

    // Head
    container.add(this.add.rectangle(0, -25, 14, 14, skinColor))
    // Body
    container.add(this.add.rectangle(0, -8, 16, 20, shirtColor))
    // Legs
    container.add(this.add.rectangle(-4, 8, 8, 14, pantsColor))
    container.add(this.add.rectangle(4, 8, 8, 14, pantsColor))

    return container
  }

  private speakNPCDialog(data: NPCData) {
    const hostApi = (globalThis as any).__questEarHostApi
    if (hostApi?.speak) {
      hostApi.speak(data.langCode, data.dialog)
    }
  }

  private createHealthBar() {
    // Background (fixed to camera)
    this.add.rectangle(700, 50, 150, 20, 0x333333).setScrollFactor(0)
    // Health bar (fixed to camera)
    this.add.rectangle(700, 50, 145, 15, 0x00ff41).setScrollFactor(0)
    this.add
      .text(700, 50, "HEALTH", { fontSize: "10px", color: "#000", fontFamily: "monospace" })
      .setOrigin(0.5)
      .setScrollFactor(0)
  }

  private sceneComplete() {
    // Return to story, passing the scene ID to return to
    this.scene.start("MainScene", {
      returnToSceneId: this.returnToSceneId,
    })
  }
}
