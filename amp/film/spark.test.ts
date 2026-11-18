import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lessonFilmSchema } from "../src/content/lesson-films";
import { defaultVoice, NARRATOR_ID, resolveCast, spokenText, takeKeyParts } from "./cast";
import { alignmentOf, numberWords, sparkHear, sparkRecipe, sparkSeed, sparkTake, speakable } from "./spark";
import { scriptSchema } from "./schema";
import { goodTake, judge, takeKey, wordsOf } from "./voice";
import { providerOf, VOICES } from "./voices";

const script = scriptSchema.parse(JSON.parse(readFileSync("film/lessons/list-all-pairs--sl.json", "utf8")));
const ROWAN = { id: "house-rowan", spark: { model: "chatterbox-v3", voice: "rowan" } };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("routing", () => {
  it("leaves every ElevenLabs default as it was", () => {
    const cast = resolveCast(script);
    expect(cast.roles.map((role) => role.voice?.id)).toEqual([defaultVoice("teacher", script.id), "SYXbTJsLE7zmSjr1DchT"]);
    expect(cast.roles.every((role) => !role.voice?.spark)).toBe(true);
    expect(resolveCast({ id: "x", shots: [] }).roles[0]!.voice?.id).toBe(NARRATOR_ID);
    expect(VOICES.filter((voice) => providerOf(voice) === "elevenlabs").map((voice) => voice.short)).toEqual(["madeline", "paul", "champ"]);
  });

  it("sends house voices to the Spark by name or by provider", () => {
    const named = resolveCast(script, { teacher: "rowan", learner: "pip" });
    expect(named.roles.map((role) => [role.role, role.name, role.voice])).toEqual([
      ["teacher", "Rowan", ROWAN],
      ["learner", "Pip", { id: "house-pip", spark: { model: "chatterbox-v3", voice: "pip" } }],
    ]);
    const local = resolveCast(script, {}, undefined, "spark");
    expect(local.roles.every((role) => role.voice?.spark)).toBe(true);
    expect(["house-ellis", "house-hazel"]).toContain(local.roles[0]!.voice!.id);
    expect(local.roles[1]!.voice!.id).toBe("house-remy");
    expect(resolveCast({ id: "x", shots: [] }, {}, undefined, "spark").roles[0]!.voice!.id).toBe("house-ellis");
    expect(() => resolveCast(script, { learner: "rowan" })).toThrow(/not approved for the learner role/);
  });

  it("keeps retired house voices playable but never picks them", () => {
    for (const short of ["rowan", "wren", "pip"]) expect(VOICES.find((v) => v.short === short)?.retired).toBe(true);
    const old = resolveCast(script, { teacher: "house-rowan", learner: "house-pip" });
    expect(old.roles.map((role) => role.name)).toEqual(["Rowan", "Pip"]);
    for (let i = 0; i < 20; i++)
      expect(resolveCast({ ...script, id: `film-${i}` }, {}, undefined, "spark").roles.every((role) => !["house-rowan", "house-wren", "house-pip"].includes(role.voice!.id))).toBe(true);
  });

  it("records house voices by id, so playback and export resolve the same edition", () => {
    const cast = resolveCast(script, { teacher: "rowan", learner: "pip" });
    expect(resolveCast(script, { teacher: "house-rowan", learner: "house-pip" })).toEqual(cast);
  });

  it("lets every approved teacher voice name a published film", () => {
    for (const voice of VOICES.filter((v) => v.kinds.includes("teacher")))
      expect(lessonFilmSchema.shape.teacher.safeParse(voice.name).success).toBe(true);
  });
});

