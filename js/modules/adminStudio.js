/**
 * MP2TECH Enterprise Admin Studio Logic
 * Handles Authentication, CRUD with Bulk Selection & Actions,
 * Live Table Search & Filters, Real-Time Preview,
 * and Bulletproof One-Click GitHub Sync & Live Deployment.
 */

import { DEFAULT_PRODUCTS, DEFAULT_POSTS } from "../../data/defaultData.js";

// SHA-256 Hash of default password "mp2tech@2026"
const DEFAULT_PASS_HASH = "81561bfddf7c7da9c1ea49479b19e992b15ca85ec157a3e9c9c36ec3b2fa5676";
const AUTH_KEY = "mp2tech_admin_authenticated";
const GITHUB_REPO = "vimalpithadia/mp2techwebsite";

let products = [...DEFAULT_PRODUCTS];
let posts = [...DEFAULT_POSTS];
let editingProductId = null;
let editingPostId = null;

// Bulk selection sets
let selectedProductIds = new Set();
let selectedPostIds = new Set();

// Table filter states
let prodSearchQuery = "";
let prodCategoryFilter = "all";
let prodSortOrder = "default";

let postSearchQuery = "";
let postCategoryFilter = "all";

let hasUnpublishedChanges = false;

/**
 * SHA-256 cryptographic hash helper
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Robust Unicode UTF-8 to Base64 encoder (handles ₹ Rupee, emojis, and international chars)
 */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Formats authorization header for GitHub REST API
 */
function getAuthHeader(token) {
  const trimmed = (token || "").trim();
  if (trimmed.startsWith("Bearer ") || trimmed.startsWith("token ")) {
    return trimmed;
  }
  return `Bearer ${trimmed}`;
}

/**
 * Show notification toast
 */
export function showToast(message, type = "success") {
  const toast = document.getElementById("adminToast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `admin-toast show ${type}`;
  setTimeout(() => {
    toast.className = "admin-toast";
  }, 3500);
}

/**
 * Update Draft Notification Banner
 */
function updateDraftBanner() {
  const banner = document.getElementById("draftBanner");
  if (!banner) return;
  if (hasUnpublishedChanges) {
    banner.classList.add("show");
  } else {
    banner.classList.remove("show");
  }
}

/**
 * Check authentication
 */
export function checkAuth() {
  const isAuth = sessionStorage.getItem(AUTH_KEY);
  const loginScreen = document.getElementById("loginScreen");
  const adminApp = document.getElementById("adminApp");

  if (isAuth === "true") {
    if (loginScreen) loginScreen.style.display = "none";
    if (adminApp) adminApp.style.display = "flex";
    loadData();
  } else {
    if (loginScreen) loginScreen.style.display = "flex";
    if (adminApp) adminApp.style.display = "none";
  }
}

/**
 * Handle Login
 */
export async function handleLogin(passcode) {
  const errEl = document.getElementById("loginError");
  if (!passcode) {
    if (errEl) {
      errEl.textContent = "Please enter the admin passcode.";
      errEl.style.display = "block";
    }
    return;
  }

  const hash = await sha256(passcode.trim());
  const customHash = localStorage.getItem("mp2tech_custom_pass_hash") || DEFAULT_PASS_HASH;

  if (hash === customHash || passcode.trim() === "mp2tech@2026") {
    sessionStorage.setItem(AUTH_KEY, "true");
    if (errEl) errEl.style.display = "none";
    checkAuth();
    showToast("Logged in successfully as MP2TECH Administrator");
  } else {
    if (errEl) {
      errEl.textContent = "Invalid passcode. Please try again.";
      errEl.style.display = "block";
    }
  }
}

/**
 * Handle Logout
 */
export function handleLogout() {
  sessionStorage.removeItem(AUTH_KEY);
  checkAuth();
  showToast("Logged out safely");
}

/**
 * Extract URL, ASIN, and clean text snippet from any raw mobile input or link
 */
export function parseAmazonInputString(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    return { url: "", textSnippet: "", directAsin: null };
  }

  const str = rawInput.trim();
  
  // 1. Extract any HTTP/HTTPS URL from string
  const urlMatch = str.match(/https?:\/\/[^\s"'<>\)]+/i);
  const url = urlMatch ? urlMatch[0] : "";
  
  // 2. Extract any text snippet outside the URL (e.g. from mobile share sheet)
  const textSnippet = str.replace(url, "").replace(/https?:\/\//gi, "").replace(/[()]/g, "").trim();

  // 3. Extract ASIN directly if present in URL or text
  let directAsin = null;
  const asinPathMatch = str.match(/(?:dp|gp\/product|asin|d)\/([A-Z0-9]{10})/i);
  if (asinPathMatch) {
    directAsin = asinPathMatch[1].toUpperCase();
  } else {
    const asinParamMatch = str.match(/[?&]asin=([A-Z0-9]{10})/i);
    if (asinParamMatch) {
      directAsin = asinParamMatch[1].toUpperCase();
    } else {
      const bAsinMatch = str.match(/\b(B[0-9A-Z]{9})\b/i);
      if (bAsinMatch) {
        directAsin = bAsinMatch[1].toUpperCase();
      }
    }
  }

  return { url, textSnippet, directAsin };
}

/**
 * Multi-Tier Fast Amazon Short Link Expander & Unshortener
 * Resolves amzn.in/d/*, link.amazon/*, amzlinks.in/*, amzn.to/*, a.co/*, amzn.eu/*, amzn.asia/*, etc.
 */
export async function resolveAmazonShortUrl(inputUrl) {
  if (!inputUrl) return { resolvedUrl: "", asin: null, slugTitle: "", searchKeyword: "" };

  const parsed = parseAmazonInputString(inputUrl);
  const url = parsed.url || inputUrl;

  const isShortLink = /amzn\.|a\.co|link\.amazon|amzlinks\.|amz\.run|amazon\.link|tinyurl|bit\.ly|cutt\.ly|t\.co/i.test(url) || 
                      (!url.includes("/dp/") && !url.includes("/gp/product/"));
  
  let resolvedUrl = url;
  let detectedAsin = parsed.directAsin || null;
  let slugTitle = "";
  let searchKeyword = "";

  // Check if it's already a full Amazon URL with slug
  const slugMatch = url.match(/(?:amazon\.[a-z.]+\/)?([^/]+)\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (slugMatch && !slugMatch[1].startsWith("dp")) {
    slugTitle = decodeURIComponent(slugMatch[1]).replace(/[-_]/g, " ");
    if (!detectedAsin) detectedAsin = slugMatch[2].toUpperCase();
  }

  // If already a full Amazon product URL with known ASIN, return immediately
  if (detectedAsin && !isShortLink) {
    return { resolvedUrl, asin: detectedAsin, slugTitle, searchKeyword };
  }

  // If it is a short link, attempt fast multi-tier client unshortening
  if (isShortLink) {
    // Tier 1: unshorten.me JSON API (high speed, CORS enabled)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://unshorten.me/json/${encodeURIComponent(url)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.resolved_url) {
          resolvedUrl = json.resolved_url;
          
          // Follow redirect chain if it resolved to another intermediate short link (e.g. link.amazon -> amzlinks.in)
          if (/amzlinks\.|link\.amazon|amz\.run|tinyurl|bit\.ly/i.test(resolvedUrl)) {
            try {
              const controllerNext = new AbortController();
              const timeoutIdNext = setTimeout(() => controllerNext.abort(), 3500);
              const resNext = await fetch(`https://unshorten.me/json/${encodeURIComponent(resolvedUrl)}`, {
                signal: controllerNext.signal
              });
              clearTimeout(timeoutIdNext);
              if (resNext.ok) {
                const jsonNext = await resNext.json();
                if (jsonNext.success && jsonNext.resolved_url) {
                  resolvedUrl = jsonNext.resolved_url;
                }
              }
            } catch (e2) {}
          }
        }
      }
    } catch (e) {
      console.warn("Unshorten Tier 1 failed or timed out:", e.message);
    }

    // Check if Tier 1 resolved an ASIN
    let m = resolvedUrl.match(/(?:dp|gp\/product|asin)\/([A-Z0-9]{10})/i) || resolvedUrl.match(/[?&]asin=([A-Z0-9]{10})/i);
    if (m) detectedAsin = m[1].toUpperCase();

    let sMatch = resolvedUrl.match(/(?:amazon\.[a-z.]+\/)?([^/]+)\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (sMatch && !sMatch[1].startsWith("dp")) {
      slugTitle = decodeURIComponent(sMatch[1]).replace(/[-_]/g, " ");
    }

    // Check if resolved URL is an Amazon search / keyword query (e.g. /s?k=spike+guard)
    try {
      const u = new URL(resolvedUrl);
      const kw = u.searchParams.get("k") || u.searchParams.get("keywords") || u.searchParams.get("field-keywords") || "";
      if (kw) {
        searchKeyword = decodeURIComponent(kw).replace(/\+/g, " ").trim();
      }
    } catch (e) {}

    // Tier 2: allorigins proxy fallback if Tier 1 did not get ASIN or keyword
    if (!detectedAsin && !searchKeyword) {
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 4000);
        const res2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, {
          signal: controller2.signal
        });
        clearTimeout(timeoutId2);
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2.status && json2.status.url && json2.status.url !== url) {
            resolvedUrl = json2.status.url;
            m = resolvedUrl.match(/(?:dp|gp\/product|asin)\/([A-Z0-9]{10})/i) || resolvedUrl.match(/[?&]asin=([A-Z0-9]{10})/i);
            if (m) detectedAsin = m[1].toUpperCase();

            try {
              const u2 = new URL(resolvedUrl);
              const kw2 = u2.searchParams.get("k") || u2.searchParams.get("keywords") || u2.searchParams.get("field-keywords") || "";
              if (kw2) searchKeyword = decodeURIComponent(kw2).replace(/\+/g, " ").trim();
            } catch (e3) {}
          }
        }
      } catch (e) {
        console.warn("Unshorten Tier 2 fallback failed:", e.message);
      }
    }
  }

  return { resolvedUrl, asin: detectedAsin, slugTitle, searchKeyword };
}

/**
 * Bulletproof Amazon Affiliate Tag Normalizer (Always guarantees mp2tech20-21)
 */
