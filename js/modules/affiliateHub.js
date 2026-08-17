/**
 * MP2TECH Elite Amazon Affiliate & Blog Dynamic Hub
 * Handles real-time search, category filtering,
 * in-article product recommendation embeds,
 * dynamic sorting, and appends Amazon Affiliate tracking tags.
 */

import { DEFAULT_PRODUCTS, DEFAULT_POSTS } from "../../data/defaultData.js";

export const AMAZON_CONFIG = {
  defaultAffiliateTag: "mp2tech-21",
  siteCountry: "in",
};

let allProducts = [...DEFAULT_PRODUCTS];
let allPosts = [...DEFAULT_POSTS];
let currentProdCategory = "all";
let currentSearch = "";
let currentSort = "default";

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
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}tag=${encodeURIComponent(tag)}&linkCode=ll1`;
  }
}

/**
 * Parse numeric price for sorting
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const num = parseInt(priceStr.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Render star ratings dynamically
 */
function renderStars(rating = 4.5) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.3 && rating % 1 <= 0.8;
  const emptyStars = Math.max(0, 5 - fullStars - (hasHalf ? 1 : 0));

  let html = "";
  for (let i = 0; i < fullStars; i++) {
    html += '<i class="fa fa-star"></i>';
  }
  if (hasHalf) {
    html += '<i class="fa fa-star-half-o"></i>';
  }
  for (let i = 0; i < emptyStars; i++) {
    html += '<i class="fa fa-star-o"></i>';
  }
  return html;
}

/**
 * Render Amazon Affiliate Product Cards
 */
export function renderProducts(category = "all", searchQuery = "", sortOrder = "default") {
  const container = document.getElementById("affiliateProductGrid");
  if (!container) return;

  let filtered = [...allProducts];

  // Filter by category
  if (category && category !== "all") {
    filtered = filtered.filter((p) => p.category === category);
  }

  // Filter by search query
  if (searchQuery && searchQuery.trim() !== "") {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.highlights && p.highlights.some((h) => h.toLowerCase().includes(q)))
    );
  }

  // Sorting
  if (sortOrder === "price-asc") {
    filtered.sort((a, b) => parsePrice(a.priceEstimate) - parsePrice(b.priceEstimate));
  } else if (sortOrder === "price-desc") {
    filtered.sort((a, b) => parsePrice(b.priceEstimate) - parsePrice(a.priceEstimate));
  } else if (sortOrder === "rating") {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortOrder === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Update product count indicator if present
  const counter = document.getElementById("productCounter");
  if (counter) {
    counter.textContent = `${filtered.length} Verified ${filtered.length === 1 ? "Product" : "Products"}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="affiliate-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #ffffff; border-radius: 16px; border: 1.5px dashed #cbd5e1;">
        <i class="fa fa-search" style="font-size: 32px; color: #94a3b8; margin-bottom: 12px; display: block;"></i>
        <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">No Hardware Found</h3>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 18px;">No products match your search "${searchQuery}".</p>
        <button onclick="window.quickSearch('')" class="btn-primary" style="background:#0284c7; padding: 9px 20px; font-size: 13px;">View All Hardware Deals</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((product) => {
      const affiliateUrl = buildAffiliateUrl(product.amazonUrl);
      const highlights = (product.highlights || [])
        .slice(0, 2)
        .map((h) => `<span class="spec-chip"><i class="fa fa-check"></i> ${h.length > 42 ? h.slice(0, 40) + '...' : h}</span>`)
        .join("");

      return `
        <article class="product-card">
          <div class="product-card-top">
            <span class="product-brand-tag">${product.brand || "Verified Hardware"}</span>
            <span class="product-verified-badge"><i class="fa fa-shield"></i> ${product.badge || "Technician Tested"}</span>
          </div>

          <div class="product-image-wrap">
            <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='img/service.jpg'" />
          </div>

          <div class="product-body">
            <div class="product-rating-row">
              <span class="stars">${renderStars(product.rating)}</span>
              <span class="rating-val">${product.rating}</span>
              <span class="review-count">(${product.reviewCount ? product.reviewCount.toLocaleString() : "1,200"})</span>
            </div>

            <h3 class="product-title">
              <a href="${affiliateUrl}" target="_blank" rel="nofollow sponsored noopener" title="${product.name}">
                ${product.name}
              </a>
            </h3>

            ${highlights ? `<div class="product-spec-chips">${highlights}</div>` : ""}

            <div class="product-pricing-row">
              <span class="product-price-val">${product.priceEstimate || "₹2,499"}</span>
              <span class="prime-badge"><i class="fa fa-check"></i> Amazon Prime</span>
            </div>
          </div>

          <div class="product-footer">
            <a href="${affiliateUrl}" target="_blank" rel="nofollow sponsored noopener" class="buy-amazon-btn">
              <i class="fa fa-shopping-cart"></i> Buy on Amazon <i class="fa fa-external-link"></i>
            </a>
          </div>
        </article>
      `;
    })
    .join("");
}

