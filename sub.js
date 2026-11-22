// Wear and Tear – sub-pages (pristine ... defective). Include AFTER burn.js:
//   <script src="/burn.js"></script>
//   <script src="/sub.js"></script>
//
// Markup on every sub-page (replaces the old <section class="hero">):
//   <div class="hero-index sub-index">
//     <h1 class="index-item index-title">DEFECTIVE</h1>
//   </div>
//
// - builds the same rows as the start page: (01) P ... (07) D
// - the heading stands in place of the letter of THIS page (found from the file name),
//   in the same small type: "Pristine" instead of the first P, "Defective" instead of the last D
// - LINKS: hover the number (or the letter) of any other row and the letter writes itself out
//   into the whole word, letter by letter. The word is a link to that sub-page.
//   (touch: first tap on the number writes the word, second tap opens the page)
// - going to another sub-page: the page stays, the colour of the target page (read from its "--bg")
//   rises slowly from the bottom to the top with a soft gradient edge, then the page opens
//   (see BG_MS / BG_SOFT / COLORS). The rows (01) ... (07) do not build up again on the new page,
//   they are simply there and show its state. The picture fades over to the new one in the same time.
// - adds a centred picture, rotated by 90 degrees and cropped to the same 3:2 landscape frame (about 900 x 600 px),
//   fixed to the screen (only the text scrolls), blend mode difference at 50 %.
//   default file /img/<page>.jpg, or set data-img="/img/other.jpg" on .sub-index
// - after 10 s of stillness the picture burns into the screen (blend mode screen), see burn.js
(function () {
  "use strict";

  var hero = document.querySelector(".sub-index");
  if (!hero) return;

  var SLUGS = ["pristine", "settled", "patina", "worn", "weathered", "neglected", "defective"];
  var WORDS = ["Pristine", "Settled", "Patina", "Worn", "Weathered", "Neglected", "Defective"];
  var CODES = ["P", "S", "P", "W", "W", "N", "D"];
  var GAP = 0.18; // seconds between two rows when they build up

  // word writing itself out on hover
  var LETTER_MS = 55; // ms between two letters (smaller = faster)
  var LETTER_FADE = 0.6; // seconds one letter takes to fade in
  var CLOSE_MS = 180; // ms the word stays open after the mouse left (so you can move over to it)
  // true:  the word takes its space in the row, the row stays centred on your vertical axis
  //        (like the heading of the current page); the number glides a little to the left while it writes
  // false: the word is written next to the letter without moving anything
  var PUSH = true;

  // background colour: when you click through to another sub-page the page stays as it is and the
  // colour of the target page rises slowly from the bottom to the top, with a soft gradient edge.
  // When it has filled the screen, that page opens (it already has that colour: no jump).
  var BG_MS = 3400; // ms the colour needs from the bottom to the top (0 = off, the page just opens)
  var BG_SOFT = 70; // softness of the moving edge in % of the screen height (0 = hard edge, 100 = very soft)
  var BG_EASE = "cubic-bezier(.5,0,.3,1)"; // easing: slow start, smooth middle, slow end
  var VT_MS = 1800; // ms the browser blends the old and the new page when the new one opens (hides the reload; longer = softer)
  var VT_EASE = "cubic-bezier(.4,0,.2,1)"; // easing of that blend (keep VT_MS the same as animation-duration in style.css)
  var TEXT_FADE = 0.6; // the description text of this page fades out within this share of BG_MS (0.6 = 60 %)
  // The colour of every target page is read automatically from its own "--bg: #xxxxxx;".
  // If you want to set one yourself (or a page has no --bg), put it here, e.g. { settled: "#6a6a6a" }
  var COLORS = {};

  // coming from another sub-page through the colour change: the rows (01) ... (07) do NOT build up
  // again, they are simply there and show the state of this page
  var ARRIVE_KEY = "wt_sub_arrive";
  var arrived = false;
  try {
    var arrTs = +sessionStorage.getItem(ARRIVE_KEY) || 0;
    sessionStorage.removeItem(ARRIVE_KEY);
    arrived = arrTs > 0 && Date.now() - arrTs < 10000;
  } catch (e) {}

  // address of the other sub-pages: same folder and same ending (.html or none) as this page
  var EXT = /\.html$/.test(location.pathname) ? ".html" : "";
  var DIR = location.pathname.replace(/[^\/]*$/, "");
  function hrefOf(i) {
    return DIR + SLUGS[i] + EXT;
  }

  var slug = location.pathname.split("/").pop().replace(/\.html$/, "").toLowerCase();
  var cur = SLUGS.indexOf(slug);
  if (cur < 0) cur = +hero.getAttribute("data-current") - 1;
  if (!(cur >= 0)) cur = 0;

  var title = hero.querySelector(".index-title");
  var parts = [];
  var nums = []; // the "(0n)" items
  var codes = []; // the letter items (links on every page except this one)

  function item(txt) {
    var s = document.createElement("span");
    s.className = "index-item";
    s.textContent = txt;
    hero.appendChild(s);
    parts.push(s);
    return s;
  }

  // a letter that can write itself out into the whole word, and links to that page
  function link(i) {
    var a = document.createElement("a");
    a.className = "index-item sub-link";
    a.href = hrefOf(i);
    a.setAttribute("aria-label", WORDS[i]);

    var first = document.createElement("span");
    first.className = "sub-first";
    first.appendChild(document.createTextNode(CODES[i]));

    var rest = document.createElement("span");
    rest.className = "sub-rest";
    rest.setAttribute("aria-hidden", "true");
    var w = WORDS[i].slice(1);
    for (var k = 0; k < w.length; k++) {
      var l = document.createElement("span");
      l.textContent = w.charAt(k);
      l.style.setProperty("--k", k);
      rest.appendChild(l);
    }
    first.appendChild(rest);
    a.appendChild(first);
    hero.appendChild(a);
    parts.push(a);
    return a;
  }

  for (var i = 0; i < SLUGS.length; i++) {
    nums[i] = item("(0" + (i + 1) + ")");
    if (i === cur && title) {
      hero.appendChild(title); // the heading takes the place of the letter
      parts.push(title);
    } else if (i === cur) {
      codes[i] = item(CODES[i]);
    } else {
      codes[i] = link(i);
    }
  }

  var t = 0;
  parts.forEach(function (p) {
    p.style.setProperty("--d", (arrived ? 0 : t).toFixed(2) + "s");
    t += GAP;
  });
  if (arrived) {
    hero.classList.add("sub-arrived");
    hero.style.setProperty("--fade", "0.01s");
  }

  // ---- links: number / letter hover -> the word writes itself out ----
  var st = document.createElement("style");
  st.textContent =
    /* the item keeps its own look and position from style.css; only colour and underline are neutralised */
    ".sub-num,.sub-link{pointer-events:auto;cursor:pointer}" +
    ".sub-link{color:inherit;text-decoration:none}" +
    /* the rest of the word: grows from width 0 (set by script), the letters fade in one after another, straight, no movement */
    ".sub-rest{display:inline-flex;white-space:nowrap;overflow:hidden;max-width:0;pointer-events:none;" +
    "transition-property:max-width;transition-timing-function:ease;transition-duration:.35s}" +
    ".sub-link.open .sub-rest{pointer-events:auto}" +
    ".sub-rest span{display:inline-block;opacity:0;transition:opacity .2s ease;transition-delay:0s}" +
    ".sub-link.open .sub-rest span{opacity:1;" +
    "transition:opacity " + LETTER_FADE + "s ease;transition-delay:calc(var(--k) * " + LETTER_MS + "ms)}" +
    /* PUSH = false: the word sits next to the letter and moves nothing */
    ".sub-nopush .sub-first{position:relative;display:inline-block}" +
    ".sub-nopush .sub-rest{position:absolute;left:100%;top:0;max-width:none!important;overflow:visible}" +
    /* arrived from another sub-page: the rows are there at once, no build-up */
    ".sub-index.sub-arrived .index-item{transition-duration:0s!important;transition-delay:0s!important;" +
    "animation-duration:.01s!important;animation-delay:0s!important}" +
    "@media(prefers-reduced-motion:reduce){.sub-rest,.sub-rest span{transition:none!important}}";
  document.head.appendChild(st);
  if (!PUSH) hero.classList.add("sub-nopush");

  var canHover = window.matchMedia ? window.matchMedia("(hover: hover)").matches : true;
  var openIdx = -1,
    closeTimer = null;

  // PUSH mode: let the word's width grow (or shrink) smoothly, in step with the letters
  function grow(a, on) {
    if (!PUSH) return;
    var r = a.querySelector(".sub-rest");
    if (!r) return;
    if (on) {
      r.style.transitionDuration = ((r.children.length * LETTER_MS) / 1000 + LETTER_FADE * 0.5).toFixed(2) + "s";
      r.style.maxWidth = r.scrollWidth + 4 + "px";
    } else {
      r.style.transitionDuration = ".35s";
      r.style.maxWidth = "0px";
    }
  }
  function closeAll() {
    if (openIdx >= 0 && codes[openIdx]) {
      codes[openIdx].classList.remove("open");
      grow(codes[openIdx], false);
    }
    openIdx = -1;
  }
  function openWord(i) {
    clearTimeout(closeTimer);
    if (openIdx === i) return;
    closeAll();
    codes[i].classList.add("open");
    grow(codes[i], true);
    openIdx = i;
  }
  function closeLater() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closeAll, CLOSE_MS);
  }

  // ---- smooth background change on the way to another sub-page ----
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Smooth page change without the "reload flash": the browser blends the old page into the new one
  // (View Transitions, Chrome / Edge / Safari 18.2+; other browsers just open the page).
  // The same rules also stand in style.css (section SEITENWECHSEL), which is what makes it reliable.
  var vt = document.createElement("style");
  vt.textContent =
    "@view-transition{navigation:auto}" +
    "::view-transition-group(root){animation-duration:" + VT_MS + "ms;animation-timing-function:" + VT_EASE + "}" +
    "::view-transition-old(root),::view-transition-new(root){animation-timing-function:" + VT_EASE + "}";
  document.head.appendChild(vt);
  // only blend when we come through the colour change; every other page change stays as it was
  window.addEventListener("pageswap", function (e) {
    if (e.viewTransition && !leaving) e.viewTransition.skipTransition();
  });
  window.addEventListener("pagereveal", function (e) {
    if (e.viewTransition && !arrived) e.viewTransition.skipTransition();
  });
  // the colour layer: sits BEHIND the page (text, picture, burn-in stay as they are), fixed to the
  // screen, and moves up from the bottom. Its top edge is a soft gradient (mask).
  // while the colour rises, every background that could cover the layer is made see-through
  // (body, #stage and the screens in it); <html> paints the old colour underneath
  var wipeStyle = document.createElement("style");
  wipeStyle.textContent =
    "html.sub-wiping body,html.sub-wiping #stage,html.sub-wiping #stage>*{background:transparent!important}";
  document.head.appendChild(wipeStyle);
  var DEBUG = /[?&]debug\b/.test(location.search);
  var wipeEl = null,
    saved = null;
  function wipe(color) {
    var H = window.innerHeight,
      S = Math.round((H * BG_SOFT) / 100);
    var cs = getComputedStyle(document.body).backgroundColor;
    if (!cs || cs === "transparent" || /,\s*0\)$/.test(cs))
      cs = getComputedStyle(document.documentElement).backgroundColor;
    // the old colour is now painted by <html>, the body is see-through, so the layer shows above it
    saved = { h: document.documentElement.style.getPropertyValue("background-color") };
    document.documentElement.style.setProperty("background-color", cs, "important");
    document.documentElement.classList.add("sub-wiping");
    if (DEBUG) console.log("[sub] wipe from", cs, "to", color, "for", BG_MS, "ms");
    var mask =
      "linear-gradient(to bottom,rgba(0,0,0,0) 0," +
      "rgba(0,0,0,.06) " + Math.round(S * 0.2) + "px," +
      "rgba(0,0,0,.3) " + Math.round(S * 0.45) + "px," +
      "rgba(0,0,0,.72) " + Math.round(S * 0.75) + "px," +
      "#000 " + S + "px)";
    var el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;left:0;top:0;width:100%;height:" + (H + S) + "px;z-index:-1;pointer-events:none;" +
      "background:" + color + ";will-change:transform;" +
      "transform:translate3d(0," + H + "px,0);-webkit-mask-image:" + mask + ";mask-image:" + mask;
    document.body.insertBefore(el, document.body.firstChild);
    wipeEl = el;
    void el.offsetHeight; // make sure the start position is applied before it moves
    el.style.transition = "transform " + BG_MS + "ms " + BG_EASE;
    el.style.transform = "translate3d(0," + -S + "px,0)";
  }
  // pictures: the picture of the target page fades in while the colour rises, the picture of this
  // page (and its burn-in) fades out. On the new page the picture is simply there (no fade again).
  var fadeEl = null,
    faded = []; // the description text blocks that fade out
  function crossfade(info) {
    if (!base || !base.wrap.parentNode) return; // this page has no picture
    var tr = "opacity " + BG_MS + "ms ease";
    var w = document.createElement("div");
    w.className = "sub-img sub-base";
    var fr = document.createElement("div");
    fr.className = "sub-frame";
    var im = new Image();
    im.alt = "";
    im.src = info.img;
    fr.appendChild(im);
    w.appendChild(fr);
    w.style.transition = tr;
    base.wrap.parentNode.insertBefore(w, base.wrap);
    fadeEl = w;
    void w.offsetHeight;
    w.classList.add("on"); // fades in to its normal look
    base.wrap.style.transition = tr;
    base.wrap.style.opacity = "0";
    burn.wrap.style.transition = tr;
    burn.wrap.style.opacity = "0";
    // the description text of this page fades out too (the new page brings its own), so nothing
    // is swapped abruptly when the new page opens. The rows (01) ... (07) stay.
    var stg = document.getElementById("stage");
    if (stg)
      Array.prototype.forEach.call(stg.children, function (c) {
        if (c === hero || c.contains(hero)) return;
        c.style.transition = "opacity " + Math.round(BG_MS * TEXT_FADE) + "ms ease";
        c.style.opacity = "0";
        faded.push(c);
      });
  }
  function unfade() {
    faded.forEach(function (c) {
      c.style.transition = "";
      c.style.opacity = "";
    });
    faded = [];
    if (fadeEl && fadeEl.parentNode) fadeEl.parentNode.removeChild(fadeEl);
    fadeEl = null;
    if (base && base.wrap) {
      base.wrap.style.transition = "";
      base.wrap.style.opacity = "";
    }
    if (burn && burn.wrap) burn.wrap.style.transition = "";
  }
  function unwipe() {
    unfade();
    if (wipeEl && wipeEl.parentNode) wipeEl.parentNode.removeChild(wipeEl);
    wipeEl = null;
    document.documentElement.classList.remove("sub-wiping");
    if (saved) {
      if (saved.h) document.documentElement.style.setProperty("background-color", saved.h);
      else document.documentElement.style.removeProperty("background-color");
      saved = null;
    }
  }

  // what we need to know about a target page: its colour (from its own "--bg: ...;", or COLORS)
  // and its picture (its data-img, or /img/<page>.jpg)
  var infoCache = {};
  function infoOf(i) {
    var fallback = { color: COLORS[SLUGS[i]] || null, img: "/img/" + SLUGS[i] + ".jpg" };
    if (!window.fetch) return Promise.resolve(fallback);
    if (!infoCache[i])
      infoCache[i] = fetch(hrefOf(i), { credentials: "same-origin" })
        .then(function (r) {
          return r.ok ? r.text() : "";
        })
        .then(function (html) {
          var m = /--bg\s*:\s*(#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([^)]*\))/.exec(html);
          var d = /data-img\s*=\s*["']([^"']+)["']/.exec(html);
          return { color: COLORS[SLUGS[i]] || (m ? m[1] : null), img: d ? d[1] : fallback.img };
        })
        .catch(function () {
          return fallback;
        });
    return infoCache[i];
  }
  function loadImg(src) {
    return new Promise(function (done) {
      var im = new Image(),
        over = false;
      function fin() {
        if (!over) {
          over = true;
          done();
        }
      }
      im.onload = fin;
      im.onerror = fin;
      im.src = src;
      setTimeout(fin, 1200); // never wait longer than this
    });
  }
  // load colours and pictures of the other pages in the background, so the change can start at once on click
  if (BG_MS > 0 && !reduce)
    setTimeout(function () {
      for (var q = 0; q < SLUGS.length; q++)
        if (q !== cur)
          infoOf(q).then(function (x) {
            loadImg(x.img);
          });
    }, 600);

  var leaving = false;
  function go(i, e) {
    if (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return; // new tab etc.: normal link
      e.preventDefault();
    }
    if (leaving) return;
    leaving = true;
    var gone = false;
    function nav() {
      if (gone) return;
      gone = true;
      try {
        sessionStorage.setItem(ARRIVE_KEY, String(Date.now()));
      } catch (e) {}
      location.href = hrefOf(i);
    }
    if (BG_MS <= 0 || reduce) return nav();
    setTimeout(nav, BG_MS + 1500); // safety: never get stuck
    infoOf(i).then(function (info) {
      if (!info.color) {
        // no colour found for that page: it opens without the colour change
        console.warn("[sub] no '--bg: #xxxxxx;' found in " + hrefOf(i) + " - set it in COLORS (sub.js)");
        return nav();
      }
      loadImg(info.img).then(function () {
        wipe(info.color); // the colour rises from the bottom, the text stays
        crossfade(info); // the picture fades over to the new one
        setTimeout(nav, BG_MS + 150);
      });
    });
  }
  // test helper for the console (does NOT open the page):  WT_SUB.test(0)  = colour change to page 01,
  // WT_SUB.reset() = back to normal. Pages are numbered 0..6 (pristine ... defective).
  window.WT_SUB = {
    test: function (i) {
      unwipe();
      return infoOf(i).then(function (info) {
        console.log("[sub] page " + i + " (" + SLUGS[i] + "):", info);
        if (info.color) {
          wipe(info.color);
          crossfade(info);
        }
        return info;
      });
    },
    reset: unwipe,
  };

  // coming back with the browser's back button: the page is restored as it was
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      leaving = false;
      unwipe();
    }
  });

  nums.forEach(function (n, i) {
    if (i === cur) return;
    n.classList.add("sub-num");
    n.addEventListener("mouseenter", function () {
      openWord(i);
    });
    n.addEventListener("mouseleave", closeLater);
    n.addEventListener("click", function () {
      // mouse: go straight there; touch: first tap writes the word, second tap opens the page
      if (canHover || openIdx === i) go(i);
      else openWord(i);
    });
    codes[i].addEventListener("click", function (e) {
      go(i, e);
    });
    codes[i].addEventListener("mouseenter", function () {
      openWord(i);
    });
    codes[i].addEventListener("mouseleave", closeLater);
    codes[i].addEventListener("focus", function () {
      openWord(i);
    });
    codes[i].addEventListener("blur", closeLater);
  });
  // touch: a tap anywhere else closes the word again
  document.addEventListener("pointerdown", function (e) {
    if (openIdx < 0) return;
    if (e.target.closest && e.target.closest(".sub-num,.sub-link")) return;
    closeAll();
  });

  // the picture: two layers with the same picture, fixed to the screen (only the text scrolls)
  //   1) difference at 50 %  - always there
  //   2) screen              - the burn-in; gets stronger the longer the page stood still (see burn.js)
  var stage = document.getElementById("stage");
  var src = hero.getAttribute("data-img") || "/img/" + slug + ".jpg";

  function layer(cls) {
    var wrap = document.createElement("div");
    wrap.className = "sub-img " + cls;
    var frame = document.createElement("div");
    frame.className = "sub-frame";
    var im = new Image();
    im.alt = "";
    if (arrived) im.decoding = "sync"; // coming through the colour change: no late pop-in
    im.src = src;
    frame.appendChild(im);
    wrap.appendChild(frame);
    document.body.insertBefore(wrap, stage || document.body.firstChild);
    return { wrap: wrap, img: im };
  }

  var base = layer("sub-base");
  var burn = layer("sub-burn");
  if (arrived) {
    // coming through the colour change: the picture was already fading in on the other page, so here
    // it is simply there (no second fade)
    base.wrap.style.transition = "none";
    base.wrap.classList.add("on");
  }

  base.img.onload = function () {
    base.wrap.classList.add("on");
  };
  base.img.onerror = function () {
    [base.wrap, burn.wrap].forEach(function (w) {
      if (w.parentNode) w.parentNode.removeChild(w);
    });
  };

  // burn-in: strength of the screen layer follows how often the page has stood still
  var BURN_MAX = 0.55; // opacity of the screen layer when fully burnt in
  if (window.WT_BURN && WT_BURN.image) {
    WT_BURN.image("i:" + slug, function (w) {
      burn.wrap.style.opacity = (w * BURN_MAX).toFixed(3);
    });
  }

  function showHero() {
    setTimeout(function () {
      hero.classList.add("show");
    }, 300);
  }
  if (arrived) hero.classList.add("show");
  else if (document.fonts && document.fonts.ready) document.fonts.ready.then(showHero);
  else showHero();
})();