// Wear and Tear – burn-in. Include on EVERY page:  <script src="/burn.js"></script>
//
// - Cursor burns live on the SCREEN (same position on every page).
// - Text burns (ghosts) live on the SCREEN too: a text you burned in on one page is
//   still visible as a ghost on every other page (a snapshot of it is stored).
// - The wear value is shared by all pages.
// - Your own traces are kept in this browser forever (localStorage).
// - Traces of ALL visitors are shared through the small server (server.js, /api/visits),
//   or through the Claude artifact database when hosted as an artifact.
//   Without either, only your own traces are shown ("offline").
(function () {
  "use strict";

  var S = 6; // cell size in px
  var HALO = 14; // soft glow around a cursor burn
  var HALO_ALPHA = 0.3; // strongest the glow can get (lower = less "highlighted box" look)
  var PUSH_MS = 1500; // how often your traces are sent to the server
  var PULL_MS = 2500; // how often the traces of the others are fetched (= how "live" it is)
  var STILL_MS = 400; // mouse must rest this long before it starts to burn in
  var REST_PX = 8; // moving less than this many px still counts as "the same spot"
  var STILL_BURN_MS = 10000; // resting this long on one spot burns it in at once ...
  var STILL_BURN = 6; // ... with the weight of this many clicks
  var BURN_AT = 40; // speed of the burn-IN (ghosts, cursor trails): higher = slower
  var WEAR_AT = 400; // speed of the WEAR % counter only: higher = slower
  var DRAG_W = 0.08; // touch: weight of one drag sample (every 80 ms) in clicks
  var CLICK_W = 1,
    HOVER_W = 0.15; // a click = 1 unit, 1 s of resting = 0.15 units
  var STATS = "/stats.html"; // click on the corner info goes here
  // elements that can burn in: headings, paragraphs, quotes, list links, .text, or anything with data-burn
  var SEL =
    window.WT_SEL ||
    "h1,h2,h3,h4,h5,h6,p,blockquote,figcaption,#list a,.text," +
    "td,th,ol.tiers li,.val,.pct,.legend button,canvas,[data-burn]";
  var API = window.WT_API || "/api/visits";
  var PAGE =
    location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";
  var LKEY = "wt4_burn";
  var PK = "p:site"; // ONE wear counter for the whole site (all pages together)

  var stage = document.getElementById("stage");
  if (!stage) return;

  // burn colour = --burn in style.css (falls back to the text colour). Must be a hex colour.
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
  // me.snap / others.snap: what the element looked like (text + style), so its ghost can be
  //                        drawn on OTHER pages too
  var me = { clicks: {}, hover: {}, pos: {}, snap: {}, shot: {} };
  var othersShot = {}; // graph pictures of the other visitors
  var others = { clicks: {}, hover: {}, pos: {}, snap: {}, shot: {}, visitors: 0 };
  var pullNow = null; // set when the server is reachable: fetch the others right now
  var lastHitInfo = "-";
  var dirty = false,
    redraw = true,
    curCell = null,
    lx = -1,
    ly = -1,
    xyDirty = false,
    lastMove = 0,
    lastScroll = 0,
    restX = -999,
    restY = -999,
    restSince = 0,
    restDone = false,
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
  var delta = { clicks: {}, hover: {}, pos: {}, snap: {}, shot: {} };
  var needPush = false;
  function readMine() {
    try {
      var v = JSON.parse(lget(LKEY));
      if (v && v.clicks && v.hover && v.pos) {
        v.snap = v.snap || {};
        v.shot = v.shot || {};
        return v;
      }
    } catch (e) {}
    return { clicks: {}, hover: {}, pos: {}, snap: {}, shot: {} };
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
    for (k in delta.snap) st.snap[k] = delta.snap[k];
    for (k in delta.shot) st.shot[k] = delta.shot[k];
    delta = { clicks: {}, hover: {}, pos: {}, snap: {}, shot: {} };
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

  // element keys are per page: "e:<page>#<link address or index>"
  // (links use their address, so adding a paragraph above never shifts the burn onto another link)
  function keyOf(el, i) {
    var id = el.tagName === "A" ? el.getAttribute("href") : null;
    return "e:" + PAGE + "@" + (id || i);
  }
  function elList() {
    return stage.querySelectorAll(SEL);
  }
  function hit(t) {
    var el = t && t.closest ? t.closest(SEL) : null;
    if (!el || !stage.contains(el)) return null;
    var l = elList();
    for (var i = 0; i < l.length; i++)
      if (l[i] === el) return { el: el, key: keyOf(l[i], i) };
    return null;
  }

  // The ghost copies the computed look (font, size, colour, spacing) of the element.
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

  // a small snapshot of an element: tag, its text (line breaks kept) and its look.
  // It is what lets the ghost show up on pages where the element does not exist.
  function snapOf(el) {
    var cs = getComputedStyle(el),
      look = {},
      i;
    for (i = 0; i < LOOK.length; i++) look[LOOK[i]] = cs.getPropertyValue(LOOK[i]);
    var txt = (el.innerText || el.textContent || "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim()
      .slice(0, 600);
    return {
      tag: el.tagName.toLowerCase(),
      txt: txt,
      look: look,
      canvas: el.tagName === "CANVAS",
    };
  }

  // A graph (canvas) cannot be cloned like text, so we keep a small picture of it,
  // painted in the burn colour. It stays in this browser only (not sent to the server).
  var shotTaken = {};
  function shotOf(src) {
    try {
      var w = Math.min(600, src.width),
        sc = w / src.width,
        h = Math.max(1, Math.round(src.height * sc));
      var o = document.createElement("canvas");
      o.width = w;
      o.height = h;
      var c = o.getContext("2d");
      c.drawImage(src, 0, 0, w, h);
      c.globalCompositeOperation = "source-in";
      c.fillStyle = "rgb(" + FGRGB + ")";
      c.fillRect(0, 0, w, h);
      var url = o.toDataURL("image/png");
      return url.length < 40000 ? url : null;
    } catch (e) {
      return null;
    }
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
    // snapshot only once per element (it is the same text every time)
    if (!me.snap[h.key]) {
      var sn = snapOf(h.el);
      if (sn.txt || sn.canvas) {
        me.snap[h.key] = sn;
        delta.snap[h.key] = sn;
      }
    }
    // picture of a graph: once per page visit
    if (h.el.tagName === "CANVAS" && !shotTaken[h.key]) {
      shotTaken[h.key] = 1;
      var sh = shotOf(h.el);
      if (sh) {
        me.shot[h.key] = sh;
        delta.shot[h.key] = sh;
      }
    }
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
      var nowT = Date.now();
      lastMove = nowT;
      // still on the same spot (within REST_PX)? then the rest timer keeps running
      if (Math.abs(lx - restX) > REST_PX || Math.abs(ly - restY) > REST_PX) {
        restX = lx;
        restY = ly;
        restSince = nowT;
        restDone = false;
      }
      xyDirty = true;
    },
    true,
  );
  document.addEventListener("pointerleave", function () {
    curCell = null;
  });

  // While the page scrolls (or snaps) the content moves under a resting cursor. Nothing may burn
  // in then, otherwise the ghosts would jump to every element that passes by.
  window.addEventListener(
    "scroll",
    function () {
      lastScroll = Date.now();
      restSince = lastScroll; // the rest timer starts again once the scrolling has stopped
      restDone = false;
    },
    { passive: true, capture: true },
  );

  // ---- touch: the finger is the cursor ----
  // tap = click (pointerdown), holding still = like a resting mouse (10 s burst included),
  // dragging = burns along the path of the finger. A ghost keeps the position where the
  // finger FIRST met the element, so it does not slide around while the page scrolls.
  var dragSeen = {},
    lastDrag = 0;
  function fingerOf(e) {
    var t = e.touches && e.touches[0];
    return t ? { clientX: t.clientX, clientY: t.clientY } : null;
  }
  function touchStart(e) {
    var p = fingerOf(e);
    if (!p) return;
    dragSeen = {};
    curCell = cellAt(p);
    lx = p.clientX;
    ly = p.clientY;
    var t = Date.now();
    lastMove = t;
    restX = lx;
    restY = ly;
    restSince = t;
    restDone = false;
    xyDirty = true;
  }
  function touchMove(e) {
    var p = fingerOf(e);
    if (!p) return;
    curCell = cellAt(p);
    lx = p.clientX;
    ly = p.clientY;
    var t = Date.now();
    lastMove = t;
    xyDirty = true;
    if (Math.abs(lx - restX) > REST_PX || Math.abs(ly - restY) > REST_PX) {
      restX = lx;
      restY = ly;
      restSince = t;
      restDone = false;
    }
    if (!curCell || t - lastDrag < 80) return;
    lastDrag = t;
    add(me.clicks, curCell, DRAG_W);
    add(delta.clicks, curCell, DRAG_W);
    add(me.clicks, PK, DRAG_W);
    add(delta.clicks, PK, DRAG_W);
    var h = hit(document.elementFromPoint(lx, ly));
    if (h) {
      add(me.clicks, h.key, DRAG_W);
      add(delta.clicks, h.key, DRAG_W);
      if (!dragSeen[h.key]) {
        dragSeen[h.key] = 1;
        mark(h);
      }
    }
    dirty = true;
    redraw = true;
  }
  function touchEnd() {
    curCell = null;
  }
  var passiveCap = { passive: true, capture: true };
  document.addEventListener("touchstart", touchStart, passiveCap);
  document.addEventListener("touchmove", touchMove, passiveCap);
  document.addEventListener("touchend", touchEnd, passiveCap);
  document.addEventListener("touchcancel", touchEnd, passiveCap);

  // hover burn: only while the mouse is RESTING on a spot (not while it moves).
  // After STILL_BURN_MS on the same spot it burns in at once (like a few clicks).
  setInterval(function () {
    if (!curCell || document.hidden || Date.now() - lastScroll < 400) return;
    var still = Date.now() - restSince;

    if (!restDone && still >= STILL_BURN_MS && still < STILL_BURN_MS + 2000) {
      restDone = true;
      add(me.clicks, curCell, STILL_BURN);
      add(delta.clicks, curCell, STILL_BURN);
      add(me.clicks, PK, STILL_BURN);
      add(delta.clicks, PK, STILL_BURN);
      var bh = hit(document.elementFromPoint(lx, ly));
      if (bh) {
        add(me.clicks, bh.key, STILL_BURN);
        add(delta.clicks, bh.key, STILL_BURN);
        mark(bh);
      }
      dirty = true;
      redraw = true;
    }

    if (still < STILL_MS || still > 15000) return;
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

  // "use" of a cell / element / the whole site: clicks + resting time, of me and all others
  function useAt(k) {
    return (
      ((me.clicks[k] || 0) + (others.clicks[k] || 0)) * CLICK_W +
      ((me.hover[k] || 0) + (others.hover[k] || 0)) * HOVER_W
    );
  }
  function wearAt(k) {
    return 1 - Math.exp((-useAt(k) / BURN_AT) * 2.2); // 0 = pristine, -> 1 = fully burnt
  }
  // the wear counter in % (whole site), with its own, slower speed
  function wearPct() {
    return (1 - Math.exp((-useAt(PK) / WEAR_AT) * 2.2)) * 100;
  }

  var ghostSig = "";
  function size() {
    var d = window.devicePixelRatio || 1;
    cv.width = Math.round(window.innerWidth * d);
    cv.height = Math.round(window.innerHeight * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ghostSig = "";
    redraw = true;
  }
  size();
  window.addEventListener("resize", size);
  window.addEventListener("load", function () {
    ghostSig = "";
    redraw = true;
  });
  if (document.fonts)
    document.fonts.ready.then(function () {
      ghostSig = "";
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
      g.addColorStop(0, "rgba(" + FGRGB + "," + Math.min(HALO_ALPHA, a * 0.4) + ")");
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
  function copyLook(src, dst) {
    var cs = getComputedStyle(src);
    for (var i = 0; i < LOOK.length; i++)
      dst.style.setProperty(LOOK[i], cs.getPropertyValue(LOOK[i]));
    var a = src.children,
      b = dst.children;
    for (var j = 0; j < a.length && j < b.length; j++) copyLook(a[j], b[j]);
  }

  function place(c, pos, a) {
    c.style.cssText =
      c.style.cssText +
      ";position:absolute;margin:0;left:" +
      (pos[0] + a * 1.5) +
      "px;top:" +
      (pos[1] + a * 1.5) +
      "px;width:" +
      pos[2] +
      "px;height:" +
      pos[3] +
      "px;opacity:" +
      Math.min(1, a * (c.tagName === "IMG" ? 0.8 : 1.6));

    // sharper for small type: the blur grows with the font size, and only big type gets a glow
    // (a glow on small type fills the gaps between the letters and looks like a highlighted box)
    var fs = parseFloat(c.style.fontSize) || 0;
    var k = fs ? Math.min(1, fs / 48) : 0.6;
    c.style.setProperty("filter", "blur(" + (0.15 + 0.85 * k).toFixed(2) + "px)");
    c.style.setProperty(
      "text-shadow",
      fs >= 28 ? "0 0 " + (1 + 3 * k).toFixed(1) + "px var(--burn)" : "none",
    );
  }

  // Burn-in: a copy of each worn element, drawn where it last was ON THE SCREEN.
  // 1) elements of THIS page: live copies (graphs: the stored picture)
  // 2) elements burned in on OTHER pages: rebuilt from their stored snapshot
  // The ghosts are only rebuilt when something actually changed (no flicker).
  function drawGhosts() {
    var gh = document.getElementById("ghosts"),
      l = elList(),
      live = {},
      todo = [],
      sig = [],
      i,
      k,
      a,
      pos,
      shot;

    for (i = 0; i < l.length; i++) {
      k = keyOf(l[i], i);
      live[k] = 1;
      a = wearAt(k);
      if (a < 0.02) continue;
      pos = me.pos[k] || others.pos[k];
      if (!pos) continue;
      shot = null;
      if (l[i].tagName === "CANVAS") {
        shot = me.shot[k] || others.shot[k];
        if (!shot) continue; // no picture of this graph taken yet
      }
      todo.push({ el: l[i], a: a, pos: pos, shot: shot });
      sig.push(
        k + ":" + a.toFixed(2) + ":" + pos.join(",") + (shot ? ":c" + shot.length : ""),
      );
    }

    var seen = {};
    [me.snap, others.snap].forEach(function (m) {
      for (var key in m) {
        if (seen[key] || live[key] || key.charAt(0) !== "e") continue;
        seen[key] = 1;
        var aa = wearAt(key);
        var pp = me.pos[key] || others.pos[key];
        var ss = me.snap[key] || others.snap[key];
        if (aa < 0.02 || !pp || !ss) continue;
        var sh = null;
        if (ss.canvas) {
          sh = me.shot[key] || others.shot[key];
          if (!sh) continue;
        }
        todo.push({ sn: ss, a: aa, pos: pp, shot: sh });
        sig.push(
          key + ":" + aa.toFixed(2) + ":" + pp.join(",") + ":s" + (sh ? sh.length : ""),
        );
      }
    });

    var s = sig.join("|");
    if (s === ghostSig) return;
    ghostSig = s;
    gh.textContent = "";

    todo.forEach(function (t) {
      var c;
      if (t.shot) {
        c = document.createElement("img");
        c.src = t.shot;
        c.alt = "";
        c.style.objectFit = "fill";
      } else if (t.el) {
        c = t.el.cloneNode(true);
        c.removeAttribute("id");
        copyLook(t.el, c);
      } else {
        var sn = t.sn;
        c = document.createElement("div");
        c.textContent = sn.txt;
        for (var p in sn.look) c.style.setProperty(p, sn.look[p]);
        c.style.setProperty("display", "block");
        c.style.setProperty("white-space", "pre"); // keeps the original line breaks
      }
      place(c, t.pos, t.a);
      gh.appendChild(c);
    });
  }
  (function loop() {
    if (redraw) {
      redraw = false;
      draw();
    }
    setTimeout(loop, 400);
  })();

  // number of burned-in elements on the whole site (this page, other pages, other visitors)
  function countGhosts() {
    var seen = {},
      n = 0;
    [me.pos, others.pos].forEach(function (m) {
      for (var k in m)
        if (!seen[k] && k.charAt(0) === "e") {
          seen[k] = 1;
          if (wearAt(k) >= 0.02) n++;
        }
    });
    return n;
  }

  // key presses, counted right away and kept across pages
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.repeat) return;
      lset("wt_keys", String((+lget("wt_keys") || 0) + 1));
    },
    true,
  );

  // used by the stats page
  window.WT_BURN = {
    ghosts: countGhosts,
    wear: wearPct,
    keys: function () {
      return +lget("wt_keys") || 0;
    },
  };

  // ---- corner info (only on pages that have it) ----
  var hudL = document.getElementById("hud-l");
  var hudXY = document.getElementById("hud-xy");
  var hudClock = document.getElementById("hud-clock");

  // click on the corner info -> stats page
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
    var pg = window.WT && WT.page ? WT.page() : { kb: 0, wh: 0, co2: 0 };
    var rows = [
      [who, first],
      ["WEAR", wearPct().toFixed(1) + " %"],
      ["GHOSTS", String(countGhosts())],
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
  var shotSigSent = "";
  function shotSig() {
    var ks = Object.keys(me.shot);
    return (
      ks.length +
      ":" +
      ks
        .map(function (x) {
          return x + me.shot[x].length;
        })
        .join(",")
    );
  }
  function shotsForServer() {
    var out = {};
    Object.keys(me.shot)
      .slice(-6)
      .forEach(function (k) {
        if (me.shot[k].length < 40000) out[k] = me.shot[k];
      });
    return out;
  }
  function doc(withShot) {
    var d = {
      first: myFirst,
      clicks: me.clicks,
      hover: me.hover,
      pos: me.pos,
      snap: me.snap,
      t: Date.now(),
    };
    if (withShot) d.shot = shotsForServer();
    return d;
  }
  function flush() {
    commit();
    if (!needPush || !push || writing) return;
    needPush = false;
    writing = true;
    var sig = shotSig(),
      withShot = sig !== shotSigSent && Object.keys(me.shot).length > 0;
    push(doc(withShot))
      .then(function () {
        if (withShot) shotSigSent = sig;
      })
      .catch(function () {
        needPush = true;
      })
      .then(function () {
        writing = false;
      });
  }
  setInterval(flush, PUSH_MS);
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
      if (pullNow) pullNow();
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

  // docs: [{id, first, t, clicks, hover, pos, snap}, ...] of ALL visitors
  function ingest(docs) {
    var c = {},
      hv = {},
      ps = {},
      pt = {},
      sn = {},
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
      // for each element keep the most recently used screen position (and its snapshot)
      for (var e in v.pos || {})
        if (!(e in pt) || t > pt[e]) {
          ps[e] = v.pos[e];
          pt[e] = t;
          if (v.snap && v.snap[e]) sn[e] = v.snap[e];
        }
    });
    others = { clicks: c, hover: hv, pos: ps, snap: sn, shot: othersShot, visitors: n };
    myRank = before + 1;
    ghostSig = "";
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
    var docsById = {},
      shotsById = {},
      since = 0,
      sinceShot = 0,
      fails = 0,
      firstPull = true;

    function getJson(url) {
      return fetch(url, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw 0;
        return r.json();
      });
    }

    // visitor docs: only what changed since the last call
    function pull() {
      return getJson(API + "?since=" + since).then(function (res) {
        var list = res && res.docs;
        if (!Array.isArray(list)) throw 0;
        var changed = firstPull;
        firstPull = false;
        list.forEach(function (d) {
          if (!d || !d.id) return;
          var old = docsById[d.id];
          if (!old || old.srv !== d.srv) changed = true;
          docsById[d.id] = d;
          if (d.srv > since) since = d.srv;
        });
        if (changed)
          ingest(
            Object.keys(docsById).map(function (k) {
              return docsById[k];
            }),
          );
      });
    }

    // graph pictures of the others (change rarely, fetched less often)
    function pullShots() {
      return getJson(API + "?shots=1&since=" + sinceShot).then(function (res) {
        var m = res && res.shots;
        if (!m) throw 0;
        var changed = false;
        for (var id in m) {
          if (!shotsById[id] || shotsById[id].srv !== m[id].srv) changed = true;
          shotsById[id] = m[id];
          if (m[id].srv > sinceShot) sinceShot = m[id].srv;
        }
        if (changed) {
          var merged = {};
          Object.keys(shotsById).forEach(function (id) {
            if (id === myId) return;
            var sh = shotsById[id].shot || {};
            for (var k in sh) merged[k] = sh[k];
          });
          othersShot = merged;
          others.shot = merged;
          ghostSig = "";
          redraw = true;
        }
      });
    }

    function tick() {
      if (document.hidden) return;
      pull()
        .then(function () {
          fails = 0;
          if (net !== "on") {
            net = "on";
            showHud();
          }
        })
        .catch(function () {
          if (++fails >= 3 && net !== "off") {
            net = "off";
            showHud();
          }
        });
    }

    function begin() {
      pull()
        .then(function () {
          push = function (d) {
            return fetch(API + "?id=" + encodeURIComponent(myId), {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(d),
              keepalive: true,
            }).then(function (r) {
              if (!r.ok) throw 0;
            });
          };
          pullNow = tick;
          net = "on";
          needPush = true;
          setTimeout(flush, 300); // register this visitor right away
          showHud();
          setInterval(tick, PULL_MS);
          pullShots().catch(function () {});
          setInterval(function () {
            if (!document.hidden) pullShots().catch(function () {});
          }, 8000);
          // heartbeat: "still here" (counts for "visitors online")
          var ping = function () {
            if (document.hidden) return;
            fetch(API + "?id=" + encodeURIComponent(myId) + "&ping=1", {
              method: "POST",
              keepalive: true,
            }).catch(function () {});
          };
          ping();
          setInterval(ping, 10000);
        })
        .catch(function () {
          net = "off";
          showHud();
          setTimeout(begin, 5000); // server not reachable yet: try again
        });
    }
    begin();
  }

  function offline() {
    net = "off";
    showHud();
  }
  if (window.claude && claude.use) connectArtifact().catch(offline);
  else if (window.fetch) connectApi();
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
      out.push("burn.js v4 | page key: " + PAGE);
      out.push("net: " + net + " | user id: " + myId + " | others: " + others.visitors);
      out.push("burn elements found on this page: " + l.length);
      for (var i = 0; i < l.length && i < 8; i++) {
        var k = keyOf(l[i], i);
        out.push(
          "  " + l[i].tagName + " \"" + l[i].textContent.trim().slice(0, 18) + "\"  wear=" +
            wearAt(k).toFixed(2) + "  clicks=" + (me.clicks[k] || 0) +
            "  pos=" + (me.pos[k] ? "yes" : "no") + "  snap=" + (me.snap[k] ? "yes" : "no"),
        );
      }
      out.push("ghost copies in #ghosts: " + (gh ? gh.children.length : "NO #ghosts"));
      out.push("snapshots stored: " + Object.keys(me.snap).length + " | graph pictures: " + Object.keys(me.shot).length);
      out.push("rest timer: " + Math.round((Date.now() - restSince) / 1000) + " s (burns at " + STILL_BURN_MS / 1000 + " s)");
      out.push("last click: " + lastHitInfo);
      box.textContent = out.join("\n");
    }, 500);
  }
})();