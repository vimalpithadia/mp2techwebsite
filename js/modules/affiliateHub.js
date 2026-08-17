/**
 * MP2TECH Amazon Affiliate & Blog Dynamic Hub
 * Automatically parses JSON datasets, handles category filtering,
 * live product search, in-article product recommendation embeds,
 * and appends Amazon Affiliate tracking tags.
 */

export const AMAZON_CONFIG = {
  defaultAffiliateTag: "mp2tech-21",
  siteCountry: "in",
};

let allProducts = [];
let allPosts = [];

/**
 * Appends the Amazon affiliate tag and tracking parameters to any Amazon URL
 */
export function buildAffiliateUrl(url, tag = AMAZON_CONFIG.defaultAffiliateTag) {
  if (!url) return "#";
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set("tag", tag);
    urlObj.searchParams.set("linkCode", "ll1");
    urlObj.searchParams.set("language", "en_IN");
    urlObj.searchParams.set("ref_", "as_li_ss_tl");
    return urlObj.toString();
  } catch (e) {
    // If URL relative or malformed, append query string
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}tag=${encodeURIComponent(tag)}&linkCode=ll1`;
  }
}

/**
 * Render star ratings dynamically
 */
function renderStars(rating = 4.5) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.3 && rating % 1 <= 0.8;
  let html = "";

  for (let i = 0; i < fullStars; i++) {
    html += '<i class="fa fa-star"></i>';
  }
  if (hasHalf) {
    html += '<i class="fa fa-star-half-o"></i>';
  }
  const emptyStars = 5 - Math.ceil(rating);
  for (let i = 0; i < emptyStars; i++) {
    html += '<i class="fa fa-star-o"></i>';
  }
  return html;
}

/**
 * Render Product Grid
 */
export function renderProducts(category = "all", searchTerm = "") {
  const container = document.getElementById("affiliateProductGrid");
  if (!container) return;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filtered = allProducts.filter((prod) => {
    const matchCategory = category === "all" || prod.category === category;
    const matchSearch =
      !normalizedSearch ||
      prod.name.toLowerCase().includes(normalizedSearch) ||
      prod.brand.toLowerCase().includes(normalizedSearch) ||
      (prod.highlights && prod.highlights.some((h) => h.toLowerCase().includes(normalizedSearch)));

    return matchCategory && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="affiliate-empty-state">
        <i class="fa fa-search"></i>
        <h3>No products found</h3>
        <p>Try searching for another hardware component or select "All Products".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((prod) => {
      const affiliateUrl = buildAffiliateUrl(prod.amazonUrl);
      const highlightsHtml = prod.highlights
        ? prod.highlights
            .slice(0, 2)
            .map((h) => `<li><i class="fa fa-check-circle"></i> ${h}</li>`)
            .join("")
        : "";

      return `
        <div class="product-card" data-category="${prod.category}">
          <div class="product-card-top">
            <span class="product-badge">${prod.badge || "Technician Verified"}</span>
            <span class="product-brand">${prod.brand}</span>
          </div>
          <div class="product-image-wrap">
            <img src="${prod.image}" alt="${prod.name}" loading="lazy" onerror="this.src='img/service.jpg'" />
          </div>
          <div class="product-body">
            <div class="product-rating">
              <span class="stars">${renderStars(prod.rating)}</span>
              <span class="rating-number">${prod.rating}</span>
              <span class="review-count">(${prod.reviewCount ? prod.reviewCount.toLocaleString() : "1,000+"})</span>
            </div>
            <h3 class="product-title" title="${prod.name}">
              <a href="${affiliateUrl}" target="_blank" rel="nofollow sponsored noopener">
                ${prod.name}
              </a>
            </h3>
            ${highlightsHtml ? `<ul class="product-highlights">${highlightsHtml}</ul>` : ""}
            <div class="product-pricing">
              <div class="price-box">
                <span class="price-label">Approx. Price</span>
                <span class="price-val">${prod.priceEstimate}</span>
              </div>
              <span class="prime-tag"><i class="fa fa-check"></i> Amazon Verified</span>
            </div>
          </div>
          <div class="product-footer">
            <a href="${affiliateUrl}" target="_blank" rel="nofollow sponsored noopener" class="buy-amazon-btn">
              <i class="fa fa-shopping-cart"></i> Buy on Amazon
              <i class="fa fa-external-link"></i>
            </a>
          </div>
        </div>
      `;
    })
    .join("");
}

/**
 * Render Blog Post Cards
 */
export function renderBlogPosts(category = "all") {
  const container = document.getElementById("blogCardsContainer");
  if (!container) return;

  const filtered = allPosts.filter(
    (post) => category === "all" || post.category === category
  );

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="affiliate-empty-state">
        <p>No articles found for this category.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map(
      (post) => `
      <article class="blog-card" data-category="${post.category}" data-post-id="${post.id}">
        <div class="blog-card-image-wrap">
          <img src="${post.image}" alt="${post.title}" loading="lazy" />
          <span class="blog-card-category">${post.categoryName || post.category}</span>
        </div>
        <div class="blog-card-body">
          <div class="blog-card-meta">
            <span><i class="fa fa-calendar-o"></i> ${post.date}</span>
            <span><i class="fa fa-clock-o"></i> ${post.readTime}</span>
          </div>
          <h2 class="blog-card-title">${post.title}</h2>
          <p class="blog-card-excerpt">${post.excerpt}</p>
          <div class="blog-card-footer">
            <button class="blog-read-btn" onclick="window.openArticleModal(${post.id})">
              Read Full Guide <i class="fa fa-arrow-right"></i>
            </button>
            <span class="blog-author-tag">By MP2TECH Tech Team</span>
          </div>
        </div>
      </article>
    `
    )
    .join("");
}

/**
 * Open Article Modal with In-Article Amazon Affiliate Recommendations
 */
export function openArticleModal(id) {
  const post = allPosts.find((p) => p.id === Number(id));
  if (!post) return;

  const modal = document.getElementById("blogModal");
  if (!modal) return;

  document.getElementById("modalCategory").textContent =
    post.categoryName || post.category;
  document.getElementById("modalImage").src = post.image;
  document.getElementById("modalImage").alt = post.title;
  document.getElementById(
    "modalDate"
  ).innerHTML = `<i class="fa fa-calendar-o"></i> ${post.date}`;
  document.getElementById(
    "modalReadTime"
  ).innerHTML = `<i class="fa fa-clock-o"></i> ${post.readTime}`;
  document.getElementById("modalTitle").textContent = post.title;
  document.getElementById("modalBody").innerHTML = post.body;

  // Render related Amazon products for this article
  const relatedContainer = document.getElementById("modalRelatedProducts");
  if (relatedContainer) {
    const relatedIds = post.relatedProductIds || [];
    const relatedProds = allProducts.filter((p) => relatedIds.includes(p.id));

    if (relatedProds.length > 0) {
      relatedContainer.innerHTML = `
        <div class="in-article-affiliate-box">
          <div class="affiliate-box-header">
            <div class="affiliate-box-title">
              <i class="fa fa-amazon"></i> Recommended Hardware & Tools for this Guide
            </div>
            <span class="affiliate-tag-badge">Technician Picks</span>
          </div>
          <div class="in-article-product-grid">
            ${relatedProds
              .map((p) => {
                const link = buildAffiliateUrl(p.amazonUrl);
                return `
                <div class="in-article-product-card">
                  <img src="${p.image}" alt="${p.name}" class="mini-prod-img" onerror="this.src='img/service.jpg'" />
                  <div class="mini-prod-info">
                    <span class="mini-prod-badge">${p.badge || p.brand}</span>
                    <h5 class="mini-prod-title"><a href="${link}" target="_blank" rel="nofollow sponsored noopener">${p.name}</a></h5>
                    <div class="mini-prod-meta">
                      <span class="mini-prod-price">${p.priceEstimate}</span>
                      <span class="mini-prod-rating">${renderStars(p.rating)} (${p.rating})</span>
                    </div>
                    <a href="${link}" target="_blank" rel="nofollow sponsored noopener" class="mini-buy-btn">
                      View on Amazon <i class="fa fa-external-link"></i>
                    </a>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `;
      relatedContainer.style.display = "block";
    } else {
      relatedContainer.innerHTML = "";
      relatedContainer.style.display = "none";
    }
  }

  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

export function closeArticleModal() {
  const modal = document.getElementById("blogModal");
  if (modal) {
    modal.classList.remove("is-open");
  }
  document.body.style.overflow = "";
}

/**
 * Initialize dynamic hub
 */
export async function initAffiliateHub() {
  try {
    const [prodRes, postRes] = await Promise.all([
      fetch("data/affiliate-products.json"),
      fetch("data/blog-posts.json"),
    ]);

    if (prodRes.ok) allProducts = await prodRes.json();
    if (postRes.ok) allPosts = await postRes.json();
  } catch (err) {
    console.warn("Could not fetch JSON datasets, using fallback", err);
  }

  // Render initially
  renderProducts("all");
  renderBlogPosts("all");

  // Product Category Filters
  const prodFilterBtns = document.querySelectorAll(".product-filter-btn");
  let currentProdCategory = "all";
  let currentSearch = "";

  prodFilterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      prodFilterBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentProdCategory = this.getAttribute("data-category") || "all";
      renderProducts(currentProdCategory, currentSearch);
    });
  });

  // Product Search Input
  const searchInput = document.getElementById("productSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      currentSearch = this.value;
      renderProducts(currentProdCategory, currentSearch);
    });
  }

  // Blog Category Filters
  const blogFilterBtns = document.querySelectorAll(".blog-filter-btn");
  blogFilterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      blogFilterBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      const cat = this.getAttribute("data-category") || "all";
      renderBlogPosts(cat);
    });
  });

  // Modal helpers on window
  window.openArticleModal = openArticleModal;
  window.closeArticleModal = closeArticleModal;
  window.handleModalBackdropClick = function (e) {
    if (e.target.id === "blogModal") {
      closeArticleModal();
    }
  };

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeArticleModal();
    }
  });
}
