/* viewer.js v3 – Burn-In-Archiv als erste Ansicht von stats.html.
   Einbinden: <script src="/viewer.js"></script> vor </body>, NACH burn.js, tracker.js und dem Inline-Skript.
   Jeder Screenshot = der echte Zustand von #wear (Cursor-Burns) und #ghosts (Text-Burns). */
(function () {
  var C = { SNAP_MS: 30000, W: 480, MAX: 24, KEY: "wt_arc" };

  /* ---------- LOOK DER FRAMES: hier anpassen ---------- */
  var FRAME = {
    /* Fläche (sichtbar, wo der Screenshot transparent ist) */
    backgroundColor: "47,39,35",   /* r,g,b */
    backgroundOpacity: 0.04,

    /* Rahmen */
    borderColor: "47,39,35",       /* r,g,b */
    borderOpacity: 0.15,
    borderWidth: 0.25,                /* px */
    borderRadius: 0,               /* px, 0 = eckig */
    shadow: "none",                /* z.B. "3px 4px 7px rgba(55,50,50,.16)" */

    /* aktiver (vorderster) Frame */
    activeBorderColor: "97,89,85",
    activeBorderOpacity: 0.25,

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
    maxVisible: 14     /* wie viele Frames nach hinten sichtbar sind */
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
    textSize: 12                   /* px: Text + Überschriften unter dem Viewer (wie die Zeile oben) */
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
    "#tblsec,.dsec,#list{justify-content:flex-start!important;align-items:flex-start!important}" +
    "#list ul{margin:0!important;max-width:none!important}" +
    "#stage th,#stage td{padding:4px 24px 4px 0!important}" +
    "#list li a{display:block!important;padding:6px 0!important}" +
    "#list li a::before,#list li a::after{content:none!important;display:none!important}" +
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
    var sx = C.W / innerWidth, H = Math.min(960, Math.max(240, Math.round(innerHeight * sx)));
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
  var states = [], pos = 0, target = 0, shown = -1, next = Date.now() + C.SNAP_MS, G = 100, BW = 400, moved = false, down = null, snapT, inView = true;

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
    d.onclick = function () { if (!moved) target = states.indexOf(o); };
    o.el = d; dim(o);
    document.getElementById("vwo").appendChild(d);
    states.unshift(o); pos += 1; if (target > 0) target += 1;
    shown = -1; document.getElementById("vcnt").textContent = states.length; arc();
  }
  function save() {
    var a = states.map(function (s) { return { ts: s.ts, ar: s.ar, img: s.img, cov: s.cov, wear: s.wear, gh: s.gh, wh: s.wh, co2: s.co2, kb: s.kb, st: s.st }; });
    try { localStorage.setItem(C.KEY, JSON.stringify(a)); }
    catch (e) { try { localStorage.setItem(C.KEY, JSON.stringify(a.slice(0, 10))); } catch (e2) {} }
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
      s.el.style.transform = "translate3d(0," + (-d * FRAME.yStep).toFixed(1) + "px," + (-d * G * (d < 0 ? 1.7 : 1)).toFixed(1) + "px)";
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
  v.addEventListener("wheel", function (e) { e.preventDefault(); target = clampN(target + (e.deltaY + e.deltaX) * .003); settle(); }, { passive: false });
  v.addEventListener("pointerdown", function (e) { down = [e.clientX, e.clientY]; moved = false; });
  addEventListener("pointermove", function (e) {
    if (!down) return;
    var dx = e.clientX - down[0], dy = e.clientY - down[1];
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    target = clampN(target - (dx + dy) * .006); down = [e.clientX, e.clientY]; settle();
  });
  addEventListener("pointerup", function () { down = null; settle(); setTimeout(function () { moved = false; }, 0); });
  addEventListener("keydown", function (e) {
    if (!inView) return; var k = e.key;
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