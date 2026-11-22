import { afterEach, expect, test, vi } from "vitest";
import { createGoogleAnalytics } from "../../../analytics/google-analytics";

// A comparison (`/versus/<slug>`) titles itself: its title comes from its own
// content, which loads with its screen. GA measures it when the screen gives
// the title, once, and never with another page's.
const gaWindow = window as unknown as Record<string, unknown>;
type PageView = {
  page_location: string;
  page_title: string;
  page_referrer: string;
};
function pageViews(): PageView[] {
  return ((gaWindow.dataLayer as IArguments[]) ?? [])
    .map((entry) => Array.from(entry) as unknown[])
    .filter((entry) => entry[0] === "event" && entry[1] === "page_view")
    .map((entry) => entry[2] as PageView);
}
const at = (path: string) =>
  vi.stubGlobal("location", new URL(`https://amp.corpora.inc${path}`));
function start(path: string) {
  at(path);
  gaWindow.dataLayer = undefined;
  gaWindow["ga-disable-G-TGEK0ZGHMD"] = undefined;
  return createGoogleAnalytics({ home: () => "app" });
}
afterEach(() => {
  vi.unstubAllGlobals();
  document.head.querySelectorAll("script").forEach((s) => s.remove());
});

test("a comparison's page view waits for its title and is sent once", () => {
  const google = start(
    "/versus/i-ready?utm_source=google&email=private@example.test",
  );
  // The document starts and the route resolves: no title yet, nothing sent,
  // and measurement stays on (the page is public).
  google.navigate();
  google.navigate();
  expect(pageViews()).toEqual([]);
  expect(gaWindow["ga-disable-G-TGEK0ZGHMD"]).toBe(false);
  // The screen writes its head and says its title.
  google.navigate("AMP vs i-Ready: Math Families Can Buy | AMP");
  expect(pageViews()).toMatchObject([
    {
      page_location: "https://amp.corpora.inc/versus/i-ready?utm_source=google",
      page_title: "AMP vs i-Ready: Math Families Can Buy | AMP",
    },
  ]);
  // A later resolve, or the same title again, is the same visit.
  google.navigate();
  google.navigate("AMP vs i-Ready: Math Families Can Buy | AMP");
  expect(pageViews()).toHaveLength(1);
});

test("moving between comparisons sends each once, with its own title", () => {
  const google = start("/versus");
  google.navigate();
  google.navigate("AMP vs Other Math Programs | AMP");
  // To a comparison: the route resolves before its screen has the title.
  at("/versus/ctcmath");
  google.navigate();
  expect(pageViews()).toHaveLength(1);
  google.navigate("AMP vs CTCMath: Practice That Adapts | AMP");
  // On to a page with a fixed title.
  at("/sign-up");
  google.navigate();
  expect(
    pageViews().map((view) => [view.page_location, view.page_title]),
  ).toEqual([
    ["https://amp.corpora.inc/versus", "AMP vs Other Math Programs | AMP"],
    [
      "https://amp.corpora.inc/versus/ctcmath",
      "AMP vs CTCMath: Practice That Adapts | AMP",
    ],
    ["https://amp.corpora.inc/sign-up", "Create Your Account | AMP"],
  ]);
  expect(pageViews()[1]!.page_referrer).toBe("https://amp.corpora.inc/versus");
});

test("a slug with no comparison is never measured, and a private page still retires measurement", () => {
  const google = start("/versus/no-such-program");
  google.navigate();
  expect(pageViews()).toEqual([]);
  // A title given on a private page is not a way in.
  at("/family/00000000-0000-4000-8000-000000000000");
  google.navigate("AMP vs i-Ready | AMP");
  expect(pageViews()).toEqual([]);
  expect(gaWindow["ga-disable-G-TGEK0ZGHMD"]).toBe(true);
});

test("coming back from a comparison that doesn't exist counts the page again", () => {
  const google = start("/versus/i-ready");
  google.navigate();
  google.navigate("AMP vs i-Ready | AMP");
  // A link to a page with no comparison: its screen never gives a title.
  at("/versus/no-such");
  google.navigate();
  expect(pageViews()).toHaveLength(1);
  // Back to the comparison: a new view of it, sent once.
  at("/versus/i-ready");
  google.navigate();
  google.navigate("AMP vs i-Ready | AMP");
  google.navigate("AMP vs i-Ready | AMP");
  expect(pageViews().map((view) => view.page_location)).toEqual([
    "https://amp.corpora.inc/versus/i-ready",
    "https://amp.corpora.inc/versus/i-ready",
  ]);
});
