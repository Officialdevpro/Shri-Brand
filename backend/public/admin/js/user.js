/* ═══════════════════════════════════════════
   USER MANAGEMENT — user.js
   Extracted from c.html
   ═══════════════════════════════════════════ */

/* MOCK DATA REMOVED - USING REAL API */
let users = [];
const ordersByUser = {};
let uLoading = false;

async function loadUsers() {
    if (uLoading) return;
    uLoading = true;
    
    // Show loading state if table body is empty
    const tbody = document.getElementById("usersBody");
    const empty = document.getElementById("uEmptyState");
    if (tbody && users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--ink-muted);">Loading users...</td></tr>`;
        if (empty) empty.style.display = "none";
    }

    try {
        const [uRes, oRes] = await Promise.all([
            fetch("/api/v1/users", { credentials: "include" }),
            // Fetch a sufficiently large number of orders to populate the per-user order arrays for admin
            fetch("/api/v1/orders?limit=5000", { credentials: "include" })
        ]);

        const uData = await uRes.json();
        if (!uRes.ok) throw new Error(uData.message || "Failed to fetch users");
        
        const oData = await oRes.json();
        const allOrders = oData.data?.orders || [];
        
        users = uData.data.data || uData.data.users || uData.data || [];
        
        // Populate ordersByUser map
        for (const k in ordersByUser) delete ordersByUser[k];
        allOrders.forEach(o => {
            const uid = o.userId?._id || o.userId;
            if (!ordersByUser[uid]) ordersByUser[uid] = [];
            ordersByUser[uid].push(o);
        });

        uApplyFilters();
    } catch (err) {
        console.error("Error fetching data:", err);
        uToast(err.message, "error");
        
        if (users.length === 0 && tbody) {
            tbody.innerHTML = "";
            if (empty) empty.style.display = "block";
        }
    } finally {
        uLoading = false;
    }
}
window.loadUsers = loadUsers;

/* STATE */
let uFiltered = [];
let uCurrentPage = 1;
const U_PER = 10;
let uEditingId = null;
let uDeleteTarget = null;
let uViewingId = null;
let uActiveTab = "profile";

/* HELPERS */
const uInitials = n => (n || "User").split(" ").map(p => p[0] || "").join("").slice(0, 2).toUpperCase();
const uFmtDate = d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const uFmtCur = n => "₹" + Number(n).toLocaleString("en-IN");
const uOCount = id => (ordersByUser[id] || []).length;
const uOSpend = id => (ordersByUser[id] || []).reduce((s, o) => s + o.pricing.total, 0);
const uRoleBadge = r => `<span class="role-badge role-${r}">${r}</span>`;

/* TABLE RENDER */
function uRender() {
    const tbody = document.getElementById("usersBody");
    const empty = document.getElementById("uEmptyState");
    const page = uFiltered.slice((uCurrentPage - 1) * U_PER, uCurrentPage * U_PER);

    document.getElementById("uTotalCount").textContent = users.length;

    if (!uFiltered.length) { tbody.innerHTML = ""; empty.style.display = "block"; }
    else {
        empty.style.display = "none";
        tbody.innerHTML = page.map((u, i) => `
      <tr style="animation-delay:${i * .04}s" onclick="openView('${u._id}')">
        <td>
          <div class="user-cell">
            <div class="avatar ${u.active !== false ? "" : "av-inactive"}">${uInitials(u.name)}</div>
            <div>
              <div class="u-name">${u.name}</div>
              <div class="u-meta">
                <span class="u-id">#${u._id.toString().slice(-6).toUpperCase()}</span>
                ${u.active === false ? '<span class="u-inactive-tag">Inactive</span>' : ""}
              </div>
            </div>
          </div>
        </td>
        <td style="font-size:12.5px;color:var(--ink-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;">${u.email}</td>
        <td>${uRoleBadge(u.role)}</td>
        <td style="font-size:12.5px;color:var(--ink-muted);">${u.phone || '<span style="color:var(--ink-faint);font-style:italic;font-size:11.5px;">—</span>'}</td>
        <td>
          <div class="orders-wrap">
            <span class="orders-num">${uOCount(u._id)}</span>
            ${uOCount(u._id) > 0 ? `<span class="orders-sub">orders</span>` : "—"}
          </div>
        </td>
        <td style="font-size:12px;color:var(--ink-muted);">${uFmtDate(u.createdAt || u.joined)}</td>
        <td onclick="event.stopPropagation()">
          <div class="act-cell">
            <button class="act-btn" title="Edit user" onclick="openEdit('${u._id}')"><i class="fa-regular fa-pen-to-square"></i></button>
            <button class="act-btn danger" title="Delete user" onclick="openDel('${u._id}')"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </td>
      </tr>`).join("");
    }
    uRenderPg();
}

