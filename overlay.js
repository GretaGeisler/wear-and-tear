// Wear and Tear – trace overlay.
//
// Click on the header row (the tracker line at the top) -> a layer in the background colour of the
// page lies over the page, the measurements build up one after another (same look as "Each metric"
// on the stats page: name, below it value + change in % with an arrow), and at the very bottom
// "Learn more about your traces" links to the stats page. Click the header row again, press ESC or
// click an empty spot to close it.
//
// Include on every page except the stats page, AFTER tracker.js and burn.js:
//   <script src="/tracker.js"></script>
//   <script src="/burn.js"></script>
//   <script src="/overlay.js"></script>
(function () {
  "use strict";

  if (/stats(\.html)?\/?$/.test(location.pathname)) return;
  if (document.getElementById("wt-ov")) return; // already loaded once
  var W = window.WT;
  if (!W || !W.COLS || !W.load || !W.derive || !W.series) return;

  /* ---------- settings ---------- */
  var OPACITY = 0.78; // opacity of the layer in the page colour (1 = fully covers the page)
  var STAGGER = 110; // ms between two entries when they build up
  var START = 250; // ms until the first entry starts
  var SUBDELAY = 300; // ms: value + change appear this much after the name
  var TOP = 54; // px from the top edge to the first entry (same as the headings on the stats page)
  var SIZE = 12; // px: type size (same as the tracker line)
  var LINE = 1.05; // line height of the entries (same as "Each metric")
  // two columns, lined up under the corner info: 1 = name (under USER), 2 = change in % with arrow.
  // The x positions are measured from the corner info itself.
  var COL2_GROUP = 2; // under which corner-info block column 2 starts: 0 USER, 1 CLICKS, 2 WEAR, 3 POWER, 4 CO2
  var MIN_C1 = 150; // px: minimum width of column 1 (so long names never run into column 2), also the fallback
  var PAD = 2; // px above and below every entry (smaller = rows closer together)
  var MORE_GAP = 24; // px between the last entry and "Learn more about your traces" (smaller = closer)
  var HIT_Y = 14; // px: the tappable area of the header row reaches this far above and below the text
  var HIT_X = 8; // px: ... and this far to the left and right (makes it easy to hit with a finger)
  var TAP_SLOP = 12; // px: a finger that moves less than this still counts as a tap
  var ARROW_FONT =
    "font-family:'DejaVu Sans','Segoe UI Symbol','Arial Unicode MS','Noto Sans Symbols2','Noto Sans Symbols',Arial,sans-serif;" +
    "font-style:normal;font-weight:400;font-variant-emoji:text;";
  var STATS = "/stats.html";
  var MORE = "Learn more about your traces";
  var TRIGGER = ".hud, #hud-l, #hud-r"; // the header row

  /* ---------- helpers ---------- */
  function num(n, d) {
    return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: d });
  }

  // same numbers as "Each metric" on the stats page: current value + change since the first value above 0
  function data() {
    var s = W.load();
    if (!s) return [];
    var m = W.derive(s),
      now = Date.now(),
      rows = W.series() || [];
    if (rows.length) {
      var lastRow = rows[rows.length - 1];
      if (now > lastRow[0]) {
        var liveRow = [now];
        W.COLS.forEach(function (col, i) {
          var v = s[col[0]];
          if (typeof v !== "number") v = m[col[0]];
          if (window.WT_BURN && col[0] === "keys") v = Math.max(v || 0, WT_BURN.keys());
          if (window.WT_BURN && col[0] === "ghosts") v = WT_BURN.ghosts();
          liveRow.push(typeof v === "number" ? v : lastRow[i + 1]);
        });
        rows = rows.concat([liveRow]);
      }
    }
    return W.COLS.map(function (col, i) {
      var last = rows.length ? rows[rows.length - 1][i + 1] : 0,
        base = null;
      for (var q = 0; q < rows.length; q++)
        if (rows[q][i + 1] > 0) {
          base = rows[q][i + 1];
          break;
        }
      var ch = base ? ((last - base) / base) * 100 : 0;
      return {
        name: col[1],
        val: num(last, 3) + (col[2] ? " " + col[2] : ""),
        pct: (ch > 0 ? "+" : "") + num(ch, 1) + " %",
      };
    });
  }

  // arrow: up for plus, down for minus, none for 0 % (same rule as on the stats page)
  function dirOf(t) {
    t = t.trim();
    return /^[-\u2212\u2013]/.test(t) ? "down" : /[1-9]/.test(t) ? "up" : "";
  }

  /* ---------- styles ---------- */
  var ease = "cubic-bezier(.22,.61,.36,1)";
  var css =
    ".hud{cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}" +
    /* bigger tappable area around the header row (invisible) */
    "#hud-l::before,#hud-r::before{content:'';position:absolute;top:-" + HIT_Y + "px;bottom:-" + HIT_Y +
    "px;left:-" + HIT_X + "px;right:-" + HIT_X + "px}" +
    "#wt-ov{position:fixed;inset:0;z-index:1500;overflow-y:auto;overscroll-behavior:contain;" +
    "visibility:hidden;pointer-events:none;transition:visibility 0s linear .5s}" +
    "#wt-ov.open{visibility:visible;pointer-events:auto;transition-delay:0s}" +
    "#wt-ov .wt-bg{position:fixed;inset:0;background:var(--bg,#fff);opacity:0;transition:opacity .4s ease}" +
    "#wt-ov.open .wt-bg{opacity:" + OPACITY + ";transition-duration:.6s}" +
    "#wt-ov .wt-in{position:relative;min-height:100%;display:flex;flex-direction:column;align-items:flex-start;" +
    "padding:calc(env(safe-area-inset-top,0px) + " + TOP + "px) 14px calc(env(safe-area-inset-bottom,0px) + 44px)}" +
    "#wt-ov .wt-row,#wt-ov .wt-row *,#wt-ov .wt-more{font:400 " + SIZE + "px/" + LINE + " 'Times New Roman',Times,serif;" +
    "text-transform:uppercase;letter-spacing:0;color:var(--fg-small,#000);text-decoration:none;text-align:left;" +
    "-webkit-font-smoothing:antialiased;margin:0}" +
    /* entry: one line, two columns: name | change with arrow */
    "#wt-ov .wt-row{display:grid;grid-template-columns:var(--c1," + MIN_C1 + "px) auto;justify-content:start;" +
    "margin-left:var(--x0,0px);column-gap:0;align-items:baseline;padding:" + PAD + "px 0;white-space:nowrap;" +
    "opacity:0;transform:translateY(6px);transition:opacity .25s ease,transform .25s ease}" +
    "#wt-ov .wt-n{grid-column:1}#wt-ov .wt-p{grid-column:2}" +
    "#wt-ov .wt-p[data-dir='up']::after{content:' \\2197\\FE0E';display:inline;" + ARROW_FONT + "}" +
    "#wt-ov .wt-p[data-dir='down']::after{content:' \\2198\\FE0E';display:inline;" + ARROW_FONT + "}" +
    /* build-up: entry first, value + change a moment later */
    "#wt-ov.open .wt-row{opacity:1;transform:none;transition:opacity .9s " + ease + ",transform .9s " + ease + ";" +
    "transition-delay:calc(var(--i) * " + STAGGER + "ms + " + START + "ms)}" +
    "#wt-ov .wt-v,#wt-ov .wt-p{opacity:0;transition:opacity .25s ease}" +
    "#wt-ov.open .wt-v,#wt-ov.open .wt-p{opacity:1;transition:opacity 1.1s " + ease + ";" +
    "transition-delay:calc(var(--i) * " + STAGGER + "ms + " + (START + SUBDELAY) + "ms)}" +
    "#wt-ov .wt-more{display:inline-block;margin-top:0;margin-left:var(--x0,0px);padding-top:" + MORE_GAP + "px;opacity:0;transition:opacity .25s ease}" +
    "#wt-ov.open .wt-more{opacity:1;transition:opacity 1s ease;transition-delay:calc(var(--i) * " + STAGGER + "ms + " + START + "ms)}" +
    "#wt-ov .wt-more:hover{opacity:.5}" +
    "body.wt-open #hud-l,body.wt-open #hud-r,body.wt-open .back{z-index:1600}" +
    "@media(prefers-reduced-motion:reduce){#wt-ov .wt-row,#wt-ov .wt-v,#wt-ov .wt-p,#wt-ov .wt-more,#wt-ov .wt-bg{transition:none!important}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- layer ---------- */
  var ov = document.createElement("div");
  ov.id = "wt-ov";
  ov.setAttribute("aria-hidden", "true");
  ov.innerHTML = '<div class="wt-bg"></div><div class="wt-in"></div>';
  document.body.appendChild(ov);
  var inner = ov.querySelector(".wt-in"),
    bg = ov.querySelector(".wt-bg");

  // background colour of the page (--bg), otherwise whatever the body has
  function paint() {
    var c = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (!c) c = getComputedStyle(document.body).backgroundColor;
    if (c) bg.style.background = c;
  }

  // column positions: measured from the corner info (#hud-l): col 1 under USER,
  // col 2 under the block set in COL2_GROUP. Falls back to the minimum width.
  function layout() {
    var g = document.querySelectorAll("#hud-l .hud-group"),
      x = [];
    [0, COL2_GROUP].forEach(function (n) {
      var r = g[n] && g[n].getBoundingClientRect();
      x.push(r && r.width ? r.left : null);
    });
    var pad = parseFloat(getComputedStyle(inner).paddingLeft) || 14;
    if (x[0] === null || x[1] === null) x = [pad, pad + MIN_C1];
    inner.style.setProperty("--x0", x[0] - pad + "px");
    inner.style.setProperty("--c1", Math.max(MIN_C1, x[1] - x[0]) + "px");
  }

  var cells = [],
    built = false;
  function build() {
    if (built) return;
    var d = data();
    if (!d.length) return;
    built = true;
    d.forEach(function (r, i) {
      var row = document.createElement("div");
      row.className = "wt-row";
      row.style.setProperty("--i", i);
      var n = document.createElement("span"),
        p = document.createElement("span");
      n.className = "wt-n";
      p.className = "wt-p";
      n.textContent = r.name;
      row.appendChild(n);
      row.appendChild(p);
      inner.appendChild(row);
      cells.push(p);
    });
    var more = document.createElement("a");
    more.className = "wt-more";
    more.href = STATS;
    more.textContent = MORE;
    more.style.setProperty("--i", d.length + 1);
    inner.appendChild(more);
    update();
  }

  function update() {
    var d = data();
    d.forEach(function (r, i) {
      if (!cells[i]) return;
      if (cells[i].textContent !== r.pct) cells[i].textContent = r.pct;
      var dir = dirOf(r.pct);
      if (dir) cells[i].setAttribute("data-dir", dir);
      else cells[i].removeAttribute("data-dir");
    });
  }

  var timer = null;
  function open() {
    paint();
    layout();
    build();
    update();
    ov.classList.add("open");
    ov.setAttribute("aria-hidden", "false");
    document.body.classList.add("wt-open");
    document.documentElement.style.overflow = "hidden";
    ov.scrollTop = 0;
    clearInterval(timer);
    timer = setInterval(update, 1000);
  }
  function close() {
    ov.classList.remove("open");
    ov.setAttribute("aria-hidden", "true");
    document.body.classList.remove("wt-open");
    document.documentElement.style.overflow = "";
    clearInterval(timer);
  }
  function toggle() {
    if (ov.classList.contains("open")) close();
    else open();
  }

  /* ---------- clicks and taps ---------- */
  function onHeader(e) {
    return e.target && e.target.closest ? e.target.closest(TRIGGER) : null;
  }

  // TOUCH: a tap is recognised on its own (finger down + up on the header row, hardly moved).
  // This does not depend on the browser sending a "click" afterwards, which phones often
  // skip when a page also reacts to touches (burn-in, scroll lock).
  var lastTap = 0,
    down = null;
  window.addEventListener(
    "pointerdown",
    function (e) {
      if (e.pointerType === "mouse" || !onHeader(e)) {
        down = null;
        return;
      }
      down = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    true
  );
  window.addEventListener(
    "pointerup",
    function (e) {
      if (!down || e.pointerType === "mouse") return;
      var d = down;
      down = null;
      if (Math.abs(e.clientX - d.x) > TAP_SLOP || Math.abs(e.clientY - d.y) > TAP_SLOP) return;
      if (Date.now() - d.t > 700) return;
      lastTap = Date.now();
      toggle();
    },
    true
  );
  window.addEventListener(
    "pointercancel",
    function () {
      down = null;
    },
    true
  );

  // MOUSE (and every click that is not already handled as a tap): opens / closes the overlay and never navigates
  // (window + capture phase: runs before every other click handler on the page)
  window.addEventListener(
    "click",
    function (e) {
      if (!onHeader(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (Date.now() - lastTap < 800) return; // this touch was already handled above
      toggle();
    },
    true
  );

  // an empty spot closes the layer, the link goes on to the stats page
  ov.addEventListener("click", function (e) {
    if (Date.now() - lastTap < 800) return; // the click that follows the opening tap
    if (e.target === ov || e.target === inner || e.target === bg) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && ov.classList.contains("open")) close();
  });
  window.addEventListener("resize", layout);
})();