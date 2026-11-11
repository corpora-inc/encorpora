import { readFileSync } from "node:fs";
import { checkPlayedExample } from "./player-compat";

if (!process.argv[2]) throw new Error("Provide the checked private payload path");
checkPlayedExample(JSON.parse(readFileSync(process.argv[2], "utf8")));
console.log(JSON.stringify({ player_figure_compatible: true }));
