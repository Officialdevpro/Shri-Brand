// ════════════════════════════════════════════════
//  MESSAGES / INQUIRIES — Shri Brand Admin
//  Adapted from c.html for integration in index.html
// ════════════════════════════════════════════════

(function () {
  "use strict";

  // ════════════════════════════════════════════
  //  CONFIG
  // ════════════════════════════════════════════
  const MSG_CONFIG = {
    BASE_URL: "https://shri-brand.onrender.com",
    API_BASE: "/api/v1",
    PER_PAGE: 20,
  };

  // ════════════════════════════════════════════
  //  STATE
  // ════════════════════════════════════════════
  const msgState = {
    inquiries: [],
    pagination: { currentPage: 1, totalPages: 1, totalInquiries: 0 },
    loading: false,
    activeId: null,
    deleteTargetId: null,
    searchTimer: null,
    initialized: false,
  };

  const PURPOSES = [
    "Bulk Order Inquiry",
    "Retail / B2B Inquiry",
    "Temple Supply Partnership",
    "Return Gift Customization",
    "Corporate Gifting",
    "Wholesale / Distributor Interest",
    "Event-Specific Inquiry",
    "Product Customization",
    "General Enquiry",
  ];

  // ════════════════════════════════════════════
  //  API HELPER
  // ════════════════════════════════════════════
  async function apiFetch(path, options = {}) {
    const url = `${MSG_CONFIG.BASE_URL}${MSG_CONFIG.API_BASE}${path}`;
    const headers = { "Content-Type": "application/json", ...options.headers };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  // ════════════════════════════════════════════
  //  INIT — called when messages page is shown
  // ════════════════════════════════════════════
  function msgInit() {
    if (msgState.initialized) return;
    msgState.initialized = true;
    populatePurposeFilter();
    Promise.all([loadInquiries(), loadStats()]);
  }

  // Expose for external use (called by nav click)
  window.msgInit = msgInit;

  function populatePurposeFilter() {
    const sel = document.getElementById("msgPurposeFilter");
    if (!sel) return;
    PURPOSES.forEach((p) => {
      const o = document.createElement("option");
      o.value = p;
      o.textContent = p;
      sel.appendChild(o);
    });
  }

  // ════════════════════════════════════════════
  //  GET ALL — GET /api/v1/inquiries
  // ════════════════════════════════════════════
  async function loadInquiries(showFeedback = false) {
    if (msgState.loading) return;
    msgState.loading = true;

    const btn = document.getElementById("msgRefreshBtn");
    if (btn) btn.disabled = true;
    showSkeletons();
    hideError();

    const params = buildQueryParams();
    const apiEl = document.getElementById("msgApiEndpoint");
    if (apiEl) apiEl.textContent = `GET ${MSG_CONFIG.BASE_URL}${MSG_CONFIG.API_BASE}/inquiries?${params}`;

    try {
      const data = await apiFetch(`/inquiries?${params}`);
      msgState.inquiries = data.data.inquiries;
      msgState.pagination = data.pagination;

      renderTable();
      renderPagination();
      updatePageInfo();

      const subEl = document.getElementById("msgTopbarSub");
      if (subEl) subEl.textContent = `Inquiries · ${data.pagination.totalInquiries} total`;
      const countEl = document.getElementById("msgResultCount");
      if (countEl) countEl.textContent = `${data.pagination.totalInquiries}`;

      if (showFeedback) msgToast("Data refreshed successfully", "success");
    } catch (err) {
      if (
        err.message === "Failed to fetch" ||
        err.message.includes("fetch") ||
        err.message.includes("NetworkError")
      ) {
        useDemoData();
        return;
      }
      showError(err.message);
      msgToast(err.message, "error");
    } finally {
      msgState.loading = false;
      if (btn) btn.disabled = false;
    }
  }

  // Expose for HTML onclick attributes
  window.loadInquiries = loadInquiries;

  function buildQueryParams() {
    const page = msgState.pagination.currentPage || 1;
    const limit = parseInt(document.getElementById("msgPerPageSelect")?.value) || 20;
    const status = document.getElementById("msgStatusFilter")?.value || "";
    const purpose = document.getElementById("msgPurposeFilter")?.value || "";
    const sortVal = document.getElementById("msgSortBy")?.value || "createdAt_desc";
    const [sortBy, order] = sortVal.split("_");
    const p = new URLSearchParams({ page, limit, sortBy, order });
    if (status) p.set("status", status);
    if (purpose) p.set("purpose", purpose);
    return p.toString();
  }

  // ════════════════════════════════════════════
  //  GET STATS
  // ════════════════════════════════════════════
  async function loadStats() {
    try {
      const [all, pending, reviewed, resolved] = await Promise.all([
        apiFetch("/inquiries?limit=1"),
        apiFetch("/inquiries?status=pending&limit=1"),
        apiFetch("/inquiries?status=reviewed&limit=1"),
        apiFetch("/inquiries?status=resolved&limit=1"),
      ]);

      const total = all.pagination.totalInquiries;
      const p = pending.pagination.totalInquiries;
      const rv = reviewed.pagination.totalInquiries;
      const rs = resolved.pagination.totalInquiries;
      const rate = total ? Math.round((rs / total) * 100) : 0;

      setText("msgStatTotal", total);
      setText("msgStatPending", p);
      setText("msgStatReviewed", rv);
      setText("msgStatResolved", rs);

      const rateEl = document.getElementById("msgStatRate");
      if (rateEl) rateEl.innerHTML = `<strong>${rate}%</strong> resolution rate`;

      // Update sidebar badge
      const badge = document.querySelector('.nav-item[data-page="messages"] .nav-badge');
      if (badge) badge.textContent = p;
    } catch (e) {
      // Non-critical
    }
  }

  // ════════════════════════════════════════════
  //  GET ONE — DETAIL MODAL
  // ════════════════════════════════════════════
  async function openModal(id) {
    msgState.activeId = id;
    document.getElementById("msgModalOverlay").classList.add("open");
    document.body.style.overflow = "hidden";

    let d = msgState.inquiries.find((x) => x._id === id);
    if (!d) {
      try {
        d = (await apiFetch(`/inquiries/${id}`)).data.inquiry;
      } catch (err) {
        msgToast("Could not load inquiry", "error");
        closeModal();
        return;
      }
    }

    setText("msgModalId", `ID: ${d._id}`);
    setText("msgModalName", d.fullName);
    setText(
      "msgModalTs",
      `Received ${fmtFull(d.createdAt)}${d.updatedAt !== d.createdAt ? ` · Updated ${fmtFull(d.updatedAt)}` : ""}`
    );
    setText("msgModalEmail", d.email);
    setText("msgModalMobile", d.mobileNumber);
    setText("msgModalCity", d.cityRegion || "—");
    setText("msgModalIp", d.ipAddress || "—");
    setText("msgModalPurpose", d.purposeOfInquiry);

    const badge = document.getElementById("msgModalStatusBadge");
    if (badge)
      badge.innerHTML = `<span class="msg-badge msg-badge-${d.status}"><span class="msg-b-dot"></span>${d.status}</span>`;

    const sel = document.getElementById("msgModalStatusSel");
    if (sel) sel.value = d.status;

    const msgEl = document.getElementById("msgModalMessage");
    if (msgEl) {
      if (d.message) {
        msgEl.textContent = d.message;
        msgEl.classList.remove("empty");
      } else {
        msgEl.textContent = "No message was provided with this inquiry.";
        msgEl.classList.add("empty");
      }
    }
  }

  window.openModal = openModal;

  function closeModal() {
    document.getElementById("msgModalOverlay").classList.remove("open");
    document.body.style.overflow = "";
    msgState.activeId = null;
  }

  window.closeModal = closeModal;

  // ════════════════════════════════════════════
  //  UPDATE STATUS
  // ════════════════════════════════════════════
  async function saveStatus() {
    if (!msgState.activeId) return;
    const newStatus = document.getElementById("msgModalStatusSel")?.value;
    const btn = document.getElementById("msgSaveStatusBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<svg style="width:13px;height:13px;animation:msg-spin .7s linear infinite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/></svg> Saving…`;
    }

    try {
      await apiFetch(`/inquiries/${msgState.activeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      const idx = msgState.inquiries.findIndex((x) => x._id === msgState.activeId);
      if (idx !== -1) {
        msgState.inquiries[idx].status = newStatus;
        renderTable();
      }

      const badge = document.getElementById("msgModalStatusBadge");
      if (badge)
        badge.innerHTML = `<span class="msg-badge msg-badge-${newStatus}"><span class="msg-b-dot"></span>${newStatus}</span>`;

      closeModal();
      loadStats();
      msgToast(`Status updated to "${newStatus}"`, "success");
    } catch (err) {
      msgToast(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save Status`;
      }
    }
  }

  window.saveStatus = saveStatus;

  // ════════════════════════════════════════════
  //  DELETE
  // ════════════════════════════════════════════
  function askDelete(id) {
    msgState.deleteTargetId = id;
    document.getElementById("msgConfirmOverlay").classList.add("open");
  }

  window.askDelete = askDelete;

  function closeConfirm() {
    document.getElementById("msgConfirmOverlay").classList.remove("open");
    msgState.deleteTargetId = null;
  }

  window.closeConfirm = closeConfirm;

  async function confirmDelete() {
    if (!msgState.deleteTargetId) return;
    const btn = document.getElementById("msgConfirmDeleteBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Deleting…"; }

    try {
      await apiFetch(`/inquiries/${msgState.deleteTargetId}`, { method: "DELETE" });
      closeConfirm();
      msgToast("Inquiry deleted successfully", "success");
      await Promise.all([loadInquiries(), loadStats()]);
    } catch (err) {
      msgToast(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg> Delete`;
      }
    }
  }

  window.confirmDelete = confirmDelete;

  // ════════════════════════════════════════════
  //  SEARCH
  // ════════════════════════════════════════════
  function handleSearch() {
    clearTimeout(msgState.searchTimer);
    msgState.searchTimer = setTimeout(clientSideSearch, 280);
  }

  window.handleSearch = handleSearch;

  function clientSideSearch() {
    const q = document.getElementById("msgSearchInput")?.value.toLowerCase().trim() || "";
    if (!q) {
      renderTable();
      setText("msgResultCount", `${msgState.inquiries.length}`);
      return;
    }

    const filtered = msgState.inquiries.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        (d.cityRegion || "").toLowerCase().includes(q) ||
        d.mobileNumber.includes(q)
    );

    const empty = document.getElementById("msgEmptyState");
    if (!filtered.length) {
      setText("msgTableBody", "");
      const tb = document.getElementById("msgTableBody");
      if (tb) tb.innerHTML = "";
      if (empty) empty.style.display = "block";
      setText("msgEmptySubtext", `No results for "${q}"`);
      setText("msgResultCount", "0");
      return;
    }

    if (empty) empty.style.display = "none";
    setText("msgResultCount", `${filtered.length}`);

    const saved = msgState.inquiries;
    msgState.inquiries = filtered;
    renderTable();
    msgState.inquiries = saved;
  }

  function resetAndLoad() {
    msgState.pagination.currentPage = 1;
    loadInquiries();
  }

  window.msgResetAndLoad = resetAndLoad;

  function changePerPage() {
    msgState.pagination.currentPage = 1;
    loadInquiries();
  }

  window.msgChangePerPage = changePerPage;

  // ════════════════════════════════════════════
  //  EXPORT CSV
  // ════════════════════════════════════════════
  function exportCSV() {
    const headers = ["ID", "Name", "Email", "Mobile", "City", "Purpose", "Status", "IP", "Date"];
    const rows = msgState.inquiries.map((d) =>
      [d._id, d.fullName, d.email, d.mobileNumber, d.cityRegion || "", d.purposeOfInquiry, d.status, d.ipAddress || "", fmtFull(d.createdAt)].map(
        (v) => `"${String(v).replace(/"/g, '""')}"`
      )
    );

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inquiries_p${msgState.pagination.currentPage}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    msgToast("CSV export downloaded", "info");
  }

  window.exportCSV = exportCSV;

  // ════════════════════════════════════════════
  //  COPY TO CLIPBOARD
  // ════════════════════════════════════════════
  function copyText(elId) {
    navigator.clipboard
      .writeText(document.getElementById(elId)?.textContent || "")
      .then(() => msgToast("Copied to clipboard", "info"));
  }

  window.msgCopyText = copyText;

  // ════════════════════════════════════════════
  //  RENDER TABLE
  // ════════════════════════════════════════════
  function avColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % 8;
    return `msg-av-${h}`;
  }

  function renderTable() {
    const tbody = document.getElementById("msgTableBody");
    const empty = document.getElementById("msgEmptyState");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!msgState.inquiries.length) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    msgState.inquiries.forEach((d) => {
      const initials = d.fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const tr = document.createElement("tr");
      tr.onclick = () => openModal(d._id);
      tr.innerHTML = `
        <td>
          <div class="msg-contact-cell">
            <div class="msg-contact-av ${avColor(d.fullName)}">${initials}</div>
            <div class="msg-contact-text">
              <div class="msg-name">${esc(d.fullName)}</div>
              <div class="msg-email">${esc(d.email)}</div>
            </div>
          </div>
        </td>
        <td><span class="msg-mobile-text">${esc(d.mobileNumber)}</span></td>
        <td><span class="msg-purpose-tag" title="${esc(d.purposeOfInquiry)}">${esc(d.purposeOfInquiry)}</span></td>
        <td><span class="msg-city-text">${d.cityRegion ? esc(d.cityRegion) : '<span style="color:var(--msg-text3)">—</span>'}</span></td>
        <td>
          <span class="msg-badge msg-badge-${d.status}">
            <span class="msg-b-dot"></span>${d.status}
          </span>
        </td>
        <td><span class="msg-date-text">${relTime(d.createdAt)}</span></td>
        <td>
          <div class="msg-row-actions">
            <button class="msg-ic-btn" title="View" onclick="event.stopPropagation(); openModal('${d._id}')">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="msg-ic-btn red" title="Delete" onclick="event.stopPropagation(); askDelete('${d._id}')">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function showSkeletons() {
    const emptyEl = document.getElementById("msgEmptyState");
    if (emptyEl) emptyEl.style.display = "none";
    const tbody = document.getElementById("msgTableBody");
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: 6 }, () => `
      <tr class="msg-skel-row">
        <td>
          <div class="msg-skel-bar" style="height:13px;width:72%"></div>
          <div class="msg-skel-bar" style="height:10px;width:55%;margin-top:6px"></div>
        </td>
        <td><div class="msg-skel-bar" style="height:12px;width:90px"></div></td>
        <td><div class="msg-skel-bar" style="height:12px;width:120px"></div></td>
        <td><div class="msg-skel-bar" style="height:12px;width:70px"></div></td>
        <td><div class="msg-skel-bar" style="height:22px;width:76px;border-radius:20px"></div></td>
        <td><div class="msg-skel-bar" style="height:12px;width:60px"></div></td>
        <td><div class="msg-skel-bar" style="height:28px;width:66px;margin-left:auto;border-radius:5px"></div></td>
      </tr>
    `).join("");
  }

  // ════════════════════════════════════════════
  //  PAGINATION
  // ════════════════════════════════════════════
  function renderPagination() {
    const { currentPage, totalPages } = msgState.pagination;
    const pag = document.getElementById("msgPagination");
    if (!pag) return;
    pag.innerHTML = "";

    const mk = (label, page, disabled = false, active = false) => {
      const b = document.createElement("button");
      b.className = "msg-pg-btn" + (active ? " active" : "");
      b.textContent = label;
      b.disabled = disabled;
      b.onclick = () => {
        msgState.pagination.currentPage = page;
        loadInquiries();
      };
      return b;
    };

    pag.appendChild(mk("«", 1, currentPage === 1));
    pag.appendChild(mk("‹", currentPage - 1, currentPage === 1));

    getPageRange(currentPage, totalPages).forEach((p) => {
      if (p === "…") {
        const s = document.createElement("span");
        s.className = "msg-pg-btn";
        s.textContent = "…";
        s.style.cssText = "cursor:default;color:var(--msg-text3);pointer-events:none";
        pag.appendChild(s);
      } else {
        pag.appendChild(mk(p, p, false, p === currentPage));
      }
    });

    pag.appendChild(mk("›", currentPage + 1, currentPage === totalPages));
    pag.appendChild(mk("»", totalPages, currentPage === totalPages));
  }

  function getPageRange(c, t) {
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    if (c <= 3) return [1, 2, 3, 4, "…", t];
    if (c >= t - 2) return [1, "…", t - 3, t - 2, t - 1, t];
    return [1, "…", c - 1, c, c + 1, "…", t];
  }

  function updatePageInfo() {
    const { currentPage, totalInquiries } = msgState.pagination;
    const limit = parseInt(document.getElementById("msgPerPageSelect")?.value || 20);
    const from = (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalInquiries);
    const el = document.getElementById("msgPageInfo");
    if (el) el.textContent = totalInquiries ? `Showing ${from}–${to} of ${totalInquiries}` : "0 results";
  }

  // ════════════════════════════════════════════
  //  TOAST
  // ════════════════════════════════════════════
  function msgToast(msg, type = "success") {
    const icons = {
      success: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      info: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };
    const el = document.createElement("div");
    el.className = `msg-toast-pill ${type}`;
    el.innerHTML = `
      <span class="msg-t-ic">${icons[type]}</span>
      <span class="msg-t-msg">${esc(msg)}</span>
      <button class="msg-t-close" onclick="this.parentElement.remove()">×</button>
    `;
    const stack = document.getElementById("msgToastStack");
    if (stack) stack.appendChild(el);
    setTimeout(() => el.remove?.(), 4000);
  }

  // ════════════════════════════════════════════
  //  ERROR BANNER
  // ════════════════════════════════════════════
  function showError(msg) {
    const b = document.getElementById("msgErrorBanner");
    if (b) b.style.display = "flex";
    setText("msgErrorMsg", msg);
    const tb = document.getElementById("msgTableBody");
    if (tb) tb.innerHTML = "";
    const es = document.getElementById("msgEmptyState");
    if (es) es.style.display = "block";
    setText("msgEmptySubtext", "Failed to load. Please retry.");
  }

  function hideError() {
    const b = document.getElementById("msgErrorBanner");
    if (b) b.style.display = "none";
  }

  // ════════════════════════════════════════════
  //  DEMO DATA
  // ════════════════════════════════════════════
  function useDemoData() {
    const demo = [
      {
        _id: "66a000000000000000000001",
        fullName: "Priya Sharma",
        email: "priya.sharma@example.com",
        mobileNumber: "9876543210",
        cityRegion: "Mumbai",
        purposeOfInquiry: "Bulk Order Inquiry",
        message: "Hi, I need 500 units for festival season. Can you share wholesale pricing and MOQ?",
        status: "pending",
        ipAddress: "103.25.17.88",
        createdAt: "2025-06-15T09:30:00Z",
        updatedAt: "2025-06-15T09:30:00Z",
      },
      {
        _id: "66a000000000000000000002",
        fullName: "Arjun Mehta",
        email: "arjun.m@temple.org",
        mobileNumber: "8765432109",
        cityRegion: "Varanasi",
        purposeOfInquiry: "Temple Supply Partnership",
        message: "We manage a large temple complex and want a long-term supply partnership for pooja items.",
        status: "reviewed",
        ipAddress: "182.74.55.12",
        createdAt: "2025-06-14T14:20:00Z",
        updatedAt: "2025-06-14T18:00:00Z",
      },
      {
        _id: "66a000000000000000000003",
        fullName: "Divya Krishnan",
        email: "divya.k@events.in",
        mobileNumber: "7654321098",
        cityRegion: "Chennai",
        purposeOfInquiry: "Return Gift Customization",
        message: "Need 200 customized return gift sets for a wedding in October. Custom packaging with printed names.",
        status: "resolved",
        ipAddress: "110.225.43.77",
        createdAt: "2025-06-13T11:10:00Z",
        updatedAt: "2025-06-13T15:30:00Z",
      },
      {
        _id: "66a000000000000000000004",
        fullName: "Rajesh Nair",
        email: "rajesh.nair@corpgifts.com",
        mobileNumber: "9543210987",
        cityRegion: "Bengaluru",
        purposeOfInquiry: "Corporate Gifting",
        message: "Planning Diwali gifts for 300 employees. Looking for something traditional yet elegant. Please share catalogue.",
        status: "pending",
        ipAddress: "49.36.122.5",
        createdAt: "2025-06-12T16:45:00Z",
        updatedAt: "2025-06-12T16:45:00Z",
      },
      {
        _id: "66a000000000000000000005",
        fullName: "Meera Patel",
        email: "meera.patel@wholesale.com",
        mobileNumber: "8432109876",
        cityRegion: "Ahmedabad",
        purposeOfInquiry: "Wholesale / Distributor Interest",
        message: "I run a chain of gift shops across Gujarat and want to become an authorized distributor.",
        status: "reviewed",
        ipAddress: "117.199.88.41",
        createdAt: "2025-06-11T10:00:00Z",
        updatedAt: "2025-06-11T12:00:00Z",
      },
      {
        _id: "66a000000000000000000006",
        fullName: "Sanjay Gupta",
        email: "sanjay@eventplanning.co",
        mobileNumber: "7321098765",
        cityRegion: "Delhi",
        purposeOfInquiry: "Event-Specific Inquiry",
        message: "Organizing a 2000-person cultural event next month. Need decorative items, diyas, and traditional decor. Urgent.",
        status: "pending",
        ipAddress: "203.88.12.99",
        createdAt: "2025-06-10T08:25:00Z",
        updatedAt: "2025-06-10T08:25:00Z",
      },
      {
        _id: "66a000000000000000000007",
        fullName: "Kavitha Reddy",
        email: "kavitha.r@gmail.com",
        mobileNumber: "9210987654",
        cityRegion: "Hyderabad",
        purposeOfInquiry: "General Enquiry",
        message: null,
        status: "resolved",
        ipAddress: "122.161.54.32",
        createdAt: "2025-06-09T13:55:00Z",
        updatedAt: "2025-06-09T16:00:00Z",
      },
    ];

    msgState.inquiries = demo;
    msgState.pagination = { currentPage: 1, totalPages: 1, totalInquiries: demo.length, limit: 20 };

    renderTable();
    renderPagination();
    updatePageInfo();

    const total = demo.length;
    const p = demo.filter((d) => d.status === "pending").length;
    const rv = demo.filter((d) => d.status === "reviewed").length;
    const rs = demo.filter((d) => d.status === "resolved").length;

    setText("msgStatTotal", total);
    setText("msgStatPending", p);
    setText("msgStatReviewed", rv);
    setText("msgStatResolved", rs);

    const rateEl = document.getElementById("msgStatRate");
    if (rateEl) rateEl.innerHTML = `<strong>${Math.round((rs / total) * 100)}%</strong> resolution rate`;

    // Update sidebar badge
    const badge = document.querySelector('.nav-item[data-page="messages"] .nav-badge');
    if (badge) badge.textContent = p;

    const subEl = document.getElementById("msgTopbarSub");
    if (subEl) subEl.textContent = "Inquiries · Demo Mode";

    setText("msgResultCount", `${total}`);

    const apiEl = document.getElementById("msgApiEndpoint");
    if (apiEl) apiEl.textContent = "⚠ DEMO MODE — API unreachable";

    msgState.loading = false;
    const btn = document.getElementById("msgRefreshBtn");
    if (btn) btn.disabled = false;

    msgToast("Running in demo mode — API not reachable at localhost:5000", "info");

    // In-memory CRUD for demo mode
    window.confirmDelete = async () => {
      msgState.inquiries = msgState.inquiries.filter((x) => x._id !== msgState.deleteTargetId);
      closeConfirm();
      renderTable();
      msgToast("Deleted (demo)", "success");
    };

    window.saveStatus = async () => {
      const s = document.getElementById("msgModalStatusSel")?.value;
      const idx = msgState.inquiries.findIndex((x) => x._id === msgState.activeId);
      if (idx !== -1) msgState.inquiries[idx].status = s;
      renderTable();
      closeModal();
      msgToast(`Status → "${s}" (demo)`, "success");
    };
  }

  // ════════════════════════════════════════════
  //  HELPERS
  // ════════════════════════════════════════════
  function esc(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function fmtFull(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  // ════════════════════════════════════════════
  //  KEYBOARD SHORTCUTS (scoped to message page)
  // ════════════════════════════════════════════
  document.addEventListener("keydown", (e) => {
    const msgPage = document.getElementById("page-messages");
    if (!msgPage?.classList.contains("active")) return;

    if (e.key === "Escape") {
      closeModal();
      closeConfirm();
    }
    if (e.key === "r" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      loadInquiries(true);
    }
  });

  // Modal close on backdrop click
  document.addEventListener("DOMContentLoaded", () => {
    const mo = document.getElementById("msgModalOverlay");
    if (mo) {
      mo.addEventListener("click", (e) => {
        if (e.target === mo) closeModal();
      });
    }
  });

  // Inject spin keyframe
  const spinStyle = document.createElement("style");
  spinStyle.textContent = "@keyframes msg-spin { to { transform: rotate(360deg) } }";
  document.head.appendChild(spinStyle);
})();