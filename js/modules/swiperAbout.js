export function initSwiperAbout() {
  const SwiperClass = window.Swiper;
  if (!SwiperClass) return;

  if (!document.querySelector(".swiperAbout")) return;

  new SwiperClass(".swiperAbout", {
    loop: true,
    pagination: {
      el: ".swiper-pagination",
    },
  });
}

