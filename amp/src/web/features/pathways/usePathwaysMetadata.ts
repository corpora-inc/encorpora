import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { MapSkill } from "./model";
import { applyPathwaysMetadata } from "./pathways-metadata";

export function usePathwaysMetadata(skill?: MapSkill, unknownSkill = false) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  useEffect(() => {
    applyPathwaysMetadata(document, pathname, skill, unknownSkill);
  }, [pathname, skill, unknownSkill]);
}