function uRenderPg() {
    const total = uFiltered.length, pages = Math.ceil(total / U_PER);
    const s = Math.min((uCurrentPage - 1) * U_PER + 1, total || 0);
    const e = Math.min(uCurrentPage * U_PER, total);
    document.getElementById("uPgInfo").textContent = total ? `Showing ${s}–${e} of ${total} users` : "";
    let h = `<button class="pg-btn" ${uCurrentPage === 1 ? "disabled" : ""} onclick="uGoP(${uCurrentPage - 1})"><i class="fa-solid fa-chevron-left" style="font-size:9px;"></i></button>`;
    for (let p = 1; p <= pages; p++) h += `<button class="pg-btn ${p === uCurrentPage ? "active" : ""}" onclick="uGoP(${p})">${p}</button>`;
    h += `<button class="pg-btn" ${uCurrentPage >= pages || !pages ? "disabled" : ""} onclick="uGoP(${uCurrentPage + 1})"><i class="fa-solid fa-chevron-right" style="font-size:9px;"></i></button>`;
    document.getElementById("uPgBtns").innerHTML = h;
}
function uGoP(p) { uCurrentPage = p; uRender(); }

/* FILTERS */
function uApplyFilters() {
    const q = document.getElementById("uSearchInput").value.toLowerCase();
    const role = document.getElementById("uRoleFilter").value;
    const sort = document.getElementById("uSortFilter").value;

    uFiltered = users.filter(u => {
        const uName = u.name || "";
        const uEmail = u.email || "";
        return (!q || uName.toLowerCase().includes(q) || uEmail.toLowerCase().includes(q))
            && (!role || u.role === role);
    });

    if (sort === "name") uFiltered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sort === "oldest") uFiltered.sort((a, b) => new Date(a.createdAt || a.joined) - new Date(b.createdAt || b.joined));
    else if (sort === "orders") uFiltered.sort((a, b) => uOCount(b._id) - uOCount(a._id));
    else uFiltered.sort((a, b) => new Date(b.createdAt || b.joined) - new Date(a.createdAt || a.joined));

    uCurrentPage = 1; uRender();
}

