/**
 * MP2TECH Admin Studio Logic
 * Handles Authentication, CRUD for Amazon Products & Blog Posts,
 * Live Preview Rendering, and One-Click GitHub Sync.
 */

// SHA-256 Hash of default password "mp2tech@2026"
const DEFAULT_PASS_HASH = "81561bfddf7c7da9c1ea49479b19e992b15ca85ec157a3e9c9c36ec3b2fa5676";
const AUTH_KEY = "mp2tech_admin_authenticated";
const GITHUB_REPO = "vimalpithadia/mp2techwebsite";

let products = [];
let posts = [];
let editingProductId = null;
let editingPostId = null;

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
  try {
    const [prodRes, postRes] = await Promise.all([
      fetch("data/affiliate-products.json"),
      fetch("data/blog-posts.json"),
    ]);

    if (prodRes.ok) products = await prodRes.json();
    if (postRes.ok) posts = await postRes.json();

    // Check if local modified state exists in session
    const localProds = sessionStorage.getItem("mp2tech_draft_products");
    const localPosts = sessionStorage.getItem("mp2tech_draft_posts");
    if (localProds) products = JSON.parse(localProds);
    if (localPosts) posts = JSON.parse(localPosts);

    updateMetrics();
    renderProductsTable();
    renderPostsTable();
    populateRelatedProductsSelect();
  } catch (err) {
    console.error("Error loading admin data:", err);
  }
}

/**
 * Update Metric Cards
 */
function updateMetrics() {
  document.getElementById("metricTotalProds").textContent = products.length;
  document.getElementById("metricTotalPosts").textContent = posts.length;
  
  const categories = new Set(products.map((p) => p.category));
  document.getElementById("metricCategories").textContent = categories.size;
}

/**
 * Save draft state to sessionStorage
 */
function saveDraftState() {
  sessionStorage.setItem("mp2tech_draft_products", JSON.stringify(products));
  sessionStorage.setItem("mp2tech_draft_posts", JSON.stringify(posts));
  updateMetrics();
}

/* ==========================================================================
   AMAZON PRODUCTS CRUD
   ========================================================================== */

export function renderProductsTable() {
  const tbody = document.getElementById("productsTableBody");
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">No products added yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = products
    .map(
      (p) => `
    <tr>
      <td><img src="${p.image}" alt="${p.name}" class="table-thumb" onerror="this.src='img/service.jpg'" /></td>
      <td><strong>${p.name}</strong><br><small style="color:#64748b;">${p.brand} &bull; ${p.category}</small></td>
      <td><span class="product-badge">${p.badge || "Verified"}</span></td>
      <td><strong>${p.priceEstimate}</strong></td>
      <td><i class="fa fa-star" style="color:#ff9900"></i> ${p.rating} (${p.reviewCount?.toLocaleString() || 0})</td>
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
  `
    )
    .join("");
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
}

export function editProduct(id) {
  const prod = products.find((p) => p.id === id);
  if (!prod) return;

  editingProductId = id;
  document.getElementById("prodName").value = prod.name;
  document.getElementById("prodCategory").value = prod.category;
  document.getElementById("prodBrand").value = prod.brand;
  document.getElementById("prodPrice").value = prod.priceEstimate.replace("₹", "");
  document.getElementById("prodRating").value = prod.rating;
  document.getElementById("prodReviews").value = prod.reviewCount || 1000;
  document.getElementById("prodBadge").value = prod.badge;
  document.getElementById("prodImage").value = prod.image;
  document.getElementById("prodAmazonUrl").value = prod.amazonUrl;
  document.getElementById("prodHighlights").value = (prod.highlights || []).join("\n");

  document.getElementById("productFormSubmitBtn").textContent = "Save Changes";
  updateProductLivePreview();

  // Scroll to form
  document.getElementById("productFormCard").scrollIntoView({ behavior: "smooth" });
}

