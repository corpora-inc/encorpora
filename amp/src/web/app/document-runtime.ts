import { startRuntimeRecovery } from "../lib/chunk-recovery";
import { captureOpenAIEntry } from "../lib/openai-acquisition";
import { startEngagement } from "../lib/engagement";
import { trackGooglePage, trackSessionStart } from "../lib/analytics";
import { watchForNewRelease } from "../lib/app-recovery";

type DocumentRuntime = { engagement: ReturnType<typeof startEngagement> };
let runtime: DocumentRuntime | undefined;

/**
 * What every AMP document runs once, whichever entry starts it: the app
 * (`app/boot.tsx`), or the light home document (`home-entry.tsx`), whose app
 * then takes these over instead of starting its own.
 */
export function startDocumentRuntime(): DocumentRuntime {
  if (runtime) return runtime;
  // After consent-entry has removed any private fragment from the URL.
  startRuntimeRecovery();
  captureOpenAIEntry();
  const engagement = startEngagement({ awaitRoute: true });
  trackGooglePage();
  trackSessionStart();
  watchForNewRelease();
  return (runtime = { engagement });
}
