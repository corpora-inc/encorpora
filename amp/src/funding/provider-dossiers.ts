import { firstWaveDossiers } from "./first-wave-dossiers.js";
import { additionalProviderDossiers } from "./additional-provider-dossiers.js";
import type { DossierInventory } from "./dossier.js";
/** Concatenation preserves duplicate IDs for the audit to reject; never silently overwrite evidence. */
export const providerDossiers: DossierInventory = {
  checkedOn: [firstWaveDossiers.checkedOn, additionalProviderDossiers.checkedOn]
    .sort()
    .at(-1)!,
  sources: [
    ...firstWaveDossiers.sources,
    ...additionalProviderDossiers.sources,
  ],
  dossiers: [
    ...firstWaveDossiers.dossiers,
    ...additionalProviderDossiers.dossiers,
  ],
};
