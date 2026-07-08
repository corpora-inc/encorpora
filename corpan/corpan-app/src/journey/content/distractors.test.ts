// Distractor sampler tests — validity property tests, determinism,
// shortfall, elimination order, per-renderer needs table
// (content-resolver.md §4, §6).

import { test } from "node:test"
import assert from "node:assert/strict"

import type { ItemRef } from "../../contentPacks/activityContract.ts"
import { tokenizePhrase } from "../../util/wordTokens.ts"
import {
  buildDistractorRequest,
  distractorNeed,
  sampleDistractors,
  seededShuffle,
  type DistractorRequest,
} from "./distractors.ts"
import { normalizeAnswer } from "./normalize.ts"
import { createResolver, type ResolvedItem, type Resolver } from "./resolve.ts"
import { FIXTURE_CTX, FixtureDeps, topUpEntries } from "./__fixtures__/index.ts"

const CTX = FIXTURE_CTX

function fresh(deps = new FixtureDeps()) {
  return { deps, resolver: createResolver(deps, CTX) }
}

async function resolveOne(resolver: Resolver, ref: ItemRef): Promise<ResolvedItem> {
  const { resolved } = await resolver.resolveItems([ref])
  assert.ok(resolved[0], `fixture ref must resolve: ${JSON.stringify(ref)}`)
  return resolved[0]
}

const PHRASE_IDS = [101, 103, 104, 105, 106, 108, 109, 111, 112, 113, 114, 116, 117]

function wordsOf(text: string, lang: string): string[] {
  return tokenizePhrase(text, lang)
    .filter((t) => t.isWord)
    .map((t) => t.text)
}

// ------------------------------------------------ §6 property tests (1,000)

test("distractor validity properties hold over 1,000 seeded cases", async () => {
  const { deps, resolver } = fresh()
  const allKeys = PHRASE_IDS.map((id) => `phrase:base:${id}`)

  for (let i = 0; i < 1000; i++) {
    const answerId = PHRASE_IDS[i % PHRASE_IDS.length]
    const answer = await resolveOne(resolver, {
      kind: "phrase",
      source: "base",
      id: String(answerId),
    })
    const mode: "item" | "token" = i % 3 === 2 ? "token" : "item"
    const answerLang = mode === "item" && i % 2 === 1 ? "es" : "en"
    const face = answerLang === "es" ? answer.native : answer.target
    if (!face) continue
    const recentKeys = new Set<string>(
      [allKeys[i % allKeys.length], allKeys[(i + 3) % allKeys.length]].filter(
        (k) => k !== answer.key,
      ),
    )
    const answerTokens = mode === "token" ? wordsOf(face.text, answerLang) : undefined
    const req: DistractorRequest = {
      cardId: `prop-card-${i}`,
      answer,
      answerLang,
      promptLang: i % 2 === 0 ? (answerLang === "en" ? "es" : "en") : undefined,
      count: 3,
      targetB: -1 + (i % 20) * 0.1,
      pool: i % 2 === 0 ? "sameSkill" : "nearTheta",
      recentKeys,
      answerTokens,
      blankIndex: mode === "token" ? i % 4 : undefined,
      mode,
    }
    const set = await sampleDistractors(req, resolver, deps, CTX)

    // distractors.length + shortfall === count
    assert.equal(set.distractors.length + set.shortfall, req.count)
    // eliminationOrder is a permutation of the distractor indexes
    assert.deepEqual(
      [...set.eliminationOrder].sort((a, b) => a - b),
      set.distractors.map((_, j) => j),
    )

    const seenKeys = new Set<string>()
    const seenNorms = new Set<string>()
    const answerNorm = normalizeAnswer(face.text, answerLang)
    const tokenNorms = new Set((answerTokens ?? []).map((t) => normalizeAnswer(t, answerLang)))

    for (const d of set.distractors) {
      const norm = normalizeAnswer(d.text, answerLang)
      // never normalized-equal the correct answer
      assert.notEqual(norm, answerNorm, `case ${i}: collision "${d.text}"`)
      // token distractors never equal ANY answer token
      if (d.mode === "token") {
        assert.ok(!tokenNorms.has(norm), `case ${i}: token "${d.text}" in answerTokens`)
      }
      // no duplicate key or normalized text within a set
      assert.ok(!seenNorms.has(norm), `case ${i}: dup norm "${norm}"`)
      seenNorms.add(norm)
      const key = d.mode === "item" ? d.item.key : d.fromKey
      assert.ok(!seenKeys.has(key), `case ${i}: dup key ${key}`)
      seenKeys.add(key)
      // no key from the recent window
      assert.ok(!recentKeys.has(key), `case ${i}: recent key ${key}`)
      // distractor language = answer language (structural: the source row
      // had that language face, and item-mode text IS that face)
      if (d.mode === "item") {
        const dFace = answerLang === "es" ? d.item.native : d.item.target
        assert.ok(dFace, `case ${i}: no ${answerLang} face`)
        assert.equal(d.text, dFace.text)
        // same-translation collision must not survive when promptLang set
        if (req.promptLang) {
          const promptFace = req.promptLang === "es" ? d.item.native : d.item.target
          const answerPromptFace = req.promptLang === "es" ? answer.native : answer.target
          if (promptFace && answerPromptFace) {
            assert.notEqual(
              normalizeAnswer(promptFace.text, req.promptLang),
              normalizeAnswer(answerPromptFace.text, req.promptLang),
              `case ${i}: same-translation collision "${promptFace.text}"`,
            )
          }
        }
      }
    }
  }
})

