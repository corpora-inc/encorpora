import type { HostApi } from "./sdk/types"
import type { InitialState } from "./core/types"
import { GameEngine } from "./engine/GameEngine"
import { ArenaMode } from "./modes/arena/ArenaMode"
import { createHudManager, type HudManager } from "./ui/HudManager"
import { createGameOverScreen, type GameOverScreen } from "./ui/GameOverScreen"
import { createAdManager } from "./ad/AdManager"
import { createMockProvider } from "./ad/providers/mockProvider"
import { createGoogleH5Provider } from "./ad/providers/googleH5"
import { createHostProvider } from "./ad/providers/hostProvider"
import { resolveAdConfig } from "./ad/adConfig"
import { setLanguageSignals, createLanguageRotator } from "./ad/LanguageSignal"
import { createNpcAdManager } from "./ad/npcAd/NpcAdManager"
import { createMockNpcProvider } from "./ad/npcAd/providers/mockNpcProvider"
import { createCorpanTextProvider } from "./ad/npcAd/providers/corpanTextProvider"
import { createAnzuProvider } from "./ad/npcAd/providers/anzuProvider"
import { createDisplayAdManager, type DisplayAdManager } from "./ad/displayAds/DisplayAdManager"

export const createAdBlaster = (
  container: HTMLElement,
  hostApi: HostApi,
  _initialState?: InitialState
) => {
  // Language rotation for ad targeting — cycles through all stack languages
  const config = hostApi.getStackConfig()
  const targetLangs = config.languages.filter((l) => l !== "en")
  const langRotator = createLanguageRotator(targetLangs)
  // Set initial language signal
  if (targetLangs.length > 0) {
    setLanguageSignals(targetLangs[0])
  }

  // Resolve ad network config (defaults to production publisher ID)
  const adConfig = resolveAdConfig()

  // Ad provider waterfall: Host (native AdMob) → Google H5 (web dev) → Mock
  // Language rotates before each ad request so ads arrive in different languages
  const adProviders = []
  if (hostApi.showInterstitial) {
    adProviders.push(createHostProvider(hostApi))
  }
  if (adConfig.adClient) {
    adProviders.push(createGoogleH5Provider({ adClient: adConfig.adClient }))
  }
  adProviders.push(createMockProvider())
  const adManager = createAdManager(adProviders, () => langRotator.rotate())
  void adManager.init()

  // NPC ad providers: anzu (when configured) → corpanText → mock (dev fallback)
  // Note: corpanTextProvider needs adContent, which is created inside the engine.
  // We create a "late-bind" npcAdManager first, then wire corpanText after engine init.
  const npcAdManager = createNpcAdManager([
    createAnzuProvider(),
    createMockNpcProvider(),
  ])

  const engine = new GameEngine(container, hostApi, adManager, npcAdManager)
  const root = engine.getRoot()
  const ctx = engine.getContext()

  // Now that engine is created, rebuild NPC ad manager with corpanText using engine's adContent
  // The initial manager (anzu + mock) works, but we want corpanText in the waterfall too.
  // Re-create with full provider chain using engine's adContent.
  const fullNpcAdManager = createNpcAdManager([
    createAnzuProvider(),
    createCorpanTextProvider(ctx.adContent),
    createMockNpcProvider(),
  ])
  void fullNpcAdManager.init()

  // Patch the context to use the full manager
  ;(ctx as { npcAdManager: typeof fullNpcAdManager }).npcAdManager = fullNpcAdManager

  // Register arena mode (the only mode)
  engine.registerMode(new ArenaMode())

  // Display ads around game UI
  let displayAds: DisplayAdManager | null = null
  try {
    displayAds = createDisplayAdManager(root, adConfig.gptNetwork, () => langRotator.rotate())
  } catch {
    // Display ads failed to init — game continues without them
  }

  // UI layers
  let hud: HudManager | null = null
  let gameOver: GameOverScreen | null = null
  let started = false
  let gameOverShown = false

  // "TAP TO START" overlay
  const startOverlay = document.createElement("div")
  startOverlay.className = "ab-start-overlay"
  startOverlay.innerHTML = `
    <h1 class="ab-start-title">AD BLASTER</h1>
    <p class="ab-start-subtitle">The Adpocalypse is here. You are the last line of defense.</p>
    <p class="ab-start-tap">TAP TO START</p>
  `
  root.appendChild(startOverlay)

  const startGame = async () => {
    if (started) return
    started = true
    startOverlay.style.display = "none"

    await engine.switchMode("arena")
    gameOverShown = false

    hud = createHudManager(root, ctx.score)

    // Use render loop for HUD updates instead of setInterval
    const checkGameState = () => {
      if (!started) return
      if (hud) hud.update()
      if (ctx.score.isGameOver() && !gameOverShown) {
        gameOverShown = true
        handleGameOver()
      }
      requestAnimationFrame(checkGameState)
    }
    requestAnimationFrame(checkGameState)
  }

  const handleGameOver = () => {
    engine.stopMode()

    if (!gameOver) {
      gameOver = createGameOverScreen(root, ctx.score, adManager)
    }

    void gameOver.show(async () => {
      // Restart
      gameOverShown = false
      await engine.switchMode("arena")
      if (hud) hud.update()
    })
  }

  // Start on tap/click
  const onStart = () => {
    startOverlay.removeEventListener("click", onStart)
    startOverlay.removeEventListener("touchstart", onStart)
    void startGame()
  }
  startOverlay.addEventListener("click", onStart)
  startOverlay.addEventListener("touchstart", onStart, { passive: true })

  return {
    dispose: () => {
      started = false
      hud?.dispose()
      gameOver?.dispose()
      displayAds?.dispose()
      startOverlay.remove()
      engine.dispose()
    },
  }
}
