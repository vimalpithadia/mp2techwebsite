/**
 * MP2TECH Elite Amazon Affiliate & Blog Dynamic Hub
 * Handles real-time search, category filtering,
 * in-article product recommendation embeds,
 * dynamic sorting, dedicated standalone article page views,
 * unique deep-link routing for articles,
 * and comprehensive social media sharing (WhatsApp, LinkedIn, X, FB, Copy).
 */

import { DEFAULT_PRODUCTS, DEFAULT_POSTS } from "../../data/defaultData.js";

export const AMAZON_CONFIG = {
  defaultAffiliateTag: "mp2tech20-21",
  siteCountry: "in",
};

let allProducts = [...DEFAULT_PRODUCTS];
let allPosts = [...DEFAULT_POSTS];
let currentProdCategory = "all";
let currentProdSearch = "";
let currentSort = "default";

let currentBlogCategory = "all";
let currentBlogSearch = "";
let activeOpenPostId = null;

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
 * Generate direct canonical share URL for a post (with WhatsApp Open Graph Preview)
 */
export function getPostShareUrl(post) {
  const origin = "https://www.mp2tech.co.in";
  const slugOrId = encodeURIComponent(post.slug || `post-${post.id}`);
  return `${origin}/articles/${slugOrId}.html`;
}

/**
 * Render Amazon Affiliate Product Cards (deals.html)
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
        <button onclick="window.quickSearch('')" class="btn-primary" style="background:#0284c7; padding: 9px 20px; font-size: 13px;">View All Products</button>
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
 * Render Diagnostic Guides & Tech Articles (blog.html grid)
 */