test("known hazards are rejected: case, diacritic, and same-translation twins", async () => {
  const { deps, resolver } = fresh()
  // Answer 101 "Hello"/"hola". 103 "hello" (case twin, en) and 102
  // "Good morning"→"hola" (same-translation via es) must never appear
  // among en-surfaced distractors with promptLang es.
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "101" })
  for (let i = 0; i < 50; i++) {
    const set = await sampleDistractors(
      {
        cardId: `hazard-${i}`,
        answer,
        answerLang: "en",
        promptLang: "es",
        count: 3,
        targetB: 0,
        pool: "sameSkill",
        recentKeys: new Set(),
        mode: "item",
      },
      resolver,
      deps,
      CTX,
    )
    for (const d of set.distractors) {
      assert.ok(d.mode === "item")
      assert.notEqual(normalizeAnswer(d.text, "en"), "hello")
      assert.notEqual(d.item.key, "phrase:base:103") // case twin
      assert.notEqual(d.item.key, "phrase:base:102") // es "hola" twin
    }
  }
  // Diacritic twin: answer 109 "adiós" (es-surfaced) must never draw 110 "adios".
  const adios = await resolveOne(resolver, { kind: "phrase", source: "base", id: "109" })
  for (let i = 0; i < 50; i++) {
    const set = await sampleDistractors(
      {
        cardId: `hazard-dia-${i}`,
        answer: adios,
        answerLang: "es",
        count: 3,
        targetB: 0,
        pool: "sameSkill",
        recentKeys: new Set(),
        mode: "item",
      },
      resolver,
      deps,
      CTX,
    )
    for (const d of set.distractors) {
      assert.ok(d.mode === "item")
      assert.notEqual(d.item.key, "phrase:base:110")
      assert.notEqual(normalizeAnswer(d.text, "es"), "adios")
    }
  }
})

// -------------------------------------------------------------- determinism

test("same (cardId, recentKeys) ⇒ byte-identical DistractorSet across fresh instances", async () => {
  const make = async () => {
    const { deps, resolver } = fresh()
    const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "104" })
    return sampleDistractors(
      {
        cardId: "det-card-7",
        answer,
        answerLang: "en",
        promptLang: "es",
        count: 3,
        targetB: -0.2,
        pool: "sameSkill",
        recentKeys: new Set(["phrase:base:106"]),
        mode: "item",
      },
      resolver,
      deps,
      CTX,
    )
  }
  const a = await make()
  const b = await make()
  assert.equal(JSON.stringify(a), JSON.stringify(b))
  assert.ok(a.distractors.length > 0)
})

test("100 distinct cardIds ⇒ ≥95 distinct sets (sanity, not a guarantee)", async () => {
  const { deps, resolver } = fresh()
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "104" })
  const seen = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const set = await sampleDistractors(
      {
        cardId: `variety-${i}`,
        answer,
        answerLang: "en",
        count: 3,
        targetB: 0,
        pool: "sameSkill",
        recentKeys: new Set(),
        mode: "item",
      },
      resolver,
      deps,
      CTX,
    )
    seen.add(JSON.stringify(set.distractors.map((d) => d.text)))
  }
  assert.ok(seen.size >= 95, `only ${seen.size} distinct sets`)
})

test("seededShuffle: stable across runs, does not mutate input", () => {
  const xs = ["a", "b", "c", "d", "e", "f"]
  const once = seededShuffle("pairs-card-1", xs)
  const twice = seededShuffle("pairs-card-1", xs)
  assert.deepEqual(once, twice)
  assert.deepEqual(xs, ["a", "b", "c", "d", "e", "f"])
  assert.deepEqual([...once].sort(), xs)
  const other = seededShuffle("pairs-card-2", xs)
  assert.notDeepEqual(once, other)
})

