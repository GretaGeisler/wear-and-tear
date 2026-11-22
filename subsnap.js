/* subsnap.js – speichert Burn-In-Screenshots einer Subpage in localStorage (Key: wt_sub_<seite>).
   Einbinden auf jeder Subpage NACH sub.js:  <script src="/subsnap.js"></script>
   Normal: Snapshot nach 4 s, dann alle 30 s und beim Verlassen der Seite.
   Mit ?snap=1 (unsichtbarer iframe der Stats-Seite): ein einziger Snapshot nach 6,5 s, dann Meldung an die Stats-Seite. */
(function () {
  var PAGE = location.pathname.split("/").pop().replace(/\.html$/, "").replace(/\W+/g, "_") || "home";
  var KEY = "wt_sub_" + PAGE;
  var LABEL = document.title.split(/\s[–-]\s/)[0];
  var W = 800,          /* Breite der Screenshots in px (kleiner = weniger Speicher) */
      MAX = 8,          /* max. Frames pro Subpage */
      EVERY = 30000,    /* ms zwischen zwei Snapshots auf der offenen Subpage */
      QUALITY = 0.82;   /* JPEG-Qualität 0..1 */

  function M() {
    var o = { wear: 0, gh: 0, wh: 0, co2: 0, kb: 0, st: 0, tier: "" };
    try {
      var m = WT.derive(WT.load());
      o.wear = m.wear; o.wh = m.wh; o.co2 = m.co2; o.kb = m.kb; o.st = m.stored;
      o.tier = WT.TIERS[WT.tier(m.wear)][0];
    } catch (e) {}
    try { o.wear = WT_BURN.wear(); o.gh = WT_BURN.ghosts(); } catch (e2) {}
    return o;
  }

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
      var px = (ctr ? r.left + r.width / 2 : r.left) * sx, y = r.top * sx;
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

  /* Bild-Burn-in (.sub-burn): gedreht, zugeschnitten (cover), mit Sättigung/Kontrast, wie im Original per "screen" über dem Hintergrund */
  function pictureTo(x, sx) {
    var sb = document.querySelector(".sub-burn"), fr = sb && sb.querySelector(".sub-frame"),
        im = fr && fr.querySelector("img");
    if (!im || !im.complete || !im.naturalWidth) return;
    var a = parseFloat(getComputedStyle(sb).opacity) || 0;
    if (a < 0.01) return;
    var r = fr.getBoundingClientRect(), dw = r.height * sx, dh = r.width * sx,
        iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(dw / iw, dh / ih),
        sw = dw / s, sh = dh / s;
    x.save();
    x.globalCompositeOperation = "screen";
    x.globalAlpha = a;
    try { x.filter = getComputedStyle(im).filter; } catch (e) {}
    x.translate((r.left + r.width / 2) * sx, (r.top + r.height / 2) * sx);
    x.rotate(Math.PI / 2);
    try { x.drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, -dw / 2, -dh / 2, dw, dh); } catch (e2) {}
    x.restore();
  }

  function pageBg() {
    var c = getComputedStyle(document.body).backgroundColor;
    if (!c || c === "transparent" || c === "rgba(0, 0, 0, 0)") c = getComputedStyle(document.documentElement).backgroundColor;
    return c || "#ffffff";
  }

  function snap() {
    try { snapInner(); } catch (err) { console.error("[subsnap] Fehler beim Snapshot:", err); }
  }
  function snapInner() {
    var sx = W / innerWidth, H = Math.min(3200, Math.max(240, Math.round(innerHeight * sx)));
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    x.fillStyle = pageBg();           /* Seitenfarbe (--bg) mit ins Bild */
    x.fillRect(0, 0, W, H);
    pictureTo(x, sx);
    var wear = document.getElementById("wear");
    if (wear && wear.width) x.drawImage(wear, 0, 0, W, H);
    ghostsTo(x, sx);
    var m = M(), arr = [];
    try { arr = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) {}
    arr.unshift({
      ts: Date.now(), ar: W / H, img: c.toDataURL("image/jpeg", QUALITY), cov: 0,
      wear: m.wear, gh: m.gh, wh: m.wh, co2: m.co2, kb: m.kb, st: m.st,
      tier: m.tier, label: LABEL
    });
    arr = arr.slice(0, MAX);
    for (var n = arr.length; n > 0; n--) { /* bei Platzmangel älteste Frames verwerfen */
      try { localStorage.setItem(KEY, JSON.stringify(arr.slice(0, n))); return; } catch (e3) {}
    }
    console.warn("[subsnap] Speichern fehlgeschlagen: localStorage ist voll. Alte Einträge löschen oder W/MAX in subsnap.js senken.");
  }

  var FRAMED = /[?&]snap=1(&|$)/.test(location.search);
  if (FRAMED) {
    /* im unsichtbaren iframe: warten bis Index + Bild aufgebaut sind, einmal speichern, Bescheid geben */
    setTimeout(function () {
      snap();
      try { parent.postMessage({ type: "wt_snap_done", page: PAGE }, location.origin); } catch (e) {}
    }, 6500);
  } else {
    setTimeout(snap, 4000);
    setInterval(snap, EVERY);
    addEventListener("pagehide", snap);
  }
})();