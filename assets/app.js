/* ============================================================
   Linux, from the inside — render engine
   Content contract lives in assets/chapters/*.js (LX.push)
   ============================================================ */
(function () {
  "use strict";

  var LX = window.LX;
  if (!LX || !LX.chapters || !LX.chapters.length) {
    document.getElementById("main").innerHTML =
      "<p>No chapter data loaded. Check the <code>assets/chapters/*.js</code> files.</p>";
    return;
  }

  /* ---------- helpers ---------- */
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  var C = {
    accent: 'var(--accent)', violet: 'var(--violet)', ok: 'var(--ok)',
    warn: 'var(--warn)', bad: 'var(--bad)', pink: 'var(--pink)'
  };

  /* ---------- renderers ---------- */
  var R = {};

  R.prose = function (s) {
    var h = "";
    if (s.h) h += "<h3 class='sec' id='" + slug(s.h) + "'>" + s.h + "</h3>";
    (s.p || []).forEach(function (p) { h += "<p>" + p + "</p>"; });
    if (s.ul) h += "<ul>" + s.ul.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>";
    if (s.ol) h += "<ol>" + s.ol.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ol>";
    if (s.note) {
      var kind = s.noteKind || "tip";
      h += "<div class='callout " + kind + "'><span class='c-title'>" +
        (s.noteTitle || kind) + "</span><p>" + s.note + "</p></div>";
    }
    return h;
  };

  R.callout = function (s) {
    return "<div class='callout " + (s.kind || "tip") + "'><span class='c-title'>" +
      esc(s.title || s.kind || "note") + "</span><p>" + (s.text || "") + "</p></div>";
  };

  R.diagram = function (s, ch) {
    var n = (LX.figureNo = (LX.figureNo || 0) + 1);
    return "<figure class='fig' id='" + (ch.id + "-fig-" + n) + "' data-svg='" + esc(s.svg) + "'>" +
      "<div class='fig-bar'><span class='fig-n'>fig " + n + "</span>" +
      "<span class='fig-t'>" + esc(s.h || "") + "</span>" +
      "<button class='zoom' type='button'>zoom</button></div>" +
      "<div class='fig-canvas'>" + s.svg + "</div>" +
      (s.caption ? "<figcaption>" + s.caption + "</figcaption>" : "") +
      "</figure>";
  };

  R.code = function (s) {
    var code = (s.code || "").replace(/^\n/, "");
    return "<div class='code'><div class='code-bar'><span class='lang'>" + esc(s.lang || "sh") + "</span>" +
      "<span class='what'>" + esc(s.what || "") + "</span>" +
      "<button class='copy' type='button'>copy</button></div><pre><code>" + esc(code) + "</code></pre></div>";
  };

  R.table = function (s) {
    var h = "<div class='tablewrap'><table><thead><tr>" +
      s.cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>";
    (s.rows || []).forEach(function (r) {
      h += "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
    });
    return h + "</tbody></table></div>";
  };

  R.cards = function (s) {
    return "<div class='cards'>" + (s.items || []).map(function (i) {
      return "<div class='card " + (i.tone ? "c-" + i.tone : "") + "'>" +
        "<h4>" + (i.title || "") + (i.tag ? " <span class='tag'>" + esc(i.tag) + "</span>" : "") + "</h4>" +
        "<p>" + (i.text || "") + "</p></div>";
    }).join("") + "</div>";
  };

  R.kv = function (s) {
    return "<div class='kv'>" + (s.items || []).map(function (i) {
      return "<div class='k'>" + i.k + "</div><div class='v'>" + i.v + "</div>";
    }).join("") + "</div>";
  };

  R.steps = function (s) {
    return "<div class='steps'>" + (s.items || []).map(function (i, n) {
      return "<div class='step' data-n='" + (n + 1) + "'><b>" + (i.t || i.title || "") +
        "</b><span>" + (i.d || i.text || "") + "</span></div>";
    }).join("") + "</div>";
  };

  /* ---------- chapter rendering ---------- */
  function renderChapter(ch, idx) {
    var h = "";
    var num = String(idx).padStart(2, "0");
    h += "<section class='chapter' id='" + ch.id + "'>";
    h += "<div class='ch-head'><div class='ch-num'>" + (ch.num || num) + "</div><div class='body'>" +
      "<h2>" + ch.title + "</h2>" +
      (ch.tagline ? "<p class='tagline'>" + ch.tagline + "</p>" : "") + "</div></div>";

    (ch.sections || []).forEach(function (s) {
      var fn = R[s.type];
      if (!fn) { h += "<p class='dim'>[unknown block type: " + esc(s.type) + "]</p>"; return; }
      h += fn(s, ch);
    });

    if (ch.takeaways && ch.takeaways.length) {
      h += "<div class='takeaways'><h4>Key takeaways</h4><ol>" +
        ch.takeaways.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol></div>";
    }
    if (ch.glossary) {
      Object.keys(ch.glossary).forEach(function (k) { LX.glossary[k] = ch.glossary[k]; });
    }
    return h + "</section>";
  }

  /* ---------- hero ---------- */
  var main = document.getElementById("main");
  var hero = el(
    "<div class='hero' id='top'>" +
    "<div class='kicker'>interactive systems map</div>" +
    "<h1>Linux, <em>from the inside</em></h1>" +
    "<p class='lede'>Not a command list. A map of the machine: what talks to what, what runs where, " +
    "and which mechanism makes each guarantee. Eighteen chapters from firmware to a running pod, " +
    "each one drawn so you can see the shape of it before you read the words.</p>" +
    "<div class='stats'>" +
    "<span class='chip'><b>18</b> chapters</span>" +
    "<span class='chip'><b>Debian/Ubuntu</b> + systemd baseline</span>" +
    "<span class='chip'><b>kernel 4.15 → 6.x</b> covered</span>" +
    "<span class='chip'><b>containerd</b> + <b>Kubernetes</b> internals</span>" +
    "<span class='chip'>works <b>offline</b></span>" +
    "</div>" +
    "<p class='dim' style='font-size:14px;max-width:72ch'>Start with chapter 00 — it is the whole machine on one screen, " +
    "and every box on it is a link. If you only have twenty minutes, read 04 (isolation) and 13 (containers) and 14 (Kubernetes): " +
    "that trio is where modern ops actually lives.</p>" +
    "</div>");
  main.appendChild(hero);
  LX.chapters.forEach(function (ch, i) { main.appendChild(el(renderChapter(ch, i))); });

  /* ---------- diagram text fitting ----------
     Monospace text in a diagram is easy to overflow its box: a character is ~0.6em
     wide, so a 70-character line at font-size 14 needs ~590 viewBox units. Rather
     than hand-wrap hundreds of lines, measure each label against the box it sits in
     and compress it to fit: letter spacing first (which reads as condensed
     monospace), glyph scaling for the mild cases, font scaling for the severe ones. */
  var PAD = 10;
  function fitDiagrams() {
    document.querySelectorAll("figure.fig svg").forEach(function (svg) {
      var vb = svg.viewBox && svg.viewBox.baseVal;
      if (!vb || !vb.width) return;
      var rects = [];
      svg.querySelectorAll("rect").forEach(function (r) {
        // boxes are classed box, box-a, box-v, box-ok, box-w, box-b, box-p …
        if (!/^box(\s|$|-)/.test(r.getAttribute("class") || "")) return;
        var x = parseFloat(r.getAttribute("x")), y = parseFloat(r.getAttribute("y"));
        var w = parseFloat(r.getAttribute("width")), h = parseFloat(r.getAttribute("height"));
        if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) rects.push({ x: x, y: y, w: w, h: h });
      });

      function hostFor(tx, ty) {
        for (var i = 0; i < rects.length; i++) {
          var r = rects[i];
          if (tx >= r.x - 2 && tx <= r.x + r.w && ty >= r.y - 2 && ty <= r.y + r.h) return r;
        }
        return null;
      }
      function startX(el) {
        var x = parseFloat(el.getAttribute("x") || "0"); if (isNaN(x)) x = 0;
        var bb; try { bb = el.getBBox(); } catch (e) { return x; }
        var a = el.getAttribute("text-anchor");
        if (a === "middle") return x - bb.width / 2;
        if (a === "end") return x - bb.width;
        return x;
      }
      // squeeze one label so it stays inside `right`
      function squeeze(el, right) {
        var bb; try { bb = el.getBBox(); } catch (e) { return; }
        if (!bb || bb.width < 1) return;
        var limit = right - bb.x;
        if (limit < bb.width * 0.16) return;
        var ratio = limit / bb.width;
        if (!isFinite(ratio) || ratio >= 0.995) return;

        // Far too long to condense without becoming unreadable: wrap it instead.
        if (ratio < 0.6 && el.tagName === "text" && !el.querySelector("tspan")) {
          var fs = parseFloat(getComputedStyle(el).fontSize);
          var chars = Math.max(12, Math.floor(limit / (bb.width / Math.max(1, el.textContent.length))));
          var words = el.textContent.split(/\s+/), lines = [], cur = "";
          words.forEach(function (w) {
            if (cur && (cur.length + 1 + w.length) > chars) { lines.push(cur); cur = w; }
            else cur = cur ? cur + " " + w : w;
          });
          if (cur) lines.push(cur);
          if (lines.length > 1 && lines.length <= 4) {
            var xA = el.getAttribute("x");
            while (el.firstChild) el.removeChild(el.firstChild);
            lines.forEach(function (ln, i) {
              var sp = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
              sp.textContent = ln;
              if (xA !== null) sp.setAttribute("x", xA);
              if (i > 0) sp.setAttribute("dy", (fs * 1.2).toFixed(1));
              el.appendChild(sp);
            });
            return;
          }
        }

        if (ratio >= 0.6) {
          // always scale glyphs, never the spacing: negative letter-spacing makes
          // monospace characters collide and turns readable text into a smear
          el.setAttribute("textLength", limit);
          el.setAttribute("lengthAdjust", "spacingAndGlyphs");
        } else {
          var size = parseFloat(getComputedStyle(el).fontSize);
          el.style.fontSize = (size * 0.88) + "px";
          var bb2 = el.getBBox();
          if (bb2.width > limit) {
            el.setAttribute("textLength", limit);
            el.setAttribute("lengthAdjust", "spacingAndGlyphs");
          }
        }
      }

      svg.querySelectorAll("text").forEach(function (t) {
        var fs = parseFloat(getComputedStyle(t).fontSize);
        var raw = t.textContent;

        // SVG collapses newlines into spaces, so a multi-line label drawn with \n
        // renders as one unreadable long line. Give each line its own tspan first.
        if (!t.querySelector("tspan") && raw.indexOf("\n") > -1) {
          var lines = raw.split("\n");
          var xAttr = t.getAttribute("x");
          while (t.firstChild) t.removeChild(t.firstChild);
          lines.forEach(function (line, i) {
            var sp = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            sp.textContent = line;
            if (xAttr !== null) sp.setAttribute("x", xAttr);
            if (i > 0) sp.setAttribute("dy", (fs * 1.25).toFixed(1));
            t.appendChild(sp);
          });
        }

        var bbT; try { bbT = t.getBBox(); } catch (e) { return; }
        var ty = parseFloat(t.getAttribute("y") || "0");
        if (isNaN(ty)) ty = 0;
        ty -= fs * 0.85;
        var host = hostFor(startX(t), ty);
        var right = host ? (host.x + host.w - PAD) : (vb.x + vb.width - PAD);

        // a tspan only means "several lines" if it carries its own position
        var lines = [...t.querySelectorAll("tspan")].filter(function (sp) {
          return sp.hasAttribute("x") || sp.hasAttribute("dy") || sp.hasAttribute("x1");
        });
        if (lines.length) lines.forEach(function (sp) { squeeze(sp, right); });
        else squeeze(t, right);

        /* Vertical pass: a label with more lines than its box was sized for spills
           out of the bottom. Shrink the whole label until it fits the box height,
           then re-fit horizontally (a smaller label may no longer need squeezing). */
        if (host) {
          var b2; try { b2 = t.getBBox(); } catch (e) { return; }
          var avail = host.h - PAD;
          if (b2.height > avail && avail > 0) {
            var factor = Math.max(0.7, avail / b2.height) * 0.985;
            var fs2 = parseFloat(getComputedStyle(t).fontSize);
            t.style.fontSize = (fs2 * factor).toFixed(2) + "px";
            t.style.fontSize = (parseFloat(getComputedStyle(t).fontSize) * 0.985).toFixed(2) + "px";
            var l2 = [...t.querySelectorAll("tspan")].filter(function (sp) {
              return sp.hasAttribute("x") || sp.hasAttribute("dy");
            });
            if (l2.length) l2.forEach(function (sp) { squeeze(sp, right); });
            else squeeze(t, right);
          }
        }
      });
    });
  }

  /* ---------- toc ---------- */
  var toc = document.getElementById("toc");
  var groups = [
    { name: "Orientation", max: 0 },
    { name: "The machine", max: 4 },
    { name: "Living on it", max: 8 },
    { name: "Running things", max: 14 },
    { name: "Production", max: 17 }
  ];
  var tocHtml = "<div class='toc-group'>Orientation</div>";
  LX.chapters.forEach(function (ch, i) {
    while (groups.length && i > groups[0].max) { groups.shift(); tocHtml += "<div class='toc-group'>" + groups[0].name + "</div>"; }
    tocHtml += "<a href='#" + ch.id + "' data-toc='" + ch.id + "'><span class='n'>" + String(i).padStart(2, "0") +
      "</span><span>" + ch.title + "</span></a>";
  });
  toc.innerHTML = tocHtml;

  /* ---------- scrollspy + progress ---------- */
  var bar = document.getElementById("progressBar");
  var links = {};
  Array.prototype.forEach.call(toc.querySelectorAll("a"), function (a) { links[a.dataset.toc] = a; });
  var secs = Array.prototype.slice.call(document.querySelectorAll("section.chapter"));
  function onScroll() {
    var h = document.documentElement;
    var p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    bar.style.width = (p * 100).toFixed(2) + "%";
    var mark = h.scrollTop + 140, cur = secs[0];
    for (var i = 0; i < secs.length; i++) if (secs[i].offsetTop <= mark) cur = secs[i];
    Object.keys(links).forEach(function (k) { links[k].classList.toggle("active", k === cur.id); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- search ---------- */
  var input = document.getElementById("search");
  var results = document.getElementById("searchResults");
  /* Strip markup to plain text for the search index. This must NOT go through
     innerHTML: the index contains raw <svg> markup, and parsing that as HTML
     throws a parse error for every attribute in it. */
  function plain(s) {
    return String(s == null ? "" : s)
      .replace(/<[^>]*>/g, " ")
      .replace(/\\(["\\])/g, "$1")
      .replace(/[{}[\]",:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  var INDEX = LX.chapters.map(function (ch) {
    return {
      id: ch.id, title: ch.title, tagline: ch.tagline || "",
      blocks: (ch.sections || []).map(function (s) {
        var label = s.h || s.what || s.title || (s.cols && s.cols.join(" ")) ||
          (s.items && s.items.map(function (i) { return i.t || i.k || i.title || ""; }).join(" ")) || "";
        return { label: label, text: plain(JSON.stringify(s).replace(/[{}\[\]",:]/g, " ")) };
      })
    };
  });

  function doSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { results.hidden = true; results.innerHTML = ""; return; }
    var hits = [];
    INDEX.forEach(function (ch) {
      var titleHit = (ch.title + " " + ch.tagline).toLowerCase().indexOf(q) >= 0;
      ch.blocks.forEach(function (b, i) {
        var at = (b.label + " " + b.text).toLowerCase().indexOf(q);
        if (at < 0) return;
        var lo = Math.max(0, at - 60);
        var snip = (lo > 0 ? "…" : "") + b.text.slice(lo, lo + 170) + "…";
        hits.push({
          ch: ch.id, anchor: "sec-" + i, score: (titleHit ? 0 : 1) + at / 1000,
          label: (titleHit ? "<b>" + ch.title + "</b>" : "<b>" + ch.title + "</b> &middot; " + esc(b.label)),
          snip: esc(snip).replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>")
        });
      });
    });
    hits.sort(function (a, b) { return a.score - b.score; });
    hits = hits.slice(0, 14);
    results.innerHTML = hits.length
      ? hits.map(function (h) {
          return "<a class='sr-item' href='#" + h.ch + (h.anchor === "sec-0" ? "" : "") + "' data-ch='" + h.ch +
            "'><b style='display:none'></b>" + h.label + "<small>" + h.snip + "</small></a>";
        }).join("")
      : "<div class='sr-empty'>No match for “" + esc(q) + "”.</div>";
    results.hidden = false;
  }
  var t;
  input.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { doSearch(input.value); }, 110); });
  input.addEventListener("focus", function () { if (input.value) doSearch(input.value); });
  results.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-ch]"); if (!a) return;
    var ch = LX.chapters.filter(function (c) { return c.id === a.dataset.ch; })[0];
    if (ch) {
      var h3s = document.querySelectorAll("#" + ch.id + " h3.sec");
      results.hidden = true; input.blur();
      document.getElementById(ch.id).scrollIntoView({ behavior: "smooth" });
    }
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".search-wrap")) results.hidden = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    if (e.key === "Escape") { results.hidden = true; input.blur(); }
  });

  /* ---------- copy buttons ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".code-bar .copy"); if (!b) return;
    var txt = b.closest(".code").querySelector("code").textContent;
    navigator.clipboard && navigator.clipboard.writeText(txt);
    b.textContent = "copied"; setTimeout(function () { b.textContent = "copy"; }, 1200);
  });

  /* ---------- diagram lightbox (pan + zoom) ---------- */
  var lb = document.getElementById("lightbox"),
      stage = document.getElementById("lightboxStage"),
      canvas = document.getElementById("lightboxCanvas"),
      lbTitle = document.getElementById("lightboxTitle");
  var view = { x: 40, y: 40, k: 1 };

  function fitToStage(svg) {
    var vb = (svg.getAttribute("viewBox") || "0 0 1000 600").split(/\s+/).map(Number);
    var sw = stage.clientWidth - 60, sh = stage.clientHeight - 60;
    var k = Math.min(sw / (vb[2] || 1000), sh / (vb[3] || 600));
    view.k = Math.max(0.2, k);
    view.x = (sw - (vb[2] || 1000) * view.k) / 2 + 20;
    view.y = (sh - (vb[3] || 600) * view.k) / 2 + 20;
    apply();
  }
  function apply() {
    canvas.style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.k + ")";
  }
  function openLb(fig) {
    var svg = fig.querySelector("svg");
    var vb = (svg.getAttribute("viewBox") || "0 0 1000 600").split(/\s+/).map(Number);
    canvas.innerHTML = "";
    var clone = svg.cloneNode(true);
    clone.removeAttribute("width"); clone.removeAttribute("height");
    clone.style.width = (vb[2] || 1000) + "px";
    clone.style.height = (vb[3] || 600) + "px";
    canvas.appendChild(clone);
    lbTitle.textContent = fig.querySelector(".fig-t").textContent;
    lb.hidden = false;
    fitToStage(clone);
  }
  document.addEventListener("click", function (e) {
    var z = e.target.closest(".fig-bar .zoom"); if (!z) return;
    openLb(z.closest(".fig"));
  });
  document.getElementById("lightboxClose").addEventListener("click", function () { lb.hidden = true; });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target === stage) lb.hidden = true; });
  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    var f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    var r = stage.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    view.x = mx - (mx - view.x) * f; view.y = my - (my - view.y) * f;
    view.k = Math.min(6, Math.max(0.15, view.k * f));
    apply();
  }, { passive: false });
  var drag = null;
  stage.addEventListener("pointerdown", function (e) {
    drag = { x: e.clientX - view.x, y: e.clientY - view.y };
    stage.classList.add("dragging"); stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", function (e) {
    if (!drag) return;
    view.x = e.clientX - drag.x; view.y = e.clientY - drag.y; apply();
  });
  stage.addEventListener("pointerup", function () { drag = null; stage.classList.remove("dragging"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") lb.hidden = true; });

  /* ---------- glossary drawer ---------- */
  var drawer = document.getElementById("drawer"),
      gbody = document.getElementById("glossaryBody"),
      gsearch = document.getElementById("glossarySearch");
  function renderGlossary(q) {
    q = (q || "").toLowerCase();
    var keys = Object.keys(LX.glossary).filter(function (k) {
      return !q || k.toLowerCase().indexOf(q) >= 0 || LX.glossary[k].toLowerCase().indexOf(q) >= 0;
    }).sort();
    gbody.innerHTML = keys.length
      ? keys.map(function (k) { return "<div class='gloss-item'><b>" + esc(k) + "</b><span>" + esc(LX.glossary[k]) + "</span></div>"; }).join("")
      : "<p class='dim'>No matching term.</p>";
  }
  document.getElementById("glossaryBtn").addEventListener("click", function () { renderGlossary(""); drawer.hidden = false; gsearch.focus(); });
  document.getElementById("drawerClose").addEventListener("click", function () { drawer.hidden = true; });
  drawer.addEventListener("click", function (e) { if (e.target === drawer) drawer.hidden = true; });
  gsearch.addEventListener("input", function () { renderGlossary(gsearch.value); });

  /* ---------- theme + print + mobile nav ---------- */
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("lx-theme"); } catch (e) {}
  if (saved) root.dataset.theme = saved;
  document.getElementById("themeBtn").addEventListener("click", function () {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    try { localStorage.setItem("lx-theme", root.dataset.theme); } catch (e) {}
  });
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
  document.getElementById("navToggle").addEventListener("click", function () {
    document.getElementById("sidebar").classList.toggle("open");
  });
  toc.addEventListener("click", function (e) {
    if (e.target.closest("a")) document.getElementById("sidebar").classList.remove("open");
  });

  /* ---------- deep links: #section-slug ---------- */
  document.addEventListener("click", function (e) {
    var j = e.target.closest("svg g.jump[data-jump]");
    if (!j) return;
    var dest = document.getElementById(j.dataset.jump);
    if (dest) dest.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* fit diagram text last: PAD and the helpers above must be initialised first */
  fitDiagrams();

  LX.ready = true;
})();