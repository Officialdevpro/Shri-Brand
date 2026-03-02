/* ═══════════════════════════════════════════
   USER MANAGEMENT — user.js
   Extracted from c.html
   ═══════════════════════════════════════════ */

/* MOCK DATA */
let users = [
    {
        _id: "u1", name: "Admin User", email: "admin@example.com", phone: "9876500001",
        role: "admin", isVerified: true, active: true, joined: "2026-01-29",
        loginAttempts: 0,
        addresses: [
            { addressLine1: "12 Palace Road", addressLine2: "Near Central Park", city: "Chennai", state: "Tamil Nadu", pincode: "600001", phone: "9876500001", isDefault: true }
        ]
    },
    {
        _id: "u2", name: "gfdfd", email: "h@gmail.com", phone: "",
        role: "reseller", isVerified: false, active: true, joined: "2026-01-29",
        loginAttempts: 0, addresses: []
    },
    {
        _id: "u3", name: "g4tg", email: "rtrthe@gmail.com", phone: "",
        role: "customer", isVerified: false, active: true, joined: "2026-01-30",
        loginAttempts: 0, addresses: []
    },
    {
        _id: "u4", name: "MOHAMMED RIFATH M", email: "m.rifath1711@gmail.com", phone: "9988776655",
        role: "customer", isVerified: true, active: true, joined: "2026-01-30",
        loginAttempts: 0,
        addresses: [
            { addressLine1: "45 Gandhi Street", addressLine2: "", city: "Madurai", state: "Tamil Nadu", pincode: "625001", phone: "9988776655", isDefault: true },
            { addressLine1: "Old House, 3rd Cross", addressLine2: "Bypass Road", city: "Coimbatore", state: "Tamil Nadu", pincode: "641001", phone: "9900112233", isDefault: false }
        ]
    },
    {
        _id: "u5", name: "pooja", email: "poojaavaisshanv@gmail.com", phone: "9123456789",
        role: "customer", isVerified: true, active: true, joined: "2026-01-31",
        loginAttempts: 0,
        addresses: [
            { addressLine1: "22 Rose Avenue", addressLine2: "", city: "Bangalore", state: "Karnataka", pincode: "560001", phone: "9123456789", isDefault: true }
        ]
    },
    {
        _id: "u6", name: "Nandhu", email: "naveenv7574@gmail.com", phone: "9876512345",
        role: "customer", isVerified: true, active: true, joined: "2026-02-04",
        loginAttempts: 0,
        addresses: [
            { addressLine1: "7/B Nehru Colony", addressLine2: "2nd Floor", city: "Trichy", state: "Tamil Nadu", pincode: "620001", phone: "9876512345", isDefault: true }
        ]
    },
    {
        _id: "u7", name: "pavithra", email: "cpavithraaa.2007@gmail.com", phone: "",
        role: "customer", isVerified: false, active: false, joined: "2026-02-07",
        loginAttempts: 3, addresses: []
    },
    {
        _id: "u8", name: "Naveen", email: "nandhuv1390@gmail.com", phone: "9001122334",
        role: "admin", isVerified: true, active: true, joined: "2026-02-04",
        loginAttempts: 0,
        addresses: [
            { addressLine1: "Plot 9, Tech Park", addressLine2: "Phase 2", city: "Hyderabad", state: "Telangana", pincode: "500081", phone: "9001122334", isDefault: true }
        ]
    },
];

