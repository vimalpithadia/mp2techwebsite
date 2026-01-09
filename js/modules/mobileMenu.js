export function initMobileMenu() {
  const $ = window.jQuery;
  if (!$) return;

  $(".side-menu").on("click", function () {
    $(".mobMenuBox").addClass("in");
    $(".mobMenuOverlay").addClass("in");
  });

  $(".menuClose, .mobMenuOverlay").on("click", function () {
    $(".mobMenuBox").removeClass("in");
    $(".mobMenuOverlay").removeClass("in");
  });
}

