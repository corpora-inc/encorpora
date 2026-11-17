/* AMP's entry guard: the one script that runs before AMP's own code.
 *
 * A visitor who arrives during or just after a release can be served a page
 * whose script files are gone, or a browser can refuse to run them. Then no
 * AMP code runs to recover, and the page would show its loading wave forever.
 * This plain script (no modules, no build, older syntax on purpose, so every
 * browser runs it) watches for that until AMP's runtime starts
 * (`data-amp-runtime` on <html>, set by src/web/lib/chunk-recovery.ts):
 *
 * - a file of AMP's that fails to load reloads the page once, sharing the
 *   app's reload slot (src/web/lib/reload-guard.ts), so the two never loop;
 * - a second failure, or a browser that can't run AMP, shows a message in
 *   place with a Reload button, never a dead screen.
 *
 * The app calls `ampEntryGuard.show("load")` when it can't recover a file
 * and has no screen of its own to say so. Served as a file because the
 * content policy allows no inline script.
 */
(function () {
  "use strict";
  var html = document.documentElement;
  var SLOT = "amp.release-reload";
  var TTL = 60000;
  var shown = false;
  /** AMP's files that failed to load in this document. */
  var failedUrls = [];
  var messages = {
    load: "AMP didn’t finish loading. Check your connection, then reload.",
    engine:
      "This browser can’t run AMP. Update it, or open this page in Safari or Chrome.",
  };

  function started() {
    return html.hasAttribute("data-amp-runtime");
  }
  function ours(url) {
    try {
      var parsed = new URL(url, location.href);
      return (
        parsed.origin === location.origin &&
        /\.(?:m?js|css|tsx?)$/.test(parsed.pathname)
      );
    } catch (error) {
      return false;
    }
  }
  /** Claims the reload slot; false when a reload happened in the last minute
   * or the browser keeps no session storage (a reload could then repeat). */
  function claimReload() {
    try {
      var previous = Number(sessionStorage.getItem(SLOT));
      var now = Date.now();
      sessionStorage.setItem(SLOT, String(now));
      if (sessionStorage.getItem(SLOT) !== String(now)) return false;
      return !(previous && Math.abs(now - previous) < TTL);
    } catch (error) {
      if (window.console) console.warn("AMP: reloads can’t be counted", error);
      return false;
    }
  }

  function show(kind) {
    if (shown) return;
    shown = true;
    var text = messages[kind] || messages.load;
    var root = document.getElementById("root");
    var wave = root && root.querySelector(".app-loading[aria-busy]");
    // Only the first paint's wave is showing: the message takes its place.
    // Anything else on screen stays, under a fixed notice that moves nothing.
    var inPlace = !!wave && root.children.length === 1;
    var box = document.createElement("div");
    box.className = inPlace ? "app-loading" : "app-recovery-toast";
    box.setAttribute("role", "alert");
    var body = document.createElement(inPlace ? "main" : "div");
    body.className = "app-loading-body";
    var message = document.createElement("p");
    message.textContent = text;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "app-recovery-button";
    button.textContent = "Reload";
    button.addEventListener("click", refreshThenReload);
    body.appendChild(message);
    body.appendChild(button);
    if (inPlace) {
      var content = document.createElement("div");
      content.className = "app-loading-content";
      content.appendChild(body);
      box.appendChild(content);
      root.replaceChild(box, wave);
    } else {
      box.appendChild(body);
      document.body.appendChild(box);
    }
  }

  /** Safari keeps a failed modulepreload in its memory cache across a
   * reload; asking for the file again, past the cache, lets the reload work.
   * Never waits more than 3 s. */
  function refreshThenReload() {
    var done = false;
    var reload = function () {
      if (done) return;
      done = true;
      location.reload();
    };
    setTimeout(reload, 3000);
    if (!failedUrls.length || !window.fetch || !window.Promise) return reload();
    var asks = [];
    for (var i = 0; i < failedUrls.length && i < 10; i++)
      asks.push(
        window
          .fetch(failedUrls[i], { cache: "reload", credentials: "same-origin" })
          .then(null, function (error) {
            if (window.console)
              console.warn("AMP: a file wasn’t asked for again", error);
          })
      );
    Promise.all(asks).then(reload, reload);
  }

  function failed(kind, url) {
    if (url && failedUrls.indexOf(url) < 0) failedUrls.push(url);
    if (shown) return;
    if (kind === "load" && claimReload()) {
      refreshThenReload();
      return;
    }
    show(kind);
  }

  window.ampEntryGuard = { show: show };

  // A script or stylesheet of AMP's that fails to load (load errors don't
  // bubble: listen while they're captured). Always remembered, for the
  // Reload's refresh; acted on only before the runtime starts.
  window.addEventListener(
    "error",
    function (event) {
      var target = event.target;
      if (!target || target === window) return;
      var url =
        target.tagName === "SCRIPT"
          ? target.src
          : target.tagName === "LINK"
            ? target.href
            : "";
      if (!url || !ours(url)) return;
      if (failedUrls.indexOf(url) < 0) failedUrls.push(url);
      if (!started()) {
        if (window.console) console.error("AMP: a file didn’t load", url);
        failed("load", url);
      }
    },
    true
  );
  // Code that can't even start: a browser that can't parse it, or a module
  // it imports that is gone.
  window.addEventListener("error", function (event) {
    if (started() || !event.filename || !ours(event.filename)) return;
    var name = event.error && event.error.name;
    if (window.console) console.error("AMP couldn’t start", event.error);
    failed(name === "SyntaxError" ? "engine" : "load");
  });
  window.addEventListener("unhandledrejection", function (event) {
    if (started()) return;
    var reason = event.reason;
    var text = String((reason && reason.message) || reason || "");
    if (
      /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to (?:fetch|load) module script|Unable to preload CSS/i.test(
        text
      )
    ) {
      if (window.console) console.error("AMP couldn’t start", reason);
      failed("load");
    }
  });
  // A browser without modules never runs AMP's code at all.
  if (!("noModule" in document.createElement("script")))
    document.addEventListener("DOMContentLoaded", function () {
      show("engine");
    });
})();