export function deleteProduct(id) {
  if (confirm("Are you sure you want to remove this product from the catalog?")) {
    products = products.filter((p) => p.id !== id);
    saveDraftState();
    renderProductsTable();
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
   BLOG POSTS CRUD
   ========================================================================== */

export function renderPostsTable() {
  const tbody = document.getElementById("postsTableBody");
  if (!tbody) return;

  if (posts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px;">No articles added yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = posts
    .map(
      (p) => `
    <tr>
      <td><img src="${p.image}" alt="${p.title}" class="table-thumb" onerror="this.src='img/service.jpg'" /></td>
      <td><strong>${p.title}</strong><br><small style="color:#64748b;">${p.categoryName || p.category} &bull; ${p.readTime}</small></td>
      <td>${p.date}</td>
      <td><span class="product-badge">${p.relatedProductIds?.length || 0} Products Linked</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn" onclick="window.editPost(${p.id})" title="Edit Article"><i class="fa fa-pencil"></i></button>
          <button class="action-btn delete" onclick="window.deletePost(${p.id})" title="Delete Article"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

export function populateRelatedProductsSelect() {
  const select = document.getElementById("postRelatedProds");
  if (!select) return;

  select.innerHTML = products
    .map((p) => `<option value="${p.id}">${p.name} (${p.brand} - ${p.priceEstimate})</option>`)
    .join("");
}

export function savePostFromForm() {
  const title = document.getElementById("postTitle").value.trim();
  const category = document.getElementById("postCategory").value;
  const categoryName = document.getElementById("postCategory").options[document.getElementById("postCategory").selectedIndex].text;
  const date = document.getElementById("postDate").value.trim() || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const readTime = document.getElementById("postReadTime").value.trim() || "5 min read";
  const image = document.getElementById("postImage").value.trim() || "img/blog1.jpg";
  const excerpt = document.getElementById("postExcerpt").value.trim();
  const body = document.getElementById("postBody").value.trim();

  // Selected related products
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
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
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
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
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
  document.getElementById("postCategory").value = post.category;
  document.getElementById("postDate").value = post.date;
  document.getElementById("postReadTime").value = post.readTime;
  document.getElementById("postImage").value = post.image;
  document.getElementById("postExcerpt").value = post.excerpt;
  document.getElementById("postBody").value = post.body;

  // Set selected related products
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
    saveDraftState();
    renderPostsTable();
    showToast("Article deleted");
  }
}

export function resetPostForm() {
  editingPostId = null;
  document.getElementById("postForm").reset();
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
   EXPORT & GITHUB DIRECT SYNC
   ========================================================================== */

/**
 * Download updated JSON files to computer
 */
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

/**
 * Direct Publish to GitHub using Personal Access Token (PAT)
 */
export async function publishDirectlyToGitHub() {
  const tokenInput = document.getElementById("githubTokenInput");
  const branchInput = document.getElementById("githubBranchInput");
  const statusEl = document.getElementById("githubSyncStatus");

  const token = tokenInput ? tokenInput.value.trim() : "";
  const branch = branchInput ? branchInput.value.trim() : "feature";

  if (!token) {
    alert("Please enter your GitHub Personal Access Token (with 'repo' write permission).");
    return;
  }

  statusEl.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Committing changes to GitHub repo (${GITHUB_REPO} on branch '${branch}')...`;

  try {
    // 1. Commit affiliate-products.json
    await commitFileToGitHub(
      token,
      branch,
      "data/affiliate-products.json",
      JSON.stringify(products, null, 2),
      "feat(affiliate): update amazon products catalog via admin portal"
    );

    // 2. Commit blog-posts.json
    await commitFileToGitHub(
      token,
      branch,
      "data/blog-posts.json",
      JSON.stringify(posts, null, 2),
      "feat(blog): update articles via admin portal"
    );

    statusEl.innerHTML = `<span style="color:#10b981;"><i class="fa fa-check-circle"></i> Successfully published to GitHub '${branch}' branch!</span>`;
    showToast("Changes published live to GitHub repository!");
  } catch (err) {
    statusEl.innerHTML = `<span style="color:#ef4444;"><i class="fa fa-times-circle"></i> Sync failed: ${err.message}</span>`;
    showToast(`GitHub sync failed: ${err.message}`, "error");
  }
}

async function commitFileToGitHub(token, branch, path, content, message) {
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${branch}`;

  // Get current file SHA
  let currentSha = null;
  try {
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
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

  // Base64 encode content
  const base64Content = btoa(unescape(encodeURIComponent(content)));

  const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
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
    const errData = await putRes.json();
    throw new Error(errData.message || "Failed to commit file to GitHub.");
  }
}

/**
 * Initialize Admin UI Events
 */
export function initAdminStudio() {
  checkAuth();

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

  // Global window bindings for inline HTML handlers
  window.editProduct = editProduct;
  window.deleteProduct = deleteProduct;
  window.saveProductFromForm = saveProductFromForm;
  window.resetProductForm = resetProductForm;

  window.editPost = editPost;
  window.deletePost = deletePost;
  window.savePostFromForm = savePostFromForm;
  window.resetPostForm = resetPostForm;

  window.exportDataFiles = exportDataFiles;
  window.publishDirectlyToGitHub = publishDirectlyToGitHub;
}
