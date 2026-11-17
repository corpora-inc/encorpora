import { useQuery } from "@tanstack/react-query";
import { settingsFamilyOf } from "./settings-family";
import { forSession, useSessionOrNull } from "../../lib/session";
import { familyPlacesOptions } from "./api";

export function useSettingsFamily() {
  const places = useQuery(forSession(useSessionOrNull(), familyPlacesOptions));
  return settingsFamilyOf(places.data)?.familyId ?? null;
}
