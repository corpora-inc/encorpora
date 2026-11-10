import { notifyManager, useQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { FamilySummary } from "../../family/contracts";
import type { Me } from "../../account/contracts";
import { nativeRuntime } from "../native-runtime";
import { meKey, queryClient } from "./query";
const nativeFamilyKey = (identity: string | null) =>
  ["native-family", identity] as const;
const subscribeAccountCache = (notify: () => void) =>
  queryClient.getQueryCache().subscribe(notifyManager.batchCalls(notify));
/** Web has one canonical server resource; legacy Family screens select its projection. */
export function useFamilyCache(identity: string | null) {
  // A projection must not replace the canonical resource's fetch function.
  const readAccount = useCallback(
    () => queryClient.getQueryData<Me | null>(meKey(identity)),
    [identity],
  );
  const me = useSyncExternalStore(
    subscribeAccountCache,
    readAccount,
    readAccount,
  );
  const native = useQuery<FamilySummary | null>({
    queryKey: nativeFamilyKey(identity),
    queryFn: () => Promise.resolve(null),
    enabled: false,
  }).data;
  return nativeRuntime ? (native ?? null) : me?.signedIn ? me.family : null;
}
/** The canonical account resource as already loaded, without fetching it
 * again: a screen inside the app reads what the app holds. */
export function useAccountCache(identity: string | null) {
  const readAccount = useCallback(
    () => queryClient.getQueryData<Me | null>(meKey(identity)),
    [identity],
  );
  const me = useSyncExternalStore(
    subscribeAccountCache,
    readAccount,
    readAccount,
  );
  return me?.signedIn ? me : null;
}
export function familyRevision(identity: string | null) {
  return (
    queryClient.getQueryState(
      nativeRuntime ? nativeFamilyKey(identity) : meKey(identity),
    )?.dataUpdateCount ?? 0
  );
}
export function setNativeFamilySnapshot(
  identity: string | null,
  value: FamilySummary | null,
) {
  if (identity && nativeRuntime)
    queryClient.setQueryData(nativeFamilyKey(identity), value);
}
export function clearFamilyAccount(identity: string | null) {
  if (identity) {
    void queryClient.cancelQueries({ queryKey: ["account", identity] });
    queryClient.removeQueries({ queryKey: ["account", identity] });
    queryClient.removeQueries({ queryKey: nativeFamilyKey(identity) });
  }
}
