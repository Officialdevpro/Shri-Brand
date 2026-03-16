/* ============================================================
   recent-orders.js
   Fully namespaced under window.RO — zero global pollution.
   All element IDs prefixed with "ro-" to avoid conflicts.
   ============================================================ */

(function () {
  "use strict";

  /* ── STATE ── */
  const RO = {
    orders: [],
    filtered: [],
    currentPage: 1,
    PER: 10,
    viewingId: null,
    deleteTarget: null,
    activeStatusTab: "",
    activeDrawerTab: "items",
  };

  /* ── API HELPERS ── */
  async function roApiFetch(url, options = {}) {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  }

  /* ── PUBLIC: called by index.html navigate() ── */
  window.loadRecentOrders = async function () {
    roShowLoadingState(true);
    try {
      let allOrders = [],
        page = 1,
        pages = 1;
      do {
        const data = await roApiFetch(
          `https://shri-brand.onrender.com/api/v1/orders?page=${page}&limit=100`,
        );
        allOrders = allOrders.concat(data.data.orders);
        pages = data.pages || 1;
        page++;
      } while (page <= pages);
      RO.orders = allOrders;
      roApplyFilters();
    } catch (err) {
      roShowError(err.message);
    } finally {
      roShowLoadingState(false);
    }
  };

  function roShowLoadingState(on) {
    const tbody = document.getElementById("ro-ordersBody");
    const empty = document.getElementById("ro-emptyState");
    if (!tbody) return;
    if (on) {
      empty.style.display = "none";
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--ro-ink-faint,#aa9988);font-size:13px;letter-spacing:.06em;">
        <i class="fa-solid fa-circle-notch fa-spin" style="color:#b8860b;font-size:1.4rem;display:block;margin-bottom:12px;"></i>Loading orders…</td></tr>`;
    }
  }

  function roShowError(msg) {
    const tbody = document.getElementById("ro-ordersBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:#7f0403;font-size:1.4rem;display:block;margin-bottom:10px;"></i>
      <div style="color:#7f0403;font-size:13px;font-weight:600;margin-bottom:6px;">Failed to load orders</div>
      <div style="color:#aa9988;font-size:12px;margin-bottom:14px;">${msg}</div>
      <button onclick="loadRecentOrders()" style="padding:8px 20px;border:1px solid #b8860b;background:rgba(184,134,11,.11);color:#4a3c30;font-family:'Jost',sans-serif;font-size:12px;cursor:pointer;">
        <i class="fa-solid fa-rotate-right" style="margin-right:6px;"></i>Retry
      </button>
    </td></tr>`;
  }

  /* ── HELPERS ── */
  const roFmtDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const roFmtTime = (d) =>
    new Date(d).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const roFmtCur = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const roInitials = (n) =>
    n
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const RO_OS_ICON = {
    placed: "fa-clock",
    processing: "fa-gear",
    shipped: "fa-truck",
    delivered: "fa-circle-check",
    cancelled: "fa-circle-xmark",
  };
  const RO_PS_ICON = {
    paid: "fa-check",
    pending: "fa-hourglass-half",
    failed: "fa-xmark",
    refunded: "fa-rotate-left",
  };
  const RO_OS_CLS = {
    placed: "ro-bs-placed",
    processing: "ro-bs-processing",
    shipped: "ro-bs-shipped",
    delivered: "ro-bs-delivered",
    cancelled: "ro-bs-cancelled",
  };
  const RO_PS_CLS = {
    paid: "ro-bp-paid",
    pending: "ro-bp-pending",
    failed: "ro-bp-failed",
    refunded: "ro-bp-refunded",
  };
  const RO_STATUSES = [
    "placed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];
  const RO_PAY_STATUSES = ["pending", "paid", "failed", "refunded"];

  function roOsBadge(s) {
    return `<span class="ro-badge ${RO_OS_CLS[s] || "ro-bs-placed"}"><i class="fa-solid ${RO_OS_ICON[s] || "fa-clock"}"></i>${s}</span>`;
  }
  function roPsBadge(s) {
    return `<span class="ro-badge ${RO_PS_CLS[s] || "ro-bp-pending"}"><i class="fa-solid ${RO_PS_ICON[s] || "fa-hourglass-half"}"></i>${s}</span>`;
  }

  /* ── STAT PILLS ── */
  function roRenderStats() {
    const total = RO.orders.length;
    const revenue = RO.orders
      .filter((o) => o.payment.status === "paid")
      .reduce((s, o) => s + o.pricing.total, 0);
    const placed = RO.orders.filter((o) => o.orderStatus === "placed").length;
    const processing = RO.orders.filter(
      (o) => o.orderStatus === "processing",
    ).length;
    const shipped = RO.orders.filter((o) => o.orderStatus === "shipped").length;
    const delivered = RO.orders.filter(
      (o) => o.orderStatus === "delivered",
    ).length;
    const cancelled = RO.orders.filter(
      (o) => o.orderStatus === "cancelled",
    ).length;

    const sp = document.getElementById("ro-statPills");
    if (sp)
      sp.innerHTML = `
      <div class="ro-stat-pill ro-sp-total">
        <div><div class="ro-sp-num">${total}</div><div class="ro-sp-lbl">Total Orders</div></div>
      </div>
      <div class="ro-stat-pill ro-sp-delivered">
        <div><div class="ro-sp-num">${roFmtCur(revenue)}</div><div class="ro-sp-lbl">Revenue</div></div>
      </div>`;

    const sc = (id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = 0;
    };
    const sv = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    sv("ro-sc-all", total);
    sv("ro-sc-placed", placed);
    sv("ro-sc-processing", processing);
    sv("ro-sc-shipped", shipped);
    sv("ro-sc-delivered", delivered);
    sv("ro-sc-cancelled", cancelled);
  }

  /* ── TABLE RENDER ── */
  function roRender() {
    const tbody = document.getElementById("ro-ordersBody");
    const empty = document.getElementById("ro-emptyState");
    if (!tbody) return;

    const page = RO.filtered.slice(
      (RO.currentPage - 1) * RO.PER,
      RO.currentPage * RO.PER,
    );
    roRenderStats();

    if (!RO.filtered.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      tbody.innerHTML = page
        .map((o, i) => {
          const firstItem = o.items[0];
          const moreCount = o.items.length - 1;
          return `
        <tr style="animation-delay:${i * 0.04}s" onclick="RO_openView('${o._id}')">
          <td>
            <div class="ro-on-num">${o.orderNumber}</div>
            <div class="ro-on-date">${roFmtDate(o.createdAt)}</div>
          </td>
          <td>
            <div class="ro-cust-cell">
              <div class="ro-cust-av">${roInitials(o.userId.name)}</div>
              <div>
                <div class="ro-cust-name">${o.userId.name}</div>
                <div class="ro-cust-email">${o.userId.email}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="ro-items-sum"><strong>${firstItem.name}</strong></div>
            ${moreCount > 0 ? `<div class="ro-items-more">+${moreCount} more item${moreCount > 1 ? "s" : ""}</div>` : ""}
          </td>
          <td>
            <div class="ro-amt-val">${roFmtCur(o.pricing.total)}</div>
            <div class="ro-amt-note">${o.payment.method === "cod" ? "COD" : "Razorpay"}</div>
          </td>
          <td>${roPsBadge(o.payment.status)}</td>
          <td>${roOsBadge(o.orderStatus)}</td>
          <td style="font-family:'Poppins',sans-serif;font-size:12px;color:#7a6a58;font-weight:400;">${roFmtDate(o.createdAt)}</td>
          <td onclick="event.stopPropagation()">
            <div class="ro-act-cell">
              <button class="ro-act-btn" title="View order" onclick="RO_openView('${o._id}')"><i class="fa-regular fa-eye"></i></button>
              <button class="ro-act-btn ro-danger" title="Delete order" onclick="RO_openDel('${o._id}')"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </td>
        </tr>`;
        })
        .join("");
    }
    roRenderPg();
  }

  function roRenderPg() {
    const total = RO.filtered.length;
    const pages = Math.ceil(total / RO.PER);
    const s = Math.min((RO.currentPage - 1) * RO.PER + 1, total || 0);
    const e = Math.min(RO.currentPage * RO.PER, total);

    const pgInfo = document.getElementById("ro-pgInfo");
    const pgBtns = document.getElementById("ro-pgBtns");
    if (!pgInfo || !pgBtns) return;

    pgInfo.textContent = total ? `Showing ${s}–${e} of ${total} orders` : "";

    let h = `<button class="ro-pg-btn" ${RO.currentPage === 1 ? "disabled" : ""} onclick="RO_goP(${RO.currentPage - 1})"><i class="fa-solid fa-chevron-left" style="font-size:9px;"></i></button>`;
    for (let p = 1; p <= pages; p++) {
      h += `<button class="ro-pg-btn ${p === RO.currentPage ? "active" : ""}" onclick="RO_goP(${p})">${p}</button>`;
    }
    h += `<button class="ro-pg-btn" ${RO.currentPage >= pages || !pages ? "disabled" : ""} onclick="RO_goP(${RO.currentPage + 1})"><i class="fa-solid fa-chevron-right" style="font-size:9px;"></i></button>`;
    pgBtns.innerHTML = h;
  }

  /* ── PUBLIC pagination (called from inline onclick) ── */
  window.RO_goP = function (p) {
    RO.currentPage = p;
    roRender();
  };

  /* ── FILTERS ── */
  window.RO_setStatusTab = function (status, el) {
    RO.activeStatusTab = status;
    document
      .querySelectorAll(".ro-stab")
      .forEach((b) => b.classList.remove("active"));
    el.classList.add("active");
    RO.currentPage = 1;
    roApplyFilters();
  };

  window.RO_applyFilters = roApplyFilters;

  function roApplyFilters() {
    const q = (
      document.getElementById("ro-searchInput")?.value || ""
    ).toLowerCase();
    const pay = document.getElementById("ro-payFilter")?.value || "";
    const method = document.getElementById("ro-methodFilter")?.value || "";
    const sort = document.getElementById("ro-sortFilter")?.value || "newest";

    RO.filtered = RO.orders.filter((o) => {
      const matchQ =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.userId.name.toLowerCase().includes(q) ||
        o.userId.email.toLowerCase().includes(q);
      const matchS =
        !RO.activeStatusTab || o.orderStatus === RO.activeStatusTab;
      const matchP = !pay || o.payment.status === pay;
      const matchM = !method || o.payment.method === method;
      return matchQ && matchS && matchP && matchM;
    });

    if (sort === "oldest")
      RO.filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (sort === "amount_desc")
      RO.filtered.sort((a, b) => b.pricing.total - a.pricing.total);
    else if (sort === "amount_asc")
      RO.filtered.sort((a, b) => a.pricing.total - b.pricing.total);
    else
      RO.filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    RO.currentPage = 1;
    roRender();
  }

  /* ── VIEW DRAWER ── */
  window.RO_openView = function (id) {
    RO.viewingId = id;
    RO.activeDrawerTab = "items";
    const o = RO.orders.find((x) => x._id === id);
    if (!o) return;
    const title = document.getElementById("ro-vd_title");
    if (title) title.textContent = o.orderNumber;
    roBuildHero(o);
    roBuildDrawerTab(o, "items");
    document
      .querySelectorAll(".ro-tab-btn")
      .forEach((b, i) => b.classList.toggle("active", i === 0));
    roOpenDrawer();
  };

  function roBuildHero(o) {
    const itemCount = o.items.reduce((s, i) => s + i.quantity, 0);
    const hero = document.getElementById("ro-vd_hero");
    if (!hero) return;
    hero.innerHTML = `
      <div class="ro-order-hero">
        <div class="ro-oh-inner">
          <div class="ro-oh-left">
            <div class="ro-oh-eyebrow">Order Reference</div>
            <div class="ro-oh-num">${o.orderNumber}</div>
            <div class="ro-oh-date">${roFmtDate(o.createdAt)} at ${roFmtTime(o.createdAt)}</div>
            <div class="ro-oh-badges">
              ${roOsBadge(o.orderStatus)}
              ${roPsBadge(o.payment.status)}
              <span class="ro-oh-method">${o.payment.method === "cod" ? "Cash on Delivery" : "Razorpay"}</span>
            </div>
          </div>
          <div class="ro-oh-right">
            <div class="ro-oh-stat">
              <div class="ro-oh-stat-num">${roFmtCur(o.pricing.total)}</div>
              <div class="ro-oh-stat-lbl">Order Total</div>
            </div>
            <div class="ro-oh-stat">
              <div class="ro-oh-stat-num">${itemCount}</div>
              <div class="ro-oh-stat-lbl">Item${itemCount > 1 ? "s" : ""}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  window.RO_switchTab = function (tab, el) {
    RO.activeDrawerTab = tab;
    document
      .querySelectorAll(".ro-tab-btn")
      .forEach((b) => b.classList.remove("active"));
    el.classList.add("active");
    const o = RO.orders.find((x) => x._id === RO.viewingId);
    if (o) roBuildDrawerTab(o, tab);
  };

  function roBuildDrawerTab(o, tab) {
    const body = document.getElementById("ro-vd_body");
    if (!body) return;
    if (tab === "items") body.innerHTML = roItemsTab(o);
    else if (tab === "shipping") body.innerHTML = roShippingTab(o);
    else body.innerHTML = roManageTab(o);
  }

  /* ITEMS & PRICING TAB */
  function roItemsTab(o) {
    const itemsHtml = o.items
      .map(
        (it) => `
      <div class="ro-oi-card">
        <div class="ro-oi-img"><i class="fa-solid fa-shirt"></i></div>
        <div class="ro-oi-info">
          <div class="ro-oi-name">${it.name}</div>
          <div class="ro-oi-sku">${it.sku}</div>
          ${it.discountPercentage ? `<div class="ro-oi-disc"><i class="fa-solid fa-tag" style="font-size:9px;"></i> ${it.discountPercentage}% off — was ${roFmtCur(it.originalPrice)}</div>` : ""}
        </div>
        <div class="ro-oi-right">
          <div class="ro-oi-qty">× ${it.quantity}</div>
          <div class="ro-oi-total">${roFmtCur(it.itemTotal)}</div>
        </div>
      </div>`,
      )
      .join("");

    return `
      <div>
        <div class="ro-sec-hd">${o.items.length} Item${o.items.length > 1 ? "s" : ""}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">${itemsHtml}</div>
      </div>
      <div>
        <div class="ro-sec-hd">Pricing Breakdown</div>
        <div class="ro-price-breakdown">
          <div class="ro-pb-row"><span class="ro-pb-lbl">Subtotal</span><span class="ro-pb-val">${roFmtCur(o.pricing.subtotal)}</span></div>
          ${o.pricing.totalDiscount ? `<div class="ro-pb-row"><span class="ro-pb-lbl">Discount</span><span class="ro-pb-val ro-disc">− ${roFmtCur(o.pricing.totalDiscount)}</span></div>` : ""}
          ${o.pricing.shippingCost ? `<div class="ro-pb-row"><span class="ro-pb-lbl">Shipping</span><span class="ro-pb-val">+ ${roFmtCur(o.pricing.shippingCost)}</span></div>` : `<div class="ro-pb-row"><span class="ro-pb-lbl">Shipping</span><span class="ro-pb-val ro-disc">Free</span></div>`}
          <div class="ro-pb-row ro-total-row"><span class="ro-pb-lbl" style="font-weight:600;color:#1c1410;">Total</span><span class="ro-pb-val ro-total">${roFmtCur(o.pricing.total)}</span></div>
        </div>
      </div>
      ${o.notes ? `<div><div class="ro-sec-hd">Notes</div><div style="padding:12px 14px;border:1px solid rgba(184,134,11,.18);background:#f7f3ed;font-size:12.5px;color:#4a3c30;font-style:italic;">"${o.notes}"</div></div>` : ""}`;
  }

  /* SHIPPING TAB */
  function roShippingTab(o) {
    const a = o.shippingAddress;
    const tl = ["placed", "processing", "shipped", "delivered"];
    const curIdx = tl.indexOf(o.orderStatus);
    const tlHtml = tl
      .map((s, i) => {
        const done = curIdx >= i && o.orderStatus !== "cancelled";
        const cur = i === curIdx && o.orderStatus !== "cancelled";
        return `<div class="ro-tl-step ${done ? "done" : ""} ${cur ? "current" : ""}">
        <div class="ro-tl-dot"><i class="fa-solid ${RO_OS_ICON[s]}"></i></div>
        <div class="ro-tl-label">${s}</div>
      </div>`;
      })
      .join("");

    const payHtml = `
      <div class="ro-info-card-body">
        <div class="ro-ic-row"><span class="ro-ic-lbl">Method</span><span class="ro-ic-val">${o.payment.method === "cod" ? "Cash on Delivery" : "Razorpay"}</span></div>
        <div class="ro-ic-row"><span class="ro-ic-lbl">Status</span><span class="ro-ic-val">${roPsBadge(o.payment.status)}</span></div>
        ${o.payment.razorpayOrderId ? `<div class="ro-ic-row"><span class="ro-ic-lbl">Order ID</span><span class="ro-ic-val" style="font-size:11px;word-break:break-all;">${o.payment.razorpayOrderId}</span></div>` : ""}
        ${o.payment.razorpayPaymentId ? `<div class="ro-ic-row"><span class="ro-ic-lbl">Pay ID</span><span class="ro-ic-val" style="font-size:11px;word-break:break-all;">${o.payment.razorpayPaymentId}</span></div>` : ""}
        ${o.payment.paidAt ? `<div class="ro-ic-row"><span class="ro-ic-lbl">Paid At</span><span class="ro-ic-val">${roFmtDate(o.payment.paidAt)} ${roFmtTime(o.payment.paidAt)}</span></div>` : ""}
      </div>`;

    return `
      <div>
        <div class="ro-sec-hd">Fulfilment Timeline</div>
        ${
          o.orderStatus === "cancelled"
            ? `<div style="text-align:center;padding:14px;border:1px solid rgba(127,4,3,.2);background:rgba(127,4,3,.05);"><span class="ro-badge ro-bs-cancelled" style="font-size:11px;padding:6px 16px;"><i class="fa-solid fa-circle-xmark"></i> Order Cancelled</span></div>`
            : `<div class="ro-timeline">${tlHtml}</div>`
        }
      </div>
      <div class="ro-info-grid">
        <div class="ro-info-card" style="grid-column:1/-1;">
          <div class="ro-info-card-head"><i class="fa-solid fa-location-dot"></i> Shipping Address</div>
          <div class="ro-info-card-body">
            <div class="ro-ic-row"><span class="ro-ic-lbl">Name</span><span class="ro-ic-val">${a.fullName}</span></div>
            <div class="ro-ic-row"><span class="ro-ic-lbl">Phone</span><span class="ro-ic-val">${a.phone}</span></div>
            <div class="ro-ic-row"><span class="ro-ic-lbl">Address</span><span class="ro-ic-val">${a.address}</span></div>
            <div class="ro-ic-row"><span class="ro-ic-lbl">City</span><span class="ro-ic-val">${a.city}, ${a.state} — ${a.pincode}</span></div>
            <div class="ro-ic-row"><span class="ro-ic-lbl">Email</span><span class="ro-ic-val" style="word-break:break-all;">${a.email}</span></div>
          </div>
        </div>
        <div class="ro-info-card" style="grid-column:1/-1;">
          <div class="ro-info-card-head"><i class="fa-solid fa-credit-card"></i> Payment Details</div>
          ${payHtml}
        </div>
      </div>`;
  }

  /* MANAGE TAB */
  function roManageTab(o) {
    const osOptions = RO_STATUSES.map(
      (s) =>
        `<option value="${s}" ${o.orderStatus === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
    ).join("");
    const psOptions = RO_PAY_STATUSES.map(
      (s) =>
        `<option value="${s}" ${o.payment.status === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
    ).join("");

    return `
      <div class="ro-status-panel">
        <div class="ro-sp-title">Update Order Status</div>
        <div class="ro-sp-row">
          <div class="ro-sp-field">
            <label>Order Status</label>
            <select id="ro-mgr_os">${osOptions}</select>
          </div>
          <button class="ro-btn-update" onclick="RO_updateOrderStatus()"><i class="fa-solid fa-rotate" style="margin-right:6px;font-size:10px;"></i>Update</button>
        </div>
      </div>
      <div class="ro-status-panel" style="margin-top:0;">
        <div class="ro-sp-title">Update Payment Status</div>
        <div class="ro-sp-row">
          <div class="ro-sp-field">
            <label>Payment Status</label>
            <select id="ro-mgr_ps">${psOptions}</select>
          </div>
          <button class="ro-btn-update" onclick="RO_updatePayStatus()"><i class="fa-solid fa-rotate" style="margin-right:6px;font-size:10px;"></i>Update</button>
        </div>
      </div>
      <div>
        <div class="ro-sec-hd">Current Status</div>
        <div style="border:1px solid rgba(184,134,11,.18);background:#f7f3ed;padding:14px 16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <div>${roOsBadge(o.orderStatus)}</div>
          <div>${roPsBadge(o.payment.status)}</div>
          <div style="font-family:'Poppins',sans-serif;font-size:11px;color:#7a6a58;margin-left:auto;font-weight:400;">Last updated: ${roFmtDate(o.createdAt)}</div>
        </div>
      </div>
      <div>
        <div class="ro-sec-hd">Customer</div>
        <div style="border:1px solid rgba(184,134,11,.18);background:#fff;padding:13px 14px;display:flex;align-items:center;gap:12px;">
          <div class="ro-cust-av" style="width:40px;height:40px;font-size:14px;">${roInitials(o.userId.name)}</div>
          <div>
            <div style="font-weight:600;color:#1c1410;font-size:13px;">${o.userId.name}</div>
            <div style="font-family:'Poppins',sans-serif;font-size:11px;color:#aa9988;font-weight:400;">${o.userId.email}</div>
          </div>
        </div>
      </div>`;
  }

  window.RO_updateOrderStatus = async function () {
    const o = RO.orders.find((x) => x._id === RO.viewingId);
    const newStatus = document.getElementById("ro-mgr_os").value;
    try {
      await roApiFetch(
        `https://shri-brand.onrender.com/api/v1/orders/${o._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ orderStatus: newStatus }),
        },
      );
      o.orderStatus = newStatus;
      roBuildHero(o);
      roBuildDrawerTab(o, "manage");
      roRender();
      roToast(`Order status updated to "${newStatus}"`, "success");
    } catch (err) {
      roToast(err.message, "error");
    }
  };

  window.RO_updatePayStatus = async function () {
    const o = RO.orders.find((x) => x._id === RO.viewingId);
    const newStatus = document.getElementById("ro-mgr_ps").value;
    try {
      await roApiFetch(
        `https://shri-brand.onrender.com/api/v1/orders/${o._id}/payment-status`,
        {
          method: "PATCH",
          body: JSON.stringify({ paymentStatus: newStatus }),
        },
      );
      o.payment.status = newStatus;
      roBuildHero(o);
      roBuildDrawerTab(o, "manage");
      roRender();
      roToast(`Payment status updated to "${newStatus}"`, "info");
    } catch (err) {
      roToast(err.message, "error");
    }
  };

  /* ── DELETE ── */
  window.RO_openDel = function (id) {
    RO.deleteTarget = id;
    const o = RO.orders.find((x) => x._id === id);
    const el = document.getElementById("ro-delOrderNum");
    if (el) el.textContent = o.orderNumber;
    const modal = document.getElementById("ro-delModal");
    if (modal) modal.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  window.RO_openDelFromDrawer = function () {
    RO_openDel(RO.viewingId);
  };

  window.RO_closeDel = function () {
    const modal = document.getElementById("ro-delModal");
    if (modal) modal.classList.remove("open");
    RO.deleteTarget = null;
    document.body.style.overflow = "";
  };

  window.RO_confirmDelete = async function () {
    try {
      await roApiFetch(
        `https://shri-brand.onrender.com/api/v1/orders/${RO.deleteTarget}`,
        { method: "DELETE" },
      );
      RO.orders = RO.orders.filter((x) => x._id !== RO.deleteTarget);
      RO_closeDel();
      roCloseAll();
      roApplyFilters();
      roToast("Order deleted", "error");
    } catch (err) {
      RO_closeDel();
      roToast(err.message, "error");
    }
  };

  /* ── DRAWER HELPERS ── */
  function roOpenDrawer() {
    const ov = document.getElementById("ro-overlay");
    const dr = document.getElementById("ro-viewDrawer");
    if (ov) ov.classList.add("open");
    if (dr) dr.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  window.RO_closeAll = roCloseAll;
  function roCloseAll() {
    const ov = document.getElementById("ro-overlay");
    const dr = document.getElementById("ro-viewDrawer");
    if (ov) ov.classList.remove("open");
    if (dr) dr.classList.remove("open");
    document.body.style.overflow = "";
  }

  /* ── TOAST ── */
  function roToast(msg, type = "success") {
    const w = document.getElementById("ro-toastWrap");
    if (!w) return;
    const el = document.createElement("div");
    el.className = `ro-toast ${type}`;
    const ico =
      type === "success"
        ? "fa-circle-check"
        : type === "error"
          ? "fa-circle-xmark"
          : "fa-circle-info";
    el.innerHTML = `<i class="fa-solid ${ico}"></i>${msg}`;
    w.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .3s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 300);
    }, 2800);
  }
})();
