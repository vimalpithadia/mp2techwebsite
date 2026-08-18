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
 * Load initial datasets from JSON files
 */
export async function loadData() {
  const localProds = sessionStorage.getItem("mp2tech_draft_products");
  const localPosts = sessionStorage.getItem("mp2tech_draft_posts");
  if (localProds) {
    products = JSON.parse(localProds);
    hasUnpublishedChanges = true;
  }
  if (localPosts) {
    posts = JSON.parse(localPosts);
    hasUnpublishedChanges = true;
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
      if (Array.isArray(p) && p.length > 0 && !localProds) products = p;
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

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selectedProductIds.has(p.id));
  const selectAllBox = document.getElementById("selectAllProds");
  if (selectAllBox) {
    selectAllBox.checked = allVisibleSelected;
  }

  tbody.innerHTML = filtered
    .map((p) => {
      const isChecked = selectedProductIds.has(p.id);
      return `
        <tr class="${isChecked ? "selected" : ""}">
          <td style="width: 40px; text-align: center;">
            <input type="checkbox" class="admin-checkbox prod-checkbox" value="${p.id}" ${isChecked ? "checked" : ""} onchange="window.toggleProductCheck('${p.id}', this.checked)" />
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
              <button class="action-btn" onclick="window.editProduct('${p.id}')" title="Edit Product"><i class="fa fa-pencil"></i></button>
              <button class="action-btn delete" onclick="window.deleteProduct('${p.id}')" title="Delete Product"><i class="fa fa-trash"></i></button>
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
    filtered.forEach((p) => selectedProductIds.add(p.id));
  } else {
    filtered.forEach((p) => selectedProductIds.delete(p.id));
  }
  renderProductsTable();
}

export function toggleProductCheck(id, checked) {
  if (checked) {
    selectedProductIds.add(id);
  } else {
    selectedProductIds.delete(id);
  }
  renderProductsTable();
}

export function deselectAllProducts() {
  selectedProductIds.clear();
  renderProductsTable();
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
    products = products.filter((p) => !selectedProductIds.has(p.id));
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

  if (editingProductId) {
    const idx = products.findIndex((p) => p.id === editingProductId);
    if (idx !== -1) {
      products[idx] = {
        id: editingProductId,
        name,
        category,
        brand,
        priceEstimate: price.startsWith("₹") ? price : `₹${price}`,
        rating,
        reviewCount: reviews,
        badge,
        image,
        amazonUrl,
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
      amazonUrl,
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
  const prod = products.find((p) => p.id === id);
  if (!prod) return;

  editingProductId = id;
  document.getElementById("prodName").value = prod.name;
  document.getElementById("prodCategory").value = prod.category;
  document.getElementById("prodBrand").value = prod.brand || "";
  document.getElementById("prodPrice").value = (prod.priceEstimate || "").replace("₹", "");
  document.getElementById("prodRating").value = prod.rating;
  document.getElementById("prodReviews").value = prod.reviewCount || 1000;
  document.getElementById("prodBadge").value = prod.badge || "Technician Verified";
  document.getElementById("prodImage").value = prod.image || "";
  document.getElementById("prodAmazonUrl").value = prod.amazonUrl || "";
  document.getElementById("prodHighlights").value = (prod.highlights || []).join("\n");

  document.getElementById("productFormSubmitBtn").textContent = "Save Changes";
  updateProductLivePreview();

  document.getElementById("productFormCard").scrollIntoView({ behavior: "smooth" });
}

export function deleteProduct(id) {
  if (confirm("Are you sure you want to remove this product from the catalog?")) {
    products = products.filter((p) => p.id !== id);
    selectedProductIds.delete(id);
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
  const url = `https://www.mp2tech.co.in/blog.html?post=${encodeURIComponent(slugOrId)}`;
  navigator.clipboard
    .writeText(url)
    .then(() => {
      showToast(`Copied direct share link to clipboard!`);
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
      const shareUrl = `https://www.mp2tech.co.in/blog.html?post=${encodeURIComponent(postSlug)}`;
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

    hasUnpublishedChanges = false;
    sessionStorage.removeItem("mp2tech_draft_products");
    sessionStorage.removeItem("mp2tech_draft_posts");
    updateDraftBanner();

    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:rgba(16, 185, 129, 0.15); border:1px solid #10b981; padding:10px 14px; border-radius:8px; color:#34d399; margin-top:10px;">
          <i class="fa fa-check-circle"></i> Successfully published to GitHub '<strong>${branch}</strong>' branch!
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
        <span style="font-size:12.5px; color:#cbd5e1;">Syncing data catalog across 'feature', 'dev', and 'main' branches...</span>
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
// AI Auto-Blogger Engine (Powered by Google Gemini AI)
// --------------------------------------------------------------------------
const GEMINI_KEY_STORAGE = "mp2tech_gemini_api_key";

export function getGeminiApiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || "";
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

  let apiKey = getGeminiApiKey();
  if (!apiKey) {
    const enteredKey = prompt("Please enter your Google Gemini API Key to enable AI Auto-Blogging (It will be saved privately in your browser):");
    if (enteredKey && enteredKey.trim()) {
      apiKey = enteredKey.trim();
      localStorage.setItem(GEMINI_KEY_STORAGE, apiKey);
      const keyInput = document.getElementById("geminiApiKeyInput");
      if (keyInput) keyInput.value = apiKey;
    } else {
      if (feedback) {
        feedback.className = "ai-feedback-box error";
        feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Gemini API Key is required. Please set it in the Settings tab.';
        feedback.style.display = "flex";
      }
      return;
    }
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
    "models/gemini-3.5-flash-lite",
    "models/gemini-flash-lite-latest",
    "models/gemini-2.5-flash"
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
 * 1-Click AI Amazon Product Auto-Capture using Gemini AI
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
      feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Please paste an Amazon product link or product title first.';
      feedback.style.display = "flex";
    }
    input.focus();
    return;
  }

  let apiKey = getGeminiApiKey();
  if (!apiKey) {
    const enteredKey = prompt("Please enter your Google Gemini API Key to enable AI Auto-Capture (Saved privately in your browser):");
    if (enteredKey && enteredKey.trim()) {
      apiKey = enteredKey.trim();
      localStorage.setItem(GEMINI_KEY_STORAGE, apiKey);
      const keyInput = document.getElementById("geminiApiKeyInput");
      if (keyInput) keyInput.value = apiKey;
    } else {
      if (feedback) {
        feedback.className = "ai-feedback-box error";
        feedback.innerHTML = '<i class="fa fa-exclamation-circle"></i> Gemini API Key is required. Please set it in Settings.';
        feedback.style.display = "flex";
      }
      return;
    }
  }

  // Extract ASIN if available in URL
  const asinMatch = rawInput.match(/(?:dp|gp\/product|d|asin)\/([A-Z0-9]{10})/i) || rawInput.match(/\b([B0-9][A-Z0-9]{9})\b/i);
  const detectedAsin = asinMatch ? asinMatch[1].toUpperCase() : null;

  // Build clean Affiliate URL with tag=mp2tech-21
  let affiliateUrl = rawInput;
  if (detectedAsin) {
    affiliateUrl = `https://www.amazon.in/dp/${detectedAsin}/?tag=mp2tech-21`;
  } else if (rawInput.startsWith("http") && !rawInput.includes("tag=")) {
    affiliateUrl = rawInput.includes("?") ? `${rawInput}&tag=mp2tech-21` : `${rawInput}?tag=mp2tech-21`;
  }

  // UI Loading State
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Extracting Specs & Formats...';
  }
  if (feedback) {
    feedback.className = "ai-feedback-box";
    feedback.style.display = "flex";
    feedback.style.background = "rgba(245, 158, 11, 0.12)";
    feedback.style.color = "#fbbf24";
    feedback.style.border = "1px solid rgba(245, 158, 11, 0.25)";
    feedback.innerHTML = '<i class="fa fa-cog fa-spin"></i> Gemini AI is parsing hardware specifications, category, rating, and benchmark highlights...';
  }

  const systemPrompt = `You are a professional PC hardware technician and Amazon product data parser for MP2TECH Store Mumbai.
Given the following Amazon product link, ASIN, or product title:
"${rawInput}"

Extract, standardize, and format the product data for an Indian tech store catalog in JSON format.
Category must be exactly one of: "storage", "ram", "cooling", "tools", "accessories".
Price must be estimated in Indian Rupees (INR) as a clean formatted string without the rupee symbol (e.g. "2,499", "9,890", "1,249").

Respond ONLY with a single valid JSON object (no markdown backticks, no extra text):
{
  "name": "Clean, authoritative, concise product title (50-80 chars, Sentence case)",
  "brand": "Brand Name (e.g. Samsung, Crucial, Corsair, Noctua, iFixit, Kingston)",
  "category": "storage",
  "price": "2,499",
  "rating": 4.6,
  "reviews": 18500,
  "badge": "Technician Verified Upgrade",
  "highlights": [
    "Up to 7,450 MB/s Sequential Read Speed",
    "Custom Nickel-Coated Controller for thermal stability",
    "DirectStorage & PS5 Compatible"
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
    "models/gemini-3.5-flash-lite",
    "models/gemini-flash-lite-latest",
    "models/gemini-2.5-flash"
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

    // Populate Product Form Fields
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

    if (nameEl) nameEl.value = data.name || rawInput;
    if (brandEl) brandEl.value = data.brand || "Verified Brand";
    if (catEl) catEl.value = data.category || "storage";
    if (priceEl) priceEl.value = data.price || "2,499";
    if (ratingEl) ratingEl.value = data.rating || 4.6;
    if (reviewsEl) reviewsEl.value = data.reviews || 1500;
    if (badgeEl) badgeEl.value = data.badge || "Technician Verified";
    if (urlEl) urlEl.value = affiliateUrl;

    // Direct Amazon ASIN Image or fallback curated hardware image
    let productImgUrl = "";
    if (detectedAsin) {
      productImgUrl = `https://images-na.ssl-images-amazon.com/images/P/${detectedAsin}.01.LZZZZZZZ.jpg`;
    } else {
      productImgUrl = getCuratedPhotoForTopic(data.category || "storage", data.brand || "", data.name || "");
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
      feedback.innerHTML = '<i class="fa fa-check-circle"></i> <strong>Product Captured!</strong> Review specs below and click "Add Product to Catalog".';
      feedback.style.display = "flex";
    }

    showToast("🛒 Amazon Product details captured!", "success");

    // Smooth scroll to product form
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
  window.setAiTopic = function(topicText) {
    const input = document.getElementById("aiTopicInput");
    if (input) {
      input.value = topicText;
      input.focus();
    }
  };

  // AI Amazon Product Auto-Capture Window Bindings
  window.extractAmazonProductWithAI = extractAmazonProductWithAI;
  window.setAiAmazonLink = function(link) {
    const input = document.getElementById("aiAmazonLinkInput");
    if (input) {
      input.value = link;
      input.focus();
    }
  };
}
