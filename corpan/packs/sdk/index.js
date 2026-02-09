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

const matchesLanguagePrefix = (voiceLang, languagePrefix) => {
  if (!languagePrefix) return true
  if (!voiceLang) return false
  const lang = String(voiceLang).toLowerCase()
  const want = String(languagePrefix).toLowerCase()
  return lang === want || lang.startsWith(`${want}-`)
}

const speakWithBrowserTts = (uiCode, text, rate, voiceId) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    console.log(`[Mock TTS ${uiCode}]`, text);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  if (voiceId && voices.length > 0) {
    const chosen = voices.find((voice) =>
      voice.voiceURI === voiceId || voice.name === voiceId
    )
    if (chosen) {
      utterance.voice = chosen
      utterance.lang = chosen.lang || uiCode
    } else {
      utterance.lang = uiCode
    }
  } else {
    utterance.lang = uiCode
  }
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
  const mockVoices = [
    {
      id: "mock-es-female-sofia",
      name: "Sofia",
      language: "es-ES",
      gender: "female",
      quality: "high",
      engine: "mock",
      networkRequired: false,
    },
    {
      id: "mock-es-female-valentina",
      name: "Valentina",
      language: "es-MX",
      gender: "female",
      quality: "normal",
      engine: "mock",
      networkRequired: false,
    },
    {
      id: "mock-es-male-diego",
      name: "Diego",
      language: "es-ES",
      gender: "male",
      quality: "normal",
      engine: "mock",
      networkRequired: false,
    },
  ]

  return {
    isMock: true,
    speak: async (uiCode, text) => {
      speakWithBrowserTts(uiCode, text, stackConfig.rate);
    },
    speakConcurrent: async (uiCode, text) => {
      speakWithBrowserTts(uiCode, text, stackConfig.rate)
      return `mock-concurrent-${Date.now()}`
    },
    speakWithVoice: async (uiCode, text, options = {}) => {
      speakWithBrowserTts(uiCode, text, options.rate ?? stackConfig.rate, options.voiceId)
    },
    speakConcurrentWithVoice: async (uiCode, text, options = {}) => {
      speakWithBrowserTts(uiCode, text, options.rate ?? stackConfig.rate, options.voiceId)
      return `mock-concurrent-voice-${Date.now()}`
    },
    listTtsVoices: async (query = {}) => {
      let filtered = [...mockVoices]
      if (query.languagePrefix) {
        filtered = filtered.filter((voice) =>
          matchesLanguagePrefix(voice.language, query.languagePrefix)
        )
      }
      if (query.femaleOnly) {
        filtered = filtered.filter((voice) => voice.gender === "female")
      } else if (query.gender) {
        filtered = filtered.filter((voice) => voice.gender === query.gender)
      }
      return filtered
    },
    stopSpeech: async () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
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
    resolvePackAssetPath: async (relativePath) => `/mock-pack/${relativePath}`,
    getPackLlmConfig: async () => ({
      runtime: "mock-local",
      defaultModel: "mock-q4",
      models: [
        {
          id: "mock-q4",
          name: "Mock Q4",
          relativePath: "model/mock-q4.gguf",
          absolutePath: "/mock-pack/model/mock-q4.gguf",
          exists: true,
          recommended: true,
          sizeBytes: 123456789,
          quantType: "Q4_K_M",
        },
      ],
      defaults: {
        temperature: 0.7,
        topP: 0.9,
        repeatPenalty: 1.1,
        maxTokens: 120,
      },
    }),
    getLocalLlmRuntimeStatus: async () => ({
      backend: "mock-local",
      commandPath: "mock",
      available: true,
      detail: "mock runtime",
    }),
    startLocalLlmStream: async (request, callbacks = {}) => {
      const requestId = `mock-${Date.now()}`
      const tokens = [`You said: ${request.messages.at(-1)?.content ?? ""}`]
      let done = false
      const timer = setInterval(() => {
        if (done) {
          return
        }
        const next = tokens.shift()
        if (!next) {
          done = true
          clearInterval(timer)
          callbacks.onDone?.(`You said: ${request.messages.at(-1)?.content ?? ""}`)
          return
        }
        callbacks.onDelta?.(next, next)
      }, 60)
      return {
        requestId,
        cancel: async () => {
          clearInterval(timer)
          if (!done) {
            done = true
            callbacks.onCancelled?.("")
          }
          return true
        },
      }
    },
    cancelLocalLlmStream: async () => true,
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
