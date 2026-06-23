import Phaser from "phaser"
import type { QuestJSON, Scene, Choice } from "../engine/types"
import type { HostApi } from "../sdk/types"
import { StoryGraph } from "../engine/StoryGraph"
import { validateQuest } from "../engine/validator"
import questData from "../data/quest.json"

export class MainScene extends Phaser.Scene {
  private storyGraph!: StoryGraph
  private currentScene: Scene | null = null
  private hostApi: HostApi | null = null
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

    // Create text objects for title and body (recreated on scene restart)
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

    // Speak the scene text
    this.speakScene()

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