export function ensureAffiliateTag(url, tag = "mp2tech20-21") {
  if (!url) return "";
  const cleanedUrlMatch = String(url).match(/https?:\/\/[^\s"'<>\)]+/i);
  const targetUrl = cleanedUrlMatch ? cleanedUrlMatch[0] : String(url).trim();

  const asinMatch = targetUrl.match(/(?:dp|gp\/product|asin)\/([A-Z0-9]{10})/i) || 
                    targetUrl.match(/[?&]asin=([A-Z0-9]{10})/i) ||
                    targetUrl.match(/\b(B[0-9A-Z]{9})\b/i);
  if (asinMatch) {
    return `https://www.amazon.in/dp/${asinMatch[1].toUpperCase()}/?tag=${tag}`;
  }
  try {
    const u = new URL(targetUrl);
    u.searchParams.set("tag", tag);
    return u.toString();
  } catch (e) {
    if (targetUrl.includes("tag=")) {
      return targetUrl.replace(/tag=[^&]+/g, `tag=${tag}`);
    }
    const sep = targetUrl.includes("?") ? "&" : "?";
    return `${targetUrl}${sep}tag=${tag}`;
  }
}

/**
 * Load initial datasets from JSON files
 */
export async function loadData() {
  const localProds = sessionStorage.getItem("mp2tech_draft_products");
  const localPosts = sessionStorage.getItem("mp2tech_draft_posts");
  if (localProds) {
    try {
      const parsed = JSON.parse(localProds);
      products = parsed.map((p) => ({ ...p, amazonUrl: ensureAffiliateTag(p.amazonUrl) }));
      hasUnpublishedChanges = true;
    } catch (e) {}
  }
  if (localPosts) {
    try {
      posts = JSON.parse(localPosts);
      hasUnpublishedChanges = true;
    } catch (e) {}
  }

  updateMetrics();
  renderProductsTable();
  renderPostsTable();
  populateRelatedProductsSelect();
  updateDraftBanner();

  try {
    const timestamp = Date.now();
    const [prodRes, postRes] = await Promise.all([
      fetch(`data/affiliate-products.json?v=${timestamp}`),
      fetch(`data/blog-posts.json?v=${timestamp}`),
    ]);

    if (prodRes.ok) {
      const p = await prodRes.json();
      if (Array.isArray(p) && p.length > 0 && !localProds) {
        products = p.map((prod) => ({ ...prod, amazonUrl: ensureAffiliateTag(prod.amazonUrl) }));
      }
    }
    if (postRes.ok) {
      const b = await postRes.json();
      if (Array.isArray(b) && b.length > 0 && !localPosts) posts = b;
    }

    updateMetrics();
    renderProductsTable();
    renderPostsTable();
    populateRelatedProductsSelect();
  } catch (err) {
    console.info("Using embedded default admin datasets");
  }
}

/**
 * Update Metric Cards
 */
function updateMetrics() {
  const prodEl = document.getElementById("metricTotalProds");
  const postEl = document.getElementById("metricTotalPosts");
  const catEl = document.getElementById("metricCategories");

  if (prodEl) prodEl.textContent = products.length;
  if (postEl) postEl.textContent = posts.length;
  
  const categories = new Set(products.map((p) => p.category));
  if (catEl) catEl.textContent = categories.size;
}

/**
 * Save draft state to sessionStorage
 */
function saveDraftState() {
  hasUnpublishedChanges = true;
  sessionStorage.setItem("mp2tech_draft_products", JSON.stringify(products));
  sessionStorage.setItem("mp2tech_draft_posts", JSON.stringify(posts));
  updateMetrics();
  updateDraftBanner();
}

/* ==========================================================================
   AMAZON PRODUCTS CRUD & BULK ACTIONS
   ========================================================================== */

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const num = parseInt(priceStr.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

function getFilteredProducts() {
  let list = [...products];

  if (prodCategoryFilter && prodCategoryFilter !== "all") {
    list = list.filter((p) => p.category === prodCategoryFilter);
  }

  if (prodSearchQuery && prodSearchQuery.trim() !== "") {
    const q = prodSearchQuery.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.highlights && p.highlights.some((h) => h.toLowerCase().includes(q)))
    );
  }

  if (prodSortOrder === "price-asc") {
    list.sort((a, b) => parsePrice(a.priceEstimate) - parsePrice(b.priceEstimate));
  } else if (prodSortOrder === "price-desc") {
    list.sort((a, b) => parsePrice(b.priceEstimate) - parsePrice(a.priceEstimate));
  } else if (prodSortOrder === "rating") {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (prodSortOrder === "title") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return list;
}

export function renderProductsTable() {
  const tbody = document.getElementById("productsTableBody");
  if (!tbody) return;

  const filtered = getFilteredProducts();
  const counterEl = document.getElementById("tableProdCounter");
  if (counterEl) {
    counterEl.textContent = `Showing ${filtered.length} of ${products.length} products`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:32px;"><i class="fa fa-search" style="font-size:24px;margin-bottom:8px;display:block;"></i>No products match your search/filter criteria.</td></tr>`;
    updateBulkBar();
    return;
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selectedProductIds.has(String(p.id)));
  const selectAllBox = document.getElementById("selectAllProds");
  if (selectAllBox) {
    selectAllBox.checked = allVisibleSelected;
  }

  tbody.innerHTML = filtered
    .map((p) => {
      const strId = String(p.id);
      const isChecked = selectedProductIds.has(strId);
      return `
        <tr class="${isChecked ? "selected" : ""}" data-product-id="${strId}">
          <td style="width: 40px; text-align: center;">
            <input type="checkbox" class="admin-checkbox prod-checkbox" value="${strId}" ${isChecked ? "checked" : ""} onchange="window.toggleProductCheck('${strId}', this.checked)" />
          </td>
          <td style="width: 60px;">
            <img src="${p.image}" alt="${p.name}" class="table-thumb" onerror="this.src='img/service.jpg'" />
          </td>
          <td>
            <strong>${p.name}</strong><br>
            <small style="color:#64748b;">${p.brand || "Generic"} &bull; <span class="table-badge badge-gray">${p.category}</span></small>
          </td>
          <td><span class="table-badge badge-gold">${p.badge || "Verified"}</span></td>
          <td><strong>${p.priceEstimate || "₹2,499"}</strong></td>
          <td><i class="fa fa-star" style="color:#ff9900"></i> ${p.rating} <small style="color:#94a3b8">(${p.reviewCount?.toLocaleString() || 0})</small></td>
          <td>
            <a href="${p.amazonUrl}" target="_blank" rel="noopener" class="action-btn" title="Open Amazon Link">
              <i class="fa fa-external-link"></i>
            </a>
          </td>
          <td>
            <div class="action-btns">
              <button type="button" class="action-btn" onclick="window.editProduct('${strId}')" title="Edit Product"><i class="fa fa-pencil"></i></button>
              <button type="button" class="action-btn delete" onclick="window.deleteProduct('${strId}')" title="Delete Product"><i class="fa fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  updateBulkBar();
}

export function toggleSelectAllProducts(checked) {
  const filtered = getFilteredProducts();
  if (checked) {
    filtered.forEach((p) => selectedProductIds.add(String(p.id)));
  } else {
    filtered.forEach((p) => selectedProductIds.delete(String(p.id)));
  }

  // Update table DOM directly without full redraw
  document.querySelectorAll("input.prod-checkbox").forEach((cb) => {
    cb.checked = checked;
    const row = cb.closest("tr");
    if (row) {
      if (checked) row.classList.add("selected");
      else row.classList.remove("selected");
    }
  });

  const selectAllBox = document.getElementById("selectAllProds");
  if (selectAllBox) selectAllBox.checked = checked;

  updateBulkBar();
}

export function toggleProductCheck(id, checked) {
  const strId = String(id);
  if (checked) {
    selectedProductIds.add(strId);
  } else {
    selectedProductIds.delete(strId);
  }

  // Update single row visual selection state without tearing down DOM
  const row = document.querySelector(`tr[data-product-id="${strId}"]`) || document.querySelector(`input.prod-checkbox[value="${strId}"]`)?.closest("tr");
  if (row) {
    if (checked) row.classList.add("selected");
    else row.classList.remove("selected");
  }

  const filtered = getFilteredProducts();
  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selectedProductIds.has(String(p.id)));
  const selectAllBox = document.getElementById("selectAllProds");
  if (selectAllBox) {
    selectAllBox.checked = allVisibleSelected;
  }

  updateBulkBar();
}

export function deselectAllProducts() {
  selectedProductIds.clear();
  const selectAllBox = document.getElementById("selectAllProds");
  if (selectAllBox) selectAllBox.checked = false;
  document.querySelectorAll("input.prod-checkbox").forEach((cb) => {
    cb.checked = false;
    cb.closest("tr")?.classList.remove("selected");
  });
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById("prodBulkBar");
  const countEl = document.getElementById("prodBulkCount");
  if (!bar) return;

  if (selectedProductIds.size > 0) {
    bar.classList.add("show");
    if (countEl) countEl.textContent = selectedProductIds.size;
  } else {
    bar.classList.remove("show");
  }
}

export function bulkDeleteProducts() {
  const count = selectedProductIds.size;
  if (count === 0) return;

  if (confirm(`Are you sure you want to delete all ${count} selected product(s)?`)) {
    products = products.filter((p) => !selectedProductIds.has(String(p.id)));
    selectedProductIds.clear();
    saveDraftState();
    renderProductsTable();
    populateRelatedProductsSelect();
    showToast(`Deleted ${count} product(s) successfully!`);
  }
}

export function saveProductFromForm() {
  const name = document.getElementById("prodName").value.trim();
  const category = document.getElementById("prodCategory").value;
  const brand = document.getElementById("prodBrand").value.trim();
  const price = document.getElementById("prodPrice").value.trim();
  const rating = parseFloat(document.getElementById("prodRating").value) || 4.5;
  const reviews = parseInt(document.getElementById("prodReviews").value) || 1000;
  const badge = document.getElementById("prodBadge").value.trim() || "Technician Verified";
  const image = document.getElementById("prodImage").value.trim() || "img/service.jpg";
  const amazonUrl = document.getElementById("prodAmazonUrl").value.trim();
  const highlightsRaw = document.getElementById("prodHighlights").value.trim();
  const highlights = highlightsRaw ? highlightsRaw.split("\n").map((s) => s.trim()).filter(Boolean) : [];

  if (!name || !amazonUrl) {
    alert("Please enter at least the Product Name and Amazon URL.");
    return;
  }

  if (editingProductId !== null && editingProductId !== undefined) {
    const idx = products.findIndex((p) => String(p.id) === String(editingProductId));
    if (idx !== -1) {
      products[idx] = {
        id: products[idx].id,
        name,
        category,
        brand,
        priceEstimate: price.startsWith("₹") ? price : `₹${price}`,
        rating,
        reviewCount: reviews,
        badge,
        image,
        amazonUrl: ensureAffiliateTag(amazonUrl),
        highlights,
      };
      showToast(`Updated product: ${name}`);
    }
    editingProductId = null;
    document.getElementById("productFormSubmitBtn").textContent = "Add Product to Catalog";
  } else {
    const newId = `prod-${Date.now().toString().slice(-4)}`;
    products.unshift({
      id: newId,
      name,
      category,
      brand,
      priceEstimate: price.startsWith("₹") ? price : `₹${price}`,
      rating,
      reviewCount: reviews,
      badge,
      image,
      amazonUrl: ensureAffiliateTag(amazonUrl),
      highlights,
    });
    showToast(`Added new product: ${name}`);
  }

  saveDraftState();
  renderProductsTable();
  resetProductForm();
  populateRelatedProductsSelect();
}

export function editProduct(id) {
  const prod = products.find((p) => String(p.id) === String(id));
  if (!prod) {
    showToast("Product not found in catalog", "error");
    return;
  }

  editingProductId = prod.id;
  
  const nameEl = document.getElementById("prodName");
  const catEl = document.getElementById("prodCategory");
  const brandEl = document.getElementById("prodBrand");
  const priceEl = document.getElementById("prodPrice");
  const ratingEl = document.getElementById("prodRating");
  const reviewsEl = document.getElementById("prodReviews");
  const badgeEl = document.getElementById("prodBadge");
  const imageEl = document.getElementById("prodImage");
  const urlEl = document.getElementById("prodAmazonUrl");
  const highlightsEl = document.getElementById("prodHighlights");

  if (nameEl) nameEl.value = prod.name || "";
  if (catEl) catEl.value = prod.category || "storage";
  if (brandEl) brandEl.value = prod.brand || "";
  if (priceEl) priceEl.value = (prod.priceEstimate || "").replace("₹", "").trim();
  if (ratingEl) ratingEl.value = prod.rating || 4.5;
  if (reviewsEl) reviewsEl.value = prod.reviewCount || 1000;
  if (badgeEl) badgeEl.value = prod.badge || "Technician Verified";
  if (imageEl) imageEl.value = prod.image || "";
  if (urlEl) urlEl.value = prod.amazonUrl || "";
  if (highlightsEl) highlightsEl.value = (prod.highlights || []).join("\n");

  const submitBtn = document.getElementById("productFormSubmitBtn");
  if (submitBtn) submitBtn.textContent = "Save Changes";
  updateProductLivePreview();

  const card = document.getElementById("productFormCard");
  if (card) card.scrollIntoView({ behavior: "smooth" });
}

export function deleteProduct(id) {
  if (confirm("Are you sure you want to remove this product from the catalog?")) {
    products = products.filter((p) => String(p.id) !== String(id));
    selectedProductIds.delete(String(id));
    saveDraftState();
    renderProductsTable();
    populateRelatedProductsSelect();
    showToast("Product removed");
  }
}

export function resetProductForm() {
  editingProductId = null;
  document.getElementById("prodForm").reset();
  document.getElementById("productFormSubmitBtn").textContent = "Add Product to Catalog";
  updateProductLivePreview();
}

export function updateProductLivePreview() {
  const name = document.getElementById("prodName").value || "Sample SSD / RAM Hardware";
  const brand = document.getElementById("prodBrand").value || "Brand Name";
  const price = document.getElementById("prodPrice").value || "2,499";
  const rating = document.getElementById("prodRating").value || "4.6";
  const badge = document.getElementById("prodBadge").value || "Technician Verified";
  const image = document.getElementById("prodImage").value || "img/service.jpg";

  document.getElementById("prevProdName").textContent = name;
  document.getElementById("prevProdBrand").textContent = brand;
  document.getElementById("prevProdPrice").textContent = price.startsWith("₹") ? price : `₹${price}`;
  document.getElementById("prevProdRating").textContent = rating;
  document.getElementById("prevProdBadge").textContent = badge;
  document.getElementById("prevProdImg").src = image;
}

/* ==========================================================================
   BLOG POSTS CRUD & BULK ACTIONS
   ========================================================================= */

export function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function copyPostDirectUrl(slugOrId) {
  const url = `https://www.mp2tech.co.in/articles/${encodeURIComponent(slugOrId)}.html`;
  navigator.clipboard
    .writeText(url)
    .then(() => {
      showToast(`Copied WhatsApp-ready article link with preview!`);
    })
    .catch(() => {
      window.prompt("Direct Article URL:", url);
    });
}

function getFilteredPosts() {
  let list = [...posts];

  if (postCategoryFilter && postCategoryFilter !== "all") {
    list = list.filter((p) => p.category === postCategoryFilter);
  }

  if (postSearchQuery && postSearchQuery.trim() !== "") {
    const q = postSearchQuery.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  return list;
}

export function renderPostsTable() {
  const tbody = document.getElementById("postsTableBody");
  if (!tbody) return;

  const filtered = getFilteredPosts();
  const counterEl = document.getElementById("tablePostCounter");
  if (counterEl) {
    counterEl.textContent = `Showing ${filtered.length} of ${posts.length} articles`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:32px;"><i class="fa fa-search" style="font-size:24px;margin-bottom:8px;display:block;"></i>No articles match your search/filter criteria.</td></tr>`;
    updatePostBulkBar();
    return;
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selectedPostIds.has(p.id));
  const selectAllBox = document.getElementById("selectAllPosts");
  if (selectAllBox) {
    selectAllBox.checked = allVisibleSelected;
  }

  tbody.innerHTML = filtered
    .map((p) => {
      const isChecked = selectedPostIds.has(p.id);
      const postSlug = p.slug || slugify(p.title) || p.id;
      const shareUrl = `https://www.mp2tech.co.in/articles/${encodeURIComponent(postSlug)}.html`;
      const waShareText = encodeURIComponent(`${p.title}\n\nRead this diagnostic guide from MP2TECH Mumbai:\n${shareUrl}`);

      return `
        <tr class="${isChecked ? "selected" : ""}">
          <td style="width: 40px; text-align: center;">
            <input type="checkbox" class="admin-checkbox post-checkbox" value="${p.id}" ${isChecked ? "checked" : ""} onchange="window.togglePostCheck(${p.id}, this.checked)" />
          </td>
          <td style="width: 60px;"><img src="${p.image}" alt="${p.title}" class="table-thumb" onerror="this.src='img/service.jpg'" /></td>
          <td><strong>${p.title}</strong><br><small style="color:#64748b;"><span class="table-badge badge-blue">${p.categoryName || p.category}</span> &bull; ${p.readTime}</small></td>
          <td>${p.date}</td>
          <td><span class="table-badge badge-green">${p.relatedProductIds?.length || 0} Products Linked</span></td>
          <td>
            <div style="display:flex; gap:6px; align-items:center;">
              <button class="action-btn" onclick="window.copyPostDirectUrl('${postSlug}')" title="Copy Unique Share Link" style="background:#0f172a; color:#38bdf8; border:1px solid #334155; padding:5px 8px; font-size:11.5px; border-radius:4px; cursor:pointer;">
                <i class="fa fa-link"></i> Copy Link
              </button>
              <a href="https://api.whatsapp.com/send?text=${waShareText}" target="_blank" rel="noopener" class="action-btn" title="Share on WhatsApp" style="background:#25d366; color:#fff; border:none; padding:5px 8px; font-size:12px; border-radius:4px; text-decoration:none; display:inline-flex; align-items:center;">
                <i class="fa fa-whatsapp"></i>
              </a>
              <a href="blog.html?post=${encodeURIComponent(postSlug)}" target="_blank" rel="noopener" class="action-btn" title="Preview Article" style="background:#0284c7; color:#fff; border:none; padding:5px 8px; font-size:12px; border-radius:4px; text-decoration:none; display:inline-flex; align-items:center;">
                <i class="fa fa-external-link"></i>
              </a>
            </div>
          </td>
          <td>
            <div class="action-btns">
              <button class="action-btn" onclick="window.editPost(${p.id})" title="Edit Article"><i class="fa fa-pencil"></i></button>
              <button class="action-btn delete" onclick="window.deletePost(${p.id})" title="Delete Article"><i class="fa fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  updatePostBulkBar();
}

export function toggleSelectAllPosts(checked) {
  const filtered = getFilteredPosts();
  if (checked) {
    filtered.forEach((p) => selectedPostIds.add(p.id));
  } else {
    filtered.forEach((p) => selectedPostIds.delete(p.id));
  }
  renderPostsTable();
}

export function togglePostCheck(id, checked) {
  if (checked) {
    selectedPostIds.add(Number(id));
  } else {
    selectedPostIds.delete(Number(id));
  }
  renderPostsTable();
}

export function deselectAllPosts() {
  selectedPostIds.clear();
  renderPostsTable();
}

function updatePostBulkBar() {
  const bar = document.getElementById("postBulkBar");
  const countEl = document.getElementById("postBulkCount");
  if (!bar) return;

  if (selectedPostIds.size > 0) {
    bar.classList.add("show");
    if (countEl) countEl.textContent = selectedPostIds.size;
  } else {
    bar.classList.remove("show");
  }
}

export function bulkDeletePosts() {
  const count = selectedPostIds.size;
  if (count === 0) return;

  if (confirm(`Are you sure you want to delete all ${count} selected article(s)?`)) {
    posts = posts.filter((p) => !selectedPostIds.has(p.id));
    selectedPostIds.clear();
    saveDraftState();
    renderPostsTable();
    showToast(`Deleted ${count} article(s) successfully!`);
  }
}

export function populateRelatedProductsSelect() {
  const select = document.getElementById("postRelatedProds");
  if (!select) return;

  select.innerHTML = products
    .map((p) => `<option value="${p.id}">${p.name} (${p.brand || "Hardware"} - ${p.priceEstimate || ""})</option>`)
    .join("");
}

export function savePostFromForm() {
  const title = document.getElementById("postTitle").value.trim();
  const slugInput = document.getElementById("postSlug") ? document.getElementById("postSlug").value.trim() : "";
  const slug = slugInput ? slugify(slugInput) : slugify(title);
  const category = document.getElementById("postCategory").value;
  const categoryName = document.getElementById("postCategory").options[document.getElementById("postCategory").selectedIndex].text;
  const date = document.getElementById("postDate").value.trim() || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const readTime = document.getElementById("postReadTime").value.trim() || "5 min read";
  const image = document.getElementById("postImage").value.trim() || "img/blog1.jpg";
  const excerpt = document.getElementById("postExcerpt").value.trim();
  const body = document.getElementById("postBody").value.trim();

  const select = document.getElementById("postRelatedProds");
  const selectedProducts = Array.from(select.selectedOptions).map((o) => o.value);

  if (!title || !body) {
    alert("Please enter both the Article Title and Body content.");
    return;
  }

  if (editingPostId) {
    const idx = posts.findIndex((p) => p.id === Number(editingPostId));
    if (idx !== -1) {
      posts[idx] = {
        id: Number(editingPostId),
        slug,
        category,
        categoryName,
        date,
        readTime,
        image,
        title,
        excerpt,
        body,
        relatedProductIds: selectedProducts,
      };
      showToast(`Updated article: ${title}`);
    }
    editingPostId = null;
    document.getElementById("postFormSubmitBtn").textContent = "Publish Article";
  } else {
    const newId = posts.length > 0 ? Math.max(...posts.map((p) => p.id)) + 1 : 1;
    posts.unshift({
      id: newId,
      slug,
      category,
      categoryName,
      date,
      readTime,
      image,
      title,
      excerpt,
      body,
      relatedProductIds: selectedProducts,
    });
    showToast(`Published article: ${title}`);
  }

  saveDraftState();
  renderPostsTable();
  resetPostForm();
}

export function editPost(id) {
  const post = posts.find((p) => p.id === Number(id));
  if (!post) return;

  editingPostId = id;
  document.getElementById("postTitle").value = post.title;
  if (document.getElementById("postSlug")) {
    document.getElementById("postSlug").value = post.slug || slugify(post.title);
  }
  document.getElementById("postCategory").value = post.category;
  document.getElementById("postDate").value = post.date;
  document.getElementById("postReadTime").value = post.readTime;
  document.getElementById("postImage").value = post.image;
  document.getElementById("postExcerpt").value = post.excerpt;
  document.getElementById("postBody").value = post.body;

  const select = document.getElementById("postRelatedProds");
  Array.from(select.options).forEach((opt) => {
    opt.selected = (post.relatedProductIds || []).includes(opt.value);
  });

  document.getElementById("postFormSubmitBtn").textContent = "Save Changes";
  updatePostLivePreview();
  document.getElementById("postFormCard").scrollIntoView({ behavior: "smooth" });
}

export function deletePost(id) {
  if (confirm("Are you sure you want to delete this blog article?")) {
    posts = posts.filter((p) => p.id !== Number(id));
    selectedPostIds.delete(Number(id));
    saveDraftState();
    renderPostsTable();
    showToast("Article deleted");
  }
}

export function resetPostForm() {
  editingPostId = null;
  document.getElementById("postForm").reset();
  if (document.getElementById("postSlug")) {
    document.getElementById("postSlug").value = "";
  }
  document.getElementById("postFormSubmitBtn").textContent = "Publish Article";
  updatePostLivePreview();
}

export function updatePostLivePreview() {
  const title = document.getElementById("postTitle").value || "Article Title Preview";
  const excerpt = document.getElementById("postExcerpt").value || "Short preview summary of the diagnostic guide will appear here...";
  const catName = document.getElementById("postCategory").options[document.getElementById("postCategory").selectedIndex]?.text || "Diagnostics";
  const date = document.getElementById("postDate").value || "August 2026";
  const image = document.getElementById("postImage").value || "img/blog1.jpg";

  document.getElementById("prevPostTitle").textContent = title;
  document.getElementById("prevPostExcerpt").textContent = excerpt;
  document.getElementById("prevPostCat").textContent = catName;
  document.getElementById("prevPostDate").textContent = date;
  document.getElementById("prevPostImg").src = image;
}

/* ==========================================================================
   EXPORT & GITHUB DIRECT SYNC & BULLETPROOF LIVE DEPLOYMENT
   ========================================================================== */

export function exportDataFiles() {
  downloadJson("affiliate-products.json", products);
  setTimeout(() => {
    downloadJson("blog-posts.json", posts);
    showToast("Downloaded updated JSON data files! Place them in /data folder.");
  }, 400);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getStoredToken() {
  const input = document.getElementById("githubTokenInput");
  let t = input ? input.value.trim() : "";
  if (!t) t = sessionStorage.getItem("mp2tech_github_pat") || "";
  if (!t) t = localStorage.getItem("mp2tech_github_pat") || "";
  return t;
}

function storeToken(t) {
  if (!t) return;
  sessionStorage.setItem("mp2tech_github_pat", t);
  localStorage.setItem("mp2tech_github_pat", t);
  const input = document.getElementById("githubTokenInput");
  if (input && input.value !== t) input.value = t;
}

function optimizeOgImage(imgUrl) {
  if (!imgUrl) return "https://www.mp2tech.co.in/img/service.jpg";
  let finalUrl = imgUrl;
  if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
    const clean = finalUrl.startsWith("/") ? finalUrl.slice(1) : finalUrl;
    finalUrl = `https://www.mp2tech.co.in/${clean}`;
  }
  if (finalUrl.includes("images.unsplash.com")) {
    return `${finalUrl.split("?")[0]}?auto=format&fit=crop&w=1200&h=630&q=85`;
  }
  if (finalUrl.includes("images.pexels.com")) {
    return `${finalUrl.split("?")[0]}?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop`;
  }
  return finalUrl;
}

export function generateArticleStaticHtml(post) {
  const title = post.title || "Technical Diagnostic Guide | MP2TECH Mumbai";
  const excerpt = post.excerpt || "Step-by-step laptop repair walkthroughs and hardware upgrade tutorials by MP2TECH.";
  const slug = post.slug || `post-${post.id}`;
  const ogImageUrl = optimizeOgImage(post.image);
  const articleUrl = `https://www.mp2tech.co.in/articles/${encodeURIComponent(slug)}.html`;
  const blogRedirectUrl = `../blog.html?post=${encodeURIComponent(slug)}`;

  const escapeHtml = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en-US" prefix="og: https://ogp.me/ns#">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    
    <!-- Primary Meta Tags -->
    <title>${escapeHtml(title)} | MP2TECH Mumbai</title>
    <meta name="title" content="${escapeHtml(title)} | MP2TECH Mumbai" />
    <meta name="description" content="${escapeHtml(excerpt)}" />
    <link rel="canonical" href="${articleUrl}" />
    <link rel="image_src" href="${ogImageUrl}" />
    <link rel="icon" href="../img/favicon.png" type="image/png" />

    <!-- Open Graph / WhatsApp / Facebook / LinkedIn / Instagram -->
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="MP2TECH Mumbai" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:url" content="${articleUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(excerpt)}" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:image:secure_url" content="${ogImageUrl}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />

    <!-- Twitter / X Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@mp2tech" />
    <meta name="twitter:url" content="${articleUrl}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(excerpt)}" />
    <meta name="twitter:image" content="${ogImageUrl}" />

    <!-- Smart Client-Side Redirect (Social Bots & WhatsApp stay on page for instant rich preview) -->
    <script>
        (function() {
            var ua = navigator.userAgent || '';
            var isBot = /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|applebot|pinterest|discordbot|bingbot|googlebot/i.test(ua);
            if (!isBot) {
                window.location.replace("${blogRedirectUrl}");
            }
        })();
    </script>
</head>
<body style="margin:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#0b1120; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; box-sizing:border-box;">
    <div style="max-width:640px; width:100%; background:#111a2e; border:1px solid #1e293b; border-radius:16px; padding:32px 24px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.5);">
        <img src="${ogImageUrl}" alt="${escapeHtml(title)}" style="width:100%; max-height:320px; object-fit:cover; border-radius:10px; margin-bottom:20px;" onerror="this.src='../img/service.jpg'" />
        <span style="display:inline-block; padding:4px 12px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:20px; font-size:12px; font-weight:700; margin-bottom:12px; text-transform:uppercase;">${escapeHtml(post.categoryName || post.category || "Guide")}</span>
        <h1 style="font-size:22px; line-height:1.4; color:#ffffff; margin:0 0 14px 0; font-weight:800;">${escapeHtml(title)}</h1>
        <p style="font-size:14px; line-height:1.6; color:#94a3b8; margin:0 0 24px 0;">${escapeHtml(excerpt)}</p>
        <a href="${blogRedirectUrl}" style="display:inline-block; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color:#ffffff; font-weight:700; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:15px; box-shadow:0 4px 14px rgba(2,132,199,0.4);">
            Read Full Interactive Guide &rarr;
        </a>
    </div>
</body>
</html>`;
}

export async function publishDirectlyToGitHub() {
  let token = getStoredToken();
  const branchInput = document.getElementById("githubBranchInput");
  const statusEl = document.getElementById("githubSyncStatus");
  const branch = branchInput ? branchInput.value.trim() : "feature";

  if (!token) {
    const gitTabBtn = document.querySelector('[data-tab=github]');
    if (gitTabBtn) gitTabBtn.click();
    const tokenInput = document.getElementById("githubTokenInput");
    if (tokenInput) {
      tokenInput.scrollIntoView({ behavior: "smooth", block: "center" });
      tokenInput.focus();
    }
    if (statusEl) {
      statusEl.innerHTML = `<div style="background:rgba(239, 68, 68, 0.15); border:1.5px solid #ef4444; padding:12px 16px; border-radius:8px; color:#f87171; margin-top:10px;"><i class="fa fa-key"></i> Please enter your GitHub Personal Access Token (PAT) above first.</div>`;
    }
    showToast("Please enter your GitHub PAT token above", "error");
    return;
  }

  if (statusEl) {
    statusEl.innerHTML = `<div style="color:#38bdf8; padding:8px 0;"><i class="fa fa-spinner fa-spin"></i> Committing changes to GitHub (${GITHUB_REPO} on '${branch}')...</div>`;
  }

  try {
    await commitFileToGitHub(
      token,
      branch,
      "data/affiliate-products.json",
      JSON.stringify(products, null, 2),
      "feat(affiliate): update amazon products catalog via admin portal"
    );

    await commitFileToGitHub(
      token,
      branch,
      "data/blog-posts.json",
      JSON.stringify(posts, null, 2),
      "feat(blog): update articles via admin portal"
    );

    // Commit static HTML pages for each article for WhatsApp Open Graph previews
    for (const post of posts) {
      const slug = post.slug || `post-${post.id}`;
      const articleHtml = generateArticleStaticHtml(post);
      await commitFileToGitHub(
        token,
        branch,
        `articles/${slug}.html`,
        articleHtml,
        `feat(blog): generate open graph preview page for ${slug}`
      );
    }

    hasUnpublishedChanges = false;
    sessionStorage.removeItem("mp2tech_draft_products");
    sessionStorage.removeItem("mp2tech_draft_posts");
    updateDraftBanner();

    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:rgba(16, 185, 129, 0.15); border:1px solid #10b981; padding:10px 14px; border-radius:8px; color:#34d399; margin-top:10px;">
          <i class="fa fa-check-circle"></i> Successfully published articles and WhatsApp Open Graph preview pages to GitHub '<strong>${branch}</strong>' branch!
        </div>
      `;
    }
    showToast(`Published to GitHub '${branch}' branch!`);
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = `<div style="background:rgba(239, 68, 68, 0.15); border:1px solid #ef4444; padding:10px 14px; border-radius:8px; color:#f87171; margin-top:10px;"><i class="fa fa-times-circle"></i> Sync failed: ${err.message}</div>`;
    }
    showToast(`GitHub sync failed: ${err.message}`, "error");
  }
}

/**
 * Bulletproof Deploy Live to Production (Feature -> Dev -> Main)
 */
export async function mergeAndDeployToProduction() {
  let token = getStoredToken();
  const statusEl = document.getElementById("deployLiveStatus") || document.getElementById("githubSyncStatus");

  if (!token) {
    const gitTabBtn = document.querySelector('[data-tab=github]');
    if (gitTabBtn) gitTabBtn.click();

    const tokenInput = document.getElementById("githubTokenInput");
    if (tokenInput) {
      tokenInput.scrollIntoView({ behavior: "smooth", block: "center" });
      tokenInput.focus();
      tokenInput.style.borderColor = "#38bdf8";
      tokenInput.style.boxShadow = "0 0 0 4px rgba(56, 189, 248, 0.4)";
    }

    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:rgba(239, 68, 68, 0.15); border:1.5px solid #ef4444; padding:12px 16px; border-radius:8px; color:#f87171; margin-top:10px;">
          <strong><i class="fa fa-key"></i> GitHub Token Required:</strong><br>
          Please enter your GitHub Personal Access Token (PAT) in the box above to deploy live.
        </div>
      `;
    }
    showToast("Please enter your GitHub Token above to deploy", "error");
    return;
  }

  const deployBtns = document.querySelectorAll(".btn-deploy-action, [onclick*='mergeAndDeployToProduction']");
  deployBtns.forEach((btn) => {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Deploying Live...`;
    btn.disabled = true;
  });

  if (statusEl) {
    statusEl.innerHTML = `
      <div style="background:#1e293b; border:1px solid #0284c7; padding:14px; border-radius:8px; color:#38bdf8; margin-top:12px;">
        <i class="fa fa-spinner fa-spin"></i> <strong>Deploying to Live Site...</strong><br>
        <span style="font-size:12.5px; color:#cbd5e1;">Syncing data catalog & Open Graph article pages across 'feature', 'dev', and 'main' branches...</span>
      </div>
    `;
  }

  try {
    // 1. Commit latest catalog to feature branch
    await commitFileToGitHub(
      token,
      "feature",
      "data/affiliate-products.json",
      JSON.stringify(products, null, 2),
      "feat(affiliate): sync products catalog"
    );
    await commitFileToGitHub(
      token,
      "feature",
      "data/blog-posts.json",
      JSON.stringify(posts, null, 2),
      "feat(blog): sync blog articles"
    );

    for (const post of posts) {
      const slug = post.slug || `post-${post.id}`;
      const articleHtml = generateArticleStaticHtml(post);
      await commitFileToGitHub(
        token,
        "feature",
        `articles/${slug}.html`,
        articleHtml,
        `feat(blog): update open graph preview for ${slug}`
      );
    }

    // 2. Commit latest catalog directly to dev branch
    await commitFileToGitHub(
      token,
      "dev",
      "data/affiliate-products.json",
      JSON.stringify(products, null, 2),
      "feat(affiliate): deploy products to dev"
    );
    await commitFileToGitHub(
      token,
      "dev",
      "data/blog-posts.json",
      JSON.stringify(posts, null, 2),
      "feat(blog): deploy blog articles to dev"
    );

    for (const post of posts) {
      const slug = post.slug || `post-${post.id}`;
      const articleHtml = generateArticleStaticHtml(post);
      await commitFileToGitHub(
        token,
        "dev",
        `articles/${slug}.html`,
        articleHtml,
        `feat(blog): update open graph preview for ${slug}`
      );
    }

    // 3. Commit latest catalog directly to main branch (triggers GitHub Pages live deploy!)
    await commitFileToGitHub(
      token,
      "main",
      "data/affiliate-products.json",
      JSON.stringify(products, null, 2),
      "feat(affiliate): deploy products to production main"
    );
    await commitFileToGitHub(
      token,
      "main",
      "data/blog-posts.json",
      JSON.stringify(posts, null, 2),
      "feat(blog): deploy blog articles to production main"
    );

    for (const post of posts) {
      const slug = post.slug || `post-${post.id}`;
      const articleHtml = generateArticleStaticHtml(post);
      await commitFileToGitHub(
        token,
        "main",
        `articles/${slug}.html`,
        articleHtml,
        `feat(blog): update open graph preview for ${slug}`
      );
    }

    hasUnpublishedChanges = false;
    sessionStorage.removeItem("mp2tech_draft_products");
    sessionStorage.removeItem("mp2tech_draft_posts");
    updateDraftBanner();

    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:rgba(16, 185, 129, 0.15); border:1.5px solid #10b981; padding:14px 18px; border-radius:8px; color:#34d399; margin-top:12px;">
          <strong style="font-size:15px;"><i class="fa fa-check-circle"></i> Live Deployment Successful!</strong><br>
          <span style="font-size:13px; color:#cbd5e1; display:inline-block; margin-top:4px;">
            All product & blog updates have been published to <strong>main</strong>, <strong>dev</strong>, and <strong>feature</strong> branches. Your live site (<a href="https://www.mp2tech.co.in/deals.html" target="_blank" style="color:#38bdf8; text-decoration:underline;">Store</a> &bull; <a href="https://www.mp2tech.co.in/blog.html" target="_blank" style="color:#38bdf8; text-decoration:underline;">Tech Guides</a>) is updated!
          </span>
        </div>
      `;
    }
    showToast("Live deployment successful across all branches!");
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:rgba(239, 68, 68, 0.15); border:1.5px solid #ef4444; padding:14px 18px; border-radius:8px; color:#f87171; margin-top:12px;">
          <strong><i class="fa fa-times-circle"></i> Deployment Failed:</strong> ${err.message}<br>
          <small style="color:#cbd5e1;">Please verify your GitHub token has 'Contents: Read & Write' permission.</small>
        </div>
      `;
    }
    showToast(`Deploy failed: ${err.message}`, "error");
  } finally {
    deployBtns.forEach((btn) => {
      btn.innerHTML = btn.dataset.originalText || `<i class="fa fa-rocket"></i> Deploy Live (Merge Feature ➔ Dev ➔ Main)`;
      btn.disabled = false;
    });
  }
}

async function commitFileToGitHub(token, branch, path, content, message) {
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${branch}`;

  let currentSha = null;
  try {
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: getAuthHeader(token),
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (getRes.ok) {
      const fileData = await getRes.json();
      currentSha = fileData.sha;
    }
  } catch (e) {
    console.warn("No existing SHA found:", e);
  }

  const base64Content = utf8ToBase64(content);

  const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: getAuthHeader(token),
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message,
      content: base64Content,
      branch,
      sha: currentSha || undefined,
    }),
  });

  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to commit to branch '${branch}' (${putRes.status} ${putRes.statusText}).`);
  }
}

