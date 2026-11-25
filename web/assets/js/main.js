(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  if (C.VERSION) { all("[data-version]").forEach(function (e) { e.textContent = "v" + C.VERSION; }); all("[data-version-plain]").forEach(function (e) { e.textContent = C.VERSION; }); }
  if (C.SETUP_URL) all("[data-dl-setup]").forEach(function (e) { e.href = C.SETUP_URL; });
  if (C.PORTABLE_URL) all("[data-dl-portable]").forEach(function (e) { e.href = C.PORTABLE_URL; });
  var y = document.getElementById("year"); if (y) y.textContent = String(new Date().getFullYear());
  var els = all(".rv");
  if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach(function (e) { io.observe(e); });
})();
