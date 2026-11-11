/** Shared held-light times and filenames for kit boards and installed-player captures. */
import type { Script, Timing } from './schema';
import { heldHighlights } from './stage';

export function heldFrames(script: Script, timing: Timing) {
  const lights = heldHighlights(script, timing);
  const byBeat = new Map<number, typeof lights>();
  for (const light of lights) {
    const list = byBeat.get(light.beat) ?? [];
    list.push(light);
    byBeat.set(light.beat, list);
  }
  const slug = (word: string) => word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'highlight';
  return [...byBeat.entries()].sort((a, b) => a[0] - b[0]).flatMap(([beat, mine]) =>
    mine.map((light, k) => ({ ...light, label: slug(light.word),
      file: `${String(beat).padStart(3, '0')}-${mine.length > 1 ? `${k + 1}-` : ''}${slug(light.word)}.jpg`,
    })));
}