// --------------------------------------------------------------------------
// AI Engines & Normalizers (Powered by Google Gemini AI)
// --------------------------------------------------------------------------
const GEMINI_KEY_STORAGE = "mp2tech_gemini_api_key";
const DEFAULT_KEY_B64 = "QVEuQWI4Uk42SXpoNDl6dFZPWW1XQ0pzSnVvVDVsaFd5bFZMN1VDTGJ1SGZBeHFrNG81R3c=";

export function getGeminiApiKey() {
  const stored = localStorage.getItem(GEMINI_KEY_STORAGE);
  if (stored && stored.trim()) return stored.trim();
  try {
    return atob(DEFAULT_KEY_B64);
  } catch (e) {
    return "";
  }
}

export function saveGeminiApiKey() {
  const input = document.getElementById("geminiApiKeyInput");
  const status = document.getElementById("geminiKeySaveStatus");
  if (!input) return;
  const key = input.value.trim();
  if (key) {
    localStorage.setItem(GEMINI_KEY_STORAGE, key);
    if (status) {
      status.textContent = "✓ Key saved securely in browser!";
      setTimeout(() => { status.textContent = ""; }, 4000);
    }
    showToast("Gemini API Key saved successfully!", "success");
  }
}

/**
 * Normalizes free-form category returned by AI into exact Amazon India select dropdown values
 */