// ------------------------------------------------- shortfall + rung ladder

test("starved pool: char answer has no same-kind candidates ⇒ full shortfall", async () => {
  const { deps, resolver } = fresh()
  const answer = await resolveOne(resolver, { kind: "char", source: "hanzipan", id: "愛" })
  const set = await sampleDistractors(
    {
      cardId: "starved-1",
      answer,
      answerLang: "en",
      count: 3,
      targetB: 0,
      pool: "sameSkill",
      recentKeys: new Set(),
      mode: "item",
    },
    resolver,
    deps,
    CTX,
  )
  assert.equal(set.distractors.length, 0)
  assert.equal(set.shortfall, 3)
  assert.deepEqual(set.eliminationOrder, [])
})

test("rung 2 ladders across skills when the same-skill pool runs dry", async () => {
  const { deps, resolver } = fresh()
  // Numbers skill has 5 phrases; excluding the answer leaves 4 — ask for 6
  // so rung 2 (course-wide near-b) must contribute.
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "111" })
  const set = await sampleDistractors(
    {
      cardId: "ladder-1",
      answer,
      answerLang: "en",
      count: 6,
      targetB: 0,
      pool: "sameSkill",
      recentKeys: new Set(),
      mode: "item",
    },
    resolver,
    deps,
    CTX,
  )
  assert.equal(set.shortfall, 0)
  assert.equal(set.distractors.length, 6)
})

test("rung 3 top-up: exhausted phrase pool falls back to random entries + log", async () => {
  const deps = new FixtureDeps({ randomEntries: topUpEntries() })
  const resolver = createResolver(deps, CTX)
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "101" })
  // Exclude EVERY course phrase via the recent window — pathological starvation.
  const recentKeys = new Set<string>(
    [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118]
      .map((id) => `phrase:base:${id}`)
      .concat(["phrase:phrase-people-basics:201", "phrase:phrase-people-basics:202"]),
  )
  const set = await sampleDistractors(
    {
      cardId: "topup-1",
      answer,
      answerLang: "en",
      count: 3,
      targetB: 0,
      pool: "sameSkill",
      recentKeys,
      mode: "item",
    },
    resolver,
    deps,
    CTX,
  )
  assert.equal(set.distractors.length, 3)
  assert.deepEqual(
    set.distractors.map((d) => d.text).sort(),
    ["A red door", "The cat sleeps", "We walk home"],
  )
  assert.ok(deps.events.some((e) => e.event === "journey_distractor_topup"))
  // Rung-3 entries have no difficulty_b ⇒ they rank worst-fit (all tied here).
  assert.equal(set.eliminationOrder.length, 3)
})

test("shortfall > 0 only on genuine exhaustion (greetings pool fills count 3)", async () => {
  const { deps, resolver } = fresh()
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "105" })
  const set = await sampleDistractors(
    {
      cardId: "full-1",
      answer,
      answerLang: "en",
      count: 3,
      targetB: 0,
      pool: "sameSkill",
      recentKeys: new Set(),
      mode: "item",
    },
    resolver,
    deps,
    CTX,
  )
  assert.equal(set.shortfall, 0)
})

// ----------------------------------------------------------- token mode

test("token mode: bank tokens come from candidate faces, never the sentence", async () => {
  const { deps, resolver } = fresh()
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "114" })
  const answerTokens = wordsOf(answer.target.text, "en") // I have four books
  const set = await sampleDistractors(
    {
      cardId: "token-1",
      answer,
      answerLang: "en",
      count: 3,
      targetB: 0,
      pool: "nearTheta",
      recentKeys: new Set(),
      answerTokens,
      blankIndex: 2, // "four"
      mode: "token",
    },
    resolver,
    deps,
    CTX,
  )
  const tokenNorms = new Set(answerTokens.map((t) => normalizeAnswer(t, "en")))
  for (const d of set.distractors) {
    assert.equal(d.mode, "token")
    assert.ok(!tokenNorms.has(normalizeAnswer(d.text, "en")))
    assert.ok(d.text.length > 0)
  }
  // Deterministic too.
  const again = await sampleDistractors(
    {
      cardId: "token-1",
      answer,
      answerLang: "en",
      count: 3,
      targetB: 0,
      pool: "nearTheta",
      recentKeys: new Set(),
      answerTokens,
      blankIndex: 2,
      mode: "token",
    },
    createResolver(new FixtureDeps(), CTX),
    new FixtureDeps(),
    CTX,
  )
  assert.equal(JSON.stringify(set), JSON.stringify(again))
})

