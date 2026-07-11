// Subtle entrance animations via IntersectionObserver.
// Elements with .reveal fade/slide in the first time they enter the viewport.

(function () {
  "use strict";

  var reveals = document.querySelectorAll(".reveal");

  // Fallback: if IntersectionObserver is unavailable, show everything.
  if (!("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("visible"); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
  );

  reveals.forEach(function (el) { observer.observe(el); });
})();
