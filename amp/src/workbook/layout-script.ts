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
 *   student work; the results page is last, fitted to one page;
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
  function fail(error) {
    // Put the unpaged blocks back, so a failed layout still prints whole
    // through CSS page breaks rather than half composed.
    var wb = document.querySelector(".wb");
    if (backup && wb) wb.parentNode.replaceChild(backup, wb);
    else if (wb) wb.style.display = "";
    root.setAttribute("data-layout", "error");
    console.error("Workbook layout failed:", error && error.stack ? error.stack : error);
  }
  function list(nodes) { return Array.prototype.slice.call(nodes); }
  function height(el) { return el.getBoundingClientRect().height; }
  var backup = null;
  function layout() {
    var wb = document.querySelector(".wb");
    backup = wb.cloneNode(true);
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
    // Scale a unit down by up to 8% so it fits the page; true when it does.
    function shrink(unit) {
      var total = unit.reduce(function (sum, b) { return sum + height(b); }, 0);
      var over = height(current.content) - height(current.body);
      if (over > 0.08 * total) return false;
      var zoom = 1 - (over + 2) / total;
      unit.forEach(function (b) { b.style.zoom = zoom.toFixed(4); });
      if (fits(current)) return true;
      unit.forEach(function (b) { b.style.zoom = ""; });
      return false;
    }
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
        // A heading and first problem that miss this page by a few percent
        // would leave most of it blank (the cover's page, say): they print a
        // touch smaller instead.
        if (spare > 0.5 * height(current.body)) {
          append(unit);
          if (shrink(unit)) return;
          detach(unit);
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
    // A lesson card must fit one page with its heading. A long one stacks
    // its idea and worked example, then gives up content one rank at a time
    // in the order render.tsx assigns (cardTrimRanks: extra paragraphs, the
    // pitfall, later sentences, the diagram, words to know, later example
    // steps, the example's figure), gives back whatever still fits, then
    // prints slightly smaller (never below 75%). When example steps go, the
    // card points to the answer key and the key prints the whole example.
    var probe = newPage("student");
    var pageHeight = height(probe.body);
    pages.removeChild(probe.page);
    made.pop();
    list(flow.querySelectorAll("[data-fit]")).forEach(function (block) {
      var limit = pageHeight - 0.8 * 96;
      // A long worked example beside the idea first takes the full width.
      var card = block.querySelector(".wb-lesson");
      if (card && height(block) > limit) card.classList.add("wb-lesson--stacked");
      var ranks = [];
      list(block.querySelectorAll("[data-trim]")).forEach(function (el) {
        var rank = Number(el.getAttribute("data-trim"));
        if (ranks.indexOf(rank) < 0) ranks.push(rank);
      });
      ranks.sort(function (a, b) { return a - b; });
      // The pointer to the answer key shows whenever an example step is
      // left out, and is measured with the card.
      var more = block.querySelector("[data-steps-more]");
      function setTrim(rank, on) {
        list(block.querySelectorAll('[data-trim="' + rank + '"]')).forEach(function (el) {
          if (on) el.setAttribute("data-trimmed", "");
          else el.removeAttribute("data-trimmed");
        });
        if (!more) return;
        if (block.querySelector(".wb-example-steps [data-trimmed]")) more.removeAttribute("hidden");
        else more.setAttribute("hidden", "");
      }
      var trimmed = [];
      for (var r = 0; r < ranks.length && height(block) > limit; r++) {
        setTrim(ranks[r], true);
        trimmed.push(ranks[r]);
      }
      // Then give back what still fits, most valued first (the reverse of
      // the trim order): a large figure dropped late can make room for the
      // steps dropped before it.
      // An item comes back only after the one before it in its list (steps,
      // paragraphs, sentences, words), so nothing prints with a gap.
      function gapped(rank) {
        return list(block.querySelectorAll('[data-trim="' + rank + '"]')).some(function (el) {
          var before = el.previousElementSibling;
          return !!before && before.hasAttribute("data-trimmed");
        });
      }
      if (height(block) <= limit)
        for (var t = trimmed.length - 2; t >= 0; t--) {
          if (gapped(trimmed[t])) continue;
          setTrim(trimmed[t], false);
          if (height(block) > limit) setTrim(trimmed[t], true);
        }
      // The key prints the whole worked example when the card left out any
      // of it (a step or its figure).
      if (block.querySelector(".wb-example [data-trimmed]"))
        list(document.querySelectorAll("[data-key-example]")).forEach(function (el) {
          el.removeAttribute("hidden");
        });
      for (var zoom = 0.95; zoom >= 0.749 && height(block) > limit; zoom -= 0.05)
        block.style.zoom = zoom.toFixed(2);
    });

    // A problem too wide for half the page (a long formula, a wide table)
    // takes its own full-width row.
    list(flow.querySelectorAll(".wb-row")).forEach(function (row) {
      var items = list(row.children);
      if (items.length < 2) return;
      var tooWide = items.some(function (item) {
        return item.scrollWidth > item.clientWidth + 1;
      });
      if (!tooWide) return;
      var next = row.cloneNode(false);
      next.appendChild(items[1]);
      row.parentNode.insertBefore(next, row.nextSibling);
    });
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
        if (height(p.body) - height(p.content) < 1 * 96) return;
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
       function () { return 7 * 96; },
       // A page that still has a hole (one tall problem alone) takes it all
       // as workspace: a page is never left part empty.
       function () { return 1e6; }]
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

    // Results: always one page. The roomiest density that fits (three
    // columns, four columns, a compact heading, compact tiles), then the
    // tiles print smaller, never below 70%. A results proof holds many.
    list(wb.querySelectorAll('[data-flow="results"]')).forEach(function (results) {
      var rp = newPage("results");
      list(results.children).forEach(function (b) { rp.content.appendChild(b); });
      results.parentNode.removeChild(results);
      var fit = rp.content.querySelector("[data-results-fit]");
      if (!fit) return;
      var grid = fit.querySelector(".wb-results-grid");
      for (var density = 0; density <= 3; density++) {
        fit.setAttribute("data-density", String(density));
        if (fits(rp)) break;
      }
      for (var shrink = 0.95; grid && shrink >= 0.699 && !fits(rp); shrink -= 0.05)
        grid.style.zoom = shrink.toFixed(2);
    });

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
    // Lay out once every embedded font has loaded, so measurements are
    // final. The workbook is hidden meanwhile: a browser that reflows the
    // whole document as each font arrives (Firefox) would otherwise spend
    // seconds on it.
    var wb = document.querySelector(".wb");
    wb.style.display = "none";
    var faces = [];
    document.fonts.forEach(function (face) { faces.push(face.load()); });
    // Embedded fonts load in well under a second; never wait forever.
    var patience = new Promise(function (resolve) { setTimeout(resolve, 8000); });
    Promise.race([Promise.all(faces), patience]).then(function () {
      wb.style.display = "";
      try { layout(); } catch (e) { fail(e); }
    }, function (error) {
      wb.style.display = "";
      fail(error);
    });
  } catch (e) { fail(e); }
})();`;
