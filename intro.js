// Wear and Tear – start-page intro. Include on the START PAGE only, AFTER burn.js:
//   <script src="/burn.js"></script>
//   <script src="/intro.js"></script>
//
// FIRST SCREEN (.hero-index): builds itself up from top to bottom (small rows and the large
//   texts between them), one part after the other, when it scrolls into view.
//     data-stagger = pause between two parts (seconds)
//     data-pause   = extra pause after each text
//     data-fade    = how long one part takes to fade in
//
// LEGEND SCREEN (.hero-legend inside .legend-track): coupled to scrolling. The screen stays in
//   place while you scroll; every scroll step (it snaps) adds the next entry (01, 02, ...):
//   number, then the explanation between the lines, then the code (UN, CL ...), and a moment
//   later the matching category appears in the top-left corner info. Everything stays once
//   it is there, so the entries build up one under the other.
(function () {
  "use strict";

  var DEFAULT_STAGGER = 0.4;
  var DEFAULT_PAUSE = 0.5;

  // legend timing (seconds, counted from the moment the scroll step is reached)
  var LEG_TEXT = 0.5; // explanation appears this long after the number
  var LEG_CODE = 1.9; // the code (UN, CL ...) appears this long after the number
  var LEG_HUD = 1.1; // the corner info follows this long after the code
  var LEG_SKIP = 1.0; // extra delay per entry when several are reached at once (fast scrolling)

  // ---------- first screen ----------
  var sections = document.querySelectorAll(".hero-index:not(.hero-legend)");
  var plans = [];

  sections.forEach(function (sec) {
    var gap = parseFloat(sec.getAttribute("data-stagger"));
    var pause = parseFloat(sec.getAttribute("data-pause"));
    var fade = parseFloat(sec.getAttribute("data-fade"));
    if (isNaN(gap)) gap = DEFAULT_STAGGER;
    if (isNaN(pause)) pause = DEFAULT_PAUSE;
    if (!isNaN(fade)) sec.style.setProperty("--fade", fade + "s");

    var t = 0;
    sec.querySelectorAll(".index-item, .index-insert").forEach(function (p) {
      p.style.setProperty("--d", t.toFixed(2) + "s");
      if (p.classList.contains("index-insert")) t += pause; // breathe after every text
      t += gap;
    });
    plans.push(sec);
  });

  function goFirst() {
    if (!("IntersectionObserver" in window)) {
      plans.forEach(function (s) {
        s.classList.add("show");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            io.unobserve(e.target);
            e.target.classList.add("show");
          }
        });
      },
      { threshold: 0.6 },
    );
    plans.forEach(function (s) {
      io.observe(s);
    });
  }

  // ---------- legend screen, driven by scrolling ----------
  var track = document.querySelector(".legend-track");
  var legend = track && track.querySelector(".hero-legend");

  function setupLegend() {
    var kids = Array.prototype.slice.call(legend.querySelectorAll(".index-item, .index-insert"));
    // entries are three parts each: number, explanation, code
    var entries = [];
    for (var i = 0; i + 2 < kids.length; i += 3) entries.push([kids[i], kids[i + 1], kids[i + 2]]);
    var n = entries.length;

    // the track is n screens tall; one snap point per entry
    track.style.height = "calc(100vh * " + n + ")";
    track.style.height = "calc(100svh * " + n + ")";
    for (var k = 0; k < n; k++) {
      var a = document.createElement("span");
      a.className = "legend-snap";
      a.style.top = "calc(100vh * " + k + ")";
      a.style.top = "calc(100svh * " + k + ")";
      track.appendChild(a);
    }

    var shown = -1; // last entry that has been revealed

    function reveal(k, extra) {
      var e = entries[k];
      var d = [0, LEG_TEXT, LEG_CODE];
      e.forEach(function (el, j) {
        el.style.setProperty("--d", (extra + d[j]).toFixed(2) + "s");
        el.classList.add("on");
      });
      setTimeout(function () {
        if (window.WT_HUD) window.WT_HUD.reveal(k + 1);
      }, (extra + LEG_CODE + LEG_HUD) * 1000);
    }

    var ticking = false;
    function update() {
      ticking = false;
      var top = track.getBoundingClientRect().top;
      var vh = window.innerHeight || 1;
      // an entry is revealed once its scroll step is (almost) reached
      var step = Math.min(n - 1, Math.floor(-top / vh + 0.6));
      var extra = 0;
      while (shown < step) {
        shown++;
        reveal(shown, extra);
        extra += LEG_SKIP;
      }
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  function init() {
    goFirst();
    if (track && legend) setupLegend();
  }

  // give fonts and layout a moment, so the build-up is not cut off at the start
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(init, 400); });
  else setTimeout(init, 600);
})();