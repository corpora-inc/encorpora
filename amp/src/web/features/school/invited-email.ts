import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { qk } from "../../lib/keys";
import { useAuthDraft } from "../auth/draft";
import { school } from "./api";
import { rememberedInvite } from "./paths";

/** A sign-in that leads back to an invitation starts with the address the
 * invitation went to, also when its holder came here by "Use another
 * account", which leaves the page and its memory. The carried link is the
 * credential for the lookup. Fills only an empty address. */
export function useInvitedEmail(on: boolean) {
  const token = on ? (rememberedInvite() ?? "").split(".")[0] : "";
  const invite = useQuery({
    queryKey: qk.account(null, "school", "invite", token),
    enabled: !!token,
    retry: false,
    queryFn: () => school.lookupInvite(token),
  });
  const address = invite.data?.email;
  useEffect(() => {
    const draft = useAuthDraft.getState();
    if (address && !draft.email) draft.setEmail(address);
  }, [address]);
}