/* ADD / EDIT DRAWER */
function openAddDrawer() {
    uEditingId = null;
    document.getElementById("editEyebrow").textContent = "New Record";
    document.getElementById("editTitle").textContent = "Add User";
    document.getElementById("passWrap").style.display = "";
    ["f_first", "f_last", "f_email", "f_phone", "f_pass"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("f_role").value = "user";
    document.getElementById("f_status").value = "active";
    uOpenDrawer("editDrawer");
}

function openEdit(id) {
    uEditingId = id;
    const u = users.find(x => x._id === id);
    document.getElementById("editEyebrow").textContent = "Edit Record";
    document.getElementById("editTitle").textContent = "Edit User";
    document.getElementById("passWrap").style.display = "none";
    const parts = u.name.split(" ");
    document.getElementById("f_first").value = parts[0] || "";
    document.getElementById("f_last").value = parts.slice(1).join(" ") || "";
    document.getElementById("f_email").value = u.email;
    document.getElementById("f_phone").value = u.phone || "";
    document.getElementById("f_role").value = u.role;
    document.getElementById("f_status").value = u.active !== false ? "active" : "inactive";
    uOpenDrawer("editDrawer");
}

async function saveUser() {
    const first = document.getElementById("f_first").value.trim();
    const last = document.getElementById("f_last").value.trim();
    const email = document.getElementById("f_email").value.trim();
    const phone = document.getElementById("f_phone").value.trim();
    if (!first || !email) { uToast("Name and Email are required", "error"); return; }
    if (phone && !/^[0-9]{10}$/.test(phone)) { uToast("Phone must be exactly 10 digits", "error"); return; }
    if (!uEditingId && document.getElementById("f_pass").value.length < 8) { uToast("Password must be at least 8 characters", "error"); return; }

    const fullName = (first + " " + last).trim();

    try {
        if (uEditingId) {
            // ── UPDATE existing user via API ──
            const body = {
                name: fullName,
                email,
                phone: phone || undefined,
                role: document.getElementById("f_role").value,
                active: document.getElementById("f_status").value === "active"
            };
            const res = await fetch(`/api/v1/users/${uEditingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to update user");
            uToast("User updated successfully", "success");
        } else {
            // ── CREATE new user via admin API ──
            const body = {
                name: fullName,
                email,
                password: document.getElementById("f_pass").value,
                phone: phone || undefined,
                role: document.getElementById("f_role").value
            };
            const res = await fetch("/api/v1/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to create user");
            uToast("User added successfully", "success");
        }
        uCloseAll();
        await loadUsers();
    } catch (err) {
        console.error("Save user error:", err);
        uToast(err.message, "error");
    }
}

/* VIEW DRAWER */
function openView(id) {
    uViewingId = id; uActiveTab = "profile";
    const u = users.find(x => x._id === id);
    document.getElementById("vd_name").textContent = u.name;
    buildHero(u);
    buildTab(u, "profile");
    document.querySelectorAll("#viewDrawer .tab-btn").forEach((b, i) => b.classList.toggle("active", i === 0));
    uOpenDrawer("viewDrawer");
}

function buildHero(u) {
    const oc = uOCount(u._id), sp = uOSpend(u._id);
    document.getElementById("vd_hero").innerHTML = `
    <div class="profile-hero">
      <div class="ph-avatar ${u.active !== false ? "" : "av-inactive"}">${uInitials(u.name)}</div>
      <div class="ph-info">
        <div class="ph-name">${u.name}</div>
        <div class="ph-email">${u.email}</div>
        <div class="ph-status-line">
          <span class="ph-role-tag">${u.role}</span>
          <span class="ph-status-tag ${u.active !== false ? "st-active" : "st-inactive"}">${u.active !== false ? "Active" : "Inactive"}</span>
          ${oc ? `<span class="ph-order-count">${oc} order${oc > 1 ? "s" : ""} · ${uFmtCur(sp)}</span>` : ""}
        </div>
      </div>
    </div>`;
}

function switchTab(tab, el) {
    uActiveTab = tab;
    document.querySelectorAll("#viewDrawer .tab-btn").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
    const u = users.find(x => x._id === uViewingId);
    if (u) buildTab(u, tab);
}

function buildTab(u, tab) {
    const body = document.getElementById("vd_body");
    if (tab === "profile") body.innerHTML = profileTab(u);
    else if (tab === "address") body.innerHTML = addressTab(u);
    else body.innerHTML = ordersTab(u);
}

/* PROFILE TAB */
function profileTab(u) {
    return `
    <div class="prof-cards-grid">
      <div class="prof-card">
        <div class="prof-card-head"><i class="fa-solid fa-address-card"></i> Contact Details</div>
        <div class="prof-card-body">
          <div class="pc-row">
            <span class="pc-icon"><i class="fa-solid fa-user"></i></span>
            <div class="pc-text">
              <div class="pc-label">Full Name</div>
              <div class="pc-value">${u.name}</div>
            </div>
          </div>
          <div class="pc-row">
            <span class="pc-icon"><i class="fa-solid fa-envelope"></i></span>
            <div class="pc-text">
              <div class="pc-label">Email Address</div>
              <div class="pc-value" style="font-size:12px;word-break:break-all;">${u.email}</div>
            </div>
          </div>
          <div class="pc-row">
            <span class="pc-icon"><i class="fa-solid fa-phone"></i></span>
            <div class="pc-text">
              <div class="pc-label">Phone</div>
              <div class="pc-value ${u.phone ? "" : "nil"}">${u.phone || "Not provided"}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="prof-card">
        <div class="prof-card-head"><i class="fa-solid fa-shield-halved"></i> Account Details</div>
        <div class="prof-card-body">
          <div class="pc-row">
            <span class="pc-icon"><i class="fa-solid fa-crown"></i></span>
            <div class="pc-text">
              <div class="pc-label">Role</div>
              <div class="pc-value" style="text-transform:capitalize;">${u.role}</div>
            </div>
          </div>
          <div class="pc-row">
            <span class="pc-icon"><i class="fa-solid fa-id-card"></i></span>
            <div class="pc-text">
              <div class="pc-label">User ID</div>
              <div class="pc-value" style="font-family:'Cormorant Garamond',serif;font-size:16px;">#${u._id.toString().slice(-6).toUpperCase()}</div>
            </div>
          </div>
          <div class="pc-row">
            <span class="pc-icon"><i class="fa-solid fa-calendar-plus"></i></span>
            <div class="pc-text">
              <div class="pc-label">Member Since</div>
              <div class="pc-value">${uFmtDate(u.createdAt || u.joined)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ADDRESS TAB */
function addressTab(u) {
    if (!u.addresses || !u.addresses.length) return `
    <div class="no-data">
      <i class="fa-solid fa-location-dot"></i>
      <p>No saved addresses.<br><span style="font-size:11px;color:var(--ink-faint)">Addresses are captured when the user places an order and fills in their shipping details.</span></p>
    </div>`;
    return `
    <div>
      <div class="sec-hd">${u.addresses.length} Saved Address${u.addresses.length > 1 ? "es" : ""}</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${u.addresses.map(a => `
          <div class="addr-card ${a.isDefault ? "dflt" : ""}">
            ${a.isDefault ? '<span class="addr-dflt-tag">Default</span>' : ""}
            <div class="addr-line">
              <strong>${a.addressLine1}</strong>${a.addressLine2 ? ", " + a.addressLine2 : ""}<br>
              ${a.city}, ${a.state} — ${a.pincode}
            </div>
            <div class="addr-ph"><i class="fa-solid fa-phone"></i>${a.phone}</div>
          </div>`).join("")}
      </div>
    </div>`;
}

/* ORDERS TAB */
function ordersTab(u) {
    const orders = ordersByUser[u._id] || [];
    if (!orders.length) return `
    <div class="no-data">
      <i class="fa-solid fa-box-open"></i>
      <p>No orders placed yet.<br><span style="font-size:11px;color:var(--ink-faint)">When this user places an order, the full cart snapshot, payment details, and shipping info will appear here.</span></p>
    </div>`;
    const sp = uOSpend(u._id);
    const delivered = orders.filter(o => o.orderStatus === "delivered").length;
    return `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-num">${orders.length}</div><div class="stat-lbl">Total Orders</div></div>
      <div class="stat-box"><div class="stat-num">${delivered}</div><div class="stat-lbl">Delivered</div></div>
      <div class="stat-box"><div class="stat-num">${uFmtCur(sp)}</div><div class="stat-lbl">Total Spent</div></div>
    </div>
    <div>
      <div class="sec-hd">All Orders (${orders.length})</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${orders.map(o => uOrderCard(o)).join("")}
      </div>
    </div>`;
}

/* ORDER CARD */
function uOrderCard(o) {
    const osMap = { "placed": "os-placed", "processing": "os-processing", "shipped": "os-shipped", "delivered": "os-delivered", "cancelled": "os-cancelled" };
    const pyMap = { "paid": "pp-paid", "pending": "pp-pending", "failed": "pp-failed", "refunded": "pp-refunded" };
    const osCls = osMap[o.orderStatus] || "os-placed";
    const pyCls = pyMap[o.payment.status] || "pp-pending";
    const pricingNote = [];
    if (o.pricing.totalDiscount) pricingNote.push(`saved ${uFmtCur(o.pricing.totalDiscount)}`);
    if (o.pricing.shippingCost) pricingNote.push(`shipping ${uFmtCur(o.pricing.shippingCost)}`);
    return `
    <div class="order-card">
      <div class="order-head">
        <div>
          <div class="o-num">${o.orderNumber}</div>
          <div class="o-date">${uFmtDate(o.createdAt)} &nbsp;·&nbsp; ${o.payment.method === "cod" ? "Cash on Delivery" : "Razorpay"}</div>
        </div>
        <div class="o-badges">
          <span class="o-status ${osCls}">${o.orderStatus}</span>
          <span class="pay-badge ${pyCls}">${o.payment.status}</span>
        </div>
      </div>
      <div class="order-items">
        ${o.items.map(it => `
          <div class="o-item">
            <div class="o-img-ph"><i class="fa-solid fa-shirt"></i></div>
            <div style="flex:1;min-width:0;">
              <div class="o-iname">${it.name}</div>
              <div class="o-isku">${it.sku}${it.discountPercentage ? ` · ${it.discountPercentage}% off` : ""}</div>
            </div>
            <div class="o-iqty">×${it.quantity}</div>
            <div class="o-iprice">${uFmtCur(it.itemTotal)}</div>
          </div>`).join("")}
      </div>
      <div class="ship-row">
        <i class="fa-solid fa-location-dot"></i>
        <span>${o.shippingAddress.fullName} &nbsp;·&nbsp; ${o.shippingAddress.phone}<br>
        ${o.shippingAddress.address}, ${o.shippingAddress.city}, ${o.shippingAddress.state} — ${o.shippingAddress.pincode}</span>
      </div>
      <div class="order-foot">
        <div class="o-pricing-detail">
          Subtotal ${uFmtCur(o.pricing.subtotal)}${pricingNote.length ? " · " + pricingNote.join(" · ") : ""}
        </div>
        <div>
          <span style="font-size:11px;color:var(--ink-faint);margin-right:6px;">Order Total</span>
          <span class="o-total-val">${uFmtCur(o.pricing.total)}</span>
        </div>
      </div>
    </div>`;
}

function editFromView() { uCloseAll(); setTimeout(() => openEdit(uViewingId), 90); }

/* DELETE */
function openDel(id) {
    uDeleteTarget = id;
    document.getElementById("uDelName").textContent = users.find(x => x._id === id).name;
    document.getElementById("userDelModal").classList.add("open");
    document.body.style.overflow = "hidden";
}
function closeDel() {
    document.getElementById("userDelModal").classList.remove("open");
    uDeleteTarget = null;
    document.body.style.overflow = "";
}
async function uConfirmDelete() {
    try {
        const res = await fetch(`/api/v1/users/${uDeleteTarget}`, {
            method: "DELETE",
            credentials: "include"
        });
        if (!res.ok && res.status !== 204) {
            const data = await res.json();
            throw new Error(data.message || "Failed to delete user");
        }
        closeDel();
        uToast("User removed", "success");
        await loadUsers();
    } catch (err) {
        console.error("Delete user error:", err);
        closeDel();
        uToast(err.message, "error");
    }
}

/* DRAWER HELPERS */
function uOpenDrawer(id) {
    document.getElementById("userOverlay").classList.add("open");
    document.getElementById(id).classList.add("open");
    document.body.style.overflow = "hidden";
}
function uCloseAll() {
    document.getElementById("userOverlay").classList.remove("open");
    ["editDrawer", "viewDrawer"].forEach(id => document.getElementById(id).classList.remove("open"));
    document.body.style.overflow = "";
}

/* TOAST */
function uToast(msg, type = "success") {
    const w = document.getElementById("userToastWrap");
    const el = document.createElement("div");
    el.className = `u-toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-xmark"}"></i>${msg}`;
    w.appendChild(el);
    setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 2800);
}

/* Init */
uApplyFilters();
