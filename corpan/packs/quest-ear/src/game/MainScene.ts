import Phaser from "phaser"
import type { QuestJSON, Scene, Choice } from "../engine/types"
import type { HostApi } from "../sdk/types"
import { StoryGraph } from "../engine/StoryGraph"
import { validateQuest } from "../engine/validator"
import questData from "../data/quest.json"

// Text size multipliers based on stack config
const TEXT_SIZE_SCALES: Record<string, number> = {
  small: 0.85,
  medium: 1.0,
  large: 1.2,
  "extra-large": 1.4,
}

export class MainScene extends Phaser.Scene {
  private storyGraph!: StoryGraph
  private currentScene: Scene | null = null
  private hostApi: HostApi | null = null
  private titleText!: Phaser.GameObjects.Text
  private bodyText!: Phaser.GameObjects.Text
  private hintText: Phaser.GameObjects.Text | null = null
  private choiceButtons: Phaser.GameObjects.Text[] = []
  private availableChoices: Choice[] = []
  private selectedIndex = 0
  private exitButton!: Phaser.GameObjects.Container
  private readonly TEXT_WIDTH = 600

  // Keyboard - use cursor keys object (Phaser's built-in, reliable)
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private enterKey!: Phaser.Input.Keyboard.Key
  private escKey!: Phaser.Input.Keyboard.Key
  private numberKeys: Phaser.Input.Keyboard.Key[] = []

  // Base font sizes (scaled by textSize setting)
  private readonly BASE_TITLE_SIZE = 28
  private readonly BASE_BODY_SIZE = 18
  private readonly BASE_CHOICE_SIZE = 16
  private readonly BASE_EXIT_SIZE = 14

  constructor() {
    super({ key: "MainScene" })
  }

  preload() {
    // Quest data is imported directly, no need to load via Phaser
  }

  private getTextScale(): number {
    const stackConfig = this.hostApi?.getStackConfig?.()
    const textSize = stackConfig?.textSize || "medium"
    return TEXT_SIZE_SCALES[textSize] || 1.0
  }

  private scaledFontSize(base: number): string {
    return `${Math.round(base * this.getTextScale())}px`
  }

  create(data?: { returnToSceneId?: string }) {
    // Set background color (always needed on scene creation)
    this.cameras.main.setBackgroundColor(0x0f0f23)

    // Validate quest data (only on first load)
    if (!this.storyGraph) {
      const errors = validateQuest(questData)
      if (errors.length > 0) {
        console.error("Quest validation errors:", errors)
        this.add
          .text(this.cameras.main.width / 2, this.cameras.main.height / 2, `Quest validation failed:\n${errors.join("\n")}`, {
            fontSize: "16px",
            color: "#ff0000",
            fontFamily: "monospace",
            wordWrap: { width: 700 },
          })
          .setOrigin(0.5)
        return
      }

      // Initialize StoryGraph
      this.storyGraph = new StoryGraph()
      const { currentScene } = this.storyGraph.initQuest(questData as QuestJSON)
      this.currentScene = currentScene

      // Get hostApi from global (set by main.ts)
      this.hostApi = (globalThis as any).__questEarHostApi || null
    }

    // Create exit button (fixed position, top-right)
    this.createExitButton()

    // Create text objects for title and body (recreated on scene restart)
    this.titleText = this.add.text(0, 0, "", {
      fontSize: this.scaledFontSize(this.BASE_TITLE_SIZE),
      color: "#00ff41",
      fontFamily: '"Courier New", monospace',
      wordWrap: { width: this.TEXT_WIDTH },
      align: "center",
    })

    this.bodyText = this.add.text(0, 0, "", {
      fontSize: this.scaledFontSize(this.BASE_BODY_SIZE),
      color: "#ffb347",
      fontFamily: '"Courier New", monospace',
      wordWrap: { width: this.TEXT_WIDTH },
      lineSpacing: 8,
    })

    // Set up keyboard - use createCursorKeys which is safe and scene-managed
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    // Number keys 1-9
    this.numberKeys = []
    const keyCodes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
      Phaser.Input.Keyboard.KeyCodes.EIGHT,
      Phaser.Input.Keyboard.KeyCodes.NINE,
    ]
    for (const keyCode of keyCodes) {
      this.numberKeys.push(this.input.keyboard!.addKey(keyCode))
    }

