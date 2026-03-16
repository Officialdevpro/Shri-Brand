/* ══════════════════════════════════════════════════
   BLOG PAGE — JS
   Extracted from ablog.html for Admin SPA
   ══════════════════════════════════════════════════ */
"use strict";

/* ── STATE ──────────────────────────────────────── */
const BLOG_API = "https://shri-brand.onrender.com/api/v1/blogs";
let blogAllPosts = [];
let blogFilteredPosts = [];
let blogPendingDeleteId = null;
const blogCommentCache = {};

/* ── API HELPER ─────────────────────────────────── */
async function blogApiFetch(url, opts = {}) {
  opts.headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  opts.credentials = "include";
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.message || json.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/* ── COMMENT DATA MAPPER ────────────────────────── */
function blogMapComment(c) {
  const authorName = c.author?.name || "User";
  const initials = authorName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dateStr = c.createdAt
    ? new Date(c.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
  return {
    id: c._id,
    user: authorName,
    initials,
    date: dateStr,
    text: c.body,
    hidden: !!c.isHidden,
    adminHearted: !!c.adminHearted,
    adminReply: c.adminReply?.body || null,
    adminReplyDate: c.adminReply?.repliedAt || null,
    isAdmin: false,
    likes: c.adminHearted ? 1 : 0,
  };
}

/* ── LOAD BLOG (called by SPA navigate) ─────────── */
function loadBlog() {
  blogFetchPosts();
}

/* ── FETCH & BOOT ───────────────────────────────── */
async function blogFetchPosts() {
  const grid = document.getElementById("blogGrid");
  if (!grid) return;
  grid.innerHTML = `<div class="blog-loading-wrap">
    <div class="blog-loading-orn">
      <div class="blog-loading-orn-dot"></div>
      <div class="blog-loading-orn-dot"></div>
      <div class="blog-loading-orn-dot"></div>
    </div>
    <p style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-faint,#aa9988)">Fetching posts…</p>
  </div>`;
  try {
    const res = await fetch(BLOG_API);
    if (!res.ok) throw new Error();
    const json = await res.json();
    blogAllPosts = json.data?.posts || [];
    blogBootUI();
  } catch (e) {
    blogRenderError();
  }
}

function blogBootUI() {
  blogFilteredPosts = [...blogAllPosts];
  blogRenderCards(blogFilteredPosts);
  const el = (id) => document.getElementById(id);
  el("blogSidebarCount") &&
    (el("blogSidebarCount").textContent = blogAllPosts.length);
  el("blogTotalCount") &&
    (el("blogTotalCount").textContent = blogAllPosts.length);
  const now = new Date();
  el("blogFutureCount") &&
    (el("blogFutureCount").textContent = blogAllPosts.filter(
      (p) => p.publishDate && new Date(p.publishDate) > now,
    ).length);
}

/* ── SEARCH ──────────────────────────────────────── */
let blogSearchTimer;
function blogHandleSearch(inp) {
  const q = inp.value.trim();
  const btn = document.getElementById("blogSearchClear");
  if (btn) btn.classList.toggle("visible", q.length > 0);
  clearTimeout(blogSearchTimer);
  blogSearchTimer = setTimeout(() => blogDoSearch(q), 180);
}

function blogDoSearch(q) {
  if (!q) {
    blogFilteredPosts = blogAllPosts;
    blogRenderCards(blogFilteredPosts);
    return;
  }
  const ql = q.toLowerCase();
  blogFilteredPosts = blogAllPosts.filter(
    (p) =>
      (p.title || "").toLowerCase().includes(ql) ||
      (p.subtitle || "").toLowerCase().includes(ql) ||
      (p.author || "").toLowerCase().includes(ql) ||
      (p.category || "").toLowerCase().includes(ql) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(ql)),
  );
  blogRenderCards(blogFilteredPosts);
}

function blogClearSearch() {
  const inp = document.getElementById("blogSearchInput");
  const btn = document.getElementById("blogSearchClear");
  if (inp) inp.value = "";
  if (btn) btn.classList.remove("visible");
  blogFilteredPosts = [...blogAllPosts];
  blogRenderCards(blogFilteredPosts);
}

/* ── SORT ────────────────────────────────────────── */
function blogSortCards(val) {
  const arr = [...blogFilteredPosts];
  if (val === "newest")
    arr.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
  if (val === "oldest")
    arr.sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate));
  if (val === "title")
    arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  if (val === "words")
    arr.sort((a, b) => (b.stats?.wordCount || 0) - (a.stats?.wordCount || 0));
  blogFilteredPosts = arr;
  blogRenderCards(blogFilteredPosts);
}

