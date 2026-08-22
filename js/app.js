import { initPreloader } from "./modules/preloader.js";
import { initMobileMenu } from "./modules/mobileMenu.js";
import { initSwiperAbout } from "./modules/swiperAbout.js";
import { initSmoothScrollAnchors } from "./modules/smoothScroll.js";
import { initAffiliateHub } from "./modules/affiliateHub.js?v=20260822_share_fix";

function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
    return;
  }
  fn();
}

onReady(() => {
  initPreloader();
  initMobileMenu();
  initSwiperAbout();
  initSmoothScrollAnchors();
  initAffiliateHub();
});


