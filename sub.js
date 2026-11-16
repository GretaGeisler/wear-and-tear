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
// - adds a centred picture, rotated by 90 degrees and cropped to the same 3:2 landscape frame (about 900 x 600 px),
//   fixed to the screen (only the text scrolls), blend mode difference at 50 %.
//   default file /img/<page>.jpg, or set data-img="/img/other.jpg" on .sub-index
// - after 10 s of stillness the picture burns into the screen (blend mode screen), see burn.js
(function () {
  "use strict";

  var hero = document.querySelector(".sub-index");
  if (!hero) return;

  var SLUGS = ["pristine", "settled", "patina", "worn", "weathered", "neglected", "defective"];
  var CODES = ["P", "S", "P", "W", "W", "N", "D"];
  var GAP = 0.18; // seconds between two rows when they build up

  var slug = location.pathname.split("/").pop().replace(/\.html$/, "").toLowerCase();
  var cur = SLUGS.indexOf(slug);
  if (cur < 0) cur = +hero.getAttribute("data-current") - 1;
  if (!(cur >= 0)) cur = 0;

  var title = hero.querySelector(".index-title");
  var parts = [];

  function item(txt) {
    var s = document.createElement("span");
    s.className = "index-item";
    s.textContent = txt;
    hero.appendChild(s);
    parts.push(s);
  }

  for (var i = 0; i < SLUGS.length; i++) {
    item("(0" + (i + 1) + ")");
    if (i === cur && title) {
      hero.appendChild(title); // the heading takes the place of the letter
      parts.push(title);
    } else item(CODES[i]);
  }

  var t = 0;
  parts.forEach(function (p) {
    p.style.setProperty("--d", t.toFixed(2) + "s");
    t += GAP;
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
    im.src = src;
    frame.appendChild(im);
    wrap.appendChild(frame);
    document.body.insertBefore(wrap, stage || document.body.firstChild);
    return { wrap: wrap, img: im };
  }

  var base = layer("sub-base");
  var burn = layer("sub-burn");

  base.img.onload = function () {
    base.wrap.classList.add("on");
  };
  base.img.onerror = function () {
    [base.wrap, burn.wrap].forEach(function (w) {
      if (w.parentNode) w.parentNode.removeChild(w);
    });
  };

  // burn-in: strength of the screen layer follows how often the page has stood still
  var BURN_MAX = 0.85; // opacity of the screen layer when fully burnt in
  if (window.WT_BURN && WT_BURN.image) {
    WT_BURN.image("i:" + slug, function (w) {
      burn.wrap.style.opacity = (w * BURN_MAX).toFixed(3);
    });
  }

  function go() {
    setTimeout(function () {
      hero.classList.add("show");
    }, 300);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  else go();
})();