const ordersByUser = {
    "u5": [
        {
            orderNumber: "SB-20260131-A3F9", createdAt: "2026-01-31",
            orderStatus: "delivered",
            payment: { method: "razorpay", status: "paid", razorpayOrderId: "order_abc123", paidAt: "2026-01-31" },
            pricing: { subtotal: 2799, totalDiscount: 300, shippingCost: 0, total: 2499 },
            shippingAddress: { fullName: "pooja", email: "poojaavaisshanv@gmail.com", phone: "9123456789", address: "22 Rose Avenue", city: "Bangalore", state: "Karnataka", pincode: "560001" },
            items: [{ name: "Silk Pattu Saree", sku: "SAR-001", price: 2499, originalPrice: 2799, discountPercentage: 11, quantity: 1, itemTotal: 2499 }]
        },
        {
            orderNumber: "SB-20260215-B7D2", createdAt: "2026-02-15",
            orderStatus: "shipped",
            payment: { method: "razorpay", status: "paid", razorpayOrderId: "order_def456", paidAt: "2026-02-15" },
            pricing: { subtotal: 1598, totalDiscount: 200, shippingCost: 0, total: 1398 },
            shippingAddress: { fullName: "pooja", email: "poojaavaisshanv@gmail.com", phone: "9123456789", address: "22 Rose Avenue", city: "Bangalore", state: "Karnataka", pincode: "560001" },
            items: [{ name: "Cotton Kurta Set", sku: "KRT-022", price: 699, originalPrice: 799, discountPercentage: 13, quantity: 2, itemTotal: 1398 }]
        }
    ],
    "u6": [
        {
            orderNumber: "SB-20260210-C1E8", createdAt: "2026-02-10",
            orderStatus: "processing",
            payment: { method: "cod", status: "pending", razorpayOrderId: null, paidAt: null },
            pricing: { subtotal: 3200, totalDiscount: 0, shippingCost: 60, total: 3260 },
            shippingAddress: { fullName: "Nandhu", email: "naveenv7574@gmail.com", phone: "9876512345", address: "7/B Nehru Colony, 2nd Floor", city: "Trichy", state: "Tamil Nadu", pincode: "620001" },
            items: [{ name: "Bridal Lehenga", sku: "LHG-008", price: 3200, originalPrice: 3200, discountPercentage: 0, quantity: 1, itemTotal: 3200 }]
        },
        {
            orderNumber: "SB-20260218-D4G3", createdAt: "2026-02-18",
            orderStatus: "placed",
            payment: { method: "razorpay", status: "paid", razorpayOrderId: "order_ghi789", paidAt: "2026-02-18" },
            pricing: { subtotal: 1200, totalDiscount: 150, shippingCost: 0, total: 1050 },
            shippingAddress: { fullName: "Nandhu", email: "naveenv7574@gmail.com", phone: "9876512345", address: "7/B Nehru Colony", city: "Trichy", state: "Tamil Nadu", pincode: "620001" },
            items: [{ name: "Anarkali Suit", sku: "ANK-015", price: 1050, originalPrice: 1200, discountPercentage: 13, quantity: 1, itemTotal: 1050 }]
        }
    ],
    "u8": [
        {
            orderNumber: "SB-20260204-E9K1", createdAt: "2026-02-04",
            orderStatus: "delivered",
            payment: { method: "razorpay", status: "paid", razorpayOrderId: "order_jkl012", paidAt: "2026-02-04" },
            pricing: { subtotal: 4500, totalDiscount: 500, shippingCost: 0, total: 4000 },
            shippingAddress: { fullName: "Naveen", email: "nandhuv1390@gmail.com", phone: "9001122334", address: "Plot 9, Tech Park, Phase 2", city: "Hyderabad", state: "Telangana", pincode: "500081" },
            items: [
                { name: "Banarasi Silk Dupatta", sku: "DUP-031", price: 2000, originalPrice: 2250, discountPercentage: 11, quantity: 1, itemTotal: 2000 },
                { name: "Zari Border Saree", sku: "SAR-077", price: 2000, originalPrice: 2250, discountPercentage: 11, quantity: 1, itemTotal: 2000 }
            ]
        }
    ]
};

/* STATE */
let uFiltered = [];
let uCurrentPage = 1;
const U_PER = 10;
let uEditingId = null;
let uDeleteTarget = null;
let uViewingId = null;
let uActiveTab = "profile";