function normalizeProductCategory(rawCategory = "", title = "", brand = "") {
  const c = (String(rawCategory) + " " + String(title) + " " + String(brand)).toLowerCase();

  // 1. Components
  if (c.includes("nvme") || c.includes("m.2") || c.includes("sata ssd") || c.includes("solid state drive") || (c.includes("ssd") && !c.includes("portable") && !c.includes("external"))) {
    return "internal-ssds";
  }
  if (c.includes("ram") || c.includes("memory") || c.includes("ddr3") || c.includes("ddr4") || c.includes("ddr5") || c.includes("sodimm") || c.includes("dimm") || c.includes("long dimm")) {
    return "memory-ram";
  }
  if (c.includes("motherboard") || c.includes("mainboard")) {
    return "motherboards";
  }
  if (c.includes("thermal paste") || c.includes("thermal compound") || c.includes("cooling") || c.includes("fan") || c.includes("heatsink") || c.includes("cooler") || c.includes("thermal pad") || c.includes("arctic mx")) {
    return "fans-cooling";
  }
  if (c.includes("power supply") || c.includes("psu") || c.includes("smps")) {
    return "power-supplies";
  }
  if (c.includes("processor") || c.includes("cpu") || c.includes("ryzen") || c.includes("intel core")) {
    return "processors";
  }
  if (c.includes("graphic") || c.includes("gpu") || c.includes("geforce") || c.includes("rtx") || c.includes("gtx") || c.includes("radeon") || c.includes("vga")) {
    return "graphics-cards";
  }
  if (c.includes("cabinet") || c.includes("pc case") || c.includes("chassis")) {
    return "computer-cases";
  }
  if (c.includes("internal hard drive") || c.includes("internal hdd")) {
    return "internal-hard-drives";
  }
  if (c.includes("screw") || c.includes("standoff")) {
    return "computer-screws";
  }
  if (c.includes("io port") || c.includes("expansion card") || c.includes("pci")) {
    return "io-port-cards";
  }
  if (c.includes("barebone") || c.includes("nuc")) {
    return "barebones";
  }

  // 2. External Storage
  if (c.includes("external hard drive") || c.includes("external hdd") || c.includes("portable hard drive") || c.includes("one touch") || c.includes("elements")) {
    return "external-hard-drives";
  }
  if (c.includes("external ssd") || c.includes("portable ssd") || c.includes("t7") || c.includes("extreme portable")) {
    return "external-ssds";
  }
  if (c.includes("pen drive") || c.includes("flash drive") || c.includes("usb drive") || c.includes("sd card") || c.includes("microsd")) {
    return "pen-drives";
  }

  // 3. Accessories & Peripherals
  if (c.includes("keyboard") || c.includes("mouse") || c.includes("trackpad")) {
    return "keyboards-mice";
  }
  if (c.includes("adapter") || c.includes("dongle") || c.includes("charger") || c.includes("bluetooth") || c.includes("ub500")) {
    return "adapters";
  }
  if (c.includes("cable") || c.includes("hdmi") || c.includes("displayport") || c.includes("sata cable") || c.includes("type c cable")) {
    return "cables-accessories";
  }
  if (c.includes("usb hub") || c.includes("type c hub") || c.includes("dock") || c.includes("multiport")) {
    return "usb-hubs";
  }
  if (c.includes("laptop stand") || c.includes("cooling pad") || c.includes("laptop bag") || c.includes("sleeve")) {
    return "laptop-accessories";
  }
  if (c.includes("ups") || c.includes("inverter") || c.includes("power backup")) {
    return "uninterrupted-power-supplies";
  }
  if (c.includes("gaming") && (c.includes("headset") || c.includes("controller") || c.includes("mousepad"))) {
    return "pc-gaming-peripherals";
  }
  if (c.includes("tool") || c.includes("screwdriver") || c.includes("multimeter") || c.includes("cleaner") || c.includes("blower") || c.includes("brush")) {
    return "cleaners-tools";
  }
  if (c.includes("headphone") || c.includes("headset") || c.includes("webcam") || c.includes("speaker") || c.includes("mic")) {
    return "audio-video-accessories";
  }

  // 4. Systems & Networking
  if (c.includes("laptop") || c.includes("notebook") || c.includes("macbook")) return "laptops";
  if (c.includes("desktop") || c.includes("all-in-one") || c.includes("aio")) return "desktops";
  if (c.includes("monitor") || c.includes("display")) return "monitors";
  if (c.includes("router") || c.includes("wifi") || c.includes("switch") || c.includes("ethernet")) return "networking-devices";

  return "adapters";
}

/**
 * Normalizes free-form price string into clean Indian Rupees format
 */
function normalizePrice(rawPrice = "") {
  if (typeof rawPrice === "number") return rawPrice.toLocaleString("en-IN");
  const cleaned = String(rawPrice).replace(/[₹\?Rs\.\s]/gi, "").trim();
  return cleaned || "2,499";
}

/**
 * Normalizes review counts
 */
function normalizeReviews(rawReviews = "") {
  if (typeof rawReviews === "number") return rawReviews;
  const num = parseInt(String(rawReviews).replace(/[,\s]/g, ""), 10);
  return isNaN(num) ? 1500 : num;
}

/**
 * Normalizes ratings (1.0 to 5.0)
 */
function normalizeRating(rawRating = 4.6) {
  const num = parseFloat(String(rawRating).replace(/[^\d.]/g, ""));
  if (isNaN(num) || num < 1 || num > 5) return 4.6;
  return num;
}

/**
 * Resolves curated high-resolution photography from Unsplash based on category and keywords
 */
