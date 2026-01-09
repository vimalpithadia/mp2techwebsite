export function initSmoothScrollAnchors() {
  const $ = window.jQuery;
  if (!$) return;

  $('a[href^="#"]').on("click", function (event) {
    const hash = this.hash;
    if (!hash) return;

    const $target = $(hash);
    if ($target.length === 0) return;

    event.preventDefault();

    const headerHeight = $("#header").height() || 0;

    $("html, body").animate(
      {
        scrollTop: $target.offset().top - headerHeight,
      },
      800
    );

    $(".menuClose").trigger("click");
  });
}