/* ── RENDER CARDS ────────────────────────────────── */
function blogRenderCards(posts) {
  const grid = document.getElementById("blogGrid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!posts.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
      <h3>No Posts Found</h3>
      <p>Try adjusting your search or filter criteria, or create a new blog post.</p>
      <button class="b-btn" onclick="blogClearSearch()" style="margin:12px auto 0;padding:10px 22px;background:var(--crimson,#7f0403);color:#fff;border:none;font-size:12px;letter-spacing:0.08em;text-transform:uppercase"><i class="fa-solid fa-rotate-left"></i> Clear Search</button>
    </div>`;
    return;
  }
  posts.forEach((post, i) => {
    grid.appendChild(blogBuildCard(post, i));
    if ((i + 1) % 3 === 0 && i + 1 < posts.length) {
      const div = document.createElement("div");
      div.className = "blog-row-divider";
      div.innerHTML = `<div class="blog-row-div-line"></div><div class="blog-row-div-diamond"></div><div class="blog-row-div-line"></div>`;
      grid.appendChild(div);
    }
  });
}

function blogBuildCard(post, i) {
  const el = document.createElement("div");
  el.className = "b-card";
  el.style.animationDelay = `${i * 0.06}s`;
  el.onclick = (e) => {
    if (e.target.closest(".b-card-action-btns")) return;
    blogOpenComments(post);
  };

  const isFeatured = post.settings?.isFeatured;
  const status = post.status || "published";
  const dateStr = post.publishDate
    ? new Date(post.publishDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
  const tags = (post.tags || []).filter(Boolean).slice(0, 3);
  const initials = (post.author || "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const wc = post.stats?.wordCount || 0;
  const catClass =
    {
      festivals: "b-tag-festivals",
      wellness: "b-tag-wellness",
      traditions: "b-tag-traditions",
    }[post.category] || "b-tag-cat";
  const cmtCount =
    post.commentCount || (blogCommentCache[post._id] || []).length;

  el.innerHTML = `
    <div class="b-card-img">
      ${
        post.coverImage?.url
          ? `<img src="${post.coverImage.url}" alt="${post.title}" loading="lazy"
             onerror="this.parentElement.innerHTML='<div class=b-card-no-img>🛕</div>'"/>`
          : `<div class="b-card-no-img">🛕</div>`
      }
      <div class="b-card-badges">
        ${post.category ? `<span class="b-tag ${catClass}">${post.category}</span>` : ""}
        ${isFeatured ? `<span class="b-tag b-tag-featured"><i class="fa-solid fa-star" style="font-size:8px"></i> Featured</span>` : ""}
      </div>
      <div class="b-card-status">
        <div class="b-status-dot ${status}"></div>
        <span>${status}</span>
      </div>
      <div class="b-card-readtime"><i class="fa-regular fa-clock" style="font-size:9px"></i> ${post.readTime || "2 min"}</div>
    </div>

    <div class="b-card-body">
      <div class="b-card-meta">
        <span class="b-card-category">${post.category || "General"}</span>
        <span class="b-card-type">${post.stats?.blockCount || 0} blocks</span>
      </div>
      <div class="b-card-title">${post.title}</div>
      <div class="b-card-desc">${post.subtitle || "No description provided."}</div>
      ${tags.length ? `<div class="b-card-tags">${tags.map((t) => `<span class="b-tag-small">${t}</span>`).join("")}</div>` : ""}
      <div class="b-card-specs">
        <div class="b-spec"><i class="fa-solid fa-pen-nib"></i> ${wc} words</div>
        <div class="b-spec"><i class="fa-regular fa-calendar"></i> ${dateStr}</div>
      </div>
    </div>

    <div class="b-card-footer">
      <div class="b-author">
        <div class="b-author-av">${initials}</div>
        <div>
          <div class="b-author-name">${post.author || "Anonymous"}</div>
          <div class="b-author-date">${dateStr}</div>
        </div>
      </div>
      <div class="b-card-action-btns">
        <button class="b-btn b-btn-comments" onclick="blogOpenComments(blogAllPosts.find(p=>p._id==='${post._id}'))" title="View comments">
          <i class="fa-regular fa-comment-dots"></i> ${cmtCount}
        </button>
        <button class="b-btn b-btn-edit"
          onclick="event.stopPropagation();blogOpenEditor('${post._id}')">
          <i class="fa-solid fa-pen-to-square"></i> Edit
        </button>
        <button class="b-btn b-btn-del"
          onclick="event.stopPropagation();blogAskDelete('${post._id}','${post.title.replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `;
  return el;
}

/* ── ERROR ────────────────────────────────────────── */
function blogRenderError() {
  const grid = document.getElementById("blogGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <h3>Could Not Load Posts</h3>
      <p>Ensure your API server is running on <strong>localhost:5000</strong> and the endpoint <code>/api/v1/blogs</code> is reachable.</p>
      <button class="b-btn" onclick="blogFetchPosts()" style="margin:12px auto 0;padding:10px 22px;background:var(--crimson,#7f0403);color:#fff;border:none;font-size:12px;letter-spacing:0.08em;text-transform:uppercase"><i class="fa-solid fa-rotate-right"></i> Retry</button>
    </div>`;
}

/* ── DELETE POST (API) ───────────────────────────── */
function blogAskDelete(id, title) {
  blogPendingDeleteId = id;
  const msg = document.getElementById("blogModalMsg");
  if (msg) msg.textContent = `"${title}" will be permanently deleted.`;
  const back = document.getElementById("blogModalBack");
  if (back) back.classList.add("open");
  const btn = document.getElementById("blogModalDelBtn");
  if (btn) btn.onclick = () => blogDoDelete(id);
}

function blogCloseModal() {
  const back = document.getElementById("blogModalBack");
  if (back) back.classList.remove("open");
  blogPendingDeleteId = null;
}

async function blogDoDelete(id) {
  try {
    await blogApiFetch(`${BLOG_API}/${id}`, { method: "DELETE" });
  } catch (e) {
    console.error("Delete API error:", e.message);
  }
  blogAllPosts = blogAllPosts.filter((p) => p._id !== id);
  blogFilteredPosts = blogFilteredPosts.filter((p) => p._id !== id);
  delete blogCommentCache[id];
  blogRenderCards(blogFilteredPosts);
  const el = (id2) => document.getElementById(id2);
  el("blogTotalCount") &&
    (el("blogTotalCount").textContent = blogAllPosts.length);
  el("blogSidebarCount") &&
    (el("blogSidebarCount").textContent = blogAllPosts.length);
  const now = new Date();
  el("blogFutureCount") &&
    (el("blogFutureCount").textContent = blogAllPosts.filter(
      (p) => p.publishDate && new Date(p.publishDate) > now,
    ).length);
  blogCloseModal();
  blogNotify("Post deleted successfully", "error");
}

/* ══════════════════════════════════════════════════
   COMMENT MODAL (all API-backed)
   ══════════════════════════════════════════════════ */
let blogActivePost = null;
let blogActiveFilter = "all";

async function blogOpenComments(post) {
  if (!post) return;
  blogActivePost = post;
  blogActiveFilter = "all";

  const el = (id) => document.getElementById(id);
  el("cmBlogCat") && (el("cmBlogCat").textContent = post.category || "General");
  el("cmBlogTitle") && (el("cmBlogTitle").textContent = post.title);
  el("cmLikes") &&
    (el("cmLikes").textContent = (
      post.reactionCounts?.love || 0
    ).toLocaleString());
  el("cmViews") &&
    (el("cmViews").textContent = (post.viewCount || 0).toLocaleString());

  // Reset UI
  document
    .querySelectorAll(".cm-tab")
    .forEach((t, i) => t.classList.toggle("active", i === 0));
  const composeInput = el("cmComposeInput");
  if (composeInput) composeInput.value = "";

  // Loading state
  el("cmCmtCount") && (el("cmCmtCount").textContent = "…");
  const list = el("cmList");
  if (list)
    list.innerHTML = `<div class="cm-empty">
    <div class="blog-loading-orn"><div class="blog-loading-orn-dot"></div><div class="blog-loading-orn-dot"></div><div class="blog-loading-orn-dot"></div></div>
    <p style="margin-top:12px;font-size:12px;color:var(--ink-faint,#aa9988)">Loading comments…</p>
  </div>`;
  el("cmOverlay") && el("cmOverlay").classList.add("open");
  document.body.style.overflow = "hidden";

  // Fetch from API
  try {
    const json = await blogApiFetch(`${BLOG_API}/${post._id}/comments`);
    const raw = json.data?.comments || [];
    blogCommentCache[post._id] = raw.map(blogMapComment);
  } catch (e) {
    console.error("Failed to load comments:", e.message);
    blogCommentCache[post._id] = [];
    blogNotify("Could not load comments: " + e.message, "error");
  }

  el("cmCmtCount") &&
    (el("cmCmtCount").textContent = (blogCommentCache[post._id] || []).length);
  blogRenderCommentList();
}

function blogCloseComments() {
  const overlay = document.getElementById("cmOverlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
  blogActivePost = null;
}

function blogSetFilter(type, btn) {
  blogActiveFilter = type;
  document
    .querySelectorAll(".cm-tab")
    .forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  blogRenderCommentList();
}

function blogRenderCommentList() {
  const list = document.getElementById("cmList");
  if (!list) return;
  if (!blogActivePost) {
    list.innerHTML = "";
    return;
  }

  let comments = blogCommentCache[blogActivePost._id] || [];
  if (blogActiveFilter === "visible")
    comments = comments.filter((c) => !c.hidden);
  if (blogActiveFilter === "hidden")
    comments = comments.filter((c) => c.hidden);
  if (blogActiveFilter === "replied")
    comments = comments.filter((c) => c.adminReply);

  if (!comments.length) {
    list.innerHTML = `<div class="cm-empty">
      <div class="cm-empty-ico"><i class="fa-regular fa-comment-dots"></i></div>
      <p>No comments match this filter.</p>
    </div>`;
    return;
  }

  list.innerHTML = comments.map((c) => blogBuildCommentHTML(c)).join("");
}

function blogBuildCommentHTML(c) {
  const hiddenBadge = c.hidden
    ? `<span class="cm-badge cm-badge-hidden">Hidden</span>`
    : "";
  const repliedBadge = c.adminReply
    ? `<span class="cm-badge cm-badge-replied">Replied</span>`
    : "";
  const adminBadge = c.isAdmin
    ? `<span class="cm-badge cm-badge-admin">Admin</span>`
    : "";
  const heartedBadge = c.adminHearted
    ? `<span class="cm-badge cm-badge-admin" style="background:rgba(127,4,3,0.12)">♥ Hearted</span>`
    : "";
  const replyBlock = c.adminReply
    ? `
    <div class="cm-admin-reply">
      <div class="cm-reply-head"><i class="fa-solid fa-shield-halved"></i> Admin Reply</div>
      ${blogEscHtml(c.adminReply)}
      <button class="cm-act cm-act-del" style="margin-top:6px;font-size:10px" onclick="blogDeleteReply('${c.id}')">
        <i class="fa-solid fa-trash-can"></i> Remove Reply
      </button>
    </div>`
    : "";
  const hideLabel = c.hidden ? "Unhide" : "Hide";
  const hideIcon = c.hidden ? "fa-eye" : "fa-eye-slash";
  const heartLabel = c.adminHearted ? "Un-heart" : "Heart";

  return `
    <div class="cm-item${c.hidden ? " hidden-cmt" : ""}" id="cmt-${c.id}">
      <div class="cm-item-head">
        <div class="cm-av">${blogEscHtml(c.initials)}</div>
        <div class="cm-meta">
          <div class="cm-uname">${blogEscHtml(c.user)}</div>
          <div class="cm-date">${blogEscHtml(c.date)}</div>
        </div>
        <div class="cm-badges">${hiddenBadge}${repliedBadge}${heartedBadge}${adminBadge}</div>
      </div>
      <div class="cm-text">${blogEscHtml(c.text)}</div>
      ${replyBlock}
      <div class="cm-actions">
        <button class="cm-act cm-act-reply" onclick="blogToggleReplyBox('${c.id}')">
          <i class="fa-solid fa-reply"></i> Reply
        </button>
        <button class="cm-act cm-act-hide" onclick="blogToggleHide('${c.id}')">
          <i class="fa-solid ${hideIcon}"></i> ${hideLabel}
        </button>
        <button class="cm-act" onclick="blogToggleHeart('${c.id}')" style="color:var(--crimson,#7f0403);border-color:rgba(127,4,3,0.2)">
          <i class="fa-solid fa-heart"></i> ${heartLabel}
        </button>
        <button class="cm-act cm-act-del" onclick="blogToggleDelConfirm('${c.id}')">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
      <div class="cm-reply-box" id="rbox-${c.id}">
        <textarea id="rtxt-${c.id}" placeholder="Write your admin reply…"
          oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
        <div class="cm-reply-box-btns">
          <button class="cm-rbtn cm-rbtn-cancel" onclick="blogToggleReplyBox('${c.id}')">Cancel</button>
          <button class="cm-rbtn cm-rbtn-send" onclick="blogSendReply('${c.id}')">
            <i class="fa-solid fa-paper-plane" style="font-size:10px"></i> Send Reply
          </button>
        </div>
      </div>
      <div class="cm-del-confirm" id="dbox-${c.id}">
        <p>Permanently delete this comment? This cannot be undone.</p>
        <div class="cm-del-btns">
          <button class="cm-del-keep" onclick="blogToggleDelConfirm('${c.id}')">Keep</button>
          <button class="cm-del-go" onclick="blogDeleteComment('${c.id}')">
            <i class="fa-solid fa-trash-can" style="font-size:10px"></i> Delete
          </button>
        </div>
      </div>
    </div>`;
}

/* ── Comment Actions (API-backed) ──────────────── */
function blogToggleReplyBox(cid) {
  const box = document.getElementById("rbox-" + cid);
  if (!box) return;
  const isOpen = box.classList.contains("open");
  document
    .querySelectorAll(".cm-reply-box")
    .forEach((b) => b.classList.remove("open"));
  if (!isOpen) {
    box.classList.add("open");
    const txt = document.getElementById("rtxt-" + cid);
    if (txt) txt.focus();
  }
}

async function blogSendReply(cid) {
  const txtEl = document.getElementById("rtxt-" + cid);
  const txt = txtEl ? txtEl.value.trim() : "";
  if (!txt) {
    blogNotify("Please write a reply first.", "error");
    return;
  }
  if (!blogActivePost) return;

  try {
    await blogApiFetch(
      `${BLOG_API}/${blogActivePost._id}/comments/${cid}/reply`,
      {
        method: "POST",
        body: JSON.stringify({ body: txt }),
      },
    );
    const comments = blogCommentCache[blogActivePost._id] || [];
    const c = comments.find((x) => x.id === cid);
    if (c) c.adminReply = txt;
    blogRenderCommentList();
    blogNotify("Reply posted successfully.", "success");
  } catch (e) {
    blogNotify("Failed to post reply: " + e.message, "error");
  }
}

async function blogDeleteReply(cid) {
  if (!blogActivePost) return;
  try {
    await blogApiFetch(
      `${BLOG_API}/${blogActivePost._id}/comments/${cid}/reply`,
      {
        method: "DELETE",
      },
    );
    const comments = blogCommentCache[blogActivePost._id] || [];
    const c = comments.find((x) => x.id === cid);
    if (c) c.adminReply = null;
    blogRenderCommentList();
    blogNotify("Reply removed.", "info");
  } catch (e) {
    blogNotify("Failed to remove reply: " + e.message, "error");
  }
}

async function blogToggleHide(cid) {
  if (!blogActivePost) return;
  const comments = blogCommentCache[blogActivePost._id] || [];
  const c = comments.find((x) => x.id === cid);
  if (!c) return;

  const action = c.hidden ? "unhide" : "hide";
  try {
    await blogApiFetch(
      `${BLOG_API}/${blogActivePost._id}/comments/${cid}/${action}`,
      {
        method: "PATCH",
      },
    );
    c.hidden = !c.hidden;
    blogRenderCommentList();
    blogNotify(
      c.hidden ? "Comment hidden from public." : "Comment is now visible.",
      "info",
    );
  } catch (e) {
    blogNotify("Failed to " + action + " comment: " + e.message, "error");
  }
}

async function blogToggleHeart(cid) {
  if (!blogActivePost) return;
  try {
    const json = await blogApiFetch(
      `${BLOG_API}/${blogActivePost._id}/comments/${cid}/heart`,
      {
        method: "PATCH",
      },
    );
    const comments = blogCommentCache[blogActivePost._id] || [];
    const c = comments.find((x) => x.id === cid);
    if (c) {
      c.adminHearted = json.data?.adminHearted ?? !c.adminHearted;
      c.likes = c.adminHearted ? 1 : 0;
    }
    blogRenderCommentList();
    blogNotify(
      c && c.adminHearted ? "Comment hearted ♥" : "Heart removed.",
      "success",
    );
  } catch (e) {
    blogNotify("Failed to heart comment: " + e.message, "error");
  }
}

function blogToggleDelConfirm(cid) {
  const box = document.getElementById("dbox-" + cid);
  if (!box) return;
  const isOpen = box.classList.contains("open");
  document
    .querySelectorAll(".cm-del-confirm")
    .forEach((b) => b.classList.remove("open"));
  if (!isOpen) box.classList.add("open");
}

async function blogDeleteComment(cid) {
  if (!blogActivePost) return;
  try {
    await blogApiFetch(`${BLOG_API}/${blogActivePost._id}/comments/${cid}`, {
      method: "DELETE",
    });
    blogCommentCache[blogActivePost._id] = (
      blogCommentCache[blogActivePost._id] || []
    ).filter((c) => c.id !== cid);
    const count = blogCommentCache[blogActivePost._id].length;
    const cmtEl = document.getElementById("cmCmtCount");
    if (cmtEl) cmtEl.textContent = count;
    blogRenderCommentList();
    blogRenderCards(blogFilteredPosts);
    blogNotify("Comment deleted.", "error");
  } catch (e) {
    blogNotify("Failed to delete comment: " + e.message, "error");
  }
}

async function blogPostAdminComment() {
  const inp = document.getElementById("cmComposeInput");
  const txt = inp ? inp.value.trim() : "";
  if (!txt) {
    blogNotify("Please write something first.", "error");
    return;
  }
  if (!blogActivePost) return;

  try {
    const json = await blogApiFetch(
      `${BLOG_API}/${blogActivePost._id}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body: txt }),
      },
    );

    const newComment = json.data?.comment;
    if (newComment) {
      const mapped = blogMapComment(newComment);
      if (!blogCommentCache[blogActivePost._id])
        blogCommentCache[blogActivePost._id] = [];
      blogCommentCache[blogActivePost._id].unshift(mapped);
    }

    if (inp) inp.value = "";
    const cmtEl = document.getElementById("cmCmtCount");
    if (cmtEl)
      cmtEl.textContent = (blogCommentCache[blogActivePost._id] || []).length;
    blogRenderCommentList();
    blogRenderCards(blogFilteredPosts);
    blogNotify("Comment posted successfully.", "success");
  } catch (e) {
    blogNotify("Failed to post comment: " + e.message, "error");
  }
}

