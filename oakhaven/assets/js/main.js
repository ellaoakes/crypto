(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var motion = hasGsap && !reduce;

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- nav ---------- */
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  function onScroll() { nav.classList.toggle("is-solid", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    links.classList.toggle("is-open", open);
  });
  links.addEventListener("click", function (e) {
    if (e.target.closest("a")) { toggle.setAttribute("aria-expanded", "false"); links.classList.remove("is-open"); }
  });

  /* ---------- tabs: elevations ---------- */
  var elevImg = document.getElementById("elev-img");
  var elevCap = document.getElementById("elev-cap");
  document.querySelectorAll("[data-img]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      btn.parentElement.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-selected", String(b === btn)); });
      elevImg.classList.add("is-swapping");
      setTimeout(function () {
        elevImg.src = "assets/img/" + btn.dataset.img + ".jpg";
        elevImg.alt = "Castlegate, " + btn.dataset.label;
        elevCap.textContent = btn.dataset.label;
        elevImg.onload = function () { elevImg.classList.remove("is-swapping"); };
      }, reduce ? 0 : 280);
    });
  });

  /* ---------- tabs: plans ---------- */
  var planImg = document.getElementById("plan-img");
  document.querySelectorAll("[data-plan]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var floor = btn.dataset.plan;
      btn.parentElement.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-selected", String(b === btn)); });
      document.querySelectorAll(".rooms").forEach(function (ul) { ul.hidden = ul.dataset.floor !== floor; });
      planImg.src = "assets/img/plan-" + floor + ".png";
      planImg.alt = "Proposed " + floor + " floor plan";
      if (motion) scanPlan();
    });
  });

  /* ---------- enquiry form ---------- */
  var form = document.getElementById("enquiry-form");
  form.addEventListener("submit", function () {
    form.querySelector(".form-status").textContent = "Thank you. Your email app should now open with your enquiry ready to send.";
  });

  /* ---------- static fallback ---------- */
  if (!motion) {
    root.classList.add("no-motion");
    ["g-crane", "g-scaffold", "g-people", "g-site"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = "none";
    });
    document.getElementById("lawn").setAttribute("opacity", "1");
    var trusses = document.getElementById("trusses"); if (trusses) trusses.style.display = "none";
    document.querySelectorAll(".stage").forEach(function (s) { s.classList.add("is-active"); });
    return;
  }

  root.classList.add("js-motion");
  gsap.registerPlugin(ScrollTrigger);

  function prepDraw(el) {
    var len = el.getTotalLength ? el.getTotalLength() : 1000;
    el.style.strokeDasharray = len + " " + len;
    el.style.strokeDashoffset = len;
    return el;
  }

  /* ---------- hero: drawing plots, then the render wipes in ---------- */
  var heroDrawing = document.querySelector(".hero-drawing");
  var heroRender = document.querySelector(".hero-render");
  var scan = document.querySelector(".hero-scan");
  gsap.set(heroRender, { clipPath: "inset(0 100% 0 0)" });
  gsap.set(heroDrawing, { opacity: 1, clipPath: "inset(0 100% 0 0)" });
  gsap.set(".hero-tag-render", { opacity: 0 });
  gsap.set(".hero-tag-draw", { opacity: 1 });
  gsap.from(".hero-copy > *", { y: 30, opacity: 0, duration: 1, stagger: .12, ease: "power3.out", delay: .1 });
  gsap.timeline({ delay: .5 })
    .set(scan, { opacity: 1, left: "0%" })
    .to(heroDrawing, { clipPath: "inset(0 0% 0 0)", duration: 2.6, ease: "power1.inOut" }, 0)
    .to(scan, { left: "100%", duration: 2.6, ease: "power1.inOut" }, 0)
    .set(scan, { left: "0%" }, "+=.5")
    .to(heroRender, { clipPath: "inset(0 0% 0 0)", duration: 1.8, ease: "power2.inOut" }, ">")
    .to(scan, { left: "100%", duration: 1.8, ease: "power2.inOut" }, "<")
    .to(heroDrawing, { opacity: 0, duration: 1.2 }, "<.6")
    .to(".hero-tag-draw", { opacity: 0, duration: .4 }, "<")
    .to(".hero-tag-render", { opacity: 1, duration: .6 }, ">-.4")
    .to(scan, { opacity: 0, duration: .3 }, ">-.2");

  /* ---------- section reveals ---------- */
  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true }
    });
  });

  /* ---------- counters ---------- */
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var obj = { v: 0 };
    var target = +el.dataset.count;
    el.textContent = "0";
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: function () {
        gsap.to(obj, { v: target, duration: 1.6, ease: "power2.out", onUpdate: function () { el.textContent = Math.round(obj.v); } });
      }
    });
  });

  /* ---------- palette ---------- */
  gsap.from(".swatches li", {
    scaleY: 0, duration: .9, ease: "power3.out", stagger: .07,
    scrollTrigger: { trigger: ".swatches", start: "top 85%", once: true }
  });
  gsap.from(".ratio span", {
    width: 0, duration: 1.2, ease: "power3.inOut", stagger: .15,
    scrollTrigger: { trigger: ".ratio", start: "top 90%", once: true }
  });

  /* ---------- plans: scanner reveal ---------- */
  function scanPlan() {
    gsap.timeline()
      .set(".plan-scan", { opacity: 1, top: "0%" })
      .fromTo(planImg, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 1.6, ease: "power1.inOut" }, 0)
      .to(".plan-scan", { top: "100%", duration: 1.6, ease: "power1.inOut" }, 0)
      .to(".plan-scan", { opacity: 0, duration: .3 });
  }
  gsap.set(planImg, { clipPath: "inset(0 0 100% 0)" });
  ScrollTrigger.create({ trigger: ".plan-figure", start: "top 75%", once: true, onEnter: scanPlan });

  /* ---------- construction sequence ---------- */
  var q = function (s) { return document.querySelector(s); };
  var qa = function (s) { return gsap.utils.toArray(s); };
  var stages = qa(".stage");

  // initial states
  qa(".house .draw").forEach(prepDraw);
  gsap.set(".peg", { scaleY: 0, transformOrigin: "50% 100%" });
  gsap.set("#found-clip", { attr: { height: 0 } });
  gsap.set("#wall-clip", { attr: { y: 600, height: 0 } });
  gsap.set("#roof-clip", { attr: { y: 340, height: 0 } });
  gsap.set("#g-scaffold", { opacity: 0 });
  gsap.set("#g-scaffold path, #g-scaffold rect", { opacity: 0 });
  gsap.set("#g-crane", { opacity: 0, y: 40 });
  gsap.set("#g-people", { opacity: 0 });
  gsap.set(".win", { scale: 0, transformOrigin: "50% 50%" });
  gsap.set(".stone", { opacity: 0 });
  gsap.set(".hedge", { scaleY: 0, transformOrigin: "50% 100%" });
  gsap.set(".tree", { scale: 0, transformOrigin: "50% 100%" });
  gsap.set(".pot", { opacity: 0, y: 10 });
  gsap.set("#path", { opacity: 0 });
  gsap.set(".build-final", { autoAlpha: 0 });

  var tl = gsap.timeline({ defaults: { ease: "none" } });

  // 01 setting out
  tl.addLabel("s0")
    .to("#setout", { strokeDashoffset: 0, duration: .6 })
    .to(".peg", { scaleY: 1, duration: .25, stagger: .08, ease: "back.out(2)" }, "<.2")
    .to("#g-people", { opacity: 1, duration: .2 }, "<")
    .to("#sky-top", { attr: { "stop-color": "#a9bccb" }, duration: 1 }, "s0");

  // 02 groundworks
  tl.addLabel("s1", ">+.1")
    .to("#g-crane", { opacity: 1, y: 0, duration: .4, ease: "power2.out" }, "s1")
    .to("#found-clip", { attr: { height: 52 }, duration: .7 }, "s1+=.1")
    .to("#dpc", { strokeDashoffset: 0, duration: .4 }, ">-.1")
    .to("#setout", { opacity: 0, duration: .2 }, "<")
    .to(".peg", { opacity: 0, duration: .2 }, "<");

  // 03 superstructure: walls rise, scaffold climbs alongside, crane lifts bricks
  tl.addLabel("s2", ">+.1")
    .to("#g-scaffold", { opacity: 1, duration: .05 }, "s2")
    .to("#wall-clip", { attr: { y: 70, height: 530 }, duration: 1.6 }, "s2")
    .to("#g-scaffold path, #g-scaffold rect", { opacity: 1, duration: .25, stagger: .1 }, "s2")
    .to("#trolley", { x: -120, duration: .8, yoyo: true, repeat: 1, ease: "sine.inOut" }, "s2")
    .to("#cable", { attr: { y2: 420 }, duration: .8, yoyo: true, repeat: 1, ease: "sine.inOut" }, "s2")
    .to("#load", { y: 120, duration: .8, yoyo: true, repeat: 1, ease: "sine.inOut" }, "s2");

  // 04 roof: trusses, then slate rows climb from the eaves
  tl.addLabel("s3", ">+.1")
    .to("#trusses .draw", { strokeDashoffset: 0, duration: .6 }, "s3")
    .to("#roof-clip", { attr: { y: 130, height: 210 }, duration: .9 }, ">-.1")
    .to("#trusses", { opacity: 0, duration: .3 }, "<.5")
    .to("#verge", { strokeDashoffset: 0, duration: .5 }, "<")
    .to("#gutter", { strokeDashoffset: 0, duration: .4 }, "<.2")
    .to("#trolley", { x: 60, duration: .9, ease: "sine.inOut" }, "s3")
    .to("#sky-top", { attr: { "stop-color": "#b9c3c6" }, duration: 1.4 }, "s3");

  // 05 windows & doors
  tl.addLabel("s4", ">+.1")
    .to(".win", { scale: 1, duration: .35, stagger: .1, ease: "back.out(1.6)" }, "s4")
    .to(".stone", { opacity: 1, duration: .4 }, "<.3");

  // 06 landscape & handover: strike scaffold & crane, plant up, golden hour
  tl.addLabel("s5", ">+.1")
    .to("#g-scaffold", { opacity: 0, y: 30, duration: .5 }, "s5")
    .to("#g-crane", { opacity: 0, x: 120, duration: .6 }, "s5")
    .to("#g-people", { opacity: 0, duration: .3 }, "s5")
    .to("#lawn", { attr: { opacity: 1 }, duration: .5 }, "s5+=.2")
    .to("#path", { opacity: 1, duration: .3 }, "<")
    .to(".hedge", { scaleY: 1, duration: .5, stagger: .1, ease: "power2.out" }, "<")
    .to(".tree", { scale: 1, duration: .6, stagger: .1, ease: "back.out(1.4)" }, "<.1")
    .to(".pot", { opacity: 1, y: 0, duration: .3, stagger: .05 }, "<.2")
    .to("#sky-top", { attr: { "stop-color": "#d9b98d" }, duration: .8 }, "s5")
    .to("#sky-bot", { attr: { "stop-color": "#f1dcb9" }, duration: .8 }, "s5")
    .to("#sun", { attr: { cy: 260, cx: 140 }, duration: .8 }, "s5")
    .to("#glow-rect", { attr: { opacity: 1 }, duration: .5 }, ">-.2")
    .addLabel("photo", ">+.15")
    .to(".build-final", { autoAlpha: 1, duration: .6 }, "photo")
    .to({}, { duration: .4 });

  var stageTimes = ["s0", "s1", "s2", "s3", "s4", "s5"].map(function (l) { return tl.labels[l]; });
  var bar = q(".build-progress span");
  var current = -1;
  function setStage(t) {
    var idx = 0;
    for (var i = 0; i < stageTimes.length; i++) if (t >= stageTimes[i] - .001) idx = i;
    if (idx === current) return;
    current = idx;
    stages.forEach(function (s, i) {
      s.classList.toggle("is-active", i === idx);
      s.classList.toggle("is-done", i < idx);
    });
  }

  ScrollTrigger.create({
    trigger: "#build",
    start: "top top",
    end: function () { return "+=" + Math.round(window.innerHeight * 4.5); },
    pin: ".build-pin",
    scrub: .6,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: function (self) {
      setStage(tl.time());
      gsap.set(bar, { scaleX: self.progress });
    }
  });
  setStage(0);

  // let people jump straight to a stage
  stages.forEach(function (s, i) {
    s.style.cursor = "pointer";
    s.addEventListener("click", function () {
      var st = ScrollTrigger.getAll().filter(function (t) { return t.animation === tl; })[0];
      if (!st) return;
      var p = (stageTimes[i] + .3) / tl.duration();
      window.scrollTo({ top: st.start + (st.end - st.start) * p, behavior: "smooth" });
    });
  });

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
