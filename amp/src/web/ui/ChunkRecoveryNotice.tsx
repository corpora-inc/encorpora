import { useSyncExternalStore } from "react";
import {
  chunkNotice,
  subscribeChunkNotice,
  dismissChunkNotice,
} from "../lib/chunk-recovery";
import { Toast } from "./Toast";

export function ChunkRecoveryNotice() {
  const visible = useSyncExternalStore(subscribeChunkNotice, chunkNotice);
  return (
    <Toast
      message={visible ? "This screen could not be loaded." : ""}
      onDismiss={dismissChunkNotice}
      action={{ label: "Reload", onClick: () => location.reload() }}
    />
  );
}
