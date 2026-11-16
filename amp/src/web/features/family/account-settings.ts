import { useQuery } from "@tanstack/react-query";
import { settingsFamilyOf } from "./settings-family";
import { sessionOptions } from "../../lib/query";
import { familyPlacesOptions } from "./api";

export function useSettingsFamily() {
  const session = useQuery(sessionOptions).data;
  const places = useQuery(
    familyPlacesOptions(session ?? { accountId: "", token: "" }),
  );
  return settingsFamilyOf(places.data)?.familyId ?? null;
}