function getCuratedPhotoForTopic(category, keyword = "", topic = "") {
  const normalized = (keyword + " " + topic).toLowerCase();
  
  if (normalized.includes("ssd") || normalized.includes("nvme") || normalized.includes("storage") || normalized.includes("hard drive")) {
    return "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1200&q=80";
  }
  if (normalized.includes("ram") || normalized.includes("memory") || normalized.includes("ddr4") || normalized.includes("ddr5")) {
    return "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=1200&q=80";
  }
  if (normalized.includes("thermal") || normalized.includes("paste") || normalized.includes("cooling") || normalized.includes("fan") || normalized.includes("overheating")) {
    return "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=80";
  }
  if (normalized.includes("screen") || normalized.includes("display") || normalized.includes("flicker") || normalized.includes("monitor")) {
    return "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80";
  }
  if (normalized.includes("motherboard") || normalized.includes("chip") || normalized.includes("circuit") || normalized.includes("soldering")) {
    return "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80";
  }
  if (normalized.includes("refurbished") || normalized.includes("buy") || normalized.includes("used") || normalized.includes("laptop")) {
    return "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80";
  }
  if (normalized.includes("tool") || normalized.includes("screwdriver") || normalized.includes("repair") || normalized.includes("teardown")) {
    return "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80";
  }

  switch (category) {
    case "upgrades":
      return "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1200&q=80";
    case "repair":
      return "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80";
    case "refurbished":
      return "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80";
    case "diagnostics":
    default:
      return "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=80";
  }
}

/**
 * Auto-matches existing product IDs from products catalog based on topic and AI product keywords
 */
function autoMatchProductIds(topic = "", productKeywords = []) {
  const searchCorpus = (topic + " " + (productKeywords || []).join(" ")).toLowerCase();
  const matchedIds = [];

  products.forEach((prod) => {
    const prodText = (prod.name + " " + prod.category + " " + (prod.highlights || []).join(" ")).toLowerCase();
    
    if (
      (searchCorpus.includes("ssd") || searchCorpus.includes("nvme") || searchCorpus.includes("storage")) &&
      prod.category === "storage"
    ) {
      matchedIds.push(prod.id);
    } else if (
      (searchCorpus.includes("ram") || searchCorpus.includes("memory") || searchCorpus.includes("ddr4") || searchCorpus.includes("ddr5")) &&
      prod.category === "ram"
    ) {
      matchedIds.push(prod.id);
    } else if (
      (searchCorpus.includes("thermal") || searchCorpus.includes("paste") || searchCorpus.includes("cooling") || searchCorpus.includes("fan") || searchCorpus.includes("heat")) &&
      prod.category === "cooling"
    ) {
      matchedIds.push(prod.id);
    } else if (
      (searchCorpus.includes("tool") || searchCorpus.includes("screw") || searchCorpus.includes("tester") || searchCorpus.includes("clean")) &&
      prod.category === "tools"
    ) {
      matchedIds.push(prod.id);
    }
  });

  return [...new Set(matchedIds)].slice(0, 3);
}

/**
 * 1-Click AI Diagnostic Article Generator using Gemini AI
 */
export async function generateArticleWithAI() {
  const topicInput = document.getElementById("aiTopicInput");
  const toneSelect = document.getElementById("aiToneSelect");
  const autoPhotoCheck = document.getElementById("aiAutoPhotoCheck");
  const autoLinkCheck = document.getElementById("aiAutoLinkCheck");
  const btn = document.getElementById("generateAiPostBtn");
  const feedback = document.getElementById("aiFeedbackBox");

  if (!topicInput) return;
  const topic = topicInput.value.trim();

  if (!topic) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Please enter a topic or customer problem description first.';
      feedback.style.display = "flex";
    }
    topicInput.focus();
    return;
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Gemini API Key is missing. Please set it in Settings.';
      feedback.style.display = "flex";
    }
    return;
  }

  const tone = toneSelect ? toneSelect.value : "diagnostics";
  const autoPhoto = autoPhotoCheck ? autoPhotoCheck.checked : true;
  const autoLink = autoLinkCheck ? autoLinkCheck.checked : true;

  // UI Loading State
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Researching & Writing Article...';
  }
  if (feedback) {
    feedback.className = "ai-feedback-box";
    feedback.style.display = "flex";
    feedback.style.background = "rgba(56, 189, 248, 0.12)";
    feedback.style.color = "#38bdf8";
    feedback.style.border = "1px solid rgba(56, 189, 248, 0.25)";
    feedback.innerHTML = '<i class="fa fa-cog fa-spin"></i> Gemini AI is generating formatted diagnostic walkthrough, slug & tips...';
  }

  const systemPrompt = `You are the Chief Diagnostic Specialist and Hardware Engineer at MP2TECH Mumbai (Specialized Laptop & PC Diagnostic and Repair Lab in Kandivali West, Mumbai).
Generate an authoritative, practical, step-by-step diagnostic guide for the following user topic:
"${topic}"

Article Style/Category: ${tone}

Respond ONLY with a single valid JSON object (no markdown formatting, no backticks, no text before or after the JSON):
{
  "title": "Authoritative, catchy headline in Sentence case (50-70 characters)",
  "slug": "clean-hyphenated-url-slug",
  "category": "${tone}",
  "categoryName": "Readable Category Name (e.g. Diagnostics & Repairs, Hardware Upgrades, Maintenance & Care, Refurbished Systems)",
  "excerpt": "Engaging 2-sentence summary (130-160 characters) explaining what the user will diagnose and fix.",
  "readTime": "4 min read",
  "keywordForImage": "2-3 English search keywords for finding high-res hardware photo (e.g. laptop motherboard repair, nvme ssd, cooling fan)",
  "recommendedProductKeywords": ["ssd", "thermal paste", "screws"],
  "body": "<p>Opening paragraph introducing the real-world symptom and diagnostic context...</p><h3>1. First Inspection & Symptom Isolation</h3><p>Step-by-step technical explanation...</p><h3>2. Deep Hardware / Software Testing</h3><p>Diagnostic methodology...</p><div class=\\"blog-tip-box\\"><strong>Specialist Diagnostic Tip:</strong> Key technician bench advice or warning tip.</div><h3>3. Permanent Fix & Component Recommendations</h3><p>Resolution details...</p><p>Need hands-on hardware diagnosis in Mumbai? Contact MP2TECH for rapid on-site testing and motherboard repair.</p>"
}`;

  const payload = {
    contents: [
      {
        parts: [{ text: systemPrompt }]
      }
    ]
  };

  const modelsToTry = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-flash-lite-latest"
  ];

  let rawResponseText = null;
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const json = await response.json();
        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
          rawResponseText = json.candidates[0].content.parts[0].text;
          break;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = errJson.error ? errJson.error.message : `HTTP ${response.status}`;
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  if (!rawResponseText) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-bolt"></i> Generate Complete Article';
    }
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = `<i class="fa fa-times-circle"></i> AI Generation failed: ${lastError || "Could not reach Gemini API"}`;
      feedback.style.display = "flex";
    }
    showToast("AI Generation failed. Check your API key.", "error");
    return;
  }

  try {
    let cleanJsonStr = rawResponseText.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.slice(7);
    } else if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.slice(3);
    }
    if (cleanJsonStr.endsWith("```")) {
      cleanJsonStr = cleanJsonStr.slice(0, -3);
    }
    cleanJsonStr = cleanJsonStr.trim();

    const data = JSON.parse(cleanJsonStr);

    const titleEl = document.getElementById("postTitle");
    const slugEl = document.getElementById("postSlug");
    const catEl = document.getElementById("postCategory");
    const readTimeEl = document.getElementById("postReadTime");
    const dateEl = document.getElementById("postDate");
    const imageEl = document.getElementById("postImage");
    const excerptEl = document.getElementById("postExcerpt");
    const bodyEl = document.getElementById("postBody");
    const relatedProdsEl = document.getElementById("postRelatedProds");

    if (titleEl) titleEl.value = data.title || topic;
    if (slugEl) slugEl.value = data.slug || slugify(data.title || topic);
    if (catEl) catEl.value = data.category || tone;
    if (readTimeEl) readTimeEl.value = data.readTime || "4 min read";
    if (dateEl) {
      const today = new Date();
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      dateEl.value = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    }
    
    if (autoPhoto && imageEl) {
      const photo = getCuratedPhotoForTopic(data.category || tone, data.keywordForImage, topic);
      imageEl.value = photo;
    }

    if (excerptEl) excerptEl.value = data.excerpt || "";
    if (bodyEl) bodyEl.value = data.body || "";

    if (autoLink && relatedProdsEl) {
      const matchedIds = autoMatchProductIds(topic, data.recommendedProductKeywords || []);
      Array.from(relatedProdsEl.options).forEach((opt) => {
        opt.selected = matchedIds.includes(opt.value);
      });
    }

    updatePostLivePreview();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-bolt"></i> Generate Complete Article';
    }
    if (feedback) {
      feedback.className = "ai-feedback-box success";
      feedback.innerHTML = '<i class="fa fa-check-circle"></i> <strong>Article Generated!</strong> Review the formatted walkthrough below and click "Publish Article".';
      feedback.style.display = "flex";
    }

    showToast("✨ AI Article generated successfully!", "success");

    const formCard = document.getElementById("postFormCard");
    if (formCard) {
      formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-bolt"></i> Generate Complete Article';
    }
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = `<i class="fa fa-times-circle"></i> Error parsing AI response: ${err.message}`;
      feedback.style.display = "flex";
    }
    showToast("Error processing AI response", "error");
  }
}

/**
 * 1-Click AI Amazon Product Auto-Capture using Gemini AI (With Short Link & Mobile Share Support)
 */
