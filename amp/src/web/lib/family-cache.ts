import { useQuery } from "@tanstack/react-query";
import type { FamilySummary } from "../../family/contracts";
import type { Me } from "../../account/contracts";
import { nativeRuntime } from "../native-runtime";
import { meKey, queryClient } from "./query";
const nativeFamilyKey = (identity: string | null) =>
  ["native-family", identity] as const;
/** Web has one canonical server resource; legacy Family screens select its projection. */
export function useFamilyCache(identity: string | null) {
  const me = useQuery<Me | null>({
    queryKey: meKey(identity),
    queryFn: () => Promise.resolve(null),
    enabled: false,
  }).data;
  const native = useQuery<FamilySummary | null>({
    queryKey: nativeFamilyKey(identity),
    queryFn: () => Promise.resolve(null),
    enabled: false,
  }).data;
  return nativeRuntime ? (native ?? null) : me?.signedIn ? me.family : null;
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
