// Wear and Tear – tracker.
// Include on EVERY page:  <script src="/tracker.js"></script>
// The stats page sets window.WT_VIEWER = true before loading this file: it only reads, never counts.
(function () {
  "use strict";

  var KEY = "wt2"; // totals
  var SKEY = "wt2_series"; // time series for the graphs
  var VIEWER = !!window.WT_VIEWER;
  var SAMPLE_MS = window.WT_SAMPLE_MS || 10000; // one graph point every 10 s

  // ---- assumptions for the energy ESTIMATE (the browser cannot measure real power) ----
  var DEVICE_W = 30; // average device power while the page is visible (W)
  var NET_WH_PER_GB = 60; // network energy per GB transferred (Wh/GB)
  var G_CO2_PER_KWH = 380; // grid carbon intensity (g CO2 per kWh), roughly Germany
  var WEAR_K = 40; // same wear curve as the burn-in on the start page
  var SESSION_GAP = 30 * 60 * 1000; // 30 min without activity = new session

  // graph columns: [key, label, unit]; a series row is [time, ...values in this order]
  var COLS = [
    ["clicks", "Total clicks", ""],
    ["hover", "Hover time", "s"],
    ["dist", "Mouse distance", "px"],
    ["speed", "Cursor speed (peak)", "px/s"],
    ["scroll", "Scroll distance", "px"],
    ["keys", "Key presses", ""],
    ["wear", "Wear", "%"],
    ["kb", "Data transferred", "KB"],
    ["wh", "Est. energy", "Wh"],
    ["co2", "Est. CO₂", "g"],
    ["ghosts", "Ghost copies in DOM", ""],
    ["stored", "Stored data size", "KB"],
  ];

  // decay tiers of the sub-pages: [name, wear % at which the tier is reached]
  var TIERS = [
    ["Pristine", 0],
    ["Settled", 10],
    ["Patina", 25],
    ["Worn", 40],
    ["Weathered", 60],
    ["Neglected", 80],
    ["Defective", 95],
  ];

  function read(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  }
  function write(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }
  function fresh() {
    return {
      t0: Date.now(),
      visits: 0,
      sessStart: 0,
      clicks: 0,
      hover: 0,
      dist: 0,
      maxSpeed: 0,
      scroll: 0,
      keys: 0,
      vis: 0,
      bytes: 0,
      lastX: null,
      lastY: null,
      lastActive: 0,
      load: null,
      ghosts: 0,
    };
  }
  function load() {
    var s = read(KEY);
    return s && s.t0 ? s : null;
  }
  function storedKB() {
    var n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("wt") === 0)
          n += (k.length + (localStorage.getItem(k) || "").length) * 2;
      }
    } catch (e) {}
    return n / 1024;
  }
  function derive(s) {
    var wear =
      (1 - Math.exp((-(s.clicks + s.hover * 0.15) / WEAR_K) * 2.2)) * 100;
    var wh = (s.vis / 3600) * DEVICE_W + (s.bytes / 1073741824) * NET_WH_PER_GB;
    return {
      wear: wear,
      kb: s.bytes / 1024,
      wh: wh,
      co2: (wh / 1000) * G_CO2_PER_KWH,
      stored: storedKB(),
    };
  }
  function tier(wear) {
    var t = 0;
    for (var i = 0; i < TIERS.length; i++) if (wear >= TIERS[i][1]) t = i;
    return t;
  }
  function rnd(v, n) {
    var f = Math.pow(10, n || 0);
    return Math.round(v * f) / f;
  }

  var live = { x: null, y: null, lastActive: Date.now() };

  // ---- first load ever = t0 ("zero") ----
  var state = load();
  if (!state) {
    state = fresh();
    write(KEY, state);
  }
  if (!VIEWER) {
    var now0 = Date.now();
    if (!state.sessStart || now0 - (state.lastActive || 0) > SESSION_GAP) {
      state.visits = (state.visits || 0) + 1; // new session = new visit
      state.sessStart = now0;
    }
    state.lastActive = now0;
    write(KEY, state);
  }

  // ---- counters (deltas, merged into storage on flush, safe with several tabs) ----
  var d = {
    clicks: 0,
    hover: 0,
    dist: 0,
    scroll: 0,
    keys: 0,
    vis: 0,
    bytes: 0,
    peak: 0,
    load: null,
  };
  // per page: bytes transferred and visible seconds (for the page's own power / CO2 estimate)
  var PAGE =
    location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";
  var dp = { bytes: 0, vis: 0 };
  var peakSample = 0,
    lastP = null,
    lastT = 0,
    lastMoveT = 0,
    lastScroll = window.scrollY || 0,
    lastBytes = 0;

  function act() {
    live.lastActive = Date.now();
  }

  addEventListener(
    "pointermove",
    function (e) {
      var now = Date.now();
      live.x = e.clientX;
      live.y = e.clientY;
      lastMoveT = now;
      act();
      if (VIEWER) return;
      if (lastP) {
        var dx = e.clientX - lastP[0],
          dy = e.clientY - lastP[1],
          dist = Math.sqrt(dx * dx + dy * dy),
          dt = now - lastT;
        d.dist += dist;
        if (dt >= 4 && dt < 500) {
          var v = (dist / dt) * 1000;
          if (v > d.peak) d.peak = v;
          if (v > peakSample) peakSample = v;
        }
      }
      lastP = [e.clientX, e.clientY];
      lastT = now;
    },
    true,
  );
  addEventListener(
    "pointerdown",
    function (e) {
      live.x = e.clientX;
      live.y = e.clientY;
      act();
      if (!VIEWER) d.clicks++;
    },
    true,
  );
  addEventListener(
    "keydown",
    function () {
      act();
      if (!VIEWER) d.keys++;
    },
    true,
  );
  addEventListener(
    "scroll",
    function () {
      var y = window.scrollY || 0;
      if (!VIEWER) d.scroll += Math.abs(y - lastScroll);
      lastScroll = y;
      act();
    },
    { passive: true, capture: true },
  );
  addEventListener("touchstart", act, { passive: true, capture: true });

  if (!VIEWER) {
    // hover: only while the mouse RESTS on a spot (same rule as the burn-in)
    setInterval(function () {
      if (document.hidden || live.x === null) return;
      var still = Date.now() - lastMoveT;
      if (still >= 400 && still < 15000) d.hover += 0.1;
    }, 100);
  }
  // visible time (basis for the energy estimate), also kept per page
  setInterval(function () {
    if (document.hidden) return;
    dp.vis += 1;
    if (!VIEWER) d.vis += 1;
  }, 1000);

  function bytesNow() {
    var t = 0;
    try {
      var n = performance.getEntriesByType("navigation")[0];
      if (n) t += n.transferSize || 0;
      performance.getEntriesByType("resource").forEach(function (r) {
        t += r.transferSize || 0;
      });
    } catch (e) {}
    return t;
  }

  function flush() {
    var b = bytesNow();
    var addB = Math.max(0, b - lastBytes);
    lastBytes = b;
    dp.bytes += addB;
    var s = load() || fresh();
    // per page (also counted for the stats page itself)
    var pg = s.pg || (s.pg = {});
    var q = pg[PAGE] || (pg[PAGE] = { bytes: 0, vis: 0 });
    q.bytes += dp.bytes;
    q.vis += dp.vis;
    dp.bytes = dp.vis = 0;
    if (!VIEWER) {
      d.bytes += addB;
      s.clicks += d.clicks;
      s.hover += d.hover;
      s.dist += d.dist;
      s.scroll += d.scroll;
      s.keys += d.keys;
      s.vis += d.vis;
      s.bytes += d.bytes;
      s.maxSpeed = Math.max(s.maxSpeed || 0, d.peak);
      if (live.x !== null) {
        s.lastX = live.x;
        s.lastY = live.y;
      }
      s.lastActive = Math.max(s.lastActive || 0, live.lastActive);
      if (d.load !== null) s.load = d.load;
      var g = document.getElementById("ghosts");
      if (g) s.ghosts = g.children.length;
      d.clicks = d.hover = d.dist = d.scroll = d.keys = d.vis = d.bytes = d.peak = 0;
      d.load = null;
    }
    write(KEY, s);
  }

  function sample() {
    if (VIEWER) return;
    flush();
    var s = load();
    if (!s) return;
    var m = derive(s);
    var row = [
      Date.now(),
      s.clicks,
      rnd(s.hover, 1),
      rnd(s.dist, 0),
      rnd(peakSample, 0),
      rnd(s.scroll, 0),
      s.keys,
      rnd(m.wear, 2),
      rnd(m.kb, 1),
      rnd(m.wh, 4),
      rnd(m.co2, 4),
      s.ghosts,
      rnd(m.stored, 1),
    ];
    peakSample = 0;
    var series = read(SKEY) || [];
    series.push(row);
    if (series.length > 1200) {
      // keep the whole history: drop every 2nd point (keep the newest)
      var last = series[series.length - 1];
      series = series.filter(function (_, i) {
        return i % 2 === 0;
      });
      if (series[series.length - 1] !== last) series.push(last);
    }
    write(SKEY, series);
  }

  if (!VIEWER) {
    // load time of this page
    var grabLoad = function () {
      setTimeout(function () {
        try {
          var n = performance.getEntriesByType("navigation")[0];
          if (n && n.loadEventEnd > 0)
            d.load = rnd((n.loadEventEnd - n.startTime) / 1000, 2);
        } catch (e) {}
      }, 0);
    };
    if (document.readyState === "complete") grabLoad();
    else addEventListener("load", grabLoad);

    setTimeout(sample, 800); // first point = the "zero" baseline
    setInterval(sample, SAMPLE_MS);
    setInterval(flush, 2000);
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) flush();
    });
  } else {
    // the stats page only keeps its own per-page numbers
    setInterval(flush, 2000);
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) flush();
    });
  }

  window.WT = {
    KEY: KEY,
    SKEY: SKEY,
    COLS: COLS,
    TIERS: TIERS,
    SESSION_GAP: SESSION_GAP,
    ASSUME: {
      DEVICE_W: DEVICE_W,
      NET_WH_PER_GB: NET_WH_PER_GB,
      G_CO2_PER_KWH: G_CO2_PER_KWH,
    },
    live: live,
    load: load,
    series: function () {
      return read(SKEY) || [];
    },
    derive: derive,
    // numbers of THIS page (this browser): data transferred, estimated power and CO2
    page: function () {
      var s = load() || fresh(),
        q = (s.pg || {})[PAGE] || { bytes: 0, vis: 0 };
      var bytes = q.bytes + dp.bytes + Math.max(0, bytesNow() - lastBytes),
        vis = q.vis + dp.vis;
      var wh = (vis / 3600) * DEVICE_W + (bytes / 1073741824) * NET_WH_PER_GB;
      return { kb: bytes / 1024, wh: wh, co2: (wh / 1000) * G_CO2_PER_KWH };
    },
    tier: tier,
    reset: function () {
      try {
        localStorage.removeItem(KEY);
        localStorage.removeItem(SKEY);
      } catch (e) {}
      location.reload();
    },
  };
})();