import { glossary } from "../src/glossary/index";
const want = process.argv.slice(2);
const byBand: Record<string, string[]> = {};
for (const e of glossary) (byBand[e.band] ??= []).push(e.id);
if (!want.length) { for (const [b, ids] of Object.entries(byBand)) console.log(b, ids.length, ids.slice(0, 40).join(" ")); }
else for (const id of want) { const e = glossary.find((x) => x.id === id); console.log(JSON.stringify(e && { id: e.id, term: e.term, band: e.band, plain: e.plain, example: e.example })); }
