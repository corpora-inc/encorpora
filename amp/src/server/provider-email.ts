/** Microsoft's `email` claim is not proof of ownership (the nOAuth class of
 * takeover). It counts as verified only with `xms_edov` (the email domain's
 * owner is verified; true for personal accounts that verified their address)
 * or when it is one of the user's verified addresses. */
export function microsoftEmailVerified(profile: {
  email?: unknown;
  xms_edov?: unknown;
  verified_primary_email?: unknown;
  verified_secondary_email?: unknown;
}) {
  const email = typeof profile.email === "string" ? profile.email : "";
  if (!email) return false;
  const listed = (claim: unknown) =>
    (Array.isArray(claim) ? claim : [claim]).some(
      (value) =>
        typeof value === "string" &&
        value.toLowerCase() === email.toLowerCase(),
    );
  return (
    profile.xms_edov === true ||
    profile.xms_edov === "true" ||
    profile.xms_edov === 1 ||
    profile.xms_edov === "1" ||
    listed(profile.verified_primary_email) ||
    listed(profile.verified_secondary_email)
  );
}
