import "./styles.css"
import type { GameModule, HostApi, PackDbQueryResult, StackConfig } from "./sdk/types"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __questEar?: { dispose: () => void }
  __corpanHostActive?: boolean
}

const GAME_ID = "quest_ear"
const DB_NAME = "main"
const QUEST_ID = "all_hearing_ear"

type QuestRow = {
  id: string
  title: string
  description: string
  default_language: string
  start_scene_id?: string | null
  metadata_json?: unknown
}

type SceneRow = {
  id: string
  quest_id: string
  title: string
  scene_type: string
  summary?: string | null
  visual_json?: unknown
  metadata_json?: unknown
}

type NodeRow = {
  id: string
  scene_id: string
  node_type: string
  text_unit_id?: number | null
  action_key?: string | null
  order_index: number
  metadata_json?: unknown
}

type EdgeRow = {
  id: string
  from_node_id: string
  to_node_id?: string | null
  to_scene_id?: string | null
  edge_type: "auto" | "choice"
  label_text_unit_id?: number | null
  order_index: number
  metadata_json?: unknown
}

type TextUnitRow = {
  id: number
  key: string
  default_text: string
}

type TranslationRow = {
  text_unit_id: number
  language_code: string
  text: string
  romanization?: string | null
}

type SceneData = {
  scene: SceneRow
  nodes: NodeRow[]
  edges: EdgeRow[]
  nodeById: Map<string, NodeRow>
  edgesByFrom: Map<string, EdgeRow[]>
  textUnits: Map<number, TextUnitRow>
  translations: Map<number, Map<string, TranslationRow>>
}

const toString = (value: unknown, fallback = ""): string => {
  if (value === null || value === undefined) return fallback
  return String(value)
}

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value)
  return Number.isNaN(num) ? fallback : num
}

const parseJson = (value: unknown) => {
  if (typeof value === "string" && value.trim().length) {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value ?? null
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi) => {
      const scope = globalThis as GlobalScope

      if (scope.__questEar) {
        scope.__questEar.dispose()
        scope.__questEar = undefined
      }

      const instance = createStoryApp(container, hostApi)
      scope.__questEar = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__questEar = undefined
        },
      }
    },
  }
}

