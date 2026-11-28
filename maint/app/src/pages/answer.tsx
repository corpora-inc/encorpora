import { useEffect, type ReactNode } from "react";
import type { Applicability } from "../engine/types.ts";
import { useAttrs, useRefused } from "../store/attrs.ts";
import { Undetermined } from "../ui/applicability.tsx";

/**
 * The in-place answer for an item whose applicability is not determined:
 * the unit's declared attributes, a field for each one the statement needs,
 * and on save the value is kept on the unit (source `typed`) and `after`
 * re-reads the view, which re-filters. Without a unit, the marker only.
 */
export function useAnswerer(assetId: string | null | undefined, packId: string | null | undefined, after?: () => void): (a: Applicability) => ReactNode {
  const attrs = useAttrs((s) => (assetId ? s.byAsset[assetId] : undefined));
  const saving = useAttrs((s) => (assetId ? !!s.saving[assetId] : false));
  const refused = useRefused(assetId);
  useEffect(() => {
    if (assetId) void useAttrs.getState().load(assetId, packId);
  }, [assetId, packId]);
  return (a) => (
    <Undetermined
      a={a}
      declared={assetId ? (attrs?.declared ?? []) : undefined}
      saving={saving}
      refused={refused}
      onAnswer={(attr, value) => {
        if (!assetId) return;
        void useAttrs
          .getState()
          .set(assetId, { [attr]: value }, packId)
          .then((ok) => ok && after?.());
      }}
    />
  );
}