export async function extractAmazonProductWithAI() {
  const input = document.getElementById("aiAmazonLinkInput");
  const btn = document.getElementById("extractAiProdBtn");
  const feedback = document.getElementById("aiProdFeedbackBox");

  if (!input) return;
  const rawInput = input.value.trim();

  if (!rawInput) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Please paste an Amazon product link, mobile share text, or product title first.';
      feedback.style.display = "flex";
    }
    input.focus();
    return;
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Gemini API Key is missing. Please set it in Settings.';
      feedback.style.display = "flex";
    }
    return;
  }

  // 1. Parse raw input (extract clean URL, text snippets from mobile shares, direct ASIN)
  const parsed = parseAmazonInputString(rawInput);
  let targetUrl = parsed.url;
  let textSnippet = parsed.textSnippet;
  let detectedAsin = parsed.directAsin;
  let urlTitleSlug = "";
  let resolvedUrl = targetUrl;

  // 2. UI Loading State - Phase 1: Resolving Link
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Resolving Product Link...';
  }
  if (feedback) {
    feedback.className = "ai-feedback-box";
    feedback.style.display = "flex";
    feedback.style.background = "rgba(245, 158, 11, 0.12)";
    feedback.style.color = "#fbbf24";
    feedback.style.border = "1px solid rgba(245, 158, 11, 0.25)";
    feedback.innerHTML = '<i class="fa fa-link fa-spin"></i> Expanding Amazon link, detecting catalog ASIN & mobile share info...';
  }

  // 3. Multi-tier Unshortening if short link (amzn.in/d/*, amzn.to/*, a.co/*, etc.)
  if (targetUrl && (/amzn\.in|amzn\.to|a\.co|amzn\.eu|amzn\.asia|tinyurl|bit\.ly/i.test(targetUrl) || !detectedAsin)) {
    try {
      const resolution = await resolveAmazonShortUrl(targetUrl);
      if (resolution.resolvedUrl) resolvedUrl = resolution.resolvedUrl;
      if (resolution.asin) detectedAsin = resolution.asin;
      if (resolution.slugTitle) urlTitleSlug = resolution.slugTitle;
    } catch (err) {
      console.warn("URL resolution error:", err);
    }
  }

  // Extract Slug if available from full URL
  if (!urlTitleSlug && resolvedUrl) {
    const slugMatch = resolvedUrl.match(/(?:amazon\.[a-z.]+\/)?([^/]+)\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (slugMatch && !slugMatch[1].startsWith("dp")) {
      urlTitleSlug = decodeURIComponent(slugMatch[1]).replace(/[-_]/g, " ");
    }
  }

  // Build clean Affiliate URL with tag=mp2tech20-21
  const initialAffiliateUrl = detectedAsin 
    ? `https://www.amazon.in/dp/${detectedAsin}/?tag=mp2tech20-21`
    : ensureAffiliateTag(resolvedUrl || rawInput);

  // UI Loading State - Phase 2: Gemini AI Parsing
  if (btn) {
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Extracting Specs & Formats...';
  }
  if (feedback) {
    feedback.innerHTML = '<i class="fa fa-cog fa-spin"></i> Gemini AI is parsing hardware specifications, category, live INR price, and benchmark highlights...';
  }

  const systemPrompt = `You are a professional PC hardware technician and Amazon India (amazon.in) product catalog specialist for MP2TECH Store Mumbai.
Given the following Amazon product information:
- Raw Input / Link: "${rawInput}"
${resolvedUrl && resolvedUrl !== rawInput ? `- Resolved Full Amazon URL: "${resolvedUrl}"` : ""}
${urlTitleSlug ? `- Extracted Product Title Slug from URL: "${urlTitleSlug}"` : ""}
${detectedAsin ? `- Amazon ASIN: "${detectedAsin}"` : ""}
${textSnippet ? `- Product Share Snippet / Description: "${textSnippet}"` : ""}

Extract, standardize, and format the product data to accurately match the exact Amazon India listing in JSON format.
Guidelines:
1. 'name': Full, standardized product title with model & capacity (50-80 chars, e.g. "Crucial BX500 480GB 3D NAND SATA 2.5-inch Internal SSD" or "Transcend TS0GUSD Micro SD to SD Adapter").
2. 'brand': Exact Brand Name (e.g. Samsung, Crucial, Corsair, Noctua, iFixit, Kingston, Transcend, Western Digital, EVM, TP-Link, SanDisk).
3. 'category': exactly one of the official Amazon India category IDs:
   - Components: "internal-ssds", "memory-ram", "motherboards", "fans-cooling", "power-supplies", "processors", "graphics-cards", "computer-cases", "internal-hard-drives", "io-port-cards", "computer-screws", "barebones"
   - Accessories: "keyboards-mice", "adapters", "cables-accessories", "usb-hubs", "laptop-accessories", "uninterrupted-power-supplies", "pc-gaming-peripherals", "cleaners-tools", "audio-video-accessories"
   - External Storage: "external-hard-drives", "external-ssds", "pen-drives"
   - Systems & Networking: "laptops", "desktops", "monitors", "networking-devices"
4. 'price': Most accurate realistic current Amazon.in selling price in Indian Rupees (INR) as a clean string without rupee symbol (e.g. "2,499", "11,299", "249", "899").
5. 'rating': Accurate customer star rating out of 5 (e.g. 4.4, 4.5, 4.6, 4.8).
6. 'reviews': Accurate total customer review count (e.g. 12500, 18500, 42000).
7. 'badge': Best Seller, Amazon's Choice, or Technician Verified Upgrade.
8. 'asin': The 10-character Amazon ASIN (e.g. "${detectedAsin || "B008XT42JU"}"). If unknown, provide the best matching 10-char Amazon ASIN.
9. 'highlights': Array of exactly 3 key technical specifications / hardware features.

Respond ONLY with a single valid JSON object (no markdown backticks, no extra text):
{
  "name": "Clean product title with model and capacity",
  "brand": "Brand Name",
  "category": "internal-ssds",
  "price": "2,499",
  "rating": 4.6,
  "reviews": 18500,
  "badge": "Technician Verified Upgrade",
  "asin": "${detectedAsin || "B008XT42JU"}",
  "highlights": [
    "Key technical highlight 1",
    "Key technical highlight 2",
    "Key technical highlight 3"
  ]
}`;

  const payload = {
    contents: [
      {
        parts: [{ text: systemPrompt }]
      }
    ]
  };

  const modelsToTry = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-flash-lite-latest"
  ];

  let rawResponseText = null;
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const json = await response.json();
        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
          rawResponseText = json.candidates[0].content.parts[0].text;
          break;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = errJson.error ? errJson.error.message : `HTTP ${response.status}`;
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  if (!rawResponseText) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-magic"></i> Auto-Capture & Fill Product Form';
    }
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = `<i class="fa fa-times-circle"></i> AI Product Extraction failed: ${lastError || "Could not reach Gemini API"}`;
      feedback.style.display = "flex";
    }
    showToast("AI Extraction failed. Check your link or API key.", "error");
    return;
  }

  try {
    let cleanJsonStr = rawResponseText.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.slice(7);
    } else if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.slice(3);
    }
    if (cleanJsonStr.endsWith("```")) {
      cleanJsonStr = cleanJsonStr.slice(0, -3);
    }
    cleanJsonStr = cleanJsonStr.trim();

    const data = JSON.parse(cleanJsonStr);

    // Final ASIN Resolution: Prefer detected ASIN from short link unshortener, or AI response
    const finalAsin = detectedAsin || (data.asin && /^[A-Z0-9]{10}$/i.test(data.asin) ? data.asin.toUpperCase() : null);

    // Build Canonical Affiliate URL
    let finalAffiliateUrl = "";
    if (finalAsin) {
      finalAffiliateUrl = `https://www.amazon.in/dp/${finalAsin}/?tag=mp2tech20-21`;
    } else {
      finalAffiliateUrl = initialAffiliateUrl || ensureAffiliateTag(resolvedUrl || rawInput);
    }

    // Populate Product Form Fields with Robust Normalization
    const nameEl = document.getElementById("prodName");
    const brandEl = document.getElementById("prodBrand");
    const catEl = document.getElementById("prodCategory");
    const priceEl = document.getElementById("prodPrice");
    const ratingEl = document.getElementById("prodRating");
    const reviewsEl = document.getElementById("prodReviews");
    const badgeEl = document.getElementById("prodBadge");
    const urlEl = document.getElementById("prodAmazonUrl");
    const imageEl = document.getElementById("prodImage");
    const highlightsEl = document.getElementById("prodHighlights");

    const normalizedCat = normalizeProductCategory(data.category || "storage");

    if (nameEl) nameEl.value = data.name || urlTitleSlug || textSnippet || rawInput;
    if (brandEl) brandEl.value = data.brand || "Verified Brand";
    if (catEl) catEl.value = normalizedCat;
    if (priceEl) priceEl.value = normalizePrice(data.price || "1,999");
    if (ratingEl) ratingEl.value = normalizeRating(data.rating);
    if (reviewsEl) reviewsEl.value = normalizeReviews(data.reviews);
    if (badgeEl) badgeEl.value = data.badge || "Technician Verified";
    if (urlEl) urlEl.value = finalAffiliateUrl;

    // Direct Amazon Official ASIN CDN Image or fallback curated hardware image
    let productImgUrl = "";
    if (finalAsin) {
      productImgUrl = `https://images-na.ssl-images-amazon.com/images/P/${finalAsin}.01.LZZZZZZZ.jpg`;
    } else {
      productImgUrl = getCuratedPhotoForTopic(normalizedCat, data.brand || "", data.name || "");
    }
    if (imageEl) imageEl.value = productImgUrl;

    if (highlightsEl && data.highlights) {
      highlightsEl.value = Array.isArray(data.highlights) ? data.highlights.join("\n") : data.highlights;
    }

    // Refresh Live Preview
    updateProductLivePreview();

    // Reset UI State
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-magic"></i> Auto-Capture & Fill Product Form';
    }
    if (feedback) {
      feedback.className = "ai-feedback-box success";
      feedback.style.background = "rgba(16, 185, 129, 0.15)";
      feedback.style.color = "#34d399";
      feedback.style.border = "1px solid rgba(16, 185, 129, 0.35)";
      feedback.innerHTML = `<i class="fa fa-check-circle"></i> <strong>Product Captured!</strong> ${finalAsin ? `(ASIN: ${finalAsin}) ` : ''}Review specs below and click "Add Product to Catalog".`;
      feedback.style.display = "flex";
    }

    showToast("🛒 Amazon Product details captured!", "success");

    // Smooth scroll to product form for mobile & desktop
    const formCard = document.getElementById("productFormCard");
    if (formCard) {
      formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-magic"></i> Auto-Capture & Fill Product Form';
    }
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = `<i class="fa fa-times-circle"></i> Error parsing product response: ${err.message}`;
      feedback.style.display = "flex";
    }
    showToast("Error processing Amazon product data", "error");
  }
}

// Bulk Importer Candidate State
let bulkCandidates = [];

export function switchAmazonAiMode(mode) {
  const singleTab = document.getElementById("aiModeTabSingle");
  const batchTab = document.getElementById("aiModeTabBatch");
  const discoveryTab = document.getElementById("aiModeTabDiscovery");

  const singleSec = document.getElementById("aiAmazonSingleSection");
  const batchSec = document.getElementById("aiAmazonBatchSection");
  const discoverySec = document.getElementById("aiAmazonDiscoverySection");

  [singleTab, batchTab, discoveryTab].forEach((t) => t && t.classList.remove("active"));
  [singleSec, batchSec, discoverySec].forEach((s) => s && (s.style.display = "none"));

  if (mode === "batch") {
    if (batchTab) batchTab.classList.add("active");
    if (batchSec) batchSec.style.display = "block";
  } else if (mode === "discovery") {
    if (discoveryTab) discoveryTab.classList.add("active");
    if (discoverySec) discoverySec.style.display = "block";
  } else {
    if (singleTab) singleTab.classList.add("active");
    if (singleSec) singleSec.style.display = "block";
  }
}

export function populateBulkDemo(type) {
  const input = document.getElementById("aiBulkLinksInput");
  if (!input) return;

  if (type === "ssds") {
    input.value = [
      "https://www.amazon.in/dp/B07G3KRZBX/ (Crucial BX500 480GB SATA 2.5 SSD)",
      "https://www.amazon.in/dp/B08GLX7TNT/ (Samsung 980 PRO 1TB PCIe 4.0 NVMe M.2 SSD)",
      "https://www.amazon.in/dp/B0C8XHN1J3/ (Western Digital WD Blue SN580 1TB NVMe SSD)",
      "https://www.amazon.in/dp/B0BBWH1R8H/ (Kingston NV2 500GB PCIe 4.0 M.2 SSD)",
      "https://www.amazon.in/dp/B08QBN5C92/ (Samsung 870 EVO 500GB SATA 2.5 SSD)"
    ].join("\n");
  } else if (type === "ram") {
    input.value = [
      "Crucial 16GB DDR4 3200MHz SODIMM Laptop RAM (CT16G4SFRA32A)",
      "Crucial 8GB DDR4 3200MHz SODIMM Laptop RAM (CT8G4SFRA32A)",
      "Crucial 16GB DDR5 4800MHz SODIMM Laptop RAM (CT16G48C40S5)",
      "Corsair Vengeance LPX 16GB DDR4 3200MHz Desktop RAM"
    ].join("\n");
  } else if (type === "cooling") {
    input.value = [
      "Noctua NT-H1 3.5g Pro-Grade Thermal Compound Paste",
      "Arctic MX-4 4g High-Performance Thermal Paste with Spatula",
      "Thermal Grizzly Kryonaut 1g Extreme Performance Thermal Paste",
      "Klim Wind Laptop Cooling Pad with 4 High-Speed Quiet Fans"
    ].join("\n");
  } else if (type === "tools") {
    input.value = [
      "iFixit Essential Electronics Toolkit Precision Screwdrivers",
      "STREBITO 142-Piece Electronics Precision Screwdriver Repair Set",
      "Digital Multimeter with Auto-Ranging for Component Testing",
      "Anti-Static Wrist Strap ESD Band for Motherboard Safety"
    ].join("\n");
  }
  input.focus();
}

export async function analyzeBulkAmazonLinksWithAI() {
  const input = document.getElementById("aiBulkLinksInput");
  const btn = document.getElementById("analyzeBulkLinksBtn");
  const feedback = document.getElementById("aiProdFeedbackBox");

  if (!input) return;
  const rawText = input.value.trim();

  if (!rawText) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Please paste at least 1 Amazon link or product name.';
      feedback.style.display = "flex";
    }
    input.focus();
    return;
  }

  const lines = rawText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 25);
  if (lines.length === 0) return;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Gemini API Key is missing. Please set it in Settings.';
      feedback.style.display = "flex";
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Analyzing & Extracting ${lines.length} Items...`;
  }
  if (feedback) {
    feedback.className = "ai-feedback-box";
    feedback.style.display = "flex";
    feedback.style.background = "rgba(245, 158, 11, 0.12)";
    feedback.style.color = "#fbbf24";
    feedback.style.border = "1px solid rgba(245, 158, 11, 0.25)";
    feedback.innerHTML = `<i class="fa fa-link fa-spin"></i> Resolving short links & expanding ASINs for ${lines.length} items in parallel...`;
  }

  // Resolve short links in parallel before sending to Gemini
  const resolvedItems = await Promise.all(
    lines.map(async (line) => {
      const parsed = parseAmazonInputString(line);
      if (parsed.url && /amzn\.in|amzn\.to|a\.co|amzn\.eu|amzn\.asia|tinyurl|bit\.ly/i.test(parsed.url)) {
        try {
          const res = await resolveAmazonShortUrl(parsed.url);
          return {
            original: line,
            resolvedUrl: res.resolvedUrl || parsed.url,
            asin: res.asin || parsed.directAsin,
            titleSlug: res.slugTitle,
            snippet: parsed.textSnippet
          };
        } catch (e) {
          return { original: line, resolvedUrl: parsed.url, asin: parsed.directAsin, titleSlug: "", snippet: parsed.textSnippet };
        }
      }
      return {
        original: line,
        resolvedUrl: parsed.url,
        asin: parsed.directAsin,
        titleSlug: "",
        snippet: parsed.textSnippet
      };
    })
  );

  if (feedback) {
    feedback.innerHTML = `<i class="fa fa-cog fa-spin"></i> Gemini AI is parsing ${lines.length} Amazon hardware products with verified pricing & images...`;
  }

  const systemPrompt = `You are a professional PC hardware technician and Amazon India (amazon.in) catalog specialist for MP2TECH Store Mumbai.
Given the following list of ${lines.length} Amazon product links or product queries:
${resolvedItems.map((item, i) => `${i + 1}. Input: "${item.original}"${item.asin ? ` [ASIN: ${item.asin}]` : ''}${item.titleSlug ? ` [Slug: ${item.titleSlug}]` : ''}${item.resolvedUrl ? ` [URL: ${item.resolvedUrl}]` : ''}`).join("\n")}

Extract, standardize, and format each product accurately for the Amazon India catalog.
Category must be exactly one of the official Amazon India category IDs:
- Components: "internal-ssds", "memory-ram", "motherboards", "fans-cooling", "power-supplies", "processors", "graphics-cards", "computer-cases", "internal-hard-drives", "io-port-cards", "computer-screws", "barebones"
- Accessories: "keyboards-mice", "adapters", "cables-accessories", "usb-hubs", "laptop-accessories", "uninterrupted-power-supplies", "pc-gaming-peripherals", "cleaners-tools", "audio-video-accessories"
- External Storage: "external-hard-drives", "external-ssds", "pen-drives"
- Systems & Networking: "laptops", "desktops", "monitors", "networking-devices"

Price must be estimated in Indian Rupees (INR) as a clean string without currency symbol (e.g. "2,499", "11,299", "899").
Affiliate URLs must include tag=mp2tech20-21.
If an ASIN is detectable, format image as "https://images-na.ssl-images-amazon.com/images/P/{ASIN}.01.LZZZZZZZ.jpg" and amazonUrl as "https://www.amazon.in/dp/{ASIN}/?tag=mp2tech20-21".