test("token mode: never emits the same normalized text twice (no dup tiles)", async () => {
  // A word_order / cloze-bank board must never show two identical distractor
  // tiles (issue #1, token angle). The sampler dedups by normalized surface
  // across the whole set — assert it over many seeds and blank positions.
  const { deps, resolver } = fresh()
  for (let i = 0; i < 200; i++) {
    const answer = await resolveOne(resolver, {
      kind: "phrase",
      source: "base",
      id: String(PHRASE_IDS[i % PHRASE_IDS.length]),
    })
    const answerTokens = wordsOf(answer.target.text, "en")
    const set = await sampleDistractors(
      {
        cardId: `tok-dedup-${i}`,
        answer,
        answerLang: "en",
        count: 4,
        targetB: 0,
        pool: i % 2 === 0 ? "sameSkill" : "nearTheta",
        recentKeys: new Set(),
        answerTokens,
        blankIndex: i % 3,
        mode: "token",
      },
      resolver,
      deps,
      CTX,
    )
    const norms = set.distractors.map((d) => normalizeAnswer(d.text, "en"))
    assert.equal(new Set(norms).size, norms.length, `case ${i}: dup token ${norms.join(",")}`)
  }
})

// ------------------------------------------------------ elimination order

test("eliminationOrder is worst-fit first (descending |b − targetB|)", async () => {
  const { deps, resolver } = fresh()
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "105" })
  const targetB = -0.9
  const set = await sampleDistractors(
    {
      cardId: "elim-1",
      answer,
      answerLang: "en",
      count: 3,
      targetB,
      pool: "sameSkill",
      recentKeys: new Set(),
      mode: "item",
    },
    resolver,
    deps,
    CTX,
  )
  assert.equal(set.distractors.length, 3)
  // Recover each distractor's b from the fixture rule (b = -1 + (id%10)*0.12).
  const bOf = (key: string) => -1 + (Number(key.split(":")[2]) % 10) * 0.12
  const dists = set.eliminationOrder.map((idx) => {
    const d = set.distractors[idx]
    assert.ok(d.mode === "item")
    return Math.abs(bOf(d.item.key) - targetB)
  })
  for (let i = 1; i < dists.length; i++) {
    assert.ok(dists[i - 1] >= dists[i] - 1e-9, `not descending: ${dists.join(",")}`)
  }
})

// ------------------------------------- §4.7 needs table / param builders

test("distractorNeed implements the §4.7 table", () => {
  assert.deepEqual(distractorNeed("choice_pick", { choices: 3 }), {
    mode: "item",
    count: 2,
    answerLang: "target",
    promptLang: "native",
  })
  assert.deepEqual(distractorNeed("choice_pick", { choices: 4, direction: "toNative" }), {
    mode: "item",
    count: 3,
    answerLang: "native",
    promptLang: "target",
  })
  assert.deepEqual(distractorNeed("listen_pick", { choices: 4 }), {
    mode: "item",
    count: 3,
    answerLang: "target",
    promptLang: "target",
  })
  assert.equal(distractorNeed("listen_type"), null)
  assert.deepEqual(distractorNeed("cloze", { mode: "bank", bankSize: 4 }), {
    mode: "token",
    count: 3,
    answerLang: "target",
    promptLang: "target",
  })
  assert.equal(distractorNeed("cloze", { mode: "type" }), null)
  assert.deepEqual(distractorNeed("word_order", { distractorTiles: 2 }), {
    mode: "token",
    count: 2,
    answerLang: "target",
    promptLang: "target",
  })
  assert.equal(distractorNeed("word_order", { distractorTiles: 0 }), null)
  assert.equal(distractorNeed("word_order"), null)
  assert.equal(distractorNeed("match_pairs"), null) // seededShuffle only
  assert.equal(distractorNeed("flip_recall"), null)
  assert.equal(distractorNeed("speak_echo"), null)
  assert.equal(distractorNeed("intro_echo"), null)
  // grammar_note inherits its embedded drill's row
  assert.deepEqual(
    distractorNeed("grammar_note", {
      drill: { activityType: "cloze", params: { mode: "bank", bankSize: 5 } },
    }),
    { mode: "token", count: 4, answerLang: "target", promptLang: "target" },
  )
  assert.equal(distractorNeed("grammar_note"), null)
  assert.equal(distractorNeed("grammar_note", { drill: { activityType: "choice_pick" } }), null)
})