export function renderBlogPosts(category = "all", searchQuery = "") {
  const container = document.getElementById("blogCardsContainer");
  if (!container) return;

  let filtered = [...allPosts];

  // Filter by category
  if (category && category !== "all") {
    filtered = filtered.filter((p) => p.category === category);
  }

  // Filter by search query
  if (searchQuery && searchQuery.trim() !== "") {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
    );
  }

  // Update guide counter
  const counter = document.getElementById("guideCounter");
  if (counter) {
    counter.textContent = `${filtered.length} ${filtered.length === 1 ? "Guide" : "Guides"} Available`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="affiliate-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #ffffff; border-radius: 16px; border: 1.5px dashed #cbd5e1;">
        <i class="fa fa-file-text-o" style="font-size: 32px; color: #94a3b8; margin-bottom: 12px; display: block;"></i>
        <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">No Guides Found</h3>
        <p style="font-size: 14px; color: #64748b;">No articles match your search "${searchQuery}".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((post) => {
      const hasProducts = post.relatedProductIds && post.relatedProductIds.length > 0;
      const partsCount = hasProducts ? post.relatedProductIds.length : 0;
      const identifier = post.slug || post.id;

      return `
        <article class="blog-card" data-post-id="${post.id}">
          <div class="blog-card-image-wrap" onclick="showArticle('${identifier}')" style="cursor:pointer;">
            <img src="${post.image}" alt="${post.title}" loading="lazy" onerror="this.src='img/service.jpg'" />
            <span class="blog-card-category">${post.categoryName || post.category}</span>
          </div>
          <div class="blog-card-body">
            <div class="blog-card-meta">
              <span><i class="fa fa-calendar-o"></i> ${post.date}</span>
              <span><i class="fa fa-clock-o"></i> ${post.readTime}</span>
            </div>
            <h3 class="blog-card-title" onclick="showArticle('${identifier}')" style="cursor:pointer;">${post.title}</h3>
            <p class="blog-card-excerpt">${post.excerpt}</p>
            ${hasProducts ? `<div class="blog-parts-badge"><i class="fa fa-amazon" style="color:#ff9900"></i> Includes ${partsCount} Verified ${partsCount === 1 ? 'Part' : 'Parts'}</div>` : ''}
            <div class="blog-card-footer" style="margin-top: 14px;">
              <button class="blog-read-btn" onclick="showArticle('${identifier}')">
                Read Guide <i class="fa fa-arrow-right"></i>
              </button>
              <button class="blog-card-share-btn" onclick="sharePostDirect(event, '${identifier}')" title="Share this Guide">
                <i class="fa fa-share-alt"></i> Share
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

/**
 * Configure social share links on elements
 */
function setupSocialShareButtons(post, prefix = "single") {
  const shareUrl = getPostShareUrl(post);
  const shareTitle = post.title;
  const shareText = `${shareTitle} - Read this technical diagnostic guide by MP2TECH Mumbai:`;
  // WhatsApp
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareUrl)}`;
  const waTop = document.getElementById(`${prefix}ShareWhatsapp`);
  const waBottom = document.getElementById(`${prefix}ShareWhatsappBottom`);
  if (waTop) waTop.href = waUrl;
  if (waBottom) waBottom.href = waUrl;

  // LinkedIn
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const liTop = document.getElementById(`${prefix}ShareLinkedin`);
  const liBottom = document.getElementById(`${prefix}ShareLinkedinBottom`);
  if (liTop) liTop.href = liUrl;
  if (liBottom) liBottom.href = liUrl;

  // Twitter / X
  const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`;
  const twTop = document.getElementById(`${prefix}ShareTwitter`);
  const twBottom = document.getElementById(`${prefix}ShareTwitterBottom`);
  if (twTop) twTop.href = twUrl;
  if (twBottom) twBottom.href = twUrl;

  // Facebook
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const fbTop = document.getElementById(`${prefix}ShareFacebook`);
  if (fbTop) fbTop.href = fbUrl;

  // Copy Link Buttons
  const cpTop = document.getElementById(`${prefix}ShareCopyLink`);
  const cpBottom = document.getElementById(`${prefix}ShareCopyLinkBottom`);

  const copyHandler = async function (btn, textSpanId) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      const textSpan = document.getElementById(textSpanId);
      if (textSpan) textSpan.textContent = "✓ Link Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        if (textSpan) textSpan.textContent = "Copy Link";
        btn.classList.remove("copied");
      }, 2500);
    } catch (e) {
      window.prompt("Copy this direct link to share:", shareUrl);
    }
  };

  if (cpTop) {
    cpTop.onclick = (e) => {
      e.preventDefault();
      copyHandler(cpTop, `${prefix}CopyLinkText`);
    };
  }
  if (cpBottom) {
    cpBottom.onclick = (e) => {
      e.preventDefault();
      copyHandler(cpBottom, `${prefix}CopyLinkTextBottom`);
    };
  }
}

/**
 * Open Single Article View
 */
export function showArticle(identifier, updateHistory = true) {
  const post = allPosts.find(
    (p) =>
      p.slug === String(identifier) ||
      p.id === Number(identifier) ||
      String(p.id) === String(identifier)
  );

  if (!post) {
    showAllArticlesView();
    return;
  }

  activeOpenPostId = post.id;

  const singleSection = document.getElementById("singleArticleSection");
  const allSection = document.getElementById("allArticlesSection");
  if (!singleSection || !allSection) return;

  // Populate Single Post DOM
  const catEl = document.getElementById("singleCategory") || document.getElementById("singleArticleCategory");
  const titleEl = document.getElementById("singleTitle") || document.getElementById("singleArticleTitle");
  const dateEl = document.getElementById("singleDate") || document.getElementById("singleArticleDate");
  const readTimeEl = document.getElementById("singleReadTime") || document.getElementById("singleArticleReadTime");
  const imgEl = document.getElementById("singleImage") || document.getElementById("singleArticleImage");
  const excerptEl = document.getElementById("singleExcerpt") || document.getElementById("singleArticleExcerpt");
  const bodyEl = document.getElementById("singleBody") || document.getElementById("singleArticleBody");

  if (catEl) catEl.textContent = post.categoryName || post.category || "General";
  if (titleEl) titleEl.textContent = post.title;
  if (dateEl) dateEl.innerHTML = `<i class="fa fa-calendar-o"></i> ${post.date}`;
  if (readTimeEl) readTimeEl.innerHTML = `<i class="fa fa-clock-o"></i> ${post.readTime}`;
  if (imgEl) {
    imgEl.src = post.image;
    imgEl.alt = post.title;
  }
  if (excerptEl) excerptEl.textContent = post.excerpt;
  if (bodyEl) bodyEl.innerHTML = post.body;

  // Setup Social Sharing Buttons
  setupSocialShareButtons(post, "single");

  // In-Article Related Hardware
  const relContainer = document.getElementById("singleRelatedProducts") || document.getElementById("inArticleRelatedProducts");
  if (relContainer) {
    if (Array.isArray(post.relatedProductIds) && post.relatedProductIds.length > 0) {
      const relProducts = allProducts.filter((p) =>
        post.relatedProductIds.some((rId) => String(rId) === String(p.id))
      );

      if (relProducts.length > 0) {
        relContainer.innerHTML = `
          <div class="in-article-hardware-box">
            <div class="in-article-box-header">
              <h3><i class="fa fa-wrench"></i> Recommended Upgrade Hardware for this Guide</h3>
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

  // Switch views
  allSection.style.display = "none";
  singleSection.style.display = "block";

  // Update browser URL query parameter & address bar to direct article URL
  if (updateHistory && window.history && window.history.replaceState) {
    const slugOrId = post.slug || `post-${post.id}`;
    const newUrl = `articles/${encodeURIComponent(slugOrId)}.html`;
    try {
      window.history.replaceState({ postId: post.id, slug: post.slug }, post.title, newUrl);
    } catch (e) {
      window.history.replaceState({ postId: post.id, slug: post.slug }, post.title, `blog.html?post=${encodeURIComponent(slugOrId)}`);
    }
    document.title = `${post.title} | MP2TECH Diagnostic Guides`;
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Show All Articles Catalog View
 */
export function showAllArticlesView(updateHistory = true) {
  activeOpenPostId = null;

  const singleSection = document.getElementById("singleArticleSection");
  const allSection = document.getElementById("allArticlesSection");

  if (singleSection) singleSection.style.display = "none";
  if (allSection) allSection.style.display = "block";

  if (updateHistory && window.history && window.history.pushState) {
    window.history.pushState({}, "Diagnostic Guides & Tech Tips | MP2TECH Mumbai", window.location.pathname);
    document.title = "Diagnostic Guides & Tech Tips | MP2TECH Mumbai";
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Quick Direct Share from card
 */
export function sharePostDirect(event, identifier) {
  if (event) event.stopPropagation();
  const post = allPosts.find(
    (p) =>
      p.slug === String(identifier) ||
      p.id === Number(identifier) ||
      String(p.id) === String(identifier)
  );
  if (!post) return;

  const shareUrl = getPostShareUrl(post);

  if (navigator.share) {
    navigator
      .share({
        title: post.title,
        text: `Read this guide by MP2TECH: ${post.title}`,
        url: shareUrl,
      })
      .catch(() => {});
  } else {
    // Copy to clipboard with prompt
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        alert(`Direct Link Copied to Clipboard!\n\n${shareUrl}`);
      })
      .catch(() => {
        window.prompt("Share this direct guide URL:", shareUrl);
      });
  }
}

/**
 * Quick Search Helper for Products (deals.html)
 */
export function quickSearch(term = "") {
  const searchInput = document.getElementById("heroSearchInput") || document.getElementById("productSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  
  if (searchInput) {
    searchInput.value = term;
    if (clearBtn) clearBtn.style.display = term ? "flex" : "none";
  }
  
  currentProdSearch = term;
  
  if (term) {
    currentProdCategory = "all";
    document.querySelectorAll(".category-pill:not(.blog-filter-btn)").forEach((btn) => {
      if (btn.getAttribute("data-category") === "all") btn.classList.add("active");
      else btn.classList.remove("active");
    });
  }

  renderProducts(currentProdCategory, currentProdSearch, currentSort);

  const productsSection = document.getElementById("products");
  if (productsSection && term) {
    productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Check URL query parameters on load to auto-display shared blog post
 */
function handleDeepLinking() {
  const urlParams = new URLSearchParams(window.location.search);
  const postQuery = urlParams.get("post") || urlParams.get("article") || urlParams.get("id");

  if (postQuery) {
    showArticle(postQuery, false);
  } else {
    showAllArticlesView(false);
  }
}

/**
 * Initialize dynamic hub
 */
export async function initAffiliateHub() {
  // Initial render
  renderProducts("all", "", "default");
  renderBlogPosts("all", "");

  // Deep linking initial check
  handleDeepLinking();

  // Handle browser back/forward buttons
  window.addEventListener("popstate", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const postQuery = urlParams.get("post");
    if (postQuery) {
      showArticle(postQuery, false);
    } else {
      showAllArticlesView(false);
    }
  });

  // Product Category Filters (deals.html)
  const prodFilterBtns = document.querySelectorAll(".category-pill:not(.blog-filter-btn)");
  prodFilterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      prodFilterBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentProdCategory = this.getAttribute("data-category") || "all";
      renderProducts(currentProdCategory, currentProdSearch, currentSort);
    });
  });

  // Product Search Input & Clear Button (deals.html)
  const searchInput = document.getElementById("heroSearchInput") || document.getElementById("productSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      currentProdSearch = this.value;
      if (clearBtn) clearBtn.style.display = this.value ? "flex" : "none";
      renderProducts(currentProdCategory, currentProdSearch, currentSort);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      currentProdSearch = "";
      clearBtn.style.display = "none";
      renderProducts(currentProdCategory, "", currentSort);
    });
  }

  // Product Sort Select (deals.html)
  const sortSelect = document.getElementById("productSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      currentSort = this.value;
      renderProducts(currentProdCategory, currentProdSearch, currentSort);
    });
  }

  // Blog Category Filters (blog.html)
  const blogFilterBtns = document.querySelectorAll(".blog-filter-btn");
  blogFilterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      blogFilterBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentBlogCategory = this.getAttribute("data-category") || "all";
      renderBlogPosts(currentBlogCategory, currentBlogSearch);
    });
  });

  // Blog Search Input & Clear Button (blog.html)
  const blogSearchInput = document.getElementById("blogSearchInput");
  const clearBlogSearchBtn = document.getElementById("clearBlogSearchBtn");

  if (blogSearchInput) {
    blogSearchInput.addEventListener("input", function () {
      currentBlogSearch = this.value;
      if (clearBlogSearchBtn) clearBlogSearchBtn.style.display = this.value ? "flex" : "none";
      renderBlogPosts(currentBlogCategory, currentBlogSearch);
    });
  }

  if (clearBlogSearchBtn) {
    clearBlogSearchBtn.addEventListener("click", function () {
      if (blogSearchInput) {
        blogSearchInput.value = "";
        blogSearchInput.focus();
      }
      currentBlogSearch = "";
      clearBlogSearchBtn.style.display = "none";
      renderBlogPosts(currentBlogCategory, "");
    });
  }

  // Fetch updated JSON datasets in background
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
        renderProducts(currentProdCategory, currentProdSearch, currentSort);
      }
    }
    if (postRes.ok) {
      const b = await postRes.json();
      if (Array.isArray(b) && b.length > 0) {
        allPosts = b;
        renderBlogPosts(currentBlogCategory, currentBlogSearch);
        handleDeepLinking();
      }
    }
  } catch (err) {
    console.info("Using embedded product catalog fallback");
  }

  // Global helpers
  window.showArticle = showArticle;
  window.showAllArticlesView = showAllArticlesView;
  window.sharePostDirect = sharePostDirect;
  window.quickSearch = quickSearch;
}