Respond ONLY with a valid JSON array of ${lines.length} objects (no markdown backticks, no extra text):
[
  {
    "name": "Full standardized product title with model & capacity (50-80 chars)",
    "brand": "Brand Name",
    "category": "internal-ssds",
    "priceEstimate": "2,499",
    "rating": 4.6,
    "reviewCount": 18500,
    "badge": "Best Seller",
    "asin": "B07G3KRZBX",
    "amazonUrl": "https://www.amazon.in/dp/B07G3KRZBX/?tag=mp2tech20-21",
    "image": "https://images-na.ssl-images-amazon.com/images/P/B07G3KRZBX.01.LZZZZZZZ.jpg",
    "highlights": [
      "Key technical highlight 1",
      "Key technical highlight 2",
      "Key technical highlight 3"
    ]
  }
]`;

  await executeGeminiBatchRequest(systemPrompt, apiKey, btn, feedback, `Batch of ${lines.length} Products`, "Batch Imported Items");
}

export async function generateCategoryDiscoveryWithAI(categoryKey) {
  const btn = document.getElementById("analyzeBulkLinksBtn");
  const feedback = document.getElementById("aiProdFeedbackBox");

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Gemini API Key is missing. Please set it in Settings.';
      feedback.style.display = "flex";
    }
    return;
  }

  const categoryDescriptions = {
    "internal-ssds": "top 10 best-selling internal SSDs on Amazon India (Crucial BX500, Samsung 980/990 PRO, WD Blue SN580, Kingston NV2, Samsung 870 EVO, EVM)",
    "memory-ram": "top 10 best-selling laptop and desktop RAM modules on Amazon India (Crucial 8GB/16GB DDR4 & DDR5 SODIMM, Corsair Vengeance DDR4/DDR5, EVM)",
    "fans-cooling": "top 8 high-performance thermal pastes, cooling pads, and thermal compounds on Amazon India (Noctua NT-H1, Arctic MX-4, Thermal Grizzly, Klim cooling pad)",
    "cleaners-tools": "top 8 PC & laptop repair diagnostic toolkits and precision screwdriver sets on Amazon India (iFixit toolkit, STREBITO, Digital Multimeters, Anti-static mats)",
    "motherboards": "top 8 Intel and AMD desktop motherboards on Amazon India (Gigabyte, ASUS Prime, MSI)",
    "adapters": "top 8 USB-C hubs, multi-port display docks, and diagnostic adapters on Amazon India (TP-Link, UGREEN, Anker)",
    "keyboards-mice": "top 8 wireless keyboard and mouse combos on Amazon India (Dell KM3322W, Logitech MK295, HP)"
  };

  const desc = categoryDescriptions[categoryKey] || `top 8 products for category ${categoryKey}`;

  if (feedback) {
    feedback.className = "ai-feedback-box";
    feedback.style.display = "flex";
    feedback.style.background = "rgba(245, 158, 11, 0.12)";
    feedback.style.color = "#fbbf24";
    feedback.style.border = "1px solid rgba(245, 158, 11, 0.25)";
    feedback.innerHTML = `<i class="fa fa-magic fa-spin"></i> Gemini AI is discovering curated ${desc}...`;
  }

  const systemPrompt = `You are a professional PC hardware technician and Amazon India catalog curator for MP2TECH Store Mumbai.
Discover and generate the ${desc}.
Every product must be a real, genuine product sold on Amazon India (amazon.in) with realistic ASINs, live market INR pricing, star ratings, review counts, direct Amazon image links, and tag=mp2tech20-21 attached.

Respond ONLY with a valid JSON array of objects (no markdown backticks, no extra text):
[
  {
    "name": "Full standardized product title with model & capacity (50-80 chars)",
    "brand": "Brand Name",
    "category": "${categoryKey}",
    "priceEstimate": "2,499",
    "rating": 4.6,
    "reviewCount": 18500,
    "badge": "Amazon's Choice",
    "asin": "B07G3KRZBX",
    "amazonUrl": "https://www.amazon.in/dp/B07G3KRZBX/?tag=mp2tech20-21",
    "image": "https://images-na.ssl-images-amazon.com/images/P/B07G3KRZBX.01.LZZZZZZZ.jpg",
    "highlights": [
      "Key technical highlight 1",
      "Key technical highlight 2",
      "Key technical highlight 3"
    ]
  }
]`;

  await executeGeminiBatchRequest(systemPrompt, apiKey, btn, feedback, `Curated ${categoryKey.toUpperCase()} Pack`, `Discovered ${categoryKey.toUpperCase()} Products`);
}

export async function generateCustomDiscoveryWithAI() {
  const input = document.getElementById("aiCustomDiscoveryInput");
  const feedback = document.getElementById("aiProdFeedbackBox");
  if (!input) return;
  const query = input.value.trim();
  if (!query) {
    input.focus();
    return;
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Gemini API Key is missing. Please set it in Settings.';
      feedback.style.display = "flex";
    }
    return;
  }

  if (feedback) {
    feedback.className = "ai-feedback-box";
    feedback.style.display = "flex";
    feedback.style.background = "rgba(245, 158, 11, 0.12)";
    feedback.style.color = "#fbbf24";
    feedback.style.border = "1px solid rgba(245, 158, 11, 0.25)";
    feedback.innerHTML = `<i class="fa fa-search fa-spin"></i> Gemini AI is searching for "${query}" on Amazon India...`;
  }

  const systemPrompt = `You are a professional PC hardware technician for MP2TECH Store Mumbai.
Search Amazon India for: "${query}".
Generate 6 to 8 top-rated products on Amazon.in with real ASINs, live INR prices, ratings, reviews, and tag=mp2tech20-21 attached.

Respond ONLY with a valid JSON array of objects (no markdown backticks, no extra text):
[
  {
    "name": "Full standardized product title (50-80 chars)",
    "brand": "Brand Name",
    "category": "accessories",
    "priceEstimate": "1,499",
    "rating": 4.5,
    "reviewCount": 8500,
    "badge": "Top Rated",
    "asin": "B07XYZ1234",
    "amazonUrl": "https://www.amazon.in/dp/B07XYZ1234/?tag=mp2tech20-21",
    "image": "https://images-na.ssl-images-amazon.com/images/P/B07XYZ1234.01.LZZZZZZZ.jpg",
    "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
  }
]`;

  await executeGeminiBatchRequest(systemPrompt, apiKey, null, feedback, `Custom Discovery: "${query}"`, "Custom Search Results");
}

async function executeGeminiBatchRequest(systemPrompt, apiKey, btn, feedback, title, subtitle) {
  const payload = {
    contents: [
      {
        parts: [{ text: systemPrompt }]
      }
    ]
  };

  const modelsToTry = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-flash-lite-latest"
  ];

  let rawResponseText = null;
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const json = await response.json();
        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
          rawResponseText = json.candidates[0].content.parts[0].text;
          break;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = errJson.error ? errJson.error.message : `HTTP ${response.status}`;
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-list-alt"></i> <span>Analyze & Format Bulk Products</span>';
  }

  if (!rawResponseText) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = `<i class="fa fa-times-circle"></i> Batch AI Extraction failed: ${lastError || "Could not reach Gemini API"}`;
      feedback.style.display = "flex";
    }
    showToast("Batch AI extraction failed", "error");
    return;
  }

  try {
    let cleanJsonStr = rawResponseText.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.slice(7);
    } else if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.slice(3);
    }
    if (cleanJsonStr.endsWith("```")) {
      cleanJsonStr = cleanJsonStr.slice(0, -3);
    }
    cleanJsonStr = cleanJsonStr.trim();

    const candidates = JSON.parse(cleanJsonStr);
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error("No valid product array found in AI response");
    }

    renderBulkReviewGrid(candidates, title, subtitle);

    if (feedback) {
      feedback.className = "ai-feedback-box success";
      feedback.style.background = "rgba(16, 185, 129, 0.15)";
      feedback.style.color = "#34d399";
      feedback.style.border = "1px solid rgba(16, 185, 129, 0.35)";
      feedback.innerHTML = `<i class="fa fa-check-circle"></i> <strong>${candidates.length} Products Found!</strong> Review the items in the grid below and click "Import Selected Products".`;
      feedback.style.display = "flex";
    }

    showToast(`Found ${candidates.length} products ready for import!`, "success");

  } catch (err) {
    if (feedback) {
      feedback.className = "ai-feedback-box error";
      feedback.innerHTML = `<i class="fa fa-times-circle"></i> Error parsing batch response: ${err.message}`;
      feedback.style.display = "flex";
    }
    showToast("Error processing batch product data", "error");
  }
}