describe("cache key", () => {
  it("keeps ElevenLabs keys and gives house takes their own, by provider, model and voice", () => {
    expect(takeKeyParts({ id: NARRATOR_ID }, "Two rows.")).toEqual([NARRATOR_ID, "eleven_v4", "Two rows."]);
    expect(takeKeyParts(ROWAN, "Two rows.")).toEqual(["spark", "chatterbox-v3", "house-rowan", "Two rows."]);
    const other = { ...ROWAN, spark: { ...ROWAN.spark, model: "chatterbox-turbo" } };
    expect(new Set([takeKey({ id: NARRATOR_ID }, "x"), takeKey(ROWAN, "x"), takeKey(other, "x"), takeKey(ROWAN, "y")]).size).toBe(4);
    // the service's processing and candidate count are part of a house take: the takes of the first service are never reused
    const first = createHash("sha256").update(JSON.stringify(["spark", "chatterbox-v3", "house-rowan", "x"])).digest("hex").slice(0, 24);
    expect(takeKey(ROWAN, "x")).not.toBe(first);
    expect(takeKey(ROWAN, "x")).toBe(takeKey({ ...ROWAN, spark: { ...ROWAN.spark, recipe: sparkRecipe(3) } }, "x"));
    expect(takeKey(ROWAN, "x")).not.toBe(takeKey({ ...ROWAN, spark: { ...ROWAN.spark, recipe: sparkRecipe(1) } }, "x"));
    expect([0, 1, 2].map(sparkSeed)).toEqual([1000, 1001, 1002]);
  });
});

describe("what the voice is asked to say", () => {
  it("spells numbers and symbols as words and keeps the phrasing", () => {
    expect(numberWords(48)).toBe("forty-eight");
    expect(numberWords(2024)).toBe("two thousand twenty-four");
    expect(speakable("3 × 4 = 12.").text).toBe("three times four equals twelve.");
    expect(speakable("Is 54 a multiple of 6?").text).toBe("Is fifty-four a multiple of six?");
    expect(speakable("$3.50, 2.05 and 1/2 or 3/7; 25% at 90°").text)
      .toBe("three dollars and fifty cents, two point zero five and one half or three sevenths; twenty-five percent at ninety degrees");
    expect(speakable("1,200 tiles, the 3rd row").text).toBe("one thousand two hundred tiles, the third row");
  });

  it("knows which spoken words belong to each written word", () => {
    const s = speakable("Forty-eight is 6 × 8 — the end.");
    expect(s.written).toEqual(["Forty-eight", "is", "6", "×", "8", "—", "the", "end."]);
    expect(s.spoken).toEqual([["forty", "eight"], ["is"], ["six"], ["times"], ["eight"], [], ["the"], ["end"]]);
  });
});

