const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const articlesDir = path.join(rootDir, 'articles');
const blogPostsPath = path.join(rootDir, 'data', 'blog-posts.json');

if (!fs.existsSync(articlesDir)) {
  fs.mkdirSync(articlesDir, { recursive: true });
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toAbsoluteImageUrl(imgUrl) {
  if (!imgUrl) return 'https://www.mp2tech.co.in/img/blog-banner.jpg';
  if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
    return imgUrl;
  }
  const clean = imgUrl.startsWith('/') ? imgUrl.slice(1) : imgUrl;
  return `https://www.mp2tech.co.in/${clean}`;
}

function generateArticleHtml(post) {
  const title = post.title || 'Technical Diagnostic Guide | MP2TECH Mumbai';
  const excerpt = post.excerpt || 'Step-by-step laptop repair walkthroughs and hardware upgrade tutorials by MP2TECH.';
  const slug = post.slug || `post-${post.id}`;
  const imageUrl = toAbsoluteImageUrl(post.image);
  const articleUrl = `https://www.mp2tech.co.in/articles/${encodeURIComponent(slug)}.html`;
  const blogRedirectUrl = `../blog.html?post=${encodeURIComponent(slug)}`;

  return `<!DOCTYPE html>
<html lang="en-US">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    
    <!-- Primary Meta Tags -->
    <title>${escapeHtml(title)} | MP2TECH Mumbai</title>
    <meta name="title" content="${escapeHtml(title)} | MP2TECH Mumbai" />
    <meta name="description" content="${escapeHtml(excerpt)}" />
    <link rel="canonical" href="${articleUrl}" />
    <link rel="icon" href="../img/favicon.png" type="image/png" />

    <!-- Open Graph / Facebook / WhatsApp / LinkedIn -->
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="MP2TECH Mumbai" />
    <meta property="og:url" content="${articleUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(excerpt)}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />

    <!-- Twitter / X Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${articleUrl}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(excerpt)}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <!-- Instant Client-Side Redirect to Interactive Guide -->
    <meta http-equiv="refresh" content="0; url=${blogRedirectUrl}" />
    <script>
        window.location.replace("${blogRedirectUrl}");
    </script>
</head>
<body style="margin:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#0b1120; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; box-sizing:border-box;">
    <div style="max-width:640px; width:100%; background:#111a2e; border:1px solid #1e293b; border-radius:16px; padding:32px 24px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.5);">
        <img src="${imageUrl}" alt="${escapeHtml(title)}" style="width:100%; max-height:300px; object-fit:cover; border-radius:10px; margin-bottom:20px;" onerror="this.src='../img/service.jpg'" />
        <span style="display:inline-block; padding:4px 12px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:20px; font-size:12px; font-weight:700; margin-bottom:12px; text-transform:uppercase;">${escapeHtml(post.categoryName || post.category || 'Guide')}</span>
        <h1 style="font-size:22px; line-height:1.4; color:#ffffff; margin:0 0 14px 0; font-weight:800;">${escapeHtml(title)}</h1>
        <p style="font-size:14px; line-height:1.6; color:#94a3b8; margin:0 0 24px 0;">${escapeHtml(excerpt)}</p>
        <a href="${blogRedirectUrl}" style="display:inline-block; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color:#ffffff; font-weight:700; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:15px; box-shadow:0 4px 14px rgba(2,132,199,0.4);">
            Read Full Interactive Guide &rarr;
        </a>
    </div>
</body>
</html>`;
}

try {
  const postsRaw = fs.readFileSync(blogPostsPath, 'utf8');
  const posts = JSON.parse(postsRaw);
  
  if (Array.isArray(posts)) {
    posts.forEach((post) => {
      const slug = post.slug || `post-${post.id}`;
      const filePath = path.join(articlesDir, `${slug}.html`);
      const html = generateArticleHtml(post);
      fs.writeFileSync(filePath, html, 'utf8');
      console.log(`Generated: articles/${slug}.html`);
    });
    console.log(`Successfully generated ${posts.length} static article pages with Open Graph tags!`);
  }
} catch (err) {
  console.error('Error generating article pages:', err);
}
