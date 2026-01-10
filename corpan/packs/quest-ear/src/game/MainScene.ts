import Phaser from "phaser"
import type { QuestJSON, Scene, Choice } from "../engine/types"
import { StoryGraph } from "../engine/StoryGraph"
import { validateQuest } from "../engine/validator"
import questData from "../data/quest.json"

export class MainScene extends Phaser.Scene {
  private storyGraph!: StoryGraph
  private currentScene: Scene | null = null
  private titleText!: Phaser.GameObjects.Text
  private bodyText!: Phaser.GameObjects.Text
  private choiceButtons: Phaser.GameObjects.Text[] = []
  private readonly TEXT_WIDTH = 600

  constructor() {
    super({ key: "MainScene" })
  }

  preload() {
    // Quest data is imported directly, no need to load via Phaser
  }

  create() {
    // Validate quest data
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

    // Set background color
    this.cameras.main.setBackgroundColor(0x0f0f23)

    // Initialize StoryGraph
    this.storyGraph = new StoryGraph()
    const { currentScene } = this.storyGraph.initQuest(questData as QuestJSON)
    this.currentScene = currentScene

    // Create text objects for title and body (will be positioned in renderScene)
    this.titleText = this.add.text(0, 0, "", {
      fontSize: "28px",
      color: "#00ff41",
      fontFamily: '"Courier New", monospace',
      wordWrap: { width: this.TEXT_WIDTH },
      align: "center",
    })

    this.bodyText = this.add.text(0, 0, "", {
      fontSize: "18px",
      color: "#ffb347",
      fontFamily: '"Courier New", monospace',
      wordWrap: { width: this.TEXT_WIDTH },
      lineSpacing: 8,
    })

    // Render the initial scene
    this.renderScene()
  }

  private renderScene() {
    // Get current scene from StoryGraph to ensure we're in sync
    const scene = this.storyGraph.getCurrentScene()
    if (!scene) {
      return
    }
    this.currentScene = scene

    // Clear previous choice buttons
    this.clearChoiceButtons()

    // Calculate starting Y position (centered vertically)
    const screenHeight = this.cameras.main.height
    const screenWidth = this.cameras.main.width
    let y = screenHeight * 0.15
    this.containerY = y

    // Render title
    this.titleText.setText(this.currentScene.title)
    this.titleText.setPosition(screenWidth / 2, y)
    this.titleText.setOrigin(0.5, 0)
    y += this.titleText.height + 30

    // Render body text (each paragraph on a new line)
    const bodyLines = this.currentScene.text.join("\n\n")
    this.bodyText.setText(bodyLines)
    this.bodyText.setPosition(screenWidth / 2, y)
    this.bodyText.setOrigin(0.5, 0)
    y += this.bodyText.height + 40

    // Get available choices (filtered by requirements)
    const availableChoices = this.storyGraph.getAvailableChoicesForCurrentScene()

    // Render choice buttons
    for (let i = 0; i < availableChoices.length; i++) {
      const choice = availableChoices[i]
      const button = this.add
        .text(screenWidth / 2, y, `> ${choice.label}`, {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: '"Courier New", monospace',
          wordWrap: { width: this.TEXT_WIDTH },
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })

      // Add hover effect
      button.on("pointerover", () => {
        button.setColor("#00ff41")
      })
      button.on("pointerout", () => {
        button.setColor("#ffffff")
      })

      // Handle click
      button.on("pointerdown", () => {
        this.handleChoice(choice)
      })

      this.choiceButtons.push(button)
      y += button.height + 20
    }
  }

  private handleChoice(choice: Choice) {
    const { nextScene } = this.storyGraph.choose(choice.id)

    if (nextScene) {
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
    for (const button of this.choiceButtons) {
      button.destroy()
    }
    this.choiceButtons = []
  }
}

