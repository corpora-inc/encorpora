import { useNavigate } from "@tanstack/react-router";
import { Sheet } from "../../ui/Sheet";
import { ChildConsentPanel, ChildDeletePanel } from "../privacy/ChildPanels";
import type { FamilyChild } from "./api";
import { familyHref, type FamilyPlace } from "./FamilyFrame";

/*
 * Thin sheets over a child's settings page around the privacy bodies
 * (features/privacy/ChildPanels.tsx), where those settings are still a page.
 * Inside the child's settings sheet the same bodies are disclosures.
 */

/** Consent over the child's settings page (no address of its own). */
export function ConsentSheet({
  open,
  onOpenChange,
}: {
  place?: FamilyPlace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Consent">
      <div data-consent-sheet="">
        <ChildConsentPanel />
      </div>
    </Sheet>
  );
}

/** Delete one child's learning data, over their settings page. Once
 * deleted, the child's page is gone, so the family's Today replaces it. */
export function DeleteDataSheet({
  place,
  child,
  open,
  onOpenChange,
}: {
  place: FamilyPlace;
  child: FamilyChild;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${child.name}’s learning data`}
    >
      <div data-delete-sheet="">
        <ChildDeletePanel
          child={child}
          onDone={() =>
            navigate({
              to: "/$",
              params: { _splat: familyHref(place.family) },
              replace: true,
            })
          }
        />
      </div>
    </Sheet>
  );
}
