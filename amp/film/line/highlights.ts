/** Read-only bridge to the kit's held-light timing and filename contract. */
import { readFileSync } from 'node:fs';
import { heldFrames } from '../held-frames';
const payload = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
console.log(JSON.stringify(heldFrames(payload.script, payload.timing)));
