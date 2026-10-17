import { firstWaveDossiers } from "./first-wave-dossiers.js";
import { additionalProviderDossiers } from "./additional-provider-dossiers.js";
import { odysseyStateDossiers } from "./odyssey-state-dossiers.js";
import type { DossierInventory } from "./dossier.js";
const inventories = [
  firstWaveDossiers,
  additionalProviderDossiers,
  odysseyStateDossiers,
];
/** Concatenation preserves duplicate IDs for audit rejection, never silently overwriting evidence. */
export const providerDossiers: DossierInventory = {
  checkedOn: inventories
    .map((i) => i.checkedOn)
    .sort()
    .at(-1)!,
  sources: inventories.flatMap((i) => i.sources),
  dossiers: inventories.flatMap((i) => i.dossiers),
};
