import { glossary } from "../src/glossary/index";
const want = ["ten-frame","fraction","ratio","slope","quadratic","vertical-asymptote","polar-form"];
for (const id of want) { const e: any = glossary.find((g) => g.id === id); console.log(id, e ? JSON.stringify({term:e.term,band:e.band,plain:e.plain,example:e.example,figure:e.figure,uses:e.uses}) : "MISSING " + glossary.filter((g)=>g.id.includes(id.split("-")[0])).map(g=>g.id).join(",")); }
