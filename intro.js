// Wear and Tear – start-page intro. Include on the START PAGE only, AFTER burn.js:
//   <script src="/burn.js"></script>
//   <script src="/intro.js"></script>
//
// - Every .hero-index screen builds itself up from top to bottom (small rows and the
//   large texts between them), one part after the other, when it scrolls into view.
// - The FIRST time a screen appears it builds up slowly and nicely. When it comes into
//   view AGAIN (e.g. you scroll back up) it builds up much faster, so you never have to wait.
// - On the .hero-legend screen each entry (01..05) also reveals its category in the
//   top-left corner info a moment AFTER its code (UN, CL ...) has faded in. After the last
//   entry the top-right info (coordinates, clock) appears too. Once revealed, it stays.
//
// Timing (set on the section, in seconds):
//   data-stagger = pause between two parts (rows / texts)
//   data-pause   = extra pause after each text before the next part begins
//   data-fade    = how long one part takes to fade in (default 1.4)
(function () {
  "use strict";

  var sections = document.querySelectorAll(".hero-index");
  if (!sections.length) return;

  var DEFAULT_STAGGER = 0.4;
  var DEFAULT_PAUSE = 0.5;
  var DEFAULT_FADE = 1.4;
  var HUD_LEAD = 1.2; // seconds after the code row appears until its corner info follows

  // when a screen comes into view AGAIN it builds up faster:
  var REPEAT_SPEED = 0.3; // multiplies all waiting times (0.3 = about 3x faster, 1 = same as the first time)
  var REPEAT_FADE = 0.5; // multiplies the fade time of every part (0.5 = twice as fast)
  var OUT_FADE = 0.25; // seconds: how fast a screen clears itself once it is out of view

  var IN_VIEW = 0.6; // how much of the screen must be visible before it starts building

  var plans = []; // per section: its parts, their delays, and when each corner entry is revealed

  sections.forEach(function (sec) {
    var gap = parseFloat(sec.getAttribute("data-stagger"));
    var pause = parseFloat(sec.getAttribute("data-pause"));
    var fade = parseFloat(sec.getAttribute("data-fade"));
    if (isNaN(gap)) gap = DEFAULT_STAGGER;
    if (isNaN(pause)) pause = DEFAULT_PAUSE;
    if (isNaN(fade)) fade = DEFAULT_FADE;

    var legend = sec.classList.contains("hero-legend");
    var parts = []; // { el, d }  d = delay of this part in seconds (first visit)
    var reveals = [];
    var t = 0;
    var afterInsert = false;

    sec.querySelectorAll(".index-item, .index-insert").forEach(function (p) {
      parts.push({ el: p, d: t });
      if (p.classList.contains("index-insert")) {
        t += pause; // breathe after every text, so it can be read
        afterInsert = legend;
      } else if (afterInsert) {
        // the code row (UN, WP ...) just appeared under the text: now the corner info follows
        reveals.push((t + HUD_LEAD) * 1000);
        t += HUD_LEAD + 0.8; // wait until it is there before the next entry begins
        afterInsert = false;
      }
      t += gap;
    });

    plans.push({
      sec: sec,
      parts: parts,
      reveals: reveals,
      fade: fade,
      legend: legend,
      seen: false, // has this screen been built before?
    });
  });

  // build the screen up (slow the first time, fast afterwards)
  function build(plan) {
    var again = plan.seen;
    var speed = again ? REPEAT_SPEED : 1;
    plan.sec.style.setProperty("--fade", (plan.fade * (again ? REPEAT_FADE : 1)).toFixed(2) + "s");
    plan.parts.forEach(function (p) {
      p.el.style.setProperty("--d", (p.d * speed).toFixed(2) + "s");
    });
    plan.sec.classList.add("show");

    // the corner info is revealed only once, on the first visit (afterwards it stays)
    if (!again && plan.legend && window.WT_HUD) {
      plan.reveals.forEach(function (ms, k) {
        setTimeout(function () {
          window.WT_HUD.reveal(k + 1);
        }, ms);
      });
    }
    plan.seen = true;
  }

  // clear the screen quickly after it left the view, so it can build up again next time
  function reset(plan) {
    plan.sec.classList.remove("show");
    plan.sec.style.setProperty("--fade", OUT_FADE + "s");
    plan.parts.forEach(function (p) {
      p.el.style.setProperty("--d", "0s");
    });
  }

  function go() {
    if (!("IntersectionObserver" in window)) {
      plans.forEach(build);
      return;
    }

    var byEl = new Map();
    plans.forEach(function (p) {
      byEl.set(p.sec, p);
    });

    // enough of the screen is visible -> build it (also works for screens taller than the window)
    var enter = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          var plan = byEl.get(e.target);
          var enough =
            e.intersectionRatio >= IN_VIEW ||
            e.intersectionRect.height >= IN_VIEW * window.innerHeight;
          if (enough && !plan.sec.classList.contains("show")) build(plan);
        });
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
    );

    // completely out of view -> reset
    var leave = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) return;
          var plan = byEl.get(e.target);
          if (plan.sec.classList.contains("show")) reset(plan);
        });
      },
      { threshold: [0] },
    );

    plans.forEach(function (p) {
      enter.observe(p.sec);
      leave.observe(p.sec);
    });
  }

  // give fonts and layout a moment, so the build-up is not cut off at the start
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(function () {
      setTimeout(go, 400);
    });
  else setTimeout(go, 600);
})();