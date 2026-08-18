export function initMobileMenu() {
  const $ = window.jQuery;
  if (!$) return;

  function openMenu() {
    $(".mobMenuBox").addClass("in");
    $(".mobMenuOverlay").addClass("in");
    $("body").addClass("menu-open");
  }

  function closeMenu() {
    $(".mobMenuBox").removeClass("in");
    $(".mobMenuOverlay").removeClass("in");
    $("body").removeClass("menu-open");
  }

  $(".side-menu").on("click", function (e) {
    e.preventDefault();
    openMenu();
  });

  $(".menuClose, .mobMenuOverlay").on("click", function (e) {
    e.preventDefault();
    closeMenu();
  });

  $(".mobNavigation li a").on("click", function () {
    closeMenu();
  });

  $(document).on("keydown", function (e) {
    if (e.key === "Escape" && $(".mobMenuBox").hasClass("in")) {
      closeMenu();
    }
  });
}
