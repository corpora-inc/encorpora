const SIGNUP_COOKIE = "amp.family-approval";
/** The proof account creation reads, for an hour at most. Only the fragment
 * and this carry hold the token, so it stays out of every URL a server or
 * report sees; the cookie tells account creation a mailed link proved the
 * address. Its own module: forgetting links (`features/links/forget.ts`)
 * runs before any screen, so it imports nothing that signs in. */
export function approvalSignup(fragment: string | null) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = fragment
    ? `${SIGNUP_COOKIE}=${encodeURIComponent(fragment)}; Path=/api/auth; Max-Age=3600; SameSite=Lax${secure}`
    : `${SIGNUP_COOKIE}=; Path=/api/auth; Max-Age=0; SameSite=Lax${secure}`;
}