    // Check if we're returning from an action scene
    if (data?.returnToSceneId && this.storyGraph) {
      // Get the current scene from StoryGraph (should be the action scene we navigated to)
      const returnScene = this.storyGraph.getCurrentScene()
      if (returnScene && returnScene.id === data.returnToSceneId) {
        // We're returning from action scene, show its choices
        this.currentScene = returnScene
        this.renderScene()
        return
      }
    }

    // Render the current scene (initial scene)
    this.renderScene()
  }

  // Polling-based input in update loop - most reliable method in Phaser
  update() {
    // Check for navigation keys (JustDown = only triggers once per press)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.navigateChoice(-1)
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.navigateChoice(1)
    }

    // Enter or Space to select
    if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
      this.selectCurrentChoice()
    }

    // ESC to exit
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.exitGame()
    }

    // Number keys 1-9
    for (let i = 0; i < this.numberKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.numberKeys[i])) {
        if (i < this.availableChoices.length) {
          this.selectedIndex = i
          this.updateChoiceHighlight()
          this.selectCurrentChoice()
        }
      }
    }
  }

  private createExitButton() {
    const screenWidth = this.cameras.main.width
    const padding = 20

    // Container for exit button
    this.exitButton = this.add.container(screenWidth - padding, padding)

    // Background
    const bg = this.add
      .rectangle(0, 0, 70, 32, 0x333344, 0.9)
      .setStrokeStyle(1, 0x666688)
      .setOrigin(1, 0)

    // Text
    const text = this.add
      .text(-35, 16, "ESC Exit", {
        fontSize: this.scaledFontSize(this.BASE_EXIT_SIZE),
        color: "#aaaacc",
        fontFamily: '"Courier New", monospace',
      })
      .setOrigin(0.5, 0.5)

    this.exitButton.add([bg, text])
    this.exitButton.setScrollFactor(0)

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

  private navigateChoice(direction: number) {
    if (this.availableChoices.length === 0) return

    this.selectedIndex += direction
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.availableChoices.length - 1
    } else if (this.selectedIndex >= this.availableChoices.length) {
      this.selectedIndex = 0
    }

    this.updateChoiceHighlight()
  }

  private updateChoiceHighlight() {
    this.choiceButtons.forEach((button, index) => {
      const isSelected = index === this.selectedIndex
      button.setColor(isSelected ? "#00ff41" : "#ffffff")

      // Update the prefix to show selection state
      const choice = this.availableChoices[index]
      if (choice) {
        const prefix = isSelected ? "► " : "  "
        const number = `${index + 1}. `
        button.setText(`${prefix}${number}${choice.label}`)
      }
    })
  }

  private selectCurrentChoice() {
    if (this.availableChoices.length === 0) return
    if (this.selectedIndex >= 0 && this.selectedIndex < this.availableChoices.length) {
      this.handleChoice(this.availableChoices[this.selectedIndex])
    }
  }

  private exitGame() {
    // Stop any ongoing speech
    this.hostApi?.stopSpeech?.()

    // Dispatch the exit event that the host app listens for
    window.dispatchEvent(new Event("corpan:exit"))
  }

  private renderScene() {
    // Get current scene from StoryGraph to ensure we're in sync
    const scene = this.storyGraph.getCurrentScene()
    if (!scene) {
      return
    }
    this.currentScene = scene

    // Clear previous UI elements
    this.clearChoiceButtons()

    // Reset selection index
    this.selectedIndex = 0

    // Calculate starting Y position (centered vertically)
    const screenHeight = this.cameras.main.height
    const screenWidth = this.cameras.main.width
    let y = screenHeight * 0.12

    // Render title
    this.titleText.setStyle({ fontSize: this.scaledFontSize(this.BASE_TITLE_SIZE) })
    this.titleText.setText(this.currentScene.title)
    this.titleText.setPosition(screenWidth / 2, y)
    this.titleText.setOrigin(0.5, 0)
    y += this.titleText.height + 30

    // Render body text (each paragraph on a new line)
    const bodyLines = this.currentScene.text.join("\n\n")
    this.bodyText.setStyle({ fontSize: this.scaledFontSize(this.BASE_BODY_SIZE) })
    this.bodyText.setText(bodyLines)
    this.bodyText.setPosition(screenWidth / 2, y)
    this.bodyText.setOrigin(0.5, 0)
    y += this.bodyText.height + 40

    // Speak the scene text
    this.speakScene()

    // Get available choices (filtered by requirements)
    this.availableChoices = this.storyGraph.getAvailableChoicesForCurrentScene()

    // Add keyboard hint if there are choices (kept separate from choiceButtons)
    if (this.availableChoices.length > 0) {
      this.hintText = this.add
        .text(screenWidth / 2, y, "↑↓ Navigate  •  Enter Select  •  1-9 Quick Select", {
          fontSize: this.scaledFontSize(12),
          color: "#666688",
          fontFamily: '"Courier New", monospace',
        })
        .setOrigin(0.5, 0)
      y += this.hintText.height + 16
    }

    // Render choice buttons with numbers
    for (let i = 0; i < this.availableChoices.length; i++) {
      const choice = this.availableChoices[i]
      const isSelected = i === this.selectedIndex
      const prefix = isSelected ? "► " : "  "
      const number = `${i + 1}. `

      const button = this.add
        .text(screenWidth / 2, y, `${prefix}${number}${choice.label}`, {
          fontSize: this.scaledFontSize(this.BASE_CHOICE_SIZE),
          color: isSelected ? "#00ff41" : "#ffffff",
          fontFamily: '"Courier New", monospace',
          wordWrap: { width: this.TEXT_WIDTH },
          align: "left",
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })

      // Store the index for click handler
      const choiceIndex = i

      // Add hover effect
      button.on("pointerover", () => {
        this.selectedIndex = choiceIndex
        this.updateChoiceHighlight()
      })

      // Handle click
      button.on("pointerdown", () => {
        this.handleChoice(choice)
      })

      this.choiceButtons.push(button)
      y += button.height + 16
    }
  }

  private handleChoice(choice: Choice) {
    // Stop any current speech
    this.hostApi?.stopSpeech?.()

    const { nextScene } = this.storyGraph.choose(choice.id)

    if (nextScene) {
      // Check if next scene is an action scene
      if (nextScene.type === "action" && nextScene.action_config?.scene_key) {
        // Transition to action scene
        this.currentScene = nextScene
        // Pass the scene ID so ActionScene can return to it
        this.scene.start(nextScene.action_config.scene_key, {
          returnToScene: nextScene.id,
        })
        return
      }

      // Transition to next scene (on_enter effects already applied in choose)
      this.currentScene = nextScene
      this.renderScene()
    } else {
      // End of quest
      this.clearChoiceButtons()
      this.titleText.setText("Quest Complete")
      this.bodyText.setText("You have reached the end of this quest.")
      const screenWidth = this.cameras.main.width
      const screenHeight = this.cameras.main.height
      this.titleText.setPosition(screenWidth / 2, screenHeight / 2 - 40)
      this.bodyText.setPosition(screenWidth / 2, screenHeight / 2 + 20)
    }
  }


  private clearChoiceButtons() {
    // Clear hint text
    if (this.hintText) {
      this.hintText.destroy()
      this.hintText = null
    }

    // Clear choice buttons
    for (const button of this.choiceButtons) {
      button.destroy()
    }
    this.choiceButtons = []
  }

  private speakScene() {
    if (!this.hostApi?.speak || !this.currentScene) {
      return
    }

    // Get user's language from stack config
    const stackConfig = this.hostApi.getStackConfig?.()
    const lang = stackConfig?.languages?.[0] || "en"

    // Combine title and body text
    const fullText = [this.currentScene.title, ...this.currentScene.text].join(". ")

    // Speak it
    this.hostApi.speak(lang, fullText)
  }
}