describe("alignment parsing", () => {
  it("turns spoken-word times into the written text's character alignment", () => {
    const s = speakable("Forty-eight is 6 × 8 — the end.");
    const times = [[0.1, 0.3], [0.3, 0.5], [0.6, 0.7], [0.8, 1.0], [1.1, 1.3], [1.4, 1.6], [1.8, 1.9], [2.0, 2.3]].map(([start, end]) => ({ start: start!, end: end! }));
    const a = alignmentOf(s.written, s.spoken, times);
    expect(a.characters.join("")).toBe("Forty-eight is 6 × 8 — the end.");
    const words = wordsOf(a);
    expect(words.map((w) => [w.text, +w.start.toFixed(2), +w.end.toFixed(2)])).toEqual([
      ["Forty-eight", 0.1, 0.5], ["is", 0.6, 0.7], ["6", 0.8, 1], ["×", 1.1, 1.3], ["8", 1.4, 1.6], ["—", 1.6, 1.6], ["the", 1.8, 1.9], ["end.", 2, 2.3],
    ]);
    expect(() => alignmentOf(s.written, s.spoken, times.slice(1))).toThrow(/timed 7 words for 8/);
  });

  it("asks the service with the seed of the try and reads its reply", async () => {
    vi.stubEnv("FILM_SPARK_VOICE_URL", "http://spark.test:18093/");
    const sent: any[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      const words = JSON.parse(String(init.body)).words.map((w: string, i: number) => ({ word: w, start: 0.2 + i * 0.3, end: 0.4 + i * 0.3 }));
      return new Response(JSON.stringify({ sample_rate: 44100, pcm: Buffer.from(new Int16Array(4410).buffer).toString("base64"), words }));
    }) as unknown as typeof fetch;
    const take = await sparkTake(ROWAN, spokenText(ROWAN, "Two rows: 12."), 2, fetcher);
    expect(sent).toEqual([{ url: "http://spark.test:18093/tts", body: {
      model: "chatterbox-v3", voice: "rowan", text: "Two rows: twelve.", words: ["two", "rows", "twelve"], seed: 1002, stage: 2, n: 3, align: true,
    } }]);
    expect(take.seed).toBe(1002);
    expect(wordsOf(take.alignment).map((w) => w.text)).toEqual(["Two", "rows:", "12."]);
  });

  it("waits while the Spark is busy and reports any other failure", async () => {
    vi.stubEnv("FILM_SPARK_VOICE_URL", "http://spark.test:18093");
    const fail = (async () => new Response("bad voice", { status: 400 })) as unknown as typeof fetch;
    await expect(sparkTake(ROWAN, "Hi.", 0, fail)).rejects.toThrow(/Spark voice 400: bad voice/);
    vi.stubEnv("FILM_SPARK_VOICE_URL", "");
    await expect(sparkTake(ROWAN, "Hi.", 0, fail)).rejects.toThrow(/FILM_SPARK_VOICE_URL is not set/);
  });

  it("never voices a house take in a no-voice session", async () => {
    // FILM_NO_VOICE is set for every kit test: nothing is cached, so the take is refused before any request.
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(goodTake(mkdtempSync(join(tmpdir(), "film-spark-")), "Hi.", undefined, undefined, ROWAN)).rejects.toThrow(/FILM_NO_VOICE/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("hearing", () => {
  it("asks Whisper on the Spark, not Scribe, for a house take", async () => {
    vi.stubEnv("FILM_SPARK_VOICE_URL", "http://spark.test:18093");
    const heard = { text: "Two rows.", words: [{ text: "Two", start: 0.1, end: 0.3, type: "word" }, { text: "rows.", start: 0.35, end: 0.7, type: "word" }] };
    const urls: string[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      urls.push(url);
      expect(JSON.parse(String(init.body)).sample_rate).toBe(44100);
      return new Response(JSON.stringify(heard));
    }) as unknown as typeof fetch;
    expect(await sparkHear(new Int16Array(441), fetcher)).toEqual(heard);
    expect(urls).toEqual(["http://spark.test:18093/hear"]);
  });
});

describe("sounds that are no word", () => {
  const take = (faults: string[]) => {
    const words = speakable("Two rows.");
    const alignment = alignmentOf(words.written, words.spoken, [{ start: 0.1, end: 0.3 }, { start: 0.35, end: 0.7 }]);
    return { audio: Buffer.from(new Int16Array(44100).buffer).toString("base64"), alignment, seed: 1000, faults };
  };
  const heard = JSON.stringify({ text: "Two rows.", words: [{ text: "Two", start: 0.1, end: 0.3, type: "word" }, { text: "rows.", start: 0.35, end: 0.7, type: "word" }] });

  it("are faults of a house take, so it is made again", async () => {
    const dir = mkdtempSync(join(tmpdir(), "film-spark-"));
    writeFileSync(join(dir, "h.json"), heard);
    const drone = "the voice runs on for 1.40 s after the last word";
    expect(await judge("Two rows.", take([drone]), join(dir, "h.json"), ROWAN)).toEqual([drone]);
    expect(await judge("Two rows.", take([]), join(dir, "h.json"), ROWAN)).toEqual([]);
  });

  it("keep the best cached take and retake past a noisy one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "film-spark-"));
    const key = takeKey(ROWAN, "Two rows.");
    writeFileSync(join(dir, `${key}.json`), JSON.stringify(take(["a sound that is no word in a pause at 0.32 s (90 ms, peak -30 dBFS)"])));
    writeFileSync(join(dir, `${key}.1.json`), JSON.stringify(take([])));
    for (const k of ["", ".1"]) writeFileSync(join(dir, `${key}${k}.heard.json`), heard);
    const got = await goodTake(dir, "Two rows.", undefined, undefined, ROWAN);
    expect(got.faults).toEqual([]);
    expect(got.tries).toBe(2);
  });
});