test("buildDistractorRequest maps context languages and drops impossible asks", async () => {
  const { resolver } = fresh()
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "101" })
  const req = buildDistractorRequest({
    activityType: "choice_pick",
    cardId: "b-1",
    answer,
    ctx: CTX,
    targetB: 0.3,
    recentKeys: new Set(),
    params: { choices: 4, direction: "toNative", distractors: "nearTheta" },
  })
  assert.ok(req)
  assert.equal(req.answerLang, "es")
  assert.equal(req.promptLang, "en")
  assert.equal(req.count, 3)
  assert.equal(req.pool, "nearTheta")
  assert.equal(req.mode, "item")
  // toNative on a single-language stack is not mintable ⇒ null.
  const singleLang = buildDistractorRequest({
    activityType: "choice_pick",
    cardId: "b-2",
    answer,
    ctx: { courseId: "journey_en", targetLang: "en" },
    targetB: 0,
    recentKeys: new Set(),
    params: { direction: "toNative" },
  })
  assert.equal(singleLang, null)
  // Renderers that need nothing get null, not a zero-count request.
  const none = buildDistractorRequest({
    activityType: "flip_recall",
    cardId: "b-3",
    answer,
    ctx: CTX,
    targetB: 0,
    recentKeys: new Set(),
  })
  assert.equal(none, null)
})

// ------------------------------------------------ word-gloss distractors

test("toNative word card: distractors are other words' es glosses", async () => {
  const { deps, resolver } = fresh()
  // coffee (SKILL_NUM) toNative — answerLang es, prompt the target word.
  const answer = await resolveOne(resolver, { kind: "word", source: "en", id: "coffee" })
  assert.equal(answer.native?.text, "el café")
  const req = buildDistractorRequest({
    activityType: "choice_pick",
    cardId: "wg-1",
    answer,
    ctx: CTX,
    targetB: -0.55,
    recentKeys: new Set(),
    params: { choices: 3, direction: "toNative" },
  })
  assert.ok(req)
  assert.equal(req.answerLang, "es")
  const set = await sampleDistractors(req, resolver, deps, CTX)
  // Same-skill pool has tea + milk (both glossed) — fills count 2.
  assert.equal(set.shortfall, 0)
  assert.equal(set.distractors.length, 2)
  for (const d of set.distractors) {
    assert.ok(d.mode === "item")
    // Distractor SURFACES in the answer language (es) and IS the gloss face.
    assert.equal(d.text, d.item.native?.text)
    // Never the answer's own gloss (even under a different key like "cafe").
    assert.notEqual(normalizeAnswer(d.text, "es"), normalizeAnswer("el café", "es"))
    // A gloss-less word (friend, no es) can never be a same-language distractor.
    assert.notEqual(d.item.key, "word:en:friend")
    // The gloss TWIN "cafe" (also "el café") is rejected as a collision.
    assert.notEqual(d.item.key, "word:en:cafe")
  }
  const texts = set.distractors.map((d) => d.text).sort()
  assert.deepEqual(texts, ["el té", "la leche"])
})

test("toNative word card: deterministic across fresh resolvers", async () => {
  const make = async () => {
    const { deps, resolver } = fresh()
    const answer = await resolveOne(resolver, { kind: "word", source: "en", id: "coffee" })
    return sampleDistractors(
      {
        cardId: "wg-det",
        answer,
        answerLang: "es",
        promptLang: "en",
        count: 2,
        targetB: -0.55,
        pool: "sameSkill",
        recentKeys: new Set(),
        mode: "item",
      },
      resolver,
      deps,
      CTX,
    )
  }
  assert.equal(JSON.stringify(await make()), JSON.stringify(await make()))
})

// ------------------------------------------------------------ resilience

test("a broken course pack yields a shortfall, never a throw", async () => {
  const deps = new FixtureDeps()
  const resolver = createResolver(deps, CTX)
  const answer = await resolveOne(resolver, { kind: "phrase", source: "base", id: "101" })
  deps.corruptPacks.add("journey_en")
  const set = await sampleDistractors(
    {
      cardId: "broken-1",
      answer,
      answerLang: "en",
      count: 3,
      targetB: 0,
      pool: "sameSkill",
      recentKeys: new Set(),
      mode: "item",
    },
    resolver,
    deps,
    CTX,
  )
  assert.equal(set.shortfall, 3)
  assert.ok(deps.events.some((e) => e.event === "journey_distractor_pool_error"))
})
