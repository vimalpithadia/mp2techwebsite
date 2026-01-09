export function initPreloader() {
  const preloader = document.getElementById("preloader");
  if (preloader) {
    preloader.style.display = "none";
  }
  document.body.classList.add("loaded");
}

