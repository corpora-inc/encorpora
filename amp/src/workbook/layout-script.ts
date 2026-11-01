/**
 * Page composition for a printed workbook, run by the browser that prints it.
 *
 * CSS alone cannot balance a page: a problem that does not fit moves to the
 * next page and leaves a hole. This script measures the real typeset blocks
 * and builds explicit pages:
 * - student blocks fill a page in order; a section heading always travels
 *   with the block after it, and the lesson card stays with its guided
 *   problems whenever they fit on one page together;
 * - the space a page has left is shared out as extra workspace, so pages end
 *   level instead of leaving holes;
 * - the answer key fills two columns per page and never shares a page with
 *   student work; the results page is last;
 * - every page gets a footer with the workbook and "Page n of N".
 *
 * Without it (a browser with scripts off) the same blocks still print in
 * order through CSS page-break rules, only less evenly.
 *
 * It sets `data-layout` on <html> to "ready", or "error" after logging why.
 * Printers wait for that (see `pdf.ts`). Plain ES5 text, never transpiled.
 */
export const workbookLayoutScript = String.raw`(function () {
  var root = document.documentElement;
  var families = (root.getAttribute("data-fonts") || "").split("|").filter(Boolean);
  function fail(error) {
    root.setAttribute("data-layout", "error");
    console.error("Workbook layout failed:", error && error.stack ? error.stack : error);
  }
  function list(nodes) { return Array.prototype.slice.call(nodes); }
  function height(el) { return el.getBoundingClientRect().height; }
  function layout() {
    var wb = document.querySelector(".wb");
    var pages = document.createElement("div");
    pages.className = "wb-pages";
    wb.appendChild(pages);
    var made = [];
    function newPage(kind) {
      var page = document.createElement("div");
      page.className = "wb-page wb-page--" + kind;
      var body = document.createElement("div");
      body.className = "wb-page-body";
      var content = document.createElement("div");
      content.className = "wb-page-content";
      body.appendChild(content);
      page.appendChild(body);
      // The footer is in place before measuring, so the body is its final height.
      var foot = document.createElement("div");
      foot.className = "wb-page-foot";
      var left = document.createElement("span");
      left.className = "wb-foot-left";
      left.textContent = wb.getAttribute(kind === "student" ? "data-foot" : "data-foot-" + kind);
      var right = document.createElement("span");
      right.className = "wb-foot-page";
      right.textContent = "Page 00 of 00";
      foot.appendChild(left);
      foot.appendChild(right);
      page.appendChild(foot);
      pages.appendChild(page);
      var p = { kind: kind, page: page, body: body, content: content, number: right };
      made.push(p);
      return p;
    }
    function fits(p) { return height(p.content) <= height(p.body) + 0.5; }
    function units(blocks, byGroup) {
      var out = [];
      blocks.forEach(function (b, i) {
        var prev = blocks[i - 1];
        var join = prev && (prev.hasAttribute("data-keep-next") ||
          (byGroup && b.getAttribute("data-group") &&
            b.getAttribute("data-group") === prev.getAttribute("data-group")));
        if (join) out[out.length - 1].push(b); else out.push([b]);
      });
      return out;
    }

    // Student pages.
    var flow = wb.querySelector('[data-flow="student"]');
    var current = newPage("student");
    function append(unit) { unit.forEach(function (b) { current.content.appendChild(b); }); }
    function detach(unit) { unit.forEach(function (b) { b.parentNode.removeChild(b); }); }
    function place(unit, split) {
      append(unit);
      if (fits(current)) return;
      if (current.content.children.length > unit.length) {
        detach(unit);
        // A long group (the lesson card and its problems) that would leave a
        // big hole starts here instead, splitting after its card.
        var spare = height(current.body) - height(current.content);
        if (split && unit.length > 2 && spare > 0.5 * height(current.body)) {
          units(unit, false).forEach(function (u) { place(u, false); });
          return;
        }
        current = newPage("student");
        append(unit);
        if (fits(current)) return;
      }
      if (split && unit.length > 1) {
        detach(unit);
        units(unit, false).forEach(function (u) { place(u, false); });
      }
      // A single block taller than a page stays; the layout check reports it.
    }
    var optional = list(flow.querySelectorAll("[data-optional]"));
    detach(optional);
    units(list(flow.children), true).forEach(function (u) { place(u, true); });
    flow.parentNode.removeChild(flow);

    // A page with nothing that can grow (a lesson card on its own) cannot be
    // levelled, so it takes rows from the end of the page before while they
    // fit; the page before keeps at least one row and grows instead.
    function growable(p) { return list(p.content.children).filter(function (b) { return b.classList.contains("wb-row"); }); }
    for (var i = 1; i < made.length; i++) {
      var page = made[i], before = made[i - 1];
      if (growable(page).length) continue;
      for (;;) {
        var last = before.content.lastElementChild;
        var prev = last && last.previousElementSibling;
        if (!last || !last.classList.contains("wb-row") || growable(before).length < 2) break;
        if (!prev || prev.hasAttribute("data-keep-next")) break;
        if (last.getAttribute("data-group") === "lesson") break;
        page.content.insertBefore(last, page.content.firstChild);
        if (!fits(page)) { before.content.appendChild(last); break; }
      }
    }

    // A lesson card whose page still has room gets a "your turn" space
    // after it, which the levelling below sizes to the page.
    optional.forEach(function (block) {
      made.forEach(function (p) {
        var card = p.content.querySelector(".wb-lesson-block");
        if (!card || growable(p).length || block.parentNode) return;
        if (height(p.body) - height(p.content) < 1.4 * 96) return;
        card.parentNode.insertBefore(block, card.nextSibling);
        if (!fits(p)) detach([block]);
      });
    });

    // Level each student page: share its spare height among its rows as
    // workspace, up to each row's cap.
    made.forEach(function (p) {
      var rows = list(p.content.querySelectorAll(".wb-row")).filter(function (r) {
        return r.querySelector(".wb-work");
      });
      var spare = height(p.body) - height(p.content) - 3;
      if (!rows.length || spare <= 2) return;
      var extra = rows.map(function () { return 0; });
      // First up to each row's own cap; then, if the page still has a hole,
      // up to a shared ceiling (open space to draw and work in).
      [function (r) { return parseFloat(r.getAttribute("data-grow")) * 96; },
       function () { return 7 * 96; }]
        .forEach(function (capOf) {
          var caps = rows.map(capOf);
          var open = rows.map(function (_, i) { return i; }).filter(function (i) { return caps[i] - extra[i] > 0.5; });
          while (spare > 1 && open.length) {
            var share = spare / open.length;
            open = open.filter(function (i) {
              var add = Math.min(share, caps[i] - extra[i]);
              extra[i] += add;
              spare -= add;
              return caps[i] - extra[i] > 0.5;
            });
          }
        });
      rows.forEach(function (r, i) {
        r.style.setProperty("--wb-grow", extra[i].toFixed(1) + "px");
        // An answer line given real room becomes workspace, with its grid.
        if (extra[i] > 0.4 * 96) r.classList.add("wb-row--roomy");
      });
      // Rounding can tip a page over by a pixel: give it back.
      for (var guard = 0; guard < 4 && !fits(p); guard++)
        rows.forEach(function (r, i) {
          extra[i] = Math.max(0, extra[i] - 2);
          r.style.setProperty("--wb-grow", extra[i].toFixed(1) + "px");
        });
    });

    // Answer key: two columns a page, a section label with the entry after it.
    var key = wb.querySelector('[data-flow="key"]');
    if (key) {
      var head = list(key.children).filter(function (b) { return b.hasAttribute("data-key-head"); });
      var entries = list(key.children).filter(function (b) { return !b.hasAttribute("data-key-head"); });
      var kp = null;
      var keyPage = function () {
        kp = newPage("key");
        if (head.length) { head.forEach(function (h) { kp.content.appendChild(h); }); head = []; }
        var cols = document.createElement("div");
        cols.className = "wb-key-cols";
        kp.cols = [document.createElement("div"), document.createElement("div")];
        kp.cols.forEach(function (c) { c.className = "wb-key-col"; cols.appendChild(c); });
        kp.content.appendChild(cols);
        kp.col = 0;
      };
      var columnFits = function () {
        return kp.cols[kp.col].getBoundingClientRect().bottom <= kp.body.getBoundingClientRect().bottom + 0.5;
      };
      keyPage();
      units(entries, false).forEach(function (unit) {
        for (;;) {
          var col = kp.cols[kp.col];
          var had = col.children.length;
          unit.forEach(function (b) { col.appendChild(b); });
          if (columnFits() || !had) return;
          unit.forEach(function (b) { col.removeChild(b); });
          if (kp.col === 0) kp.col = 1; else keyPage();
        }
      });
      key.parentNode.removeChild(key);
    }

    // Results: one page.
    var results = wb.querySelector('[data-flow="results"]');
    if (results) {
      var rp = newPage("results");
      list(results.children).forEach(function (b) { rp.content.appendChild(b); });
      results.parentNode.removeChild(results);
    }

    // Footers.
    var total = made.length;
    made.forEach(function (p, i) {
      p.number.textContent = "Page " + (i + 1) + " of " + total;
      p.page.setAttribute("data-page", String(i + 1));
    });
    wb.classList.add("wb--paged");
    root.setAttribute("data-layout", "ready");
  }
  try {
    // Lay out once the embedded fonts have loaded, so measurements are final.
    document.body.getBoundingClientRect();
    Promise.all(families.map(function (f) {
      return Promise.all([document.fonts.load('400 16px "' + f + '"'), document.fonts.load('700 16px "' + f + '"')]);
    })).then(function () { return document.fonts.ready; }).then(function () {
      try { layout(); } catch (e) { fail(e); }
    }, fail);
  } catch (e) { fail(e); }
})();`;
