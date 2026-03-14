/* ═══════════════════════════════════════════════
   BLOG SECTION — blog.js
   Handles the blog section in index.ejs
═══════════════════════════════════════════════ */

(function () {
    'use strict';

    const BLOG_API_BASE = 'https://shri-brand.onrender.com/api/v1/blogs';
    const BLOG_PER_PAGE = 4;
    const BLOG_FETCH_TIMEOUT = 12000;

    /* ── STATE ── */
    let blogFeaturedPosts = [];
    let blogCurrentPage = 1;
    let blogTotalPosts = 0;
    let blogTotalPages = 1;
    let blogSearchQuery = '';
    let blogIsLoading = false;
    let blogSearchTimer = null;
    let blogFeatIdx = 0;
    let blogFeatAutoTimer = null;

    /* ═══════════════════════════════════════════════
       FETCH HELPER
    ═══════════════════════════════════════════════ */
    class BlogApiError extends Error {
        constructor(message, status) {
            super(message);
            this.name = 'BlogApiError';
            this.status = status;
        }
    }

    async function blogApiFetch(url, retries = 2) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), BLOG_FETCH_TIMEOUT);
                const resp = await fetch(url, { signal: controller.signal });
                clearTimeout(timer);
                if (!resp.ok) {
                    const body = await resp.json().catch(() => ({}));
                    const msg = body.message || `Server error (${resp.status})`;
                    throw new BlogApiError(msg, resp.status);
                }
                return await resp.json();
            } catch (err) {
                if (err instanceof BlogApiError) throw err;
                if (err.name === 'AbortError') {
                    if (attempt < retries) continue;
                    throw new BlogApiError('Request timed out. Please check your connection.', 0);
                }
                if (attempt < retries) continue;
                if (!navigator.onLine) {
                    throw new BlogApiError('You appear to be offline. Please check your internet connection.', 0);
                }
                throw new BlogApiError('Unable to connect to the server. Please try again later.', 0);
            }
        }
    }

    /* ═══════════════════════════════════════════════
       HELPERS
    ═══════════════════════════════════════════════ */
    const BLOG_CAT_LABELS = {
        'traditions': 'Traditions',
        'artisan-crafts': 'Artisan Crafts',
        'festivals': 'Festivals',
        'wellness': 'Wellness',
        'community': 'Community',
        'sacred-recipes': 'Sacred Recipes'
    };

    function blogCatLabel(slug) {
        return BLOG_CAT_LABELS[slug] || slug || 'Uncategorised';
    }

    function blogFormatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function blogGetExcerpt(post) {
        if (post.subtitle) return post.subtitle;
        const txt = (post.search_text || post.rendered_html || '').replace(/<[^>]+>/g, '').trim();
        return txt.length > 150 ? txt.slice(0, 147) + '…' : txt;
    }

    function blogGetCoverImg(post) {
        if (post.coverImage && post.coverImage.url) return post.coverImage.url;
        const imgBlock = (post.blocks || []).find(b => b.type === 'image' && b.url);
        return imgBlock ? imgBlock.url : 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=500&q=80';
    }

    function blogHighlight(text, query) {
        if (!query || !text) return text || '';
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
    }

    /* ═══════════════════════════════════════════════
       LOADING SKELETONS
    ═══════════════════════════════════════════════ */
    function blogShowFeaturedSkeleton() {
        const strip = document.getElementById('blogFeatStrip');
        if (!strip) return;
        strip.innerHTML = `<article class="blog-featured" style="opacity:.5;pointer-events:none">
        <div class="blog-feat-img" style="background:#f9f5eb;display:flex;align-items:center;justify-content:center;color:#e5e7eb"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i></div>
        <div class="blog-feat-body" style="justify-content:center;text-align:center"><p style="color:#6b7280">Loading featured stories…</p></div>
      </article>`;
        const dots = document.getElementById('blogFeatDots');
        if (dots) dots.innerHTML = '';
    }

    function blogShowGridSkeleton() {
        const grid = document.getElementById('blogPostsGrid');
        if (!grid) return;
        const noResults = document.getElementById('blogNoResults');
        if (noResults) noResults.classList.remove('visible');
        Array.from(grid.children).forEach(c => { if (c !== noResults) c.remove(); });
        for (let i = 0; i < BLOG_PER_PAGE; i++) {
            const el = document.createElement('article');
            el.className = 'blog-post-card';
            el.style.opacity = '0.45';
            el.style.pointerEvents = 'none';
            el.innerHTML = `
          <div class="blog-card-img" style="background:#f9f5eb;display:flex;align-items:center;justify-content:center;aspect-ratio:16/10">
            <i class="fas fa-image" style="font-size:1.5rem;color:#e5e7eb"></i>
          </div>
          <div class="blog-card-body">
            <div style="height:12px;width:60%;background:#f9f5eb;border-radius:4px;margin-bottom:8px"></div>
            <div style="height:10px;width:90%;background:#f9f5eb;border-radius:4px;margin-bottom:6px"></div>
            <div style="height:10px;width:75%;background:#f9f5eb;border-radius:4px"></div>
          </div>`;
            grid.appendChild(el);
        }
    }

    /* ═══════════════════════════════════════════════
       ERROR BANNERS
    ═══════════════════════════════════════════════ */
    function blogShowFeaturedError(msg) {
        const strip = document.getElementById('blogFeatStrip');
        if (!strip) return;
        strip.innerHTML = `<article class="blog-featured" style="display:flex;align-items:center;justify-content:center;text-align:center;flex-direction:column;gap:12px;width:100%">
        <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#e6ac00"></i>
        <p style="font-size:.9rem;color:#4b5563">${msg}</p>
        <button onclick="window.__blogLoadFeatured()" style="padding:8px 20px;background:#7f0403;color:white;border:none;border-radius:50px;font-family:Inter,sans-serif;font-size:.75rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">
          <i class="fas fa-redo"></i> Try Again
        </button>
      </article>`;
        const dots = document.getElementById('blogFeatDots');
        if (dots) dots.innerHTML = '';
    }

    function blogShowGridError(msg) {
        const grid = document.getElementById('blogPostsGrid');
        if (!grid) return;
        const noResults = document.getElementById('blogNoResults');
        Array.from(grid.children).forEach(c => { if (c !== noResults) c.remove(); });
        if (noResults) noResults.classList.remove('visible');
        const el = document.createElement('div');
        el.style.cssText = 'grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;gap:12px';
        el.innerHTML = `
        <i class="fas fa-exclamation-circle" style="font-size:2rem;color:#e6ac00"></i>
        <h4 style="font-family:'Playfair Display',serif;font-size:1.05rem;color:#4b5563">${msg}</h4>
        <button onclick="window.__blogFetchPosts()" style="padding:8px 20px;background:#7f0403;color:white;border:none;border-radius:50px;font-family:Inter,sans-serif;font-size:.75rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;margin-top:4px">
          <i class="fas fa-redo"></i> Retry
        </button>`;
        grid.appendChild(el);
        const pw = document.getElementById('blogPaginationWrap');
        if (pw) pw.style.display = 'none';
    }

    /* ═══════════════════════════════════════════════
       FEATURED SLIDER
    ═══════════════════════════════════════════════ */
    async function blogLoadFeaturedPosts() {
        blogShowFeaturedSkeleton();
        try {
            const data = await blogApiFetch(`${BLOG_API_BASE}?featured=true&limit=6&sortBy=publishDate&order=desc`);
            if (!data || !data.data || !data.data.posts) {
                throw new BlogApiError('Invalid response from server', 0);
            }
            blogFeaturedPosts = data.data.posts;
            if (blogFeaturedPosts.length === 0) {
                blogShowFeaturedError('No featured stories yet. Check back soon!');
                return;
            }
            blogBuildFeatSlides();
            blogResetFeatAuto();
        } catch (err) {
            console.error('Failed to load featured blog posts:', err);
            blogShowFeaturedError(err.message || 'Could not load featured stories.');
        }
    }

    function blogBuildFeatSlides() {
        const strip = document.getElementById('blogFeatStrip');
        const dots = document.getElementById('blogFeatDots');
        if (!strip || !dots) return;
        strip.innerHTML = dots.innerHTML = '';
        blogFeatIdx = 0;

        blogFeaturedPosts.forEach((f, i) => {
            const img = blogGetCoverImg(f);
            const date = blogFormatDate(f.publishDate);
            const tags = (f.tags && f.tags.length) ? f.tags : [blogCatLabel(f.category)];
            const excerpt = blogGetExcerpt(f);

            const slide = document.createElement('article');
            slide.className = 'blog-featured';
            slide.innerHTML = `
          <span class="blog-feat-badge">✦ Featured ${i + 1} / ${blogFeaturedPosts.length}</span>
          <div class="blog-feat-img">
            <img src="${img}" alt="${f.title}" loading="${i === 0 ? 'eager' : 'lazy'}" />
            <div class="blog-feat-veil"></div>
          </div>
          <div class="blog-feat-body">
            <div class="blog-feat-tags">${tags.map(t => `<span class="blog-feat-tag">${t}</span>`).join('')}</div>
            <h3>${f.title}</h3>
            <p>${excerpt.slice(0, 160)}${excerpt.length > 160 ? '…' : ''}</p>
            <div class="blog-feat-meta-row">
              <span class="blog-feat-meta-item"><i class="fas fa-calendar-alt"></i> ${date}</span>
              <span class="blog-feat-meta-item"><i class="fas fa-user"></i> ${f.author || 'Staff'}</span>
              <span class="blog-feat-meta-item"><i class="fas fa-clock"></i> ${f.readTime || '—'}</span>
            </div>
            <a href="/blog" class="blog-read-btn">Read Full Story <i class="fas fa-arrow-right"></i></a>
          </div>`;
            strip.appendChild(slide);

            const dot = document.createElement('button');
            dot.className = 'blog-feat-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Go to featured story ${i + 1}`);
            dot.addEventListener('click', () => blogGoFeat(i));
            dots.appendChild(dot);
        });
    }

    function blogGoFeat(idx) {
        if (!blogFeaturedPosts.length) return;
        blogFeatIdx = (idx + blogFeaturedPosts.length) % blogFeaturedPosts.length;
        const strip = document.getElementById('blogFeatStrip');
        if (strip) strip.style.transform = `translateX(-${blogFeatIdx * 100}%)`;
        document.querySelectorAll('.blog-feat-dot').forEach((d, i) => d.classList.toggle('active', i === blogFeatIdx));
        blogResetFeatAuto();
    }

    function blogResetFeatAuto() {
        clearInterval(blogFeatAutoTimer);
        if (blogFeaturedPosts.length > 1) {
            blogFeatAutoTimer = setInterval(() => blogGoFeat(blogFeatIdx + 1), 5500);
        }
    }

    /* ═══════════════════════════════════════════════
       POSTS GRID
    ═══════════════════════════════════════════════ */
    async function blogFetchPosts() {
        if (blogIsLoading) return;
        blogIsLoading = true;
        blogShowGridSkeleton();
        try {
            let url;
            if (blogSearchQuery) {
                if (blogSearchQuery.length < 2) {
                    blogIsLoading = false;
                    blogRenderGrid([]);
                    blogRenderPagination({ total: 0, totalPages: 1, currentPage: 1 });
                    return;
                }
                url = `${BLOG_API_BASE}?search=${encodeURIComponent(blogSearchQuery)}&limit=${BLOG_PER_PAGE}`;
            } else {
                url = `${BLOG_API_BASE}?page=${blogCurrentPage}&limit=${BLOG_PER_PAGE}&sortBy=publishDate&order=desc`;
            }
            const data = await blogApiFetch(url);
            if (!data || !data.data || !data.data.posts) {
                throw new BlogApiError('Invalid response from server', 0);
            }
            const posts = data.data.posts;
            if (data.pagination) {
                blogTotalPosts = data.pagination.total;
                blogTotalPages = data.pagination.totalPages;
            } else {
                blogTotalPosts = posts.length;
                blogTotalPages = 1;
            }
            blogRenderGrid(posts);
            blogRenderPagination(data.pagination || { total: posts.length, totalPages: 1, currentPage: 1 });
        } catch (err) {
            console.error('Failed to load blog posts:', err);
            blogShowGridError(err.message || 'Could not load stories.');
        } finally {
            blogIsLoading = false;
        }
    }

    /* ── RENDER GRID ── */
    function blogRenderGrid(posts) {
        const grid = document.getElementById('blogPostsGrid');
        if (!grid) return;
        const noResults = document.getElementById('blogNoResults');
        Array.from(grid.children).forEach(c => { if (c !== noResults) c.remove(); });

        if (!posts || posts.length === 0) {
            if (noResults) noResults.classList.add('visible');
            const pw = document.getElementById('blogPaginationWrap');
            if (pw) pw.style.display = 'none';
            return;
        }
        if (noResults) noResults.classList.remove('visible');
        const pw = document.getElementById('blogPaginationWrap');
        if (pw) pw.style.display = '';

        posts.forEach((p, i) => {
            const img = blogGetCoverImg(p);
            const date = blogFormatDate(p.publishDate);
            const tags = (p.tags && p.tags.length) ? p.tags : [blogCatLabel(p.category)];
            const excerpt = blogGetExcerpt(p);
            const time = p.readTime || `${Math.max(1, Math.ceil((p.stats?.wordCount || 0) / 220))} min`;

            const el = document.createElement('article');
            el.className = 'blog-post-card';
            el.style.animationDelay = `${i * 0.07}s`;
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => { window.location.href = '/blog'; });

            const titleHl = blogHighlight(p.title, blogSearchQuery);
            const excerptHl = blogHighlight(excerpt, blogSearchQuery);

            el.innerHTML = `
          <div class="blog-card-img">
            <img src="${img}" alt="${p.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=500&q=80'" />
            <span class="blog-card-time"><i class="fas fa-clock"></i> ${time}</span>
          </div>
          <div class="blog-card-body">
            <div class="blog-card-tags">${tags.map(t => `<span class="blog-card-tag">${blogHighlight(t, blogSearchQuery)}</span>`).join('')}</div>
            <h4>${titleHl}</h4>
            <p>${excerptHl}</p>
            <div class="blog-card-foot">
              <span class="blog-card-meta-item"><i class="fas fa-calendar-alt"></i> ${date}</span>
              <span class="blog-card-meta-item"><i class="fas fa-user"></i> ${p.author || 'Staff'}</span>
              <span class="blog-card-meta-item" style="border-right:none;margin-left:auto;padding-right:0;"><i class="fas fa-clock"></i> ${time}</span>
            </div>
          </div>`;
            grid.appendChild(el);
        });
    }

    /* ── RENDER PAGINATION ── */
    function blogRenderPagination(pagination) {
        if (!pagination) pagination = { total: 0, totalPages: 1, currentPage: 1 };
        const total = pagination.totalPages || 1;
        const tPosts = pagination.total || 0;
        const start = tPosts > 0 ? (blogCurrentPage - 1) * BLOG_PER_PAGE + 1 : 0;
        const end = Math.min(blogCurrentPage * BLOG_PER_PAGE, tPosts);

        const infoText = document.getElementById('blogPgInfoText');
        const infoPage = document.getElementById('blogPgInfoPage');
        const pgPrev = document.getElementById('blogPgPrev');
        const pgNext = document.getElementById('blogPgNext');
        const numsEl = document.getElementById('blogPgNumbers');

        if (infoText) infoText.textContent = tPosts > 0
            ? `Showing ${start}–${end} of ${tPosts} ${blogSearchQuery ? 'result' + (tPosts !== 1 ? 's' : '') : 'stories'}`
            : (blogSearchQuery ? 'No results found' : 'No stories yet');
        if (infoPage) infoPage.textContent = `Page ${blogCurrentPage} of ${total}`;
        if (pgPrev) pgPrev.disabled = blogCurrentPage <= 1;
        if (pgNext) pgNext.disabled = blogCurrentPage >= total;

        if (!numsEl) return;
        numsEl.innerHTML = '';
        const makeNum = n => {
            const b = document.createElement('button');
            b.className = 'blog-pg-num' + (n === blogCurrentPage ? ' active' : '');
            b.textContent = n;
            b.addEventListener('click', () => blogGoToPage(n));
            return b;
        };
        const makeEllipsis = () => {
            const s = document.createElement('span');
            s.className = 'blog-pg-ellipsis'; s.textContent = '···'; return s;
        };
        if (total <= 5) {
            for (let i = 1; i <= total; i++) numsEl.appendChild(makeNum(i));
        } else {
            const pages = [...new Set([1, total, blogCurrentPage, blogCurrentPage - 1, blogCurrentPage + 1].filter(p => p >= 1 && p <= total))].sort((a, b) => a - b);
            pages.forEach((p, idx) => {
                if (idx > 0 && p - pages[idx - 1] > 1) numsEl.appendChild(makeEllipsis());
                numsEl.appendChild(makeNum(p));
            });
        }
    }

    function blogGoToPage(n) {
        if (n < 1 || n > blogTotalPages || n === blogCurrentPage) return;
        blogCurrentPage = n;
        blogFetchPosts();
        const secHead = document.getElementById('blogSecHead');
        if (secHead) secHead.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ═══════════════════════════════════════════════
       INIT
    ═══════════════════════════════════════════════ */
    function blogInit() {
        // Expose retry handlers
        window.__blogLoadFeatured = blogLoadFeaturedPosts;
        window.__blogFetchPosts = blogFetchPosts;

        // Featured slider arrows
        const featPrev = document.getElementById('blogFeatPrev');
        const featNext = document.getElementById('blogFeatNext');
        if (featPrev) featPrev.addEventListener('click', () => blogGoFeat(blogFeatIdx - 1));
        if (featNext) featNext.addEventListener('click', () => blogGoFeat(blogFeatIdx + 1));

        // Touch swipe for featured slider
        const viewport = document.querySelector('.blog-feat-viewport');
        if (viewport) {
            let touchStartX = 0;
            viewport.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
            viewport.addEventListener('touchend', e => {
                const dx = e.changedTouches[0].clientX - touchStartX;
                if (Math.abs(dx) > 40) blogGoFeat(dx < 0 ? blogFeatIdx + 1 : blogFeatIdx - 1);
            });
        }

        // Search
        const searchInput = document.getElementById('blogSearchInput');
        const searchClear = document.getElementById('blogSearchClear');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const val = searchInput.value.trim();
                if (searchClear) searchClear.classList.toggle('visible', val.length > 0);
                clearTimeout(blogSearchTimer);
                blogSearchTimer = setTimeout(() => {
                    blogSearchQuery = val.toLowerCase();
                    blogCurrentPage = 1;
                    blogFetchPosts();
                }, 350);
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                blogSearchQuery = '';
                searchClear.classList.remove('visible');
                blogCurrentPage = 1;
                clearTimeout(blogSearchTimer);
                blogFetchPosts();
                if (searchInput) searchInput.focus();
            });
        }

        // Pagination buttons
        const pgPrev = document.getElementById('blogPgPrev');
        const pgNext = document.getElementById('blogPgNext');
        if (pgPrev) pgPrev.addEventListener('click', () => blogGoToPage(blogCurrentPage - 1));
        if (pgNext) pgNext.addEventListener('click', () => blogGoToPage(blogCurrentPage + 1));

        // Fetch data
        blogLoadFeaturedPosts();
        blogFetchPosts();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', blogInit);
    } else {
        blogInit();
    }
})();
