import { purchasePreview } from "./purchase-preview-fixture";
const fixture = await purchasePreview(
  Number(process.env.AMP_PURCHASE_PREVIEW_PORT ?? 4980),
  {
    schema: process.env.AMP_PURCHASE_PREVIEW_SCHEMA,
    stateFile: process.env.AMP_PURCHASE_PREVIEW_STATE_FILE,
  },
);
console.log(`Preview ready: ${fixture.origin}/__preview`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => void fixture.close().then(() => process.exit()));