/* HELPERS */
const uInitials = n => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
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
            <div class="avatar ${u.active ? "" : "av-inactive"}">${uInitials(u.name)}</div>
            <div>
              <div class="u-name">${u.name}</div>
              <div class="u-meta">
                <span class="u-id">#${u._id.replace("u", "").padStart(4, "0")}</span>
                ${!u.active ? '<span class="u-inactive-tag">Inactive</span>' : ""}
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
        <td style="font-size:12px;color:var(--ink-muted);">${uFmtDate(u.joined)}</td>
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
        return (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
            && (!role || u.role === role);
    });

    if (sort === "name") uFiltered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "oldest") uFiltered.sort((a, b) => new Date(a.joined) - new Date(b.joined));
    else if (sort === "orders") uFiltered.sort((a, b) => uOCount(b._id) - uOCount(a._id));
    else uFiltered.sort((a, b) => new Date(b.joined) - new Date(a.joined));

    uCurrentPage = 1; uRender();
}

/* ADD / EDIT DRAWER */
function openAddDrawer() {
    uEditingId = null;
    document.getElementById("editEyebrow").textContent = "New Record";
    document.getElementById("editTitle").textContent = "Add User";
    document.getElementById("passWrap").style.display = "";
    ["f_first", "f_last", "f_email", "f_phone", "f_pass"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("f_role").value = "customer";
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
    document.getElementById("f_status").value = u.active ? "active" : "inactive";
    uOpenDrawer("editDrawer");
}

function saveUser() {
    const first = document.getElementById("f_first").value.trim();
    const email = document.getElementById("f_email").value.trim();
    const phone = document.getElementById("f_phone").value.trim();
    if (!first || !email) { uToast("Name and Email are required", "error"); return; }
    if (phone && !/^[0-9]{10}$/.test(phone)) { uToast("Phone must be exactly 10 digits", "error"); return; }
    if (!uEditingId && document.getElementById("f_pass").value.length < 8) { uToast("Password must be at least 8 characters", "error"); return; }

    if (uEditingId) {
        const u = users.find(x => x._id === uEditingId);
        u.name = (first + " " + document.getElementById("f_last").value.trim()).trim();
        u.email = email; u.phone = phone;
        u.role = document.getElementById("f_role").value;
        u.active = document.getElementById("f_status").value === "active";
        uToast("User updated successfully", "success");
    } else {
        users.unshift({
            _id: "u" + Date.now(),
            name: (first + " " + document.getElementById("f_last").value.trim()).trim(),
            email, phone,
            role: document.getElementById("f_role").value,
            active: document.getElementById("f_status").value === "active",
            joined: new Date().toISOString().split("T")[0],
            loginAttempts: 0, addresses: []
        });
        uToast("User added", "success");
    }
    uCloseAll(); uApplyFilters();
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
      <div class="ph-avatar ${u.active ? "" : "av-inactive"}">${uInitials(u.name)}</div>
      <div class="ph-info">
        <div class="ph-name">${u.name}</div>
        <div class="ph-email">${u.email}</div>
        <div class="ph-status-line">
          <span class="ph-role-tag">${u.role}</span>
          <span class="ph-status-tag ${u.active ? "st-active" : "st-inactive"}">${u.active ? "Active" : "Inactive"}</span>
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
              <div class="pc-value" style="font-family:'Cormorant Garamond',serif;font-size:16px;">#${u._id.replace("u", "").padStart(4, "0")}</div>
            </div>
          </div>
          <div class="pc-row">
            <span class="pc-icon"><i class="fa-solid fa-calendar-plus"></i></span>
            <div class="pc-text">
              <div class="pc-label">Member Since</div>
              <div class="pc-value">${uFmtDate(u.joined)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ADDRESS TAB */
function addressTab(u) {
    if (!u.addresses.length) return `
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
function uConfirmDelete() { users = users.filter(x => x._id !== uDeleteTarget); closeDel(); uApplyFilters(); uToast("User removed", "error"); }

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
