// src/contentPacks/phrasePackRegister.ts
//
// Bridge between the generic content-pack install path and the phrase-pack
// store. After any pack install completes we peek at its manifest; if
// `packType === "phrase"` we parse the phrase-pack metadata and register it
// in `usePhrasePacksStore` so the Settings UI and the sampler-id list can
// see it.
//
// The disk is the source of truth; this module is just the in-memory
// mirror layer. `rehydratePhrasePacksFromDisk()` is meant to run once at
// app boot, after the persisted Zustand stores have hydrated.

import { invoke } from "@tauri-apps/api/core";

import {
    usePhrasePacksStore,
    type InstalledPhrasePack,
} from "@/store/phrasePacks";

/** Mirror of `pack_meta` + the generic `manifest.json` fields. */
type PhrasePackManifest = {
    id: string;
    version: string;
    packType?: string;
    name?: string;
    description?: string;
    category?: string;
    topic?: string;
    levelMin?: string;
    levelMax?: string;
    entryCount?: number;
    languageCodes?: string[];
    icon?: string;
    accentColor?: string;
    databases?: Record<string, string>;
    schemaVersion?: number;
};

async function fetchInstalledManifest(
    packId: string,
): Promise<PhrasePackManifest | null> {
    const url = `corpan-pack://localhost/${packId}/manifest.json`;
    try {
        const text = await invoke<string>("content_packs_fetch_text", { url });
        return JSON.parse(text) as PhrasePackManifest;
    } catch (err) {
        console.warn(
            `[phrase-packs] failed to read manifest for ${packId}:`,
            err,
        );
        return null;
    }
}

function manifestToInstalled(
    manifest: PhrasePackManifest,
    source: "catalog" | "manual",
): InstalledPhrasePack {
    return {
        id: manifest.id,
        version: manifest.version || "0.0.0",
        name: manifest.name || manifest.id,
        description: manifest.description || "",
        category: manifest.category || "uncategorized",
        topic: manifest.topic || manifest.name || manifest.id,
        levelMin: manifest.levelMin || "A1",
        levelMax: manifest.levelMax || "C2",
        entryCount: typeof manifest.entryCount === "number" ? manifest.entryCount : 0,
        languageCodes: Array.isArray(manifest.languageCodes)
            ? manifest.languageCodes
            : [],
        installedAt: new Date().toISOString(),
        // Populated later by a Rust stat command when we add one; 0 is a
        // safe "unknown" sentinel that the UI can detect and hide.
        sizeBytes: 0,
        source,
        icon: manifest.icon,
        accentColor: manifest.accentColor,
    };
}

/**
 * Read the manifest of a freshly-installed pack and, if it's a phrase pack,
 * register it. Returns true if a phrase pack was registered. Safe to call
 * for any pack id — non-phrase packs are silently ignored.
 *
 * Always invalidates the sampler's count cache for this pack id so a
 * version bump immediately takes effect.
 */
export async function registerPhrasePackIfApplicable(
    packId: string,
    source: "catalog" | "manual",
): Promise<boolean> {
    const manifest = await fetchInstalledManifest(packId);
    if (!manifest) return false;
    if (manifest.packType !== "phrase") return false;

    const pack = manifestToInstalled(manifest, source);
    usePhrasePacksStore.getState().register(pack);
    await invalidateSamplerCache(packId);
    return true;
}

/**
 * Drop a phrase pack from the registry. Intended to be called by the
 * uninstall flow after the disk side has succeeded. Also invalidates the
 * sampler's COUNT cache so a later same-id install is sampled fresh.
 */
export async function unregisterPhrasePack(packId: string): Promise<void> {
    usePhrasePacksStore.getState().unregister(packId);
    await invalidateSamplerCache(packId);
}

/**
 * Boot-time reconciliation: scan installed content packs and register any
 * that look like phrase packs. Idempotent — repeatedly overwrites entries
 * with the freshly-read manifest. Catches drift where the JS store falls
 * out of sync with disk (manual sideload, store clear, etc.).
 */
export async function rehydratePhrasePacksFromDisk(): Promise<void> {
    try {
        const installed = await invoke<Array<{ id: string }>>(
            "content_packs_list_installed",
        );
        // Build a fresh registry from scratch so packs removed from disk
        // disappear from the store on next boot.
        const discovered: InstalledPhrasePack[] = [];
        for (const entry of installed) {
            const manifest = await fetchInstalledManifest(entry.id);
            if (!manifest || manifest.packType !== "phrase") continue;
            discovered.push(manifestToInstalled(manifest, "catalog"));
        }
        usePhrasePacksStore.getState().replaceAll(discovered);
    } catch (err) {
        console.warn("[phrase-packs] rehydrate failed:", err);
    }
}

async function invalidateSamplerCache(packId: string): Promise<void> {
    try {
        await invoke("phrase_packs_invalidate_cache", { packId });
    } catch (err) {
        // Not fatal — the worst-case is a stale COUNT for this pack
        // briefly; the next active-set toggle pays the lookup cost again.
        console.warn(
            `[phrase-packs] failed to invalidate sampler cache for ${packId}:`,
            err,
        );
    }
}
