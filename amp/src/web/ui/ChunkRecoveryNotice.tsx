import { useSyncExternalStore } from "react";
import {
  chunkNotice,
  subscribeChunkNotice,
  dismissChunkNotice,
  reloadWithFreshFiles,
} from "../lib/chunk-recovery";
import { Toast } from "./Toast";

export function ChunkRecoveryNotice() {
  const visible = useSyncExternalStore(subscribeChunkNotice, chunkNotice);
  return (
    <Toast
      message={
        visible
          ? "Part of this page didn’t load. Check your connection, then reload."
          : ""
      }
      onDismiss={dismissChunkNotice}
      action={{ label: "Reload", onClick: () => reloadWithFreshFiles() }}
    />
  );
}
