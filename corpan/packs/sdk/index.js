const defaultStackConfig = {
  activeStackId: "mock",
  languages: ["en", "es"],
  domains: ["travel"],
  levels: ["A1"],
  rate: 0.8,
  textSize: "medium",
  showRomanization: true,
  phrasePackIds: [],
  baseCorpusEnabled: true,
  scrollNavigationEnabled: true,
};

const getRegistry = () => {
  if (typeof window === "undefined") {
    return {};
  }
  const registry = window.CorpanGames || {};
  window.CorpanGames = registry;
  return registry;
};

export const registerGame = (game) => {
  if (!game || typeof game.id !== "string") {
    throw new Error("Game must define an id");
  }
  if (typeof game.mount !== "function") {
    throw new Error("Game must define mount(container, hostApi, initialState)");
  }
  const registry = getRegistry();
  registry[game.id] = game;
  return game;
};

const speakWithBrowserTts = (uiCode, text, rate) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    console.log(`[Mock TTS ${uiCode}]`, text);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = uiCode;
  if (typeof rate === "number") {
    utterance.rate = rate;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

// Journey mock seam: lets standalone pack dev assert emissions without a host.
// Everything reported is logged AND stashed on
// `window.__corpanMockJourney = { items: [], results: [] }`.
const mockJourneyStash = () => {
  if (typeof window === "undefined") {
    return { items: [], results: [] };
  }
  const stash = window.__corpanMockJourney || { items: [], results: [] };
  window.__corpanMockJourney = stash;
  return stash;
};

const createMockJourney = (spec) => ({
  isActive: () => !!spec,
  getSpec: () => spec || null,
  reportItem: (item) => {
    console.log("[Mock journey] reportItem", item);
    mockJourneyStash().items.push(item);
  },
  reportResult: (result) => {
    console.log("[Mock journey] reportResult", result);
    mockJourneyStash().results.push(result);
  },
  abandon: (reason = "user_exit") => {
    console.log("[Mock journey] abandon", reason);
    mockJourneyStash().results.push({
      specId: spec ? spec.specId : "",
      score: 0,
      perItem: [],
      durationMs: 0,
      abandoned: true,
      __mockAbandonReason: reason,
    });
  },
});

export const createMockHostApi = (options = {}) => {
  const { stackConfig: stackOverrides, activity, ...overrides } = options;
  const stackConfig = {
    ...defaultStackConfig,
    ...(stackOverrides || {}),
  };
  const snapshot = () => ({ ...stackConfig, languages: [...stackConfig.languages] });
  const stackListeners = new Set();
  const mockHistory = { ids: [], sources: [], index: -1 };
  const historyListeners = new Set();

  return {
    isMock: true,
    journey: createMockJourney(activity),
    speak: async (uiCode, text) => {
      speakWithBrowserTts(uiCode, text, stackConfig.rate);
    },
    getStackConfig: () => snapshot(),
    onStackConfigChange: (listener) => {
      listener(snapshot());
      stackListeners.add(listener);
      return () => stackListeners.delete(listener);
    },
    setStackConfig: (patch = {}) => {
      Object.assign(stackConfig, patch);
      for (const l of stackListeners) l(snapshot());
    },
    history: {
      getState: () => ({ ids: [...mockHistory.ids], sources: [...mockHistory.sources], index: mockHistory.index }),
      push: (entryId, source = "base") => {
        mockHistory.ids.push(entryId);
        mockHistory.sources.push(source);
        mockHistory.index = mockHistory.ids.length - 1;
        for (const l of historyListeners) l();
      },
      setIndex: (index) => { mockHistory.index = index; for (const l of historyListeners) l(); },
      replaceCurrent: (entryId, source = "base") => {
        if (mockHistory.index < 0) { mockHistory.ids.push(entryId); mockHistory.sources.push(source); mockHistory.index = 0; }
        else { mockHistory.ids[mockHistory.index] = entryId; mockHistory.sources[mockHistory.index] = source; }
        for (const l of historyListeners) l();
      },
      getRecentTuples: (n) => {
        const out = [];
        for (let i = mockHistory.ids.length - 1; i >= 0 && out.length < n; i -= 1) {
          out.push({ entryId: mockHistory.ids[i], source: mockHistory.sources[i] });
        }
        return out;
      },
      subscribe: (listener) => { historyListeners.add(listener); return () => historyListeners.delete(listener); },
    },
    notifyUtterance: () => {},
    phrasePacks: {
      getInstalled: () => ({}),
      setEnabled: () => {},
      subscribe: () => () => {},
    },
    getRandomEntry: async () => ({
      entry_id: 1,
      level: "A1",
      domains: ["travel"],
      translations: [
        { language_code: "es", text: "hola", romanization: "" },
        { language_code: "en", text: "hello", romanization: "" },
      ],
    }),
    getRandomEntries: async (count = 1) => {
      const entries = [];
      for (let i = 0; i < count; i += 1) {
        entries.push({
          entry_id: 1 + i,
          level: "A1",
          domains: ["travel"],
          translations: [
            { language_code: "es", text: "hola", romanization: "" },
            { language_code: "en", text: "hello", romanization: "" },
          ],
        });
      }
      return entries;
    },
    getEntryById: async () => null,
    searchEntriesByText: async ({ text, limit = 10, offset = 0 } = {}) => {
      const sample = {
        entry_id: 42,
        level: "A1",
        domains: ["travel"],
        translations: [
          { language_code: "zh-Hans", text: text || "你好", romanization: "nǐ hǎo" },
          { language_code: "en", text: "hello", romanization: "" },
        ],
      };
      return Array.from({ length: limit }, (_v, i) => ({
        ...sample,
        entry_id: sample.entry_id + offset + i,
      }));
    },
    searchEntriesByTextCount: async ({ text } = {}) => {
      if (!text) return 0;
      return 128;
    },
    queryPackDb: async () => ({
      columns: [],
      rows: [],
    }),
    ...overrides,
  };
};

export const mountStandalone = (game, options = {}) => {
  const hostApi = options.hostApi || createMockHostApi(options);
  const container = options.container || (() => {
    const node = document.createElement("div");
    node.style.position = "fixed";
    node.style.inset = "0";
    node.style.zIndex = "9999";
    document.body.appendChild(node);
    return node;
  })();

  const instance = game.mount(container, hostApi, {
    stackConfig: hostApi.getStackConfig(),
    // Simulated Journey launch (dev): mirrors the host's initialState spread.
    ...(options.activity ? { activity: options.activity } : {}),
    ...(options.initialState || {}),
  });

  return {
    unmount: () => {
      if (instance && typeof instance.unmount === "function") {
        instance.unmount();
      }
      if (!options.container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
};
