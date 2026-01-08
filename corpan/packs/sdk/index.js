const defaultStackConfig = {
  activeStackId: "mock",
  languages: ["en", "es"],
  domains: ["travel"],
  levels: ["A1"],
  rate: 0.8,
  textSize: "medium",
  showRomanization: true,
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

export const createMockHostApi = (options = {}) => {
  const { stackConfig: stackOverrides, ...overrides } = options;
  const stackConfig = {
    ...defaultStackConfig,
    ...(stackOverrides || {}),
  };

  return {
    isMock: true,
    speak: async (uiCode, text) => {
      speakWithBrowserTts(uiCode, text, stackConfig.rate);
    },
    getStackConfig: () => ({ ...stackConfig, languages: [...stackConfig.languages] }),
    onStackConfigChange: (listener) => {
      listener({ ...stackConfig, languages: [...stackConfig.languages] });
      return () => {};
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
