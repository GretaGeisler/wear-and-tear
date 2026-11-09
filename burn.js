// Wear and Tear – burn-in. Include on EVERY page:  <script src="/burn.js"></script>
//
// - Cursor burns live on the SCREEN (same position on every page).
// - Text burns (ghosts) belong to the page where they happened.
// - Your own traces are kept in this browser forever (localStorage).
// - Traces of ALL visitors are shared through the small server (server.js, /api/visits),
//   or through the Claude artifact database when hosted as an artifact.
//   Without either, only your own traces are shown ("offline").
(function () {
  "use strict";

  var S = 6; // cell size in px
  var HALO = 24; // soft glow around a cursor burn
  var STILL_MS = 400; // mouse must rest this long before it starts to burn in
  var BURN_AT = 40; // how much "use" burns a cell to full strength
  var CLICK_W = 1,
    HOVER_W = 0.15; // a click = 1 unit, 1 s of resting = 0.15 units
  // elements that can burn in: headings, paragraphs, quotes, list links, .text, or anything with data-burn
  var SEL =
    window.WT_SEL ||
    "h1,h2,h3,h4,h5,h6,p,blockquote,figcaption,#list a,.text,[data-burn]";
  var API = window.WT_API || "/api/visits";
  var PAGE =
    location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";
  var LKEY = "wt2_burn";
  var PK = "p:" + PAGE; // counter for everything done on THIS page (clicks / resting time)

  var stage = document.getElementById("stage");
  if (!stage) return;

  // burn colour = --burn in style.css (falls back to the text colour)
  function hexToRgb(h) {
    h = (h || "").trim().replace("#", "");
    if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
    if (!/^[0-9a-f]{6}$/i.test(h)) return "255,255,255";
    return [0, 2, 4]
      .map(function (i) {
        return parseInt(h.substr(i, 2), 16);
      })
      .join(",");
  }
  var rootCss = getComputedStyle(document.documentElement);
  var FGRGB = hexToRgb(rootCss.getPropertyValue("--burn") || rootCss.getPropertyValue("--fg"));

  // ---- make sure the layers exist on every page ----
  (function ensure() {
    var b = document.body;
    if (!document.getElementById("rough"))
      b.insertAdjacentHTML(
        "afterbegin",
        '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
          '<filter id="rough" x="0" y="0" width="100%" height="100%">' +
          '<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4" result="n"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>' +
          "</filter></svg>",
      );
    if (!document.getElementById("ghosts")) {
      var g = document.createElement("div");
      g.id = "ghosts";
      b.insertBefore(g, b.firstChild);
    }
    if (!document.getElementById("wear")) {
      var c = document.createElement("canvas");
      c.id = "wear";
      b.insertBefore(c, b.firstChild);
    }
    // corner info + "Show the Traces" button on every page (the start page has its own copy)
    if (!document.getElementById("hud-l"))
      b.insertAdjacentHTML(
        "beforeend",
        '<div class="hud" id="hud-l">USER #\u2026\u2003\u20030 clicks</div>' +
          '<div class="hud" id="hud-r"><span id="hud-xy">X ---- Y ----</span>' +
          '<span id="hud-clock">--:--:--</span></div>' +
          '<button id="tog">SHOW TRACES</button>',
      );
  })();

  var cv = document.getElementById("wear");
  var ctx = cv.getContext("2d");

  // ---- state ----
  // me.pos / others.pos: where on the SCREEN an element was when it was last used
  var me = { clicks: {}, hover: {}, pos: {} };
  var others = { clicks: {}, hover: {}, pos: {}, visitors: 0 };
  var lastHitInfo = "-";
  var dirty = false,
    redraw = true,
    curCell = null,
    lx = -1,
    ly = -1,
    xyDirty = false,
    lastMove = 0,
    writing = false;
  var myId = null,
    myFirst = 0,
    myRank = null,
    net = "wait", // wait | on | off
    push = null; // function(doc) -> promise, set when a shared store is reachable

  function lget(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lset(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }

  myId = lget("wt2_id");
  myFirst = +lget("wt2_first") || 0;
  if (!myId) {
    myId = Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
    lset("wt2_id", myId);
  }
  if (!myFirst) {
    myFirst = Date.now();
    lset("wt2_first", String(myFirst));
  }
  me = readMine();

  // Everything we count also goes into `delta`. Saving MERGES the delta into what is stored
  // (it never overwrites), so burns made on other pages or tabs - or a page that comes back from
  // the browser's back/forward cache with old data - can never wipe each other out.
  var delta = { clicks: {}, hover: {}, pos: {} };
  var needPush = false;
  function readMine() {
    try {
      var v = JSON.parse(lget(LKEY));
      if (v && v.clicks && v.hover && v.pos) return v;
    } catch (e) {}
    return { clicks: {}, hover: {}, pos: {} };
  }
  function hasDelta() {
    for (var kind in delta) for (var k in delta[kind]) return true;
    return false;
  }
  function r2(v) {
    return Math.round(v * 100) / 100;
  }
  function commit() {
    var had = hasDelta();
    var st = readMine(),
      k;
    for (k in delta.clicks) st.clicks[k] = r2((st.clicks[k] || 0) + delta.clicks[k]);
    for (k in delta.hover) st.hover[k] = r2((st.hover[k] || 0) + delta.hover[k]);
    for (k in delta.pos) st.pos[k] = delta.pos[k];
    delta = { clicks: {}, hover: {}, pos: {} };
    me = st;
    if (had) {
      lset(LKEY, JSON.stringify(st));
      needPush = true;
      redraw = true;
    }
    return had;
  }

  // cells are in SCREEN (viewport) coordinates, so the burn stays on the screen
  function cellAt(e) {
    var x = e.clientX,
      y = e.clientY;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight)
      return null;
    return Math.floor(x / S) + "_" + Math.floor(y / S);
  }
  function add(map, k, v) {
    map[k] = Math.round(((map[k] || 0) + v) * 100) / 100;
  }

  // element keys are per page: "e:<page>#<index>"
  function ekey(i) {
    return "e:" + PAGE + "#" + i;
  }
// neu, direkt unter ekey():
function keyOf(el, i) {
  var id = el.tagName === "A" ? el.getAttribute("href") : null;
  return "e:" + PAGE + "#" + (id || i);
}

  function elList() {
    return stage.querySelectorAll(SEL);
  }
  function hit(t) {
    var el = t && t.closest ? t.closest(SEL) : null;
    if (!el || !stage.contains(el)) return null;
    var l = elList();
    for (var i = 0; i < l.length; i++)
      if (l[i] === el) return { el: el, key: ekey(i) };
    return null;
  }
  function mark(h) {
    var r = h.el.getBoundingClientRect();
    var arr = [
      Math.round(r.left),
      Math.round(r.top),
      Math.ceil(r.width) + 2, // a little extra so the ghost never wraps differently
      Math.ceil(r.height),
    ];
    me.pos[h.key] = arr;
    delta.pos[h.key] = arr;
  }

  document.addEventListener(
    "pointerdown",
    function (e) {
      var c = cellAt(e);
      if (!c) return;
      add(me.clicks, c, 1);
      add(delta.clicks, c, 1);
      add(me.clicks, PK, 1);
      add(delta.clicks, PK, 1);
      var h = hit(e.target);
      lastHitInfo =
        e.target.tagName + " -> " + (h ? h.key : "NO MATCH (not a burn element)");
      if (h) {
        add(me.clicks, h.key, 1);
        add(delta.clicks, h.key, 1);
        mark(h);
      }
      dirty = true;
      redraw = true;
      showHud();
    },
    true,
  );
  document.addEventListener(
    "pointermove",
    function (e) {
      curCell = cellAt(e);
      lx = e.clientX;
      ly = e.clientY;
      lastMove = Date.now();
      xyDirty = true;
    },
    true,
  );
  document.addEventListener("pointerleave", function () {
    curCell = null;
  });

  // hover burn: only while the mouse is RESTING on a spot (not while it moves)
  setInterval(function () {
    var still = Date.now() - lastMove;
    if (!curCell || document.hidden || still < STILL_MS || still > 15000)
      return;
    add(me.hover, curCell, 0.1);
    add(delta.hover, curCell, 0.1);
    add(me.hover, PK, 0.1);
    add(delta.hover, PK, 0.1);
    var h = hit(document.elementFromPoint(lx, ly));
    if (h) {
      add(me.hover, h.key, 0.1);
      add(delta.hover, h.key, 0.1);
      mark(h);
    }
    dirty = true;
    redraw = true;
  }, 100);

  function wearAt(k) {
    var v =
      ((me.clicks[k] || 0) + (others.clicks[k] || 0)) * CLICK_W +
      ((me.hover[k] || 0) + (others.hover[k] || 0)) * HOVER_W;
    return 1 - Math.exp((-v / BURN_AT) * 2.2); // 0 = pristine, -> 1 = fully burnt
  }

  function size() {
    var d = window.devicePixelRatio || 1;
    cv.width = Math.round(window.innerWidth * d);
    cv.height = Math.round(window.innerHeight * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    redraw = true;
  }
  size();
  window.addEventListener("resize", size);
  window.addEventListener("load", function () {
    redraw = true;
  });
  if (document.fonts)
    document.fonts.ready.then(function () {
      redraw = true;
    });

  function draw() {
    var w = window.innerWidth,
      h = window.innerHeight,
      keys = {},
      k,
      p,
      g,
      x,
      y;
    ctx.clearRect(0, 0, w, h);

    [me.clicks, me.hover, others.clicks, others.hover].forEach(function (m) {
      for (k in m) keys[k] = 1;
    });
    for (k in keys) {
      if (k.charAt(1) === ":") continue; // "e:" / "p:" keys are not cursor cells
      var a = wearAt(k);
      if (a < 0.015) continue;
      p = k.split("_");
      x = (+p[0] + 0.5) * S;
      y = (+p[1] + 0.5) * S;
      // faint halo around the burn
      g = ctx.createRadialGradient(x, y, 0, x, y, HALO * 1.6);
      g.addColorStop(0, "rgba(" + FGRGB + "," + Math.min(1, a * 0.6) + ")");
      g.addColorStop(1, "rgba(" + FGRGB + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - HALO * 2, y - HALO * 2, HALO * 4, HALO * 4);
      // burned-in mouse cursor: the arrow tip sits at the cell's corner
      ctx.fillStyle = "rgba(" + FGRGB + "," + Math.min(1, a) + ")";
      ctx.beginPath();
      var ax = x - S / 2,
        ay = y - S / 2,
        q = 1.4;
      [
        [0, 0],
        [0, 16],
        [4, 12.5],
        [7, 19],
        [9.6, 18],
        [6.8, 11.6],
        [11.5, 11.6],
      ].forEach(function (pt, n) {
        if (n === 0) ctx.moveTo(ax + pt[0] * q, ay + pt[1] * q);
        else ctx.lineTo(ax + pt[0] * q, ay + pt[1] * q);
      });
      ctx.closePath();
      ctx.fill();
    }
    drawGhosts();
  }

  // The ghost is a copy living outside the page layout, so CSS rules like ".box p {...}" would not
  // reach it. We copy the computed look (font, size, colour, spacing) onto the copy instead.
  var LOOK = [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-variant",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-align",
    "text-transform",
    "text-indent",
    "white-space",
    "color",
    "text-decoration",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "display",
    "list-style-type",
  ];
  function copyLook(src, dst) {
    var cs = getComputedStyle(src);
    for (var i = 0; i < LOOK.length; i++)
      dst.style.setProperty(LOOK[i], cs.getPropertyValue(LOOK[i]));
    var a = src.children,
      b = dst.children;
    for (var j = 0; j < a.length && j < b.length; j++) copyLook(a[j], b[j]);
  }

  // Burn-in: a copy of each worn element, drawn where it last was ON THE SCREEN.
  function drawGhosts() {
    var gh = document.getElementById("ghosts"),
      l = elList(),
      i,
      a,
      k,
      pos,
      c;
    gh.textContent = "";
    for (i = 0; i < l.length; i++) {
      k = ekey(i);
      a = wearAt(k);
      if (a < 0.02) continue;
      pos = me.pos[k] || others.pos[k];
      if (!pos) continue;
      c = l[i].cloneNode(true);
      c.removeAttribute("id");
      copyLook(l[i], c);
      c.style.cssText = c.style.cssText +
        ";"+
        "position:absolute;margin:0;left:" +
        (pos[0] + a * 1.5) +
        "px;top:" +
        (pos[1] + a * 1.5) +
        "px;width:" +
        pos[2] +
        "px;height:" +
        pos[3] +
"px;opacity:" + Math.min(1, a * 1.6);
      gh.appendChild(c);
    }
  }
  (function loop() {
    if (redraw) {
      redraw = false;
      draw();
    }
    setTimeout(loop, 400);
  })();

  // ---- corner info (only on pages that have it) ----
  var hudL = document.getElementById("hud-l");
  var hudXY = document.getElementById("hud-xy");
  var hudClock = document.getElementById("hud-clock");

  // click on the corner info -> stats page
var STATS = "/stats.html"; // <- Adresse deiner Stats-Seite
if (location.pathname !== STATS)
  Array.prototype.forEach.call(document.querySelectorAll(".hud"), function (h) {
    h.addEventListener("click", function () {
      location.href = STATS;
    });
  });

  function total(m) {
    var t = 0;
    for (var k in m) if (k.charAt(1) !== ":") t += m[k];
    return t;
  }
  function fmtData(kb) {
    return kb >= 1024 ? (kb / 1024).toFixed(2) + " MB" : Math.round(kb) + " KB";
  }
  // the left corner info is a 2-column grid: label | value. The gap between the columns is the
  // same everywhere (set in style.css), and values line up under each other.
  var hudCells = null;
  function buildHud() {
    hudL.textContent = "";
    hudCells = [];
    for (var i = 0; i < 6; i++) {
      var l = document.createElement("span"),
        v = document.createElement("span");
      hudL.appendChild(l);
      hudL.appendChild(v);
      hudCells.push([l, v]);
    }
  }
  function showHud() {
    if (!hudL) return;
    if (!hudCells) buildHud();
    var clicks = Math.round(total(me.clicks) + total(others.clicks));
    var who =
      net === "on" && myRank
        ? "USER #" + myRank
        : net === "off"
          ? "USER #1"
          : "USER #\u2026";
    var first =
      (net === "off" ? "offline\u2003\u2003" : "") + clicks + " clicks";
    var gh = document.getElementById("ghosts");
    var pg = window.WT && WT.page ? WT.page() : { kb: 0, wh: 0, co2: 0 };
    var rows = [
      [who, first],
      ["WEAR", (wearAt(PK) * 100).toFixed(1) + " %"],
      ["GHOSTS", String(gh ? gh.children.length : 0)],
      ["DATA", fmtData(pg.kb)],
      ["POWER", pg.wh.toFixed(2) + " WH"],
      ["CO2", pg.co2.toFixed(2) + " G"],
    ];
    rows.forEach(function (r, i) {
      hudCells[i][0].textContent = r[0];
      hudCells[i][1].textContent = r[1];
    });
  }
  setInterval(showHud, 1000);
  showHud();

  function pad(n) {
    n = String(Math.max(0, Math.round(n)));
    while (n.length < 4) n = "0" + n;
    return n;
  }
  if (hudXY)
    (function xyLoop() {
      if (xyDirty) {
        xyDirty = false;
        hudXY.textContent = "X " + pad(lx) + " Y " + pad(ly);
      }
      requestAnimationFrame(xyLoop);
    })();

  if (hudClock) {
    var tick = function () {
      var d = new Date();
      var z = function (n) {
        return (n < 10 ? "0" : "") + n;
      };
      hudClock.textContent =
        z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds());
    };
    setInterval(tick, 250);
    tick();
  }

  var tog = document.getElementById("tog");
  if (tog)
    tog.addEventListener("click", function () {
      var b = document.body.classList.toggle("bare");
      this.textContent = b ? "SHOW PAGE" : "SHOW TRACES";
    });

  // ---- shared storage: each visitor writes ONLY their own doc, everyone reads all docs ----
  function doc() {
    return {
      first: myFirst,
      clicks: me.clicks,
      hover: me.hover,
      pos: me.pos,
      t: Date.now(),
    };
  }
  function flush() {
    commit();
    if (!needPush || !push || writing) return;
    needPush = false;
    writing = true;
    push(doc())
      .catch(function () {
        needPush = true;
      })
      .then(function () {
        writing = false;
      });
  }
  setInterval(flush, 3000);
  window.addEventListener("pagehide", function () {
    commit();
    if (push && needPush) {
      needPush = false;
      push(doc()).catch(function () {});
    }
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) flush();
    else {
      commit(); // pick up what other pages or tabs burned meanwhile
      redraw = true;
    }
  });
  // page restored from the back/forward cache, or another tab burned something
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      commit();
      redraw = true;
      showHud();
    }
  });
  window.addEventListener("storage", function (e) {
    if (e.key === LKEY) {
      commit();
      redraw = true;
    }
  });

  // docs: [{id, first, t, clicks, hover, pos}, ...] of ALL visitors
  function ingest(docs) {
    var c = {},
      hv = {},
      ps = {},
      pt = {},
      before = 0,
      n = 0;
    docs.forEach(function (v) {
      if (!v || v.id === myId) return;
      var t = v.t || 0,
        f = v.first || t;
      n++;
      if (f < myFirst || (f === myFirst && v.id < myId)) before++; // my number = 1 + visitors before me
      for (var k in v.clicks || {}) c[k] = (c[k] || 0) + v.clicks[k];
      for (var j in v.hover || {}) hv[j] = (hv[j] || 0) + v.hover[j];
      // for each element keep the most recently used screen position
      for (var e in v.pos || {})
        if (!(e in pt) || t > pt[e]) {
          ps[e] = v.pos[e];
          pt[e] = t;
        }
    });
    others = { clicks: c, hover: hv, pos: ps, visitors: n };
    myRank = before + 1;
    redraw = true;
    showHud();
  }

  function connectArtifact() {
    return claude.use("db").then(function (db) {
      if (!db) throw 0;
      var col = db.collection("visits");
      push = function (d) {
        return col.doc(myId).set(d);
      };
      col.onSnapshot(
        function (snap) {
          ingest(
            snap.docs.map(function (d) {
              var v = d.data() || {};
              v.id = d.id;
              return v;
            }),
          );
        },
        function () {
          net = "off";
        },
      );
      net = "on";
      needPush = true;
      setTimeout(flush, 800); // register this visitor right away
    });
  }

  function connectApi() {
    function pull() {
      return fetch(API, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw 0;
          return r.json();
        })
        .then(function (list) {
          if (!Array.isArray(list)) throw 0;
          ingest(list);
          return true;
        });
    }
    return pull().then(function () {
      push = function (d) {
return fetch(API + "?id=" + encodeURIComponent(myId), {          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(d),
          keepalive: true,
        }).then(function (r) {
          if (!r.ok) throw 0;
        });
      };
      net = "on";
      needPush = true;
      setTimeout(flush, 800); // register this visitor right away
      setInterval(function () {
        pull().catch(function () {});
      }, 15000);
    });
  }

  function offline() {
    net = "off";
    showHud();
  }
  if (window.claude && claude.use) connectArtifact().catch(offline);
  else if (window.fetch) connectApi().catch(offline);
  else offline();

  // ---- diagnosis: open any page with ?debug at the end of the address ----
  if (/[?&]debug\b/.test(location.search)) {
    var box = document.createElement("pre");
    box.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:99999;margin:0;padding:8px 10px;" +
      "font:11px/1.35 monospace;color:#fff;background:rgba(0,0,0,.88);" +
      "border:1px solid #fff;pointer-events:none;max-width:92vw;white-space:pre-wrap";
    document.body.appendChild(box);
    setInterval(function () {
      var l = elList(),
        gh = document.getElementById("ghosts"),
        out = [];
      out.push("burn.js v3 | page key: " + PAGE);
      out.push("net: " + net + " | user id: " + myId);
      out.push("burn elements found on this page: " + l.length);
      for (var i = 0; i < l.length && i < 8; i++) {
        var k = ekey(i);
        out.push(
          "  " + l[i].tagName + " \"" + l[i].textContent.trim().slice(0, 18) + "\"  wear=" +
            wearAt(k).toFixed(2) + "  clicks=" + (me.clicks[k] || 0) +
            "  pos=" + (me.pos[k] ? "yes" : "no"),
        );
      }
      out.push("ghost copies in #ghosts: " + (gh ? gh.children.length : "NO #ghosts"));
      out.push("last click: " + lastHitInfo);
      out.push("stored burn keys: " + Object.keys(readMine().clicks).filter(function (x) { return x.charAt(0) === "e"; }).join(", "));
      box.textContent = out.join("\n");
    }, 500);
  }
})();