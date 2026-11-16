/* viewer.js v3 – Burn-In-Archiv als erste Ansicht von stats.html.
   Einbinden: <script src="/viewer.js"></script> vor </body>, NACH burn.js, tracker.js und dem Inline-Skript.
   Jeder Screenshot = der echte Zustand von #wear (Cursor-Burns) und #ghosts (Text-Burns). */
(function () {
  var C = {
    SNAP_MS: 30000,
    W: 1280,      /* Auflösung der Screenshots (Breite in px). 480 = alt, 960 = scharf, 1280+ = sehr scharf */
    MAX: 24,      /* max. Anzahl gespeicherter Frames */
    KEY: "wt_arc"
  };

  /* ---------- LOOK DER FRAMES: hier anpassen ---------- */
  var FRAME = {
    /* Fläche (sichtbar, wo der Screenshot transparent ist) */
    backgroundColor: "47,39,35",   /* r,g,b */
    backgroundOpacity: 0.04,

    /* Rahmen */
    borderColor: "47,39,35",       /* r,g,b */
    borderOpacity: 0.05,
    borderWidth: 0.25,                /* px */
    borderRadius: 0,               /* px, 0 = eckig */
    shadow: "none",                /* z.B. "3px 4px 7px rgba(55,50,50,.16)" */

    /* aktiver (vorderster) Frame */
    activeBorderColor: "97,89,85",
    activeBorderOpacity: 0.1,

    /* Dicke / Tiefe (echte 3D-Seitenflächen) */
    depth: 0,               /* Dicke des Frames in px, 0 = flach */
    sideColor: "155,155,155",  /* r,g,b der Seitenflächen */
    sideOpacity: 0.03,      /* Fläche der Seiten */
    sideBorderOpacity: 0.15,/* Kanten der Seiten */
    layers: 0,              /* zusätzliche Zwischenebenen in der Dicke (0 = keine) */
    backOpacity: 0.5,       /* Rückseite: Rahmen-Deckkraft relativ zur Vorderseite */

    /* Größe, Abstand, Transparenz */
    width: 0.5,        /* Frame-Breite relativ zum Viewport */
    gap: 0.36,         /* Tiefenabstand zwischen Frames (relativ zur Breite) */
    yStep: 14,         /* vertikaler Versatz pro Frame in px */
    opacity: 0.95,     /* max. Deckkraft */
    fade: 0.09,        /* Deckkraftverlust pro Frame nach hinten */
    minOpacity: 0.1,   /* untere Grenze der Deckkraft */
    maxVisible: 14,    /* wie viele Frames nach hinten sichtbar sind */

    /* Klick: Frame fährt nach rechts heraus */
    slide: 0.6,        /* Weg nach rechts, relativ zur Frame-Breite (0 = aus) */
    slideSpeed: 0.1    /* Geschwindigkeit der Bewegung (0.05 = träge, 0.2 = schnell) */
  };

  /* ---------- FARBEN DER STATS-SEITE: hier anpassen ---------- */
  var THEME = {
    bg: "#ffffff",                 /* Hintergrund */
    fg: "#000000",                 /* große Schrift */
    fgSmall: "#000000",            /* kleine Schrift (HUD, Tabelle, Buttons) */
    burn: "#55524d",               /* Farbe der Text-Ghosts (auch im Screenshot) */
    ui: "47,39,35",             /* r,g,b für Pills/Buttons (Fläche + Rand) */
    shadow: "3px 4px 7px rgba(55,50,50,.16)", /* Textschatten, "none" = aus */
    paperOpacity: 0,               /* Papier-Overlay (image2.png), 0 = aus */
    texOpacity: 0,                 /* Hintergrund-Textur #tex, 0 = aus */
    grainOpacity: 0,               /* Filmkorn #grain, 0 = aus */
    scanlines: false,              /* CRT-Scanlines #crt */
    showWear: false,               /* Cursor-Burns (#wear) auf der Seite zeigen; Screenshots enthalten sie trotzdem */
    showGhosts: false,             /* Text-Ghosts (#ghosts) auf der Seite zeigen */
    textSize: 12,                  /* px: Text + Überschriften unter dem Viewer (wie die Zeile oben) */
    headGap: 2                     /* Leerzeilen über jeder Überschrift (z. B. "All live measurements"), 0 = keine */
  };

  var stage = document.getElementById("stage"),
    wrap = document.getElementById("wrap");
  if (!stage) return;

  /* ---------- Styles (Variablen aus style.css) ---------- */
  var css =
    ":root{color-scheme:only light;--bg:" + THEME.bg + ";--fg:" + THEME.fg + ";--fg-small:" + THEME.fgSmall + ";--burn:" + THEME.burn + "}" +
    "html,body{background:" + THEME.bg + "}" +
    "body::after{opacity:" + THEME.paperOpacity + "}" +
    "#tex{opacity:" + THEME.texOpacity + "}" +
    "#grain{opacity:" + THEME.grainOpacity + "}" +
    (THEME.scanlines ? "" : "#crt{display:none}") +
    (THEME.showWear ? "" : "#wear{opacity:0!important}") +
    (THEME.showGhosts ? "" : "#ghosts{opacity:0!important}") +
    "h1,h2,#list a{text-shadow:" + THEME.shadow + "}" +
    /* Index-Bereich: aller Text wie .textblock der Subpages, Überschriften in derselben Größe, keine Ziffern/Rahmen */
    "#tblsec,#tblsec *,.dsec,.dsec *,#list,#list *,#stage h2,#stage .sub,#stage .note,#stage ol.tiers,#stage table,#stage th,#stage td{" +
      "font:400 " + THEME.textSize + "px/1.25 'Times New Roman',Times,serif!important;" +
      "letter-spacing:0!important;text-transform:uppercase!important;text-align:left!important;" +
      "color:var(--fg-small)!important;text-shadow:none!important;background:none!important;border:0!important;box-shadow:none!important}" +
    "#tblsec:not(.dsec),.dsec,#list{filter:url(#xerox-s);opacity:var(--title-opacity)}" +
    "#tblsec .dsec,#tblsec #list{filter:none;opacity:1}" +
    "#stage table{margin:0!important;border-collapse:collapse!important}" +
    "#stage>:not(#viewer) h1,#stage>:not(#viewer) h2,#stage>:not(#viewer) h3,#tblsec h2,.dsec h2{margin-top:" + (THEME.headGap * THEME.textSize * 1.25).toFixed(1) + "px!important;margin-bottom:0!important}" +
    "#tblsec,.dsec,#list{justify-content:flex-start!important;align-items:flex-start!important}" +
    "#list ul{margin:0!important;max-width:none!important}" +
    "#stage th,#stage td{padding:4px 24px 4px 0!important}" +
    "#list li a{display:block!important;padding:6px 0!important}" +
    "#list li a::before,#list li a::after{content:none!important;display:none!important}" +
    /* alle Ziffern/Marker im Index-Bereich weg (römisch I-IV, 01-04, Listenpunkte) */
    "#stage>:not(#viewer)::before,#stage>:not(#viewer)::after,#stage>:not(#viewer) *::before,#stage>:not(#viewer) *::after,#stage li::before,#stage li::after,#stage li a::before,#stage li a::after{content:none!important;display:none!important}" +
    "#stage ol,#stage ul,#stage li{list-style:none!important;counter-reset:none!important;counter-increment:none!important}" +
    /* alles inkl. Header linksbündig */
    "#stage>:not(#viewer),#stage>:not(#viewer) *,#stage h1,#stage h2,#stage h3{text-align:left!important}" +
    "#stage>:not(#viewer) h1,#stage>:not(#viewer) h2,#stage>:not(#viewer) h3,#tblsec h1,#tblsec h2,.dsec h2{margin-left:0!important;margin-right:auto!important;padding-left:0!important}" +
    "body{overflow-x:clip}" +
    "#viewer{position:relative;width:100vw;height:100vh;height:100svh;margin:0 0 0 calc(50% - 50vw);overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;touch-action:none;font-family:'Times New Roman',Times,serif}" +
    "#vw{position:absolute;inset:0;perspective:2200px;perspective-origin:50% 40%}" +
    "#vwo{position:absolute;left:38%;top:58%;width:0;height:0;transform-style:preserve-3d;transform:rotateX(-5deg) rotateY(-34deg)}" +
    ".vl{position:absolute;transform-style:preserve-3d;cursor:pointer;will-change:transform}" +
    ".vf,.vk,.vs{position:absolute;box-sizing:border-box;opacity:var(--o,1);backface-visibility:visible}" +
    ".vf{inset:0;overflow:hidden;" +
      "background:rgba(" + FRAME.backgroundColor + "," + FRAME.backgroundOpacity + ");" +
      "border:" + FRAME.borderWidth + "px solid rgba(" + FRAME.borderColor + "," + FRAME.borderOpacity + ");" +
      "border-radius:" + FRAME.borderRadius + "px;" +
      "box-shadow:" + FRAME.shadow + "}" +
    ".vl.on .vf{border-color:rgba(" + FRAME.activeBorderColor + "," + FRAME.activeBorderOpacity + ")}" +
    ".vk{inset:0;pointer-events:none;border-radius:" + FRAME.borderRadius + "px;" +
      "border:" + FRAME.borderWidth + "px solid rgba(" + FRAME.sideColor + "," + FRAME.sideBorderOpacity * FRAME.backOpacity + ")}" +
    ".vs{pointer-events:none;background:rgba(" + FRAME.sideColor + "," + FRAME.sideOpacity + ");" +
      "border:" + FRAME.borderWidth + "px solid rgba(" + FRAME.sideColor + "," + FRAME.sideBorderOpacity + ")}" +
    ".vs.l{left:0;top:0;height:100%;width:" + FRAME.depth + "px;transform-origin:0 50%;transform:rotateY(90deg)}" +
    ".vs.r{right:0;top:0;height:100%;width:" + FRAME.depth + "px;transform-origin:100% 50%;transform:rotateY(-90deg)}" +
    ".vs.t{left:0;top:0;width:100%;height:" + FRAME.depth + "px;transform-origin:50% 0;transform:rotateX(-90deg)}" +
    ".vs.b{left:0;bottom:0;width:100%;height:" + FRAME.depth + "px;transform-origin:50% 100%;transform:rotateX(90deg)}" +
    ".vf img{display:block;width:100%;height:100%;-webkit-user-drag:none;pointer-events:none}" +
    ".vt{position:absolute;left:8px;bottom:6px;font:300 10px var(--mono);letter-spacing:var(--mono-spacing);color:var(--fg-small);opacity:.6}" +
    ".vbar{position:absolute;display:flex;gap:20px;z-index:4;font:300 12px/1 var(--mono);letter-spacing:var(--mono-spacing);text-transform:uppercase;color:var(--fg-small)}" +
    ".vp,.vb{background:none;border:0;border-radius:0;padding:0;margin:0;color:inherit;font:inherit;letter-spacing:inherit;text-transform:uppercase;white-space:nowrap;filter:blur(.2px)}" +
    ".vp b{font-weight:300}.vb{cursor:pointer;opacity:.55}.vb.on{opacity:1}" +
    "#vinfo{left:14px;top:30px;flex-direction:column;align-items:flex-start;gap:6px}" +
    "#vpan{display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin-top:12px}" +
    "#stage .legend{display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;gap:6px!important;width:100%;text-align:left!important}" +
    "#stage .legend button{display:block!important;margin:0!important;padding:0!important;background:none!important;border:0!important;text-align:left!important;white-space:nowrap;" +
      "font:400 " + THEME.textSize + "px/1.25 'Times New Roman',Times,serif!important;text-transform:uppercase!important;color:var(--fg-small)!important}" +
    "#stage .vgr :not(svg):not(svg *){font:400 " + THEME.textSize + "px/1.25 'Times New Roman',Times,serif!important;text-transform:uppercase!important;text-align:left!important;color:var(--fg-small)!important}" +
    ".vcb{display:inline-block;min-width:2.4em;margin-right:.5em;white-space:pre;text-align:left}" +
    "#vmodes{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 10px);z-index:20}" +
    "@media(max-width:700px){#vinfo{gap:4px}#vpan{gap:4px}}";
  var el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);

  /* ---------- DOM (bewusst ohne h1/p/canvas: burn.js darf diese Elemente nicht als Burn-Ziele indizieren) ---------- */
  var hero = document.querySelector(".hero");
  if (hero) hero.style.display = "none";
  var v = document.createElement("section");
  v.id = "viewer";
  v.innerHTML =
    '<div id="vw"><div id="vwo"></div></div>' +
    '<div class="vbar" id="vinfo"><div class="vp">Next screenshot <b id="vcd">30</b> s</div><div class="vp">States <b id="vcnt">0</b></div><div id="vpan"></div></div>';
  stage.insertBefore(v, stage.firstChild);
  var modes = document.createElement("div");
  modes.className = "vbar";
  modes.id = "vmodes";
  modes.innerHTML = '<button class="vb on" data-m="ov">Overview</button><button class="vb" data-m="ix">Index</button>';
  document.body.appendChild(modes);

  if (wrap) {
    var sec = document.createElement("section");
    sec.className = "dsec";
    sec.innerHTML =
      '<h2>State archive</h2><p class="sub">One screenshot every 30 seconds</p><table><thead><tr><th class="no">No.</th><th class="me">Date / time</th><th>Wear</th><th>Ghosts</th><th>Energy</th><th>Stored</th><th>CO₂</th></tr></thead><tbody id="varc"></tbody></table>';
    wrap.appendChild(sec); /* ans Ende: verschiebt keine bestehenden Burn-Schlüssel */
  }

  /* ---------- Helfer ---------- */
  var z = function (n) { return (n < 10 ? "0" : "") + n; };
  var fd = function (t) { var x = new Date(t); return z(x.getDate()) + "." + z(x.getMonth() + 1) + "." + x.getFullYear(); };
  var ft = function (t) { var x = new Date(t); return z(x.getHours()) + ":" + z(x.getMinutes()) + ":" + z(x.getSeconds()); };
  var nf = function (n, d) { return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: d }); };
  var mk = function (w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  var clampN = function (x) { return Math.min(states.length - 1, Math.max(0, x)); };

  /* echte Werte aus tracker.js / burn.js */
  function M() {
    var o = { wear: 0, gh: 0, wh: 0, co2: 0, kb: 0, st: 0 };
    try {
      var m = window.WT.derive(window.WT.load());
      o.wear = m.wear; o.wh = m.wh; o.co2 = m.co2; o.kb = m.kb; o.st = m.stored;
    } catch (e) {}
    try { o.wear = window.WT_BURN.wear(); o.gh = window.WT_BURN.ghosts(); } catch (e2) {}
    return o;
  }

  /* ---------- Screenshot: #wear kopieren, #ghosts als Text neu zeichnen ---------- */
  function ghostsTo(x, sx) {
    var gh = document.getElementById("ghosts");
    if (!gh) return;
    var ink = getComputedStyle(document.documentElement).getPropertyValue("--burn").trim() || "#55524d";
    Array.prototype.forEach.call(gh.children, function (n) {
      var cs = getComputedStyle(n), r = n.getBoundingClientRect(), a = parseFloat(cs.opacity);
      if (!(a > 0.02) || !r.width) return;
      x.globalAlpha = Math.min(1, a);
      if (n.tagName === "IMG") {
        try { x.drawImage(n, r.left * sx, r.top * sx, r.width * sx, r.height * sx); } catch (e) {}
        return;
      }
      var fs = parseFloat(cs.fontSize) || 14, lh = (parseFloat(cs.lineHeight) || fs * 1.2) * sx, maxw = r.width * sx;
      var t = (n.innerText || n.textContent || "").trim();
      if (cs.textTransform === "uppercase") t = t.toUpperCase();
      x.font = cs.fontStyle + " " + cs.fontWeight + " " + Math.max(4, fs * sx) + "px " + cs.fontFamily;
      x.fillStyle = ink; x.textBaseline = "top";
      var ctr = cs.textAlign === "center";
      x.textAlign = ctr ? "center" : "left";
      var px = (ctr ? r.left + r.width / 2 : r.left) * sx, y = (r.top + (parseFloat(cs.paddingTop) || 0)) * sx;
      t.split(/\n+/).forEach(function (line) {
        var cur = "";
        line.split(" ").forEach(function (w) {
          var test = cur ? cur + " " + w : w;
          if (cur && x.measureText(test).width > maxw) { x.fillText(cur, px, y); y += lh; cur = w; }
          else cur = test;
        });
        x.fillText(cur, px, y); y += lh;
      });
    });
    x.globalAlpha = 1;
  }

  function snap() {
    var sx = C.W / innerWidth, H = Math.min(3200, Math.max(240, Math.round(innerHeight * sx)));
    var c = mk(C.W, H), x = c.getContext("2d");
    var wear = document.getElementById("wear");
    if (wear && wear.width) x.drawImage(wear, 0, 0, C.W, H);
    ghostsTo(x, sx);
    var s = mk(80, Math.round(80 * H / C.W)).getContext("2d");
    s.drawImage(c, 0, 0, 80, s.canvas.height);
    var d = s.getImageData(0, 0, 80, s.canvas.height).data, n = 0;
    for (var i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    var m = M();
    add({ ts: Date.now(), ar: C.W / H, img: c.toDataURL("image/png"), cov: n / (d.length / 4) * 100, wear: m.wear, gh: m.gh, wh: m.wh, co2: m.co2, kb: m.kb, st: m.st });
    if (states.length > C.MAX) states.pop().el.remove();
    save(); next = Date.now() + C.SNAP_MS;
  }

  /* ---------- States ---------- */
  var states = [], pos = 0, target = 0, shown = -1, next = Date.now() + C.SNAP_MS, G = 100, BW = 400, moved = false, down = null, snapT, inView = true, popped = null;

  function dim(o) { var w = BW, h = BW / o.ar; o.el.style.cssText += ";width:" + w + "px;height:" + h + "px;left:" + (-w / 2) + "px;top:" + (-h / 2) + "px"; }
  function add(o) {
    var d = document.createElement("div");
    d.className = "vl";
    var T = FRAME.depth;
    if (T > 0) {
      ["l", "r", "t", "b"].forEach(function (k) { var sd = document.createElement("div"); sd.className = "vs " + k; d.appendChild(sd); });
      for (var q = 1; q <= FRAME.layers; q++) {
        var ly = document.createElement("div"); ly.className = "vk"; ly.style.transform = "translateZ(" + (-T * q / (FRAME.layers + 1)).toFixed(1) + "px)"; d.appendChild(ly);
      }
      var bk = document.createElement("div"); bk.className = "vk"; bk.style.transform = "translateZ(" + (-T) + "px)"; d.appendChild(bk);
    }
    var fr = document.createElement("div"); fr.className = "vf"; d.appendChild(fr);
    var im = document.createElement("img"); im.src = o.img; im.alt = ""; fr.appendChild(im);
    var t = document.createElement("div"); t.className = "vt"; t.textContent = fd(o.ts) + " " + ft(o.ts); fr.appendChild(t);
    o.sx = 0;
    d.onclick = function () { if (moved) return; target = states.indexOf(o); popped = popped === o ? null : o; };
    o.el = d; dim(o);
    document.getElementById("vwo").appendChild(d);
    states.unshift(o); pos += 1; if (target > 0) target += 1;
    shown = -1; document.getElementById("vcnt").textContent = states.length; arc();
  }
  function save() {
    var a = states.map(function (s) { return { ts: s.ts, ar: s.ar, img: s.img, cov: s.cov, wear: s.wear, gh: s.gh, wh: s.wh, co2: s.co2, kb: s.kb, st: s.st }; });
    /* localStorage ist klein (~5 MB): bei hoher Auflösung so viele neueste Frames behalten, wie hineinpassen */
    for (var n = a.length; n > 0; n = Math.floor(n * 0.7) || (n > 1 ? 1 : 0)) {
      try { localStorage.setItem(C.KEY, JSON.stringify(a.slice(0, n))); return; } catch (e) {}
    }
  }

  /* ---------- Anzeige ---------- */
  function size() {
    BW = Math.max(180, Math.min(innerWidth * FRAME.width, innerHeight * FRAME.width * (innerWidth / innerHeight)));
    G = BW * FRAME.gap;
    states.forEach(dim);
  }
  addEventListener("resize", size); size();

  function layout() {
    states.forEach(function (s, i) {
      var d = i - pos,
        o = d < 0 ? Math.max(0, 1 + d * .9) : Math.max(FRAME.minOpacity, 1 - d * FRAME.fade);
      s.el.style.visibility = o <= .01 || d > FRAME.maxVisible ? "hidden" : "visible";
      s.el.style.setProperty("--o", (o * FRAME.opacity).toFixed(3));
      var goal = s === popped ? FRAME.slide * BW : 0;
      s.sx += (goal - s.sx) * FRAME.slideSpeed; if (Math.abs(goal - s.sx) < .05) s.sx = goal;
      s.el.style.transform = "translate3d(" + s.sx.toFixed(1) + "px," + (-d * FRAME.yStep).toFixed(1) + "px," + (-d * G * (d < 0 ? 1.7 : 1)).toFixed(1) + "px)";
      s.el.classList.toggle("on", Math.abs(d) < .5);
    });
  }
  function panel() {
    var i = Math.round(clampN(pos)); if (i === shown || !states[i]) return; shown = i;
    var s = states[i];
    document.getElementById("vpan").innerHTML = [
      ["State", "#" + (states.length - i) + " / " + states.length], ["Date", fd(s.ts) + " " + ft(s.ts)],
      ["Wear", nf(s.wear, 2) + " %"], ["Burn-in", nf(s.cov, 1) + " %"], ["Ghosts", nf(s.gh, 0)],
      ["Power", nf(s.wh, 3) + " Wh"], ["Data", nf(s.kb, 1) + " KB"], ["Stored", nf(s.st, 1) + " KB"], ["CO₂", nf(s.co2, 3) + " g"]
    ].map(function (r) { return '<div class="vp">' + r[0] + " <b>" + r[1] + "</b></div>"; }).join("");
  }
  function arc() {
    var b = document.getElementById("varc"); if (!b) return;
    b.innerHTML = states.slice(0, 15).map(function (s, i) {
      return '<tr><td class="no">' + (states.length - i) + '</td><td class="me">' + fd(s.ts) + " " + ft(s.ts) + "</td><td>" + nf(s.wear, 2) + " %</td><td>" + nf(s.gh, 0) + "</td><td>" + nf(s.wh, 3) + " Wh</td><td>" + nf(s.st, 1) + " KB</td><td>" + nf(s.co2, 3) + " g</td></tr>";
    }).join("");
  }

  /* ---------- Navigation ---------- */
  var settle = function () { clearTimeout(snapT); snapT = setTimeout(function () { target = Math.round(target); }, 180); };
  v.addEventListener("wheel", function (e) { e.preventDefault(); popped = null; target = clampN(target + (e.deltaY + e.deltaX) * .003); settle(); }, { passive: false });
  v.addEventListener("pointerdown", function (e) { down = [e.clientX, e.clientY]; moved = false; });
  addEventListener("pointermove", function (e) {
    if (!down) return;
    var dx = e.clientX - down[0], dy = e.clientY - down[1];
    if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; popped = null; }
    target = clampN(target - (dx + dy) * .006); down = [e.clientX, e.clientY]; settle();
  });
  addEventListener("pointerup", function () { down = null; settle(); setTimeout(function () { moved = false; }, 0); });
  addEventListener("keydown", function (e) {
    if (!inView) return; var k = e.key;
    if (/^(Arrow|Page)/.test(k)) popped = null;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown") target = clampN(Math.round(target) + 1);
    if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") target = clampN(Math.round(target) - 1);
  });
  modes.onclick = function (e) {
    var b = e.target.closest(".vb"); if (!b) return;
    var t = b.dataset.m === "ov" ? v : document.getElementById("tblsec");
    if (t) t.scrollIntoView({ behavior: "smooth" });
  };
  if ("IntersectionObserver" in window)
    new IntersectionObserver(function (en) {
      inView = en[0].isIntersecting;
      modes.children[0].classList.toggle("on", inView);
      modes.children[1].classList.toggle("on", !inView);
    }, { threshold: .5 }).observe(v);

  /* ---------- Graph "All metrics in one graph": Hilfslinien (0 / 50 / 100 %) weg, [ ] / [•] vor den Kategorien ---------- */
  var GRAPH = {
    hideRefLines: true,   /* waagrechte Hilfslinien + Beschriftung 0 / 50 / 100 % ausblenden */
    checkboxes: true,     /* vor jeder klickbaren Kategorie [ ] bzw. [•] */
    hideAllLines: false,   /* im Graphen überhaupt keine Linien im Hintergrund (nur die Datenkurven bleiben) */
    arrange: true,        /* Reihenfolge: Header, Baseline t0, "All values count from here", Kategorien, Graph */
    blockGap: 1           /* Leerzeilen zwischen diesen Blöcken */
  };

  function clsOf(n) { var c = n.className; return (c && c.baseVal !== undefined ? c.baseVal : c) || ""; }
  function graphRoot() {
    var hs = stage.querySelectorAll("h1,h2,h3,h4,.sub,.note");
    for (var i = 0; i < hs.length; i++)
      if (/all metrics in one graph/i.test(hs[i].textContent)) return hs[i].closest("section") || hs[i].parentElement;
    return null;
  }
  function isOn(b) {
    var c = clsOf(b);
    if (/(^|[\s_-])(off|dim|dimmed|hidden|hide|inactive|muted|disabled|unselected|deselected)($|[\s_-])/i.test(c)) return false;
    if (/(^|[\s_-])(on|active|sel|selected|checked|show|shown|visible)($|[\s_-])/i.test(c)) return true;
    var ap = b.getAttribute("aria-pressed"); if (ap === null) ap = b.getAttribute("aria-checked");
    if (ap !== null) return ap === "true";
    return parseFloat(getComputedStyle(b).opacity) >= 0.8;
  }
  function hideEl(n) { if (n.getAttribute("data-vh")) return; n.setAttribute("data-vh", "1"); n.style.setProperty("display", "none", "important"); }

  /* Kategorien oben, Graph darunter (falls die Legende im DOM hinter dem Graphen steht) */
  function layoutGraph(root) {
    var legend = root.querySelector(".legend"), g = root.querySelector("canvas") || root.querySelector("svg");
    if (!legend || !g || legend.contains(g) || g.contains(legend)) return;
    var p = legend.parentElement;
    while (p && !p.contains(g)) p = p.parentElement;
    if (!p || p === root || p.getAttribute("data-vl")) return;
    p.setAttribute("data-vl", "1");
    var kid = function (n) { while (n.parentElement !== p) n = n.parentElement; return n; };
    var lc = kid(legend), gc = kid(g);
    p.style.setProperty("display", "flex", "important");
    p.style.setProperty("flex-direction", "column", "important");
    p.style.setProperty("align-items", "flex-start", "important");
    lc.style.setProperty("order", "-1"); lc.style.setProperty("width", "100%");
    gc.style.setProperty("order", "1"); gc.style.setProperty("align-self", "stretch");
  }

  /* kleinstes Element, dessen Text re trifft (inline-Teile werden zum Elternelement hochgezogen) */
  function leafText(re) {
    var all = stage.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (v.contains(n) || /^(SCRIPT|STYLE|BUTTON|SVG|CANVAS)$/i.test(n.tagName) || !re.test(n.textContent)) continue;
      var deeper = false;
      for (var j = 0; j < n.children.length; j++) if (re.test(n.children[j].textContent)) { deeper = true; break; }
      if (deeper) continue;
      while (n.parentElement && n.parentElement !== stage && /^(SPAN|B|I|EM|STRONG|TIME|SMALL)$/i.test(n.tagName)) n = n.parentElement;
      return n;
    }
    return null;
  }
  function sp(n, k, val) { if (n.style.getPropertyValue(k) !== val) n.style.setProperty(k, val, "important"); }

  function arrange(root) {
    var h = null, hs = root.querySelectorAll("h1,h2,h3,h4");
    for (var i = 0; i < hs.length; i++) if (/all metrics in one graph/i.test(hs[i].textContent)) { h = hs[i]; break; }
    if (!h) return;
    root.classList.add("vgr");
    var kid = function (n) { while (n && n.parentElement !== root) n = n.parentElement; return n; };
    var base = leafText(/baseline\s*t0/i), note = leafText(/all values count from here/i);
    var hk = kid(h);
    if (!hk) return;
    /* Baseline-/Hinweis-Zeile gehören unter den Header; stehen sie woanders, hierher verschieben */
    [base, note].forEach(function (n, idx) {
      if (!n || n === h || n.contains(h) || (base && note && idx === 1 && (base.contains(note) || note.contains(base)))) return;
      if (!root.contains(n)) { var ref = idx === 0 ? hk.nextSibling : (base && root.contains(base) ? kid(base).nextSibling : hk.nextSibling); root.insertBefore(n, ref); }
    });
    var legend = root.querySelector(".legend"), g = root.querySelector("canvas") || root.querySelector("svg");
    var seq = [h, base, note, legend, g], seen = [], gap = (GRAPH.blockGap * THEME.textSize * 1.25).toFixed(1) + "px";
    sp(root, "display", "flex"); sp(root, "flex-direction", "column"); sp(root, "align-items", "flex-start"); sp(root, "justify-content", "flex-start");
    seq.forEach(function (n, idx) {
      if (!n || !root.contains(n)) return;
      var k = kid(n);
      if (!k || seen.indexOf(k) >= 0) return;
      seen.push(k);
      sp(k, "order", String(idx)); sp(k, "align-self", idx === 4 ? "stretch" : "flex-start");
      if (idx >= 2) sp(k, "margin-top", gap);
    });
  }

  function decorate() {
    var root = graphRoot() || stage;
    if (GRAPH.checkboxes) {
      var btns = stage.querySelectorAll(".legend button");
      if (!btns.length && root !== stage) btns = root.querySelectorAll("button");
      Array.prototype.forEach.call(btns, function (b) {
        if (v.contains(b)) return;
        var m = b.querySelector(":scope > .vcb");
        if (!m) { m = document.createElement("span"); m.className = "vcb"; b.insertBefore(m, b.firstChild); }
        var t = isOn(b) ? "[•]" : "[ ]";
        if (m.textContent !== t) m.textContent = t;
      });
    }
    if (root !== stage) { layoutGraph(root); if (GRAPH.arrange) arrange(root); }
    if (GRAPH.hideRefLines) {
      Array.prototype.forEach.call(root.querySelectorAll("svg line"), function (l) {
        if (GRAPH.hideAllLines || Math.abs((parseFloat(l.getAttribute("y1")) || 0) - (parseFloat(l.getAttribute("y2")) || 0)) < 0.5) hideEl(l);
      });
      Array.prototype.forEach.call(root.querySelectorAll("svg [class*='grid'],svg [class*='guide'],svg [class*='ref'],svg [class*='tick']"), hideEl);
      Array.prototype.forEach.call(root.querySelectorAll("*"), function (n) {
        if (n.children.length || n.closest("button,td,th,.vp")) return;
        if (/^\s*(0|50|100)\s*%\s*$/.test(n.textContent)) hideEl(n);
      });
    }
  }
  var decT = 0;
  function decorateSoon() { if (!decT) decT = requestAnimationFrame(function () { decT = 0; decorate(); }); }
  decorate();
  if ("MutationObserver" in window)
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) if (!v.contains(ms[i].target)) { decorateSoon(); return; }
    }).observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-pressed", "aria-checked", "style"] });

  /* ---------- Start ---------- */
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem(C.KEY) || "[]"); } catch (e) {}
  saved.slice().reverse().forEach(add); /* älteste zuerst, damit die neueste vorne liegt */
  pos = target = 0;
  var age = states.length ? Date.now() - states[0].ts : Infinity;
  if (age > C.SNAP_MS) setTimeout(function () { snap(); pos = target = 0; }, 1500); /* burn.js erst fertig zeichnen lassen */
  else next = Date.now() + (C.SNAP_MS - age);
  setInterval(snap, C.SNAP_MS);
  (function frame() {
    pos += (target - pos) * .09; if (Math.abs(target - pos) < .0005) pos = target;
    layout(); panel();
    document.getElementById("vcd").textContent = Math.max(0, Math.ceil((next - Date.now()) / 1000));
    requestAnimationFrame(frame);
  })();
})();