const createStoryApp = (container: HTMLElement, hostApi: HostApi) => {
  const root = document.createElement("div")
  root.className = "story-root"
  const visual = document.createElement("div")
  visual.className = "story-visual"
  const grain = document.createElement("div")
  grain.className = "story-grain"
  visual.appendChild(grain)
  const feed = document.createElement("div")
  feed.className = "story-feed"

  root.appendChild(visual)
  root.appendChild(feed)
  container.innerHTML = ""
  container.appendChild(root)

  let quest: QuestRow | null = null
  let activeLanguages: string[] = []
  let showRomanization = false
  let unsubscribe: (() => void) | null = null
  const sceneCache = new Map<string, SceneData>()
  const spokenNodes = new Set<string>()
  const nodeElements = new Map<string, HTMLElement>()

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        el.classList.add("is-visible")
        const nodeId = el.dataset.nodeId
        if (!nodeId || spokenNodes.has(nodeId)) continue
        const nodeData = findNodeById(nodeId)
        if (nodeData && nodeData.node.text_unit_id) {
          const spokenLang = activeLanguages[0] || quest?.default_language || "en"
          const text = resolveText(nodeData, nodeData.node.text_unit_id, spokenLang)
          if (text) {
            hostApi.speak(spokenLang, text)
            spokenNodes.add(nodeId)
          }
        }
      }
    },
    { root: feed, threshold: 0.4 }
  )

  const handleScroll = (() => {
    let scheduled = false
    return () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        const max = feed.scrollHeight - feed.clientHeight
        const progress = max > 0 ? feed.scrollTop / max : 0
        root.style.setProperty("--scroll-progress", progress.toFixed(4))
      })
    }
  })()

  feed.addEventListener("scroll", handleScroll)

  const applyTheme = (scene: SceneRow) => {
    const visualJson = parseJson(scene.visual_json) as { theme?: string } | null
    const theme = visualJson?.theme || "market"
    const palette = {
      market: ["#0b1a1f", "#14333a", "#234a3f", "#f2b66d", "#57d6c8"],
      tunnel: ["#0a1014", "#1a1d2b", "#2b2f3f", "#f29d6d", "#7f9cff"],
      archive: ["#0f1611", "#1b2b1d", "#2d3f2a", "#f2c08d", "#8fd39b"],
      temple: ["#131018", "#2a1f31", "#46343f", "#f2b86d", "#e28bc1"],
      cafe: ["#101416", "#1c2a2b", "#2b3d37", "#f2b66d", "#d9a26f"],
    }[theme] || ["#0b1a1f", "#14333a", "#234a3f", "#f2b66d", "#57d6c8"]

    root.style.setProperty("--bg-1", palette[0])
    root.style.setProperty("--bg-2", palette[1])
    root.style.setProperty("--bg-3", palette[2])
    root.style.setProperty("--accent", palette[3])
    root.style.setProperty("--accent-2", palette[4])
  }

  const showError = (message: string) => {
    feed.innerHTML = ""
    const error = document.createElement("div")
    error.className = "story-error"
    error.textContent = message
    feed.appendChild(error)
  }

  const queryDb = async (sql: string, params: unknown[] = []) => {
    if (!hostApi.queryPackDb) {
      throw new Error("Pack DB query is unavailable in this host.")
    }
    const result = (await hostApi.queryPackDb({
      sql,
      params,
      dbName: DB_NAME,
    })) as PackDbQueryResult
    return result.rows
  }

  const loadQuest = async () => {
    const rows = await queryDb(
      "SELECT id, title, description, default_language, start_scene_id, metadata_json FROM story_quest WHERE id = ?",
      [QUEST_ID]
    )
    const row = rows[0]
    if (!row) {
      throw new Error(`Quest '${QUEST_ID}' not found in pack DB.`)
    }
    quest = {
      id: toString(row.id),
      title: toString(row.title),
      description: toString(row.description),
      default_language: toString(row.default_language, "en"),
      start_scene_id: row.start_scene_id ? toString(row.start_scene_id) : null,
      metadata_json: parseJson(row.metadata_json),
    }
    return quest
  }

  const loadSceneData = async (sceneId: string): Promise<SceneData> => {
    const cached = sceneCache.get(sceneId)
    if (cached) {
      return cached
    }
    const sceneRows = await queryDb(
      "SELECT id, quest_id, title, scene_type, summary, visual_json, metadata_json FROM story_scene WHERE id = ?",
      [sceneId]
    )
    const sceneRow = sceneRows[0]
    if (!sceneRow) {
      throw new Error(`Scene '${sceneId}' not found.`)
    }

    const scene: SceneRow = {
      id: toString(sceneRow.id),
      quest_id: toString(sceneRow.quest_id),
      title: toString(sceneRow.title),
      scene_type: toString(sceneRow.scene_type),
      summary: toString(sceneRow.summary || ""),
      visual_json: parseJson(sceneRow.visual_json),
      metadata_json: parseJson(sceneRow.metadata_json),
    }

    const nodeRows = await queryDb(
      "SELECT id, scene_id, node_type, text_unit_id, action_key, order_index, metadata_json FROM story_node WHERE scene_id = ? ORDER BY order_index",
      [sceneId]
    )
    const nodes: NodeRow[] = nodeRows.map((row) => ({
      id: toString(row.id),
      scene_id: toString(row.scene_id),
      node_type: toString(row.node_type),
      text_unit_id: row.text_unit_id ? toNumber(row.text_unit_id) : null,
      action_key: toString(row.action_key || ""),
      order_index: toNumber(row.order_index),
      metadata_json: parseJson(row.metadata_json),
    }))

    const edgeRows = await queryDb(
      `
      SELECT e.id, e.from_node_id, e.to_node_id, e.to_scene_id, e.edge_type, e.label_text_unit_id, e.order_index, e.metadata_json
      FROM story_edge e
      JOIN story_node n ON n.id = e.from_node_id
      WHERE n.scene_id = ?
      ORDER BY e.order_index
    `,
      [sceneId]
    )
    const edges: EdgeRow[] = edgeRows.map((row) => ({
      id: toString(row.id),
      from_node_id: toString(row.from_node_id),
      to_node_id: row.to_node_id ? toString(row.to_node_id) : null,
      to_scene_id: row.to_scene_id ? toString(row.to_scene_id) : null,
      edge_type: row.edge_type === "choice" ? "choice" : "auto",
      label_text_unit_id: row.label_text_unit_id ? toNumber(row.label_text_unit_id) : null,
      order_index: toNumber(row.order_index),
      metadata_json: parseJson(row.metadata_json),
    }))

    const textUnitIds = new Set<number>()
    nodes.forEach((node) => {
      if (node.text_unit_id) textUnitIds.add(node.text_unit_id)
    })
    edges.forEach((edge) => {
      if (edge.label_text_unit_id) textUnitIds.add(edge.label_text_unit_id)
    })

    const idList = [...textUnitIds]
    const placeholders = idList.map(() => "?").join(",")
    const textUnitsRows =
      idList.length > 0
        ? await queryDb(
            `SELECT id, key, default_text FROM story_text_unit WHERE id IN (${placeholders})`,
            idList
          )
        : []
    const textUnits = new Map<number, TextUnitRow>()
    textUnitsRows.forEach((row) => {
      const id = toNumber(row.id)
      textUnits.set(id, {
        id,
        key: toString(row.key),
        default_text: toString(row.default_text),
      })
    })

    const translationRows =
      idList.length > 0
        ? await queryDb(
            `SELECT text_unit_id, language_code, text, romanization FROM story_text_unit_translation WHERE text_unit_id IN (${placeholders})`,
            idList
          )
        : []
    const translations = new Map<number, Map<string, TranslationRow>>()
    translationRows.forEach((row) => {
      const id = toNumber(row.text_unit_id)
      const lang = toString(row.language_code)
      const map = translations.get(id) ?? new Map<string, TranslationRow>()
      map.set(lang, {
        text_unit_id: id,
        language_code: lang,
        text: toString(row.text),
        romanization: row.romanization ? toString(row.romanization) : "",
      })
      translations.set(id, map)
    })

    const nodeById = new Map<string, NodeRow>()
    nodes.forEach((node) => nodeById.set(node.id, node))
    const edgesByFrom = new Map<string, EdgeRow[]>()
    edges.forEach((edge) => {
      const bucket = edgesByFrom.get(edge.from_node_id) ?? []
      bucket.push(edge)
      edgesByFrom.set(edge.from_node_id, bucket)
    })

    const data: SceneData = {
      scene,
      nodes,
      edges,
      nodeById,
      edgesByFrom,
      textUnits,
      translations,
    }
    sceneCache.set(sceneId, data)
    return data
  }

  const findNodeById = (nodeId: string): { data: SceneData; node: NodeRow } | null => {
    for (const data of sceneCache.values()) {
      const node = data.nodeById.get(nodeId)
      if (node) return { data, node }
    }
    return null
  }

  const resolveText = (
    data: SceneData,
    textUnitId: number,
    lang: string
  ): string => {
    const translations = data.translations.get(textUnitId)
    const translation = translations?.get(lang)
    if (translation?.text) return translation.text
    const unit = data.textUnits.get(textUnitId)
    return unit?.default_text ?? ""
  }

  const renderTextLines = (data: SceneData, textUnitId: number): HTMLElement => {
    const wrapper = document.createElement("div")
    const languages = activeLanguages.length ? activeLanguages : [quest?.default_language || "en"]
    languages.forEach((lang, index) => {
      const line = document.createElement("div")
      line.className = "story-line"
      if (index === 0) line.classList.add("is-primary")
      const label = document.createElement("div")
      label.className = "lang"
      label.textContent = lang.toUpperCase()
      const text = document.createElement("div")
      text.className = "text"
      const translation = data.translations.get(textUnitId)?.get(lang)
      text.textContent = translation?.text || data.textUnits.get(textUnitId)?.default_text || ""
      line.appendChild(label)
      line.appendChild(text)
      if (showRomanization && translation?.romanization) {
        const roman = document.createElement("div")
        roman.className = "text"
        roman.textContent = translation.romanization
        line.appendChild(roman)
      }
      wrapper.appendChild(line)
    })
    return wrapper
  }

  const updateLanguageDisplay = () => {
    nodeElements.forEach((el, nodeId) => {
      const nodeData = findNodeById(nodeId)
      if (!nodeData || !nodeData.node.text_unit_id) return
      const content = el.querySelector(".node-content")
      if (!content) return
      content.innerHTML = ""
      content.appendChild(renderTextLines(nodeData.data, nodeData.node.text_unit_id))
    })
  }

  const renderSceneBanner = (scene: SceneRow) => {
    const banner = document.createElement("div")
    banner.className = "scene-banner"
    const title = document.createElement("div")
    title.className = "scene-title"
    title.textContent = scene.title
    const summary = document.createElement("div")
    summary.className = "scene-summary"
    summary.textContent = scene.summary || ""
    banner.appendChild(title)
    banner.appendChild(summary)
    feed.appendChild(banner)
  }

  const renderNode = (data: SceneData, node: NodeRow) => {
    const card = document.createElement("article")
    card.className = "story-node"
    card.dataset.nodeId = node.id

    const tag = document.createElement("div")
    tag.className = "node-tag"
    tag.textContent = node.node_type === "action" ? "Action Beat" : "Narrative"
    card.appendChild(tag)

    const content = document.createElement("div")
    content.className = "node-content"
    if (node.text_unit_id) {
      content.appendChild(renderTextLines(data, node.text_unit_id))
    }
    if (node.node_type === "action") {
      const actionBox = document.createElement("div")
      actionBox.className = "story-action"
      const badge = document.createElement("span")
      badge.className = "action-badge"
      badge.textContent = "Action"
      actionBox.appendChild(badge)
      const hint = document.createElement("div")
      hint.className = "text"
      hint.textContent = "Tap to launch an action scene (placeholder)."
      actionBox.appendChild(hint)
      content.appendChild(actionBox)
    }
    card.appendChild(content)
    feed.appendChild(card)
    nodeElements.set(node.id, card)
    observer.observe(card)
  }

  const renderChoices = (data: SceneData, edges: EdgeRow[]) => {
    const choices = document.createElement("div")
    choices.className = "story-choices"
    const title = document.createElement("div")
    title.className = "choice-title"
    title.textContent = "Choose a direction"
    choices.appendChild(title)

    const primaryLang = activeLanguages[0] || quest?.default_language || "en"

    edges.forEach((edge) => {
      const button = document.createElement("button")
      button.className = "story-choice"
      if (edge.label_text_unit_id) {
        button.textContent = resolveText(data, edge.label_text_unit_id, primaryLang)
      } else {
        button.textContent = "Continue"
      }
      button.addEventListener("click", () => {
        choices.remove()
        void advanceFromEdge(edge)
      })
      choices.appendChild(button)
    })
    feed.appendChild(choices)
  }

  const getEntryNode = (data: SceneData): NodeRow | null => {
    return data.nodes[0] || null
  }

  const advanceFromNode = async (data: SceneData, nodeId: string) => {
    let currentId: string | null = nodeId
    while (currentId) {
      const node = data.nodeById.get(currentId)
      if (!node) return
      renderNode(data, node)

      const edges = data.edgesByFrom.get(currentId) ?? []
      const choiceEdges = edges.filter((edge) => edge.edge_type === "choice")
      if (choiceEdges.length) {
        renderChoices(data, choiceEdges)
        return
      }
      const autoEdge = edges.find((edge) => edge.edge_type === "auto")
      if (!autoEdge) return
      if (autoEdge.to_node_id) {
        currentId = autoEdge.to_node_id
        continue
      }
      if (autoEdge.to_scene_id) {
        await advanceToScene(autoEdge.to_scene_id)
        return
      }
      return
    }
  }

  const advanceFromEdge = async (edge: EdgeRow) => {
    if (edge.to_node_id) {
      const data = findNodeById(edge.to_node_id)
      if (data) {
        await advanceFromNode(data.data, edge.to_node_id)
      }
      return
    }
    if (edge.to_scene_id) {
      await advanceToScene(edge.to_scene_id)
      return
    }
    const end = document.createElement("div")
    end.className = "scene-banner"
    end.textContent = "End of the trail (for now)."
    feed.appendChild(end)
  }

  const advanceToScene = async (sceneId: string) => {
    const data = await loadSceneData(sceneId)
    applyTheme(data.scene)
    renderSceneBanner(data.scene)
    const entry = getEntryNode(data)
    if (entry) {
      await advanceFromNode(data, entry.id)
    }
  }

  const renderHeader = (quest: QuestRow) => {
    const header = document.createElement("div")
    header.className = "story-header"
    const title = document.createElement("div")
    title.className = "story-title"
    title.textContent = quest.title
    const subtitle = document.createElement("div")
    subtitle.className = "story-subtitle"
    subtitle.textContent = quest.description
    header.appendChild(title)
    header.appendChild(subtitle)
    feed.appendChild(header)
  }

  const init = async () => {
    try {
      const questRow = await loadQuest()
      renderHeader(questRow)
      const startSceneId = questRow.start_scene_id
      if (!startSceneId) {
        throw new Error("Quest is missing a start scene.")
      }
      await advanceToScene(startSceneId)
    } catch (err) {
      showError(
        err instanceof Error
          ? `${err.message} (Make sure the pack DB is installed at data/story.sqlite3.)`
          : "Failed to load story data."
      )
    }
  }

  const updateFromStack = (stack: StackConfig) => {
    activeLanguages = stack.languages.length ? [...stack.languages] : ["en"]
    showRomanization = stack.showRomanization
    updateLanguageDisplay()
  }

  updateFromStack(hostApi.getStackConfig())
  if (hostApi.onStackConfigChange) {
    unsubscribe = hostApi.onStackConfigChange(updateFromStack)
  }
  void init()

  return {
    dispose: () => {
      feed.removeEventListener("scroll", handleScroll)
      observer.disconnect()
      if (unsubscribe) unsubscribe()
      if (hostApi.stopSpeech) hostApi.stopSpeech()
    },
  }
}

registerGame()