export function renderBulkReviewGrid(candidates, title = "Bulk Products Review", subtitle = "Select the hardware components you want to add to your store catalog.") {
  bulkCandidates = candidates;
  const drawer = document.getElementById("bulkReviewDrawer");
  const tbody = document.getElementById("bulkCandidatesTableBody");
  const titleEl = document.getElementById("bulkFoundTitle");
  const subEl = document.getElementById("bulkFoundSubtitle");

  if (!drawer || !tbody) return;

  if (titleEl) titleEl.textContent = `${title} (${candidates.length} items)`;
  if (subEl) subEl.textContent = subtitle;

  const existingAsins = new Set(
    products
      .map((p) => {
        const m = (p.amazonUrl || "").match(/(?:dp|gp\/product|d|asin)\/([A-Z0-9]{10})/i);
        return m ? m[1].toUpperCase() : null;
      })
      .filter(Boolean)
  );

  const existingNames = new Set(products.map((p) => p.name.toLowerCase().trim()));

  tbody.innerHTML = candidates
    .map((item, index) => {
      const asin = item.asin ? item.asin.toUpperCase() : null;
      const isDuplicate = (asin && existingAsins.has(asin)) || existingNames.has((item.name || "").toLowerCase().trim());
      const checkedAttr = isDuplicate ? "" : "checked";
      const normalizedCat = normalizeProductCategory(item.category || "storage");
      const normalizedPrice = normalizePrice(item.priceEstimate || "2,499");
      const imgSrc = item.image || (asin ? `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg` : getCuratedPhotoForTopic(normalizedCat, item.brand, item.name));
      const highlightsText = Array.isArray(item.highlights) ? item.highlights.join(" • ") : (item.highlights || "");

      return `
        <tr class="bulk-candidate-row ${isDuplicate ? "duplicate" : ""}" data-index="${index}">
          <td style="text-align:center;">
            <input type="checkbox" class="bulk-candidate-check" data-index="${index}" ${checkedAttr} onchange="window.updateBulkSelectionCount()" />
          </td>
          <td>
            <img src="${imgSrc}" alt="thumb" style="width:46px; height:46px; object-fit:contain; border-radius:6px; background:#1e293b; padding:2px;" onerror="this.src='img/service.jpg'" />
          </td>
          <td style="min-width:240px;">
            <input type="text" class="candidate-editable-input candidate-name-input" value="${item.name || ""}" style="font-weight:700; margin-bottom:4px;" />
            <div style="font-size:11px; color:#94a3b8; line-height:1.4;">${highlightsText}</div>
          </td>
          <td style="width:110px;">
            <input type="text" class="candidate-editable-input candidate-brand-input" value="${item.brand || "Verified"}" />
          </td>
          <td style="width:140px;">
            <select class="candidate-editable-input candidate-cat-select" style="padding:4px 6px; font-size:11px;">
              <optgroup label="Components">
                <option value="internal-ssds" ${normalizedCat === "internal-ssds" ? "selected" : ""}>Internal SSDs</option>
                <option value="memory-ram" ${normalizedCat === "memory-ram" ? "selected" : ""}>Memory (RAM)</option>
                <option value="motherboards" ${normalizedCat === "motherboards" ? "selected" : ""}>Motherboards</option>
                <option value="fans-cooling" ${normalizedCat === "fans-cooling" ? "selected" : ""}>Fans & Cooling</option>
                <option value="power-supplies" ${normalizedCat === "power-supplies" ? "selected" : ""}>Power Supplies</option>
                <option value="processors" ${normalizedCat === "processors" ? "selected" : ""}>Processors</option>
                <option value="graphics-cards" ${normalizedCat === "graphics-cards" ? "selected" : ""}>Graphics Cards</option>
                <option value="computer-cases" ${normalizedCat === "computer-cases" ? "selected" : ""}>Computer Cases</option>
                <option value="internal-hard-drives" ${normalizedCat === "internal-hard-drives" ? "selected" : ""}>Internal HDDs</option>
                <option value="io-port-cards" ${normalizedCat === "io-port-cards" ? "selected" : ""}>I/O Port Cards</option>
                <option value="computer-screws" ${normalizedCat === "computer-screws" ? "selected" : ""}>Computer Screws</option>
                <option value="barebones" ${normalizedCat === "barebones" ? "selected" : ""}>Barebones</option>
              </optgroup>
              <optgroup label="Accessories & Peripherals">
                <option value="keyboards-mice" ${normalizedCat === "keyboards-mice" ? "selected" : ""}>Keyboards & Mice</option>
                <option value="adapters" ${normalizedCat === "adapters" ? "selected" : ""}>Adapters</option>
                <option value="cables-accessories" ${normalizedCat === "cables-accessories" ? "selected" : ""}>Cables & Interconnects</option>
                <option value="usb-hubs" ${normalizedCat === "usb-hubs" ? "selected" : ""}>USB Hubs & Docks</option>
                <option value="laptop-accessories" ${normalizedCat === "laptop-accessories" ? "selected" : ""}>Laptop Accessories</option>
                <option value="uninterrupted-power-supplies" ${normalizedCat === "uninterrupted-power-supplies" ? "selected" : ""}>UPS Units</option>
                <option value="pc-gaming-peripherals" ${normalizedCat === "pc-gaming-peripherals" ? "selected" : ""}>Gaming Peripherals</option>
                <option value="cleaners-tools" ${normalizedCat === "cleaners-tools" ? "selected" : ""}>Tools & Cleaners</option>
                <option value="audio-video-accessories" ${normalizedCat === "audio-video-accessories" ? "selected" : ""}>Audio & Video</option>
              </optgroup>
              <optgroup label="External Storage">
                <option value="external-hard-drives" ${normalizedCat === "external-hard-drives" ? "selected" : ""}>External HDDs</option>
                <option value="external-ssds" ${normalizedCat === "external-ssds" ? "selected" : ""}>External SSDs</option>
                <option value="pen-drives" ${normalizedCat === "pen-drives" ? "selected" : ""}>Pen Drives</option>
              </optgroup>
              <optgroup label="Systems & Networking">
                <option value="laptops" ${normalizedCat === "laptops" ? "selected" : ""}>Laptops</option>
                <option value="desktops" ${normalizedCat === "desktops" ? "selected" : ""}>Desktops</option>
                <option value="monitors" ${normalizedCat === "monitors" ? "selected" : ""}>Monitors</option>
                <option value="networking-devices" ${normalizedCat === "networking-devices" ? "selected" : ""}>Networking</option>
              </optgroup>
            </select>
          </td>
          <td style="width:90px;">
            <input type="text" class="candidate-editable-input candidate-price-input" value="${normalizedPrice}" style="font-weight:700; color:#fbbf24;" />
          </td>
          <td style="width:85px; font-size:12px; color:#cbd5e1;">
            <span style="color:#ff9900;"><i class="fa fa-star"></i> ${item.rating || "4.5"}</span>
            <div style="font-size:10.5px; color:#64748b;">(${item.reviewCount ? item.reviewCount.toLocaleString() : "1.2k"})</div>
          </td>
          <td style="width:95px;">
            ${isDuplicate ? '<span class="duplicate-pill">In Store</span>' : '<span class="ready-pill">Ready</span>'}
          </td>
        </tr>
      `;
    })
    .join("");

  drawer.style.display = "block";
  updateBulkSelectionCount();
  drawer.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function toggleAllBulkCandidates(checked) {
  const checkboxes = document.querySelectorAll(".bulk-candidate-check");
  checkboxes.forEach((cb) => {
    cb.checked = checked;
  });
  const master = document.getElementById("bulkSelectAllCheckbox");
  if (master) master.checked = checked;
  updateBulkSelectionCount();
}

export function updateBulkSelectionCount() {
  const checked = document.querySelectorAll(".bulk-candidate-check:checked");
  const count = checked ? checked.length : 0;
  const countText = document.getElementById("bulkSelectedCountText");
  const importBtn = document.getElementById("importBulkBtn");

  if (countText) {
    countText.textContent = `${count} products selected for import`;
  }
  if (importBtn) {
    importBtn.disabled = count === 0;
    importBtn.innerHTML = `<i class="fa fa-download"></i> <span>Import ${count} Selected Products to Catalog</span>`;
  }
}

export function importSelectedBulkProducts() {
  const checkboxes = document.querySelectorAll(".bulk-candidate-check:checked");
  if (!checkboxes || checkboxes.length === 0) {
    showToast("Please select at least 1 product to import.", "error");
    return;
  }

  let importedCount = 0;
  let maxId = products.reduce((max, p) => Math.max(max, p.id || 0), 0);

  checkboxes.forEach((cb) => {
    const idx = parseInt(cb.getAttribute("data-index"), 10);
    const candidate = bulkCandidates[idx];
    if (!candidate) return;

    const row = cb.closest("tr");
    const nameInput = row ? row.querySelector(".candidate-name-input") : null;
    const brandInput = row ? row.querySelector(".candidate-brand-input") : null;
    const catSelect = row ? row.querySelector(".candidate-cat-select") : null;
    const priceInput = row ? row.querySelector(".candidate-price-input") : null;

    const finalName = nameInput ? nameInput.value.trim() : candidate.name;
    const finalBrand = brandInput ? brandInput.value.trim() : candidate.brand;
    const finalCat = catSelect ? catSelect.value : candidate.category;
    const finalPrice = priceInput ? priceInput.value.trim() : candidate.priceEstimate;

    // Ensure Amazon Affiliate tag mp2tech20-21 is attached
    const finalUrl = ensureAffiliateTag(candidate.amazonUrl || (candidate.asin ? `https://www.amazon.in/dp/${candidate.asin}` : ""));

    const newId = `prod-${Date.now().toString().slice(-4)}-${importedCount + 1}`;
    const newProduct = {
      id: newId,
      name: finalName,
      brand: finalBrand,
      category: normalizeProductCategory(finalCat),
      priceEstimate: normalizePrice(finalPrice),
      rating: normalizeRating(candidate.rating),
      reviewCount: normalizeReviews(candidate.reviewCount),
      badge: candidate.badge || "Verified Hardware",
      amazonUrl: finalUrl,
      image: candidate.image || (candidate.asin ? `https://images-na.ssl-images-amazon.com/images/P/${candidate.asin}.01.LZZZZZZZ.jpg` : getCuratedPhotoForTopic(finalCat, finalBrand, finalName)),
      highlights: Array.isArray(candidate.highlights) ? candidate.highlights : ["Genuine Hardware", "Technician Tested"]
    };

    products.unshift(newProduct);
    importedCount++;
  });

  if (importedCount > 0) {
    sessionStorage.setItem("mp2tech_draft_products", JSON.stringify(products));
    hasUnpublishedChanges = true;

    updateMetrics();
    renderProductsTable();
    populateRelatedProductsSelect();
    updateDraftBanner();

    const drawer = document.getElementById("bulkReviewDrawer");
    if (drawer) drawer.style.display = "none";
    bulkCandidates = [];

    const bulkInput = document.getElementById("aiBulkLinksInput");
    if (bulkInput) bulkInput.value = "";

    showToast(`🎉 Successfully imported ${importedCount} products into your store!`, "success");

    const tableCard = document.getElementById("productFormCard");
    if (tableCard) {
      tableCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

/**
 * Initialize Admin UI Events
 */
export function initAdminStudio() {
  checkAuth();

  const savedToken = getStoredToken();
  const tokenInput = document.getElementById("githubTokenInput");
  if (savedToken && tokenInput) {
    tokenInput.value = savedToken;
  }
  if (tokenInput) {
    tokenInput.addEventListener("input", function () {
      storeToken(this.value.trim());
    });
  }

  // Load Gemini API Key into Settings input
  const geminiInput = document.getElementById("geminiApiKeyInput");
  if (geminiInput) {
    geminiInput.value = getGeminiApiKey();
  }

  // Login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pin = document.getElementById("loginPasscode").value;
      handleLogin(pin);
    });
  }

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // Sidebar navigation tabs
  const navLinks = document.querySelectorAll(".sidebar-menu a[data-tab]");
  navLinks.forEach((link) => {
    link.addEventListener("click", function () {
      navLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      const targetTab = this.getAttribute("data-tab");
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.remove("active");
      });
      const targetPanel = document.getElementById(`tab-${targetTab}`);
      if (targetPanel) targetPanel.classList.add("active");
    });
  });

  // Table Search & Filter - Products
  const prodSearch = document.getElementById("prodTableSearch");
  if (prodSearch) {
    prodSearch.addEventListener("input", function () {
      prodSearchQuery = this.value;
      renderProductsTable();
    });
  }

  const prodCatFilter = document.getElementById("prodTableCategoryFilter");
  if (prodCatFilter) {
    prodCatFilter.addEventListener("change", function () {
      prodCategoryFilter = this.value;
      renderProductsTable();
    });
  }

  const prodSort = document.getElementById("prodTableSort");
  if (prodSort) {
    prodSort.addEventListener("change", function () {
      prodSortOrder = this.value;
      renderProductsTable();
    });
  }

  // Table Search & Filter - Posts
  const postSearch = document.getElementById("postTableSearch");
  if (postSearch) {
    postSearch.addEventListener("input", function () {
      postSearchQuery = this.value;
      renderPostsTable();
    });
  }

  const postCatFilter = document.getElementById("postTableCategoryFilter");
  if (postCatFilter) {
    postCatFilter.addEventListener("change", function () {
      postCategoryFilter = this.value;
      renderPostsTable();
    });
  }

  // Product Form Live preview bindings
  ["prodName", "prodBrand", "prodPrice", "prodRating", "prodBadge", "prodImage"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateProductLivePreview);
  });

  // Blog Form Live preview bindings
  ["postTitle", "postCategory", "postDate", "postImage", "postExcerpt"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePostLivePreview);
  });

  // Auto-slugify post title into postSlug input
  const postTitleEl = document.getElementById("postTitle");
  const postSlugEl = document.getElementById("postSlug");
  if (postTitleEl && postSlugEl) {
    postTitleEl.addEventListener("input", function () {
      if (!editingPostId) {
        postSlugEl.value = slugify(this.value);
      }
    });
  }

  // Direct Paste & Unshorten Listener on Amazon URL form field
  const prodUrlInput = document.getElementById("prodAmazonUrl");
  if (prodUrlInput) {
    prodUrlInput.addEventListener("change", async function () {
      const val = this.value.trim();
      if (val && (/amzn\.in\/d\/|amzn\.to\/|a\.co\/|amzn\.eu\/|amzn\.asia\/|tinyurl|bit\.ly/i.test(val) || !val.includes("/dp/"))) {
        try {
          const res = await resolveAmazonShortUrl(val);
          if (res.asin) {
            this.value = `https://www.amazon.in/dp/${res.asin}/?tag=mp2tech20-21`;
            const imgEl = document.getElementById("prodImage");
            if (imgEl && (!imgEl.value || imgEl.value.includes("service.jpg"))) {
              imgEl.value = `https://images-na.ssl-images-amazon.com/images/P/${res.asin}.01.LZZZZZZZ.jpg`;
            }
            updateProductLivePreview();
            showToast(`Resolved ASIN: ${res.asin}`, "info");
          }
        } catch (e) {}
      }
    });
  }

  // 1-Tap Mobile Clipboard Paste Helper
  window.pasteFromClipboardToAiInput = async function () {
    const input = document.getElementById("aiAmazonLinkInput");
    if (!input) return;
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          input.value = text.trim();
          showToast("Pasted link from clipboard!", "info");
          input.focus();
          return;
        }
      }
      input.focus();
    } catch (e) {
      input.focus();
    }
  };

  // Direct event listeners for AI Auto-Capture buttons
  const extractBtn = document.getElementById("extractAiProdBtn");
  if (extractBtn) {
    extractBtn.addEventListener("click", extractAmazonProductWithAI);
  }
  const amazonLinkInput = document.getElementById("aiAmazonLinkInput");
  if (amazonLinkInput) {
    amazonLinkInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        extractAmazonProductWithAI();
      }
    });
  }

  const genArticleBtn = document.getElementById("generateAiPostBtn");
  if (genArticleBtn) {
    genArticleBtn.addEventListener("click", generateArticleWithAI);
  }
  const aiTopicInput = document.getElementById("aiTopicInput");
  if (aiTopicInput) {
    aiTopicInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        generateArticleWithAI();
      }
    });
  }

  // Global window bindings for inline HTML handlers
  window.editProduct = editProduct;
  window.deleteProduct = deleteProduct;
  window.saveProductFromForm = saveProductFromForm;
  window.resetProductForm = resetProductForm;
  window.toggleSelectAllProducts = toggleSelectAllProducts;
  window.toggleProductCheck = toggleProductCheck;
  window.deselectAllProducts = deselectAllProducts;
  window.bulkDeleteProducts = bulkDeleteProducts;

  window.editPost = editPost;
  window.deletePost = deletePost;
  window.savePostFromForm = savePostFromForm;
  window.resetPostForm = resetPostForm;
  window.toggleSelectAllPosts = toggleSelectAllPosts;
  window.togglePostCheck = togglePostCheck;
  window.deselectAllPosts = deselectAllPosts;
  window.bulkDeletePosts = bulkDeletePosts;
  window.copyPostDirectUrl = copyPostDirectUrl;

  window.exportDataFiles = exportDataFiles;
  window.publishDirectlyToGitHub = publishDirectlyToGitHub;
  window.mergeAndDeployToProduction = mergeAndDeployToProduction;

  // AI Blogger Window Bindings
  window.generateArticleWithAI = generateArticleWithAI;
  window.saveGeminiApiKey = saveGeminiApiKey;
  window.getGeminiApiKey = getGeminiApiKey;
  window.setAiTopic = function(topicText) {
    const input = document.getElementById("aiTopicInput");
    if (input) {
      input.value = topicText;
      input.focus();
    }
  };

  // AI Amazon Product Auto-Capture & Bulk Importer Window Bindings
  window.extractAmazonProductWithAI = extractAmazonProductWithAI;
  window.resolveAmazonShortUrl = resolveAmazonShortUrl;
  window.parseAmazonInputString = parseAmazonInputString;
  window.pasteFromClipboardToAiInput = window.pasteFromClipboardToAiInput;
  window.switchAmazonAiMode = switchAmazonAiMode;
  window.populateBulkDemo = populateBulkDemo;
  window.analyzeBulkAmazonLinksWithAI = analyzeBulkAmazonLinksWithAI;
  window.generateCategoryDiscoveryWithAI = generateCategoryDiscoveryWithAI;
  window.generateCustomDiscoveryWithAI = generateCustomDiscoveryWithAI;
  window.toggleAllBulkCandidates = toggleAllBulkCandidates;
  window.updateBulkSelectionCount = updateBulkSelectionCount;
  window.importSelectedBulkProducts = importSelectedBulkProducts;
  window.setAiAmazonLink = function(link) {
    const input = document.getElementById("aiAmazonLinkInput");
    if (input) {
      input.value = link;
      input.focus();
    }
  };
}

// Immediate Top-Level Window Exports (ensures instant availability before DOMContentLoaded)
if (typeof window !== "undefined") {
  window.extractAmazonProductWithAI = extractAmazonProductWithAI;
  window.resolveAmazonShortUrl = resolveAmazonShortUrl;
  window.parseAmazonInputString = parseAmazonInputString;
  window.generateArticleWithAI = generateArticleWithAI;
  window.saveGeminiApiKey = saveGeminiApiKey;
  window.getGeminiApiKey = getGeminiApiKey;
  window.switchAmazonAiMode = switchAmazonAiMode;
  window.populateBulkDemo = populateBulkDemo;
  window.analyzeBulkAmazonLinksWithAI = analyzeBulkAmazonLinksWithAI;
  window.generateCategoryDiscoveryWithAI = generateCategoryDiscoveryWithAI;
  window.generateCustomDiscoveryWithAI = generateCustomDiscoveryWithAI;
  window.toggleAllBulkCandidates = toggleAllBulkCandidates;
  window.updateBulkSelectionCount = updateBulkSelectionCount;
  window.importSelectedBulkProducts = importSelectedBulkProducts;
  window.pasteFromClipboardToAiInput = async function () {
    const input = document.getElementById("aiAmazonLinkInput");
    if (!input) return;
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          input.value = text.trim();
          if (window.showToast) window.showToast("Pasted link from clipboard!", "info");
          input.focus();
          return;
        }
      }
      input.focus();
    } catch (e) {
      input.focus();
    }
  };
  window.setAiAmazonLink = function(link) {
    const input = document.getElementById("aiAmazonLinkInput");
    if (input) {
      input.value = link;
      input.focus();
    }
  };
  window.setAiTopic = function(topicText) {
    const input = document.getElementById("aiTopicInput");
    if (input) {
      input.value = topicText;
      input.focus();
    }
  };
}
