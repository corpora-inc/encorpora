const key = "amp.school-buyer";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
/** Read the capability before routing, then remove it from browser history.
 * A tab may reload the same public summary without putting it in a URL. */
export function prepareBuyerHandoff(): string | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get("token");
  if (hash.has("token")) {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    if (!token || !tokenPattern.test(token)) {
      memory = null;
      try {
        sessionStorage.removeItem(key);
      } catch {}
      return null;
    }
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ token, until: Date.now() + 30 * 86400000 }),
      );
    } catch {}
    memory = token;
    return token;
  }
  if (memory) return memory;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (
      saved &&
      typeof saved.token === "string" &&
      tokenPattern.test(saved.token) &&
      typeof saved.until === "number" &&
      saved.until > Date.now()
    )
      return (memory = saved.token);
    sessionStorage.removeItem(key);
  } catch {}
  return null;
}
let memory: string | null = null;