/**
 * Render Diagnostic Guides & Tech Articles
 */
export function renderBlogPosts(category = "all") {
  const container = document.getElementById("blogCardsContainer");
  if (!container) return;

  let filtered = allPosts;
  if (category && category !== "all") {
    filtered = filtered.filter((p) => p.category === category);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="affiliate-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px;">
        <i class="fa fa-file-text-o" style="font-size: 32px; color: #94a3b8; margin-bottom: 12px; display: block;"></i>
        <h3 style="font-size: 18px; font-weight: 800; color: #0f172a;">No Articles Found</h3>
        <p style="font-size: 14px; color: #64748b;">No guides published in this category yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map(
      (post) => `
      <article class="blog-card" data-post-id="${post.id}">
        <div class="blog-card-image-wrap">
          <img src="${post.image}" alt="${post.title}" loading="lazy" onerror="this.src='img/service.jpg'" />
          <span class="blog-card-category">${post.categoryName || post.category}</span>
        </div>
        <div class="blog-card-body">
          <div class="blog-card-meta">
            <span><i class="fa fa-calendar-o"></i> ${post.date}</span>
            <span><i class="fa fa-clock-o"></i> ${post.readTime}</span>
          </div>
          <h3 class="blog-card-title">${post.title}</h3>
          <p class="blog-card-excerpt">${post.excerpt}</p>
          <div class="blog-card-footer">
            <button class="blog-read-btn" onclick="openArticleModal(${post.id})">
              Read Guide <i class="fa fa-arrow-right"></i>
            </button>
            <span class="blog-author-tag"><i class="fa fa-user"></i> MP2TECH Specialist</span>
          </div>
        </div>
      </article>
    `
    )
    .join("");
}

/**
 * Open Article Reader Modal
 */
export function openArticleModal(postId) {
  const post = allPosts.find((p) => p.id === Number(postId));
  if (!post) return;

  const modal = document.getElementById("blogModal");
  if (!modal) return;

  document.getElementById("modalCategory").textContent = post.categoryName || post.category;
  document.getElementById("modalImage").src = post.image;
  document.getElementById("modalImage").alt = post.title;
  document.getElementById("modalDate").innerHTML = `<i class="fa fa-calendar-o"></i> ${post.date}`;
  document.getElementById("modalReadTime").innerHTML = `<i class="fa fa-clock-o"></i> ${post.readTime}`;
  document.getElementById("modalTitle").textContent = post.title;
  document.getElementById("modalBody").innerHTML = post.body;

  // Render related Amazon products inside the guide
  const relContainer = document.getElementById("modalRelatedProducts");
  if (relContainer) {
    if (post.relatedProductIds && post.relatedProductIds.length > 0) {
      const relProducts = allProducts.filter((p) => post.relatedProductIds.includes(p.id));
      if (relProducts.length > 0) {
        relContainer.innerHTML = `
          <div class="in-article-affiliate-box">
            <div class="affiliate-box-header">
              <span class="affiliate-box-title"><i class="fa fa-amazon"></i> Recommended Hardware for this Guide</span>
              <span class="affiliate-tag-badge">Genuine Amazon Links</span>
            </div>
            <div class="in-article-product-grid">
              ${relProducts
                .map((p) => {
                  const url = buildAffiliateUrl(p.amazonUrl);
                  return `
                    <div class="in-article-product-card">
                      <img src="${p.image}" alt="${p.name}" class="mini-prod-img" onerror="this.src='img/service.jpg'" />
                      <span class="mini-prod-badge">${p.badge || "Recommended"}</span>
                      <h4 class="mini-prod-title"><a href="${url}" target="_blank" rel="nofollow sponsored noopener">${p.name}</a></h4>
                      <div class="mini-prod-meta">
                        <span class="mini-prod-price">${p.priceEstimate || "₹2,499"}</span>
                        <span style="color:#ff9900"><i class="fa fa-star"></i> ${p.rating}</span>
                      </div>
                      <a href="${url}" target="_blank" rel="nofollow sponsored noopener" class="mini-buy-btn">
                        <i class="fa fa-shopping-cart"></i> Buy on Amazon <i class="fa fa-external-link"></i>
                      </a>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        `;
        relContainer.style.display = "block";
      } else {
        relContainer.style.display = "none";
      }
    } else {
      relContainer.style.display = "none";
    }
  }

  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

/**
 * Close Article Reader Modal
 */
export function closeArticleModal() {
  const modal = document.getElementById("blogModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  document.body.style.overflow = "";
}

/**
 * Quick Search Helper (triggered from trending chips or script)
 */
export function quickSearch(term = "") {
  const searchInput = document.getElementById("heroSearchInput") || document.getElementById("productSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  
  if (searchInput) {
    searchInput.value = term;
    if (clearBtn) clearBtn.style.display = term ? "flex" : "none";
  }
  
  currentSearch = term;
  
  // Reset category pill to "All" if searching
  if (term) {
    currentProdCategory = "all";
    document.querySelectorAll(".category-pill").forEach((btn) => {
      if (btn.getAttribute("data-category") === "all") btn.classList.add("active");
      else btn.classList.remove("active");
    });
  }

  renderProducts(currentProdCategory, currentSearch, currentSort);

  const productsSection = document.getElementById("products");
  if (productsSection && term) {
    productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Initialize dynamic hub
 */
export async function initAffiliateHub() {
  // Render default embedded data immediately without delay
  renderProducts("all", "", "default");
  renderBlogPosts("all");

  // Product Category Filters (Pills)
  const prodFilterBtns = document.querySelectorAll(".category-pill");
  prodFilterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      prodFilterBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentProdCategory = this.getAttribute("data-category") || "all";
      renderProducts(currentProdCategory, currentSearch, currentSort);
    });
  });

  // Product Search Input & Clear Button
  const searchInput = document.getElementById("heroSearchInput") || document.getElementById("productSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      currentSearch = this.value;
      if (clearBtn) clearBtn.style.display = this.value ? "flex" : "none";
      renderProducts(currentProdCategory, currentSearch, currentSort);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      currentSearch = "";
      clearBtn.style.display = "none";
      renderProducts(currentProdCategory, "", currentSort);
    });
  }

  // Product Sort Select
  const sortSelect = document.getElementById("productSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      currentSort = this.value;
      renderProducts(currentProdCategory, currentSearch, currentSort);
    });
  }

  // Fetch updated JSON datasets in background with cache buster
  try {
    const timestamp = Date.now();
    const [prodRes, postRes] = await Promise.all([
      fetch(`data/affiliate-products.json?v=${timestamp}`),
      fetch(`data/blog-posts.json?v=${timestamp}`),
    ]);

    if (prodRes.ok) {
      const p = await prodRes.json();
      if (Array.isArray(p) && p.length > 0) {
        allProducts = p;
        renderProducts(currentProdCategory, currentSearch, currentSort);
      }
    }
    if (postRes.ok) {
      const b = await postRes.json();
      if (Array.isArray(b) && b.length > 0) {
        allPosts = b;
        renderBlogPosts("all");
      }
    }
  } catch (err) {
    console.info("Using embedded product catalog fallback");
  }

  // Blog Category Filters if present
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
  window.quickSearch = quickSearch;
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
