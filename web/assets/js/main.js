(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  if (C.VERSION) all("[data-version]").forEach(function (e) { e.textContent = "v" + C.VERSION; });
  if (C.SETUP_URL) all("[data-dl-setup]").forEach(function (e) { e.href = C.SETUP_URL; });
  if (C.PORTABLE_URL) all("[data-dl-portable]").forEach(function (e) { e.href = C.PORTABLE_URL; });
  if (C.GITHUB_URL) all("[data-github]").forEach(function (e) { e.href = C.GITHUB_URL; });
  var y = document.getElementById("year"); if (y) y.textContent = String(new Date().getFullYear());
})();
