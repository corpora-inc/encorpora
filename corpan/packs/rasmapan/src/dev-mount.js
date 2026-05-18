/**
 * Dev-only standalone mount for browser preview (vite dev server).
 *
 * Loaded by `index.html` after `src/main.js` registers the game via
 * `window.CorpanGames.rasmapan = { id, mount }`. This module:
 *
 *   1. Loads sql.js (WebAssembly SQLite) from a CDN.
 *   2. Fetches the pack's data/arabic.sqlite3 as a Uint8Array.
 *   3. Initializes an in-memory sql.js database from those bytes.
 *   4. Constructs a mock `hostApi` that delegates `queryPackDb` to
 *      the in-memory db and provides reasonable defaults for the
 *      other surfaces (`speak` uses browser SpeechSynthesis,
 *      `searchEntriesByText` returns an empty list, etc.).
 *   5. Calls `rasmapan.mount(container, hostApi)`.
 *
 * Never included in the production build — vite library mode only
 * bundles `src/main.js` per `vite.config.js`'s `lib.entry`. The dev
 * preview UI lives entirely in this file + the existing pack code.
 */

const SQL_JS_URL = "https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/sql-wasm.js"
const SQL_JS_WASM = "https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/sql-wasm.wasm"

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve(window.initSqlJs)
    script.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(script)
  })

const ensureSqlJs = async () => {
  if (window.initSqlJs) return window.initSqlJs
  await loadScript(SQL_JS_URL)
  if (!window.initSqlJs) throw new Error("initSqlJs missing after load")
  return window.initSqlJs
}

const loadDatabase = async () => {
  const initSqlJs = await ensureSqlJs()
  const SQL = await initSqlJs({ locateFile: () => SQL_JS_WASM })
  const res = await fetch("/data/arabic.sqlite3")
  if (!res.ok) {
    throw new Error(`failed to fetch /data/arabic.sqlite3 (${res.status})`)
  }
  const buf = await res.arrayBuffer()
  return new SQL.Database(new Uint8Array(buf))
}

const buildMockHostApi = (db) => {
  const stackConfig = {
    activeStackId: "dev",
    languages: ["en", "ar"],
    domains: [],
    levels: [],
    rate: 0.9,
    textSize: "medium",
    showRomanization: true,
  }

  const speak = async (uiCode, text) => {
    if (!text) return
    if (typeof window === "undefined" || !window.speechSynthesis) {
      // eslint-disable-next-line no-console
      console.log(`[dev TTS ${uiCode}]`, text)
      return
    }
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = uiCode
    utt.rate = stackConfig.rate
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utt)
  }

  // Run a parameterized SQL statement against the in-memory db and
  // return columns + array-of-row-objects in the same shape the real
  // Tauri `queryPackDb` returns.
  const queryPackDb = async ({ sql, params = [] }) => {
    if (!sql) return { columns: [], rows: [] }
    try {
      const stmt = db.prepare(sql)
      stmt.bind(params || [])
      const rows = []
      let columns = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        rows.push(row)
        if (!columns.length) columns = Object.keys(row)
      }
      if (!columns.length) {
        try {
          columns = stmt.getColumnNames()
        } catch {
          columns = []
        }
      }
      stmt.free()
      return { columns, rows }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[dev queryPackDb] failed", { sql, params, err })
      return { columns: [], rows: [] }
    }
  }

  return {
    isMock: true,
    speak,
    getStackConfig: () => ({ ...stackConfig, languages: [...stackConfig.languages] }),
    onStackConfigChange: () => () => {},
    getRandomEntry: async () => ({
      entry_id: 1,
      level: "A1",
      domains: [],
      translations: [],
    }),
    getRandomEntries: async (count = 1) =>
      Array.from({ length: count }, (_v, i) => ({
        entry_id: i + 1,
        level: "A1",
        domains: [],
        translations: [],
      })),
    getEntryById: async () => null,
    // Mock corpus search — returns Arabic phrase fixtures so the
    // examples panel has something to display in browser preview.
    searchEntriesByText: async ({ text } = {}) => {
      const fixtures = [
        { ar: "السلام عليكم", en: "Peace be upon you" },
        { ar: "صباح الخير",   en: "Good morning" },
        { ar: "كيف حالك",     en: "How are you" },
        { ar: "أنا بخير",     en: "I am well" },
        { ar: "ما اسمك",      en: "What is your name" },
      ]
      return fixtures
        .filter((f) => !text || f.ar.includes(text))
        .map((f, i) => ({
          entry_id: 1000 + i,
          level: "A1",
          domains: [],
          translations: [
            { language_code: "ar", text: f.ar, romanization: "" },
            { language_code: "en", text: f.en, romanization: "" },
          ],
        }))
    },
    searchEntriesByTextCount: async ({ text } = {}) => (text ? 5 : 0),
    queryPackDb,
  }
}

const showStatus = (msg, isError = false) => {
  let el = document.getElementById("rasmapan-dev-status")
  if (!el) {
    el = document.createElement("div")
    el.id = "rasmapan-dev-status"
    el.style.cssText =
      "position: fixed; top: 12px; left: 12px; z-index: 9999; padding: 8px 14px; " +
      "background: rgba(245,240,232,.9); color: #3d2b1f; font-family: Georgia, serif; " +
      "font-size: 13px; border-radius: 8px; border: 1px solid rgba(107,76,42,.3); " +
      "box-shadow: 0 4px 12px rgba(61,43,31,.18);"
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.style.color = isError ? "#8b4513" : "#3d2b1f"
}

const main = async () => {
  showStatus("Loading sql.js + arabic.sqlite3 ...")
  let db
  try {
    db = await loadDatabase()
  } catch (err) {
    showStatus(`Dev mount failed: ${err.message}`, true)
    // eslint-disable-next-line no-console
    console.error("[rasmapan dev] db load failed:", err)
    return
  }
  showStatus("Mounting rasmapan ...")
  const hostApi = buildMockHostApi(db)
  const registry =
    (typeof window !== "undefined" && window.CorpanGames) || {}
  const game = registry.rasmapan
  if (!game) {
    showStatus("Rasmapan failed to register on window.CorpanGames", true)
    return
  }
  const container = document.getElementById("corpan-game-root")
  if (!container) {
    showStatus("Missing #corpan-game-root in index.html", true)
    return
  }
  // Take over the page entirely.
  container.style.position = "fixed"
  container.style.inset = "0"
  container.style.zIndex = "1"
  try {
    game.mount(container, hostApi, {
      stackConfig: hostApi.getStackConfig(),
    })
    setTimeout(() => {
      const el = document.getElementById("rasmapan-dev-status")
      if (el) el.remove()
    }, 600)
  } catch (err) {
    showStatus(`Mount failed: ${err.message}`, true)
    // eslint-disable-next-line no-console
    console.error("[rasmapan dev] mount failed:", err)
  }
}

main()