/* Close overlay on backdrop click */
document.addEventListener("click", function (e) {
  const overlay = document.getElementById("cmOverlay");
  if (overlay && e.target === overlay) blogCloseComments();
});

/* ── NOTIFICATION ────────────────────────────────── */
let blogNotifTimer;
const blogIconMap = {
  success: "fa-circle-check",
  error: "fa-circle-xmark",
  info: "fa-circle-info",
};
function blogNotify(msg, type = "info") {
  const el = document.getElementById("blogNotif");
  const ic = document.getElementById("blogNotifIcon");
  const msgEl = document.getElementById("blogNotifMsg");
  if (!el || !ic || !msgEl) return;
  msgEl.textContent = msg;
  el.className = "blog-notif show " + type;
  ic.className = "fa-solid " + (blogIconMap[type] || blogIconMap.info);
  clearTimeout(blogNotifTimer);
  blogNotifTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

/* ── UTILS ───────────────────────────────────────── */
function blogEscHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ══════════════════════════════════════════════════
   BLOG EDITOR MODAL (iframe-based)
   ══════════════════════════════════════════════════ */
function blogOpenEditor(postId) {
  const overlay = document.getElementById("blogEditorOverlay");
  const iframe = document.getElementById("blogEditorIframe");
  if (!overlay || !iframe) return;
  // Reset src first to force a fresh load even if the same postId is opened again
  iframe.src = "about:blank";
  const targetUrl = postId
    ? `./blogpost.html?edit=${postId}`
    : "./blogpost.html";
  // Small delay to ensure src reset is processed before setting the new URL
  setTimeout(() => {
    iframe.src = targetUrl;
  }, 30);
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function blogCloseEditor() {
  const overlay = document.getElementById("blogEditorOverlay");
  const iframe = document.getElementById("blogEditorIframe");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  // Clear iframe after transition
  setTimeout(() => {
    if (iframe) iframe.src = "about:blank";
  }, 300);
}

/* Listen for postMessage from blogpost.html iframe */
window.addEventListener("message", function (e) {
  if (e.data && e.data.type === "blog-published") {
    blogCloseEditor();
    blogNotify("Blog post published successfully!", "success");
    // Refresh the blog list after a brief delay
    setTimeout(() => blogFetchPosts(), 500);
  }
  if (e.data && e.data.type === "blog-saved") {
    blogNotify("Draft saved.", "info");
    setTimeout(() => blogFetchPosts(), 500);
  }
  if (e.data && e.data.type === "blog-close-editor") {
    blogCloseEditor();
  }
  if (e.data && e.data.type === "blog-updated") {
    blogNotify("Post updated successfully!", "success");
    setTimeout(() => blogFetchPosts(), 500);
  }
});

/* Close editor overlay on backdrop click */
document.addEventListener("click", function (e) {
  const overlay = document.getElementById("blogEditorOverlay");
  if (overlay && e.target === overlay) blogCloseEditor();
});
