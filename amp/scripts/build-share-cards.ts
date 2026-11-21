/** The public pages' share cards (scripts/lib/public-share-cards.ts).
 *
 *     npx tsx scripts/build-share-cards.ts            # record them
 *     npx tsx scripts/build-share-cards.ts --dist     # write them into dist/
 *
 * Recording renders each card and writes its content-hashed address and alt
 * text to src/web/app/share-cards.json, which the route head reads, so the
 * app and the prerendered documents name the same picture. `npm run build`
 * records first; commit the file (tests/share-cards.test.ts checks it).
 * `--dist` runs after `vite build`: it writes the PNGs under
 * dist/assets/share-cards/ and fails if a card no longer matches the record,
 * so a document never names a missing picture. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  renderShareCards,
  shareCardDirectory,
  shareCardRecord,
  shareCardsJson,
} from "./lib/public-share-cards";

const cards = renderShareCards();
const record = shareCardRecord(cards);
if (process.argv.includes("--dist")) {
  if ((await readFile(shareCardsJson, "utf8")) !== record)
    throw new Error(
      "src/web/app/share-cards.json doesn't match the cards: run `npm run build:share-cards` in amp/ and commit it.",
    );
  const directory = new URL(`../dist${shareCardDirectory}`, import.meta.url);
  await mkdir(directory, { recursive: true });
  for (const { image, png } of cards)
    await writeFile(
      new URL(image.slice(shareCardDirectory.length), directory),
      png,
    );
  console.log(`Built ${cards.length} share cards.`);
} else {
  await writeFile(shareCardsJson, record);
  console.log(
    `Recorded ${cards.length} share cards in src/web/app/share-cards.json.`,
  );
}
