import Phaser from "phaser"

export class ActionScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private progressText!: Phaser.GameObjects.Text
  private returnToSceneId?: string

  // Constants
  private readonly WORLD_WIDTH = 80000 // 100 screens × 800px
  private readonly SCREEN_WIDTH = 800
  private readonly SCREEN_HEIGHT = 600

  // Player state
  private playerSpeed = 200
  private health = 100

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

    // Health bar
    this.createHealthBar()

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
      .text(400, 30, "← → to move | Approach NPCs to interact", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
  }

  update(time: number, delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body

    if (this.cursors.left.isDown) {
      body.setVelocityX(-this.playerSpeed)
      this.player.setScale(-1, 1) // Flip to face left
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(this.playerSpeed)
      this.player.setScale(1, 1) // Face right
    } else {
      body.setVelocityX(0)
    }

    // Update progress indicator
    const progress = Math.floor((this.player.x / this.WORLD_WIDTH) * 100)
    this.progressText.setText(`${progress}% through NYC`)

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
      const building = this.add.rectangle(x, 500 - height / 2, width, height, 0x2a2a4e)

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

  private createHealthBar() {
    // Background (fixed to camera)
    const bgBar = this.add.rectangle(700, 50, 150, 20, 0x333333).setScrollFactor(0)
    // Health (will update dynamically, fixed to camera)
    const healthBar = this.add.rectangle(700, 50, 145, 15, 0x00ff41).setScrollFactor(0)
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
