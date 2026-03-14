/**
 * products.js  —  Shri Brand
 * Handles all cart interactions on the index page.
 * API Base: /api/v1/cart  (protected by JWT cookie via authController.protect)
 */

console.log(document.getElementsByClassName(".cart-btn"))

const CART_API = "/api/v1/cart";

// ─────────────────────────────────────────────────────────────────────────────
//  TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
    const existing = document.getElementById("cart-toast");
    if (existing) existing.remove();

    const colors = {
        success: "#10b981",
        error: "#ef4444",
        warning: "#f59e0b",
        info: "#3b82f6",
    };

    const icons = {
        success: "fa-check-circle",
        error: "fa-exclamation-circle",
        warning: "fa-exclamation-triangle",
        info: "fa-info-circle",
    };

    const toast = document.createElement("div");
    toast.id = "cart-toast";
    toast.innerHTML = `<i class="fas ${icons[type]}" style="margin-right:8px;"></i>${message}`;

    Object.assign(toast.style, {
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%) translateY(20px)",
        background: colors[type],
        color: "#fff",
        padding: "12px 22px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        zIndex: "9999",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        opacity: "0",
        transition: "all 0.3s ease",
        whiteSpace: "nowrap",
        maxWidth: "90vw",
        textOverflow: "ellipsis",
        overflow: "hidden",
        fontFamily: "Poppins, sans-serif",
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SET BUTTON LOADING STATE
// ─────────────────────────────────────────────────────────────────────────────
function setButtonLoading(btn, loading) {
    if (loading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        btn.disabled = true;
        btn.style.opacity = "0.75";
    } else {
        btn.innerHTML = btn.dataset.originalText || "Add to Cart";
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADD TO CART (with pack support)
//  POST /api/v1/cart   →   { productId, quantity: 1, packWeight }
// ─────────────────────────────────────────────────────────────────────────────
async function addToCart(productId, btn, packWeight) {
    setButtonLoading(btn, true);

    try {
        const body = { productId, quantity: 1 };
        if (packWeight) body.packWeight = packWeight;

        const res = await fetch(CART_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (res.status === 401) {
            showToast("Please login to add items to your cart!", "warning");
            setTimeout(() => { window.location.href = "/auth"; }, 1500);
            return;
        }

        if (!res.ok) {
            showToast(data.message || "Could not add to cart.", "error");
            return;
        }

        showToast(data.message || "Added to cart!", "success");
        updateCartCount(data.data.cart.summary.totalItems);
        renderCartSidebar(data.data.cart);

    } catch (err) {
        console.error("addToCart error:", err);
        showToast("Network error. Please try again.", "error");
    } finally {
        setButtonLoading(btn, false);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE ITEM QUANTITY
//  PATCH /api/v1/cart/:productId   →   { quantity, packWeight }
// ─────────────────────────────────────────────────────────────────────────────
async function updateQuantity(productId, newQuantity, packWeight) {
    if (newQuantity < 1) {
        removeFromCart(productId, packWeight);
        return;
    }

    try {
        const body = { quantity: newQuantity };
        if (packWeight) body.packWeight = packWeight;

        const res = await fetch(`${CART_API}/${productId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (res.status === 401) {
            showToast("Session expired. Please login again.", "warning");
            setTimeout(() => { window.location.href = "/auth"; }, 1500);
            return;
        }

        if (!res.ok) {
            showToast(data.message || "Could not update quantity.", "error");
            return;
        }

        updateCartCount(data.data.cart.summary.totalItems);
        renderCartSidebar(data.data.cart);

    } catch (err) {
        console.error("updateQuantity error:", err);
        showToast("Network error. Please try again.", "error");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHANGE PACK FOR CART ITEM
//  PATCH /api/v1/cart/:productId   →   { packWeight, newPackWeight }
// ─────────────────────────────────────────────────────────────────────────────
async function changeCartPack(productId, oldPackWeight, newPackWeight) {
    try {
        const res = await fetch(`${CART_API}/${productId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ packWeight: oldPackWeight, newPackWeight }),
        });

        const data = await res.json();

        if (res.status === 401) {
            showToast("Session expired. Please login again.", "warning");
            setTimeout(() => { window.location.href = "/auth"; }, 1500);
            return;
        }

        if (!res.ok) {
            showToast(data.message || "Could not change pack.", "error");
            loadCart(); // Re-render sidebar to revert dropdown
            return;
        }

        showToast(data.message || `Switched to ${newPackWeight}`, "success");
        updateCartCount(data.data.cart.summary.totalItems);
        renderCartSidebar(data.data.cart);

    } catch (err) {
        console.error("changeCartPack error:", err);
        showToast("Network error. Please try again.", "error");
        loadCart(); // Re-render sidebar to revert dropdown
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REMOVE ITEM FROM CART
//  DELETE /api/v1/cart/:productId?packWeight=...
// ─────────────────────────────────────────────────────────────────────────────
async function removeFromCart(productId, packWeight) {
    try {
        let url = `${CART_API}/${productId}`;
        if (packWeight) url += `?packWeight=${encodeURIComponent(packWeight)}`;

        const res = await fetch(url, {
            method: "DELETE",
            credentials: "include",
        });

        const data = await res.json();

        if (res.status === 401) {
            showToast("Session expired. Please login again.", "warning");
            setTimeout(() => { window.location.href = "/auth"; }, 1500);
            return;
        }

        if (!res.ok) {
            showToast(data.message || "Could not remove item.", "error");
            return;
        }

        showToast("Item removed from cart.", "info");
        updateCartCount(data.data.cart.summary.totalItems);
        renderCartSidebar(data.data.cart);

    } catch (err) {
        console.error("removeFromCart error:", err);
        showToast("Network error. Please try again.", "error");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOAD CART  (called on page load)
//  GET /api/v1/cart — also validates cart and returns issues
// ─────────────────────────────────────────────────────────────────────────────
async function loadCart() {
    try {
        const res = await fetch(CART_API, {
            method: "GET",
            credentials: "include",
        });

        if (res.status === 401) return;
        if (!res.ok) return;

        const data = await res.json();
        const cart = data.data?.cart;

        if (cart) {
            updateCartCount(cart.summary?.totalItems || 0);
            renderCartSidebar(cart);
        }

        // Show issue notifications (item removed, stock adjusted, price changed, etc.)
        if (data.issues && data.issues.length > 0) {
            const issueTypes = { unavailable: "error", "pack-unavailable": "error", "out-of-stock": "warning", "stock-reduced": "warning", "price-changed": "info" };
            // Show first 3 issues max to avoid toast spam
            data.issues.slice(0, 3).forEach((issue, i) => {
                setTimeout(() => {
                    showToast(issue.message, issueTypes[issue.issue] || "info");
                }, i * 1200);
            });
        }

    } catch (err) {
        console.warn("Could not load cart:", err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE CART COUNT BADGE
// ─────────────────────────────────────────────────────────────────────────────
function updateCartCount(count) {
    const badge = document.getElementById("nav-cart-count");
    if (!badge) return;

    badge.textContent = count || 0;

    badge.style.transform = "scale(1.4)";
    setTimeout(() => { badge.style.transform = "scale(1)"; }, 200);
}

// ─────────────────────────────────────────────────────────────────────────────
//  RENDER CART SIDEBAR
//  Populates the #card sidebar in index.ejs — with pack selector dropdown
//  Freezes items whose selected pack is out of stock; blocks checkout if frozen
// ─────────────────────────────────────────────────────────────────────────────
function renderCartSidebar(cart) {
    const container = document.getElementById("cart-items-container");
    const emptyMsg = document.getElementById("empty-cart-msg");
    const totalEl = document.getElementById("cart-total");
    const countEl = document.getElementById("cart-item-count");
    const summaryEl = document.getElementById("cart-summary");
    const checkoutBtn = document.getElementById("checkout-btn");

    if (!container) return;

    const items = cart.items || [];

    // Update header count
    if (countEl) {
        countEl.textContent = `${cart.summary?.itemCount || 0} item${(cart.summary?.itemCount || 0) !== 1 ? "s" : ""}`;
    }

    // Update total
    if (totalEl) {
        totalEl.textContent = `₹${cart.summary?.subtotal || 0}`;
    }

    // Show / hide summary bar
    if (summaryEl) {
        summaryEl.style.display = items.length > 0 ? "block" : "none";
    }

    // Empty state
    if (items.length === 0) {
        if (emptyMsg) emptyMsg.style.display = "flex";
        const rendered = container.querySelectorAll(".selecteditems");
        rendered.forEach(el => el.remove());
        // Enable checkout (nothing to block)
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = "1";
            checkoutBtn.title = "";
        }
        return;
    }

    // Hide empty message
    if (emptyMsg) emptyMsg.style.display = "none";

    // Rebuild items
    const oldItems = container.querySelectorAll(".selecteditems");
    oldItems.forEach(el => el.remove());

    // Track if any item is frozen (out of stock)
    let hasFrozenItems = false;

    // Render each cart item
    items.forEach(item => {
        const pack = item.selectedPack || {};
        const packs = item.availablePacks || [];
        const isFrozen = (pack.stock || 0) <= 0; // selected pack is out of stock
        const anyPackInStock = packs.some(p => p.stock > 0);
        const allOutOfStock = !anyPackInStock;

        if (isFrozen) hasFrozenItems = true;

        const div = document.createElement("div");
        div.className = "selecteditems product-details";
        div.dataset.productId = item.productId;
        div.dataset.packWeight = pack.weight || "";

        // Frozen item styling
        if (isFrozen) {
            div.style.cssText += "border:2px solid #ef4444;border-radius:10px;background:#fef2f2;position:relative;";
        }

        // Build pack dropdown options
        let packOptions = "";
        if (packs.length > 1) {
            packOptions = packs.map(p =>
                `<option value="${p.weight}" ${p.weight === pack.weight ? "selected" : ""} ${p.stock <= 0 ? "disabled" : ""}>` +
                `${p.weight} — ₹${p.price}${p.stock <= 0 ? " (Out of Stock)" : ""}` +
                `</option>`
            ).join("");
        }

        // Build frozen warning banner
        const frozenBanner = isFrozen
            ? `<div style="background:#fde8e8;color:#b91c1c;font-size:11px;font-weight:600;padding:6px 10px;border-radius:6px;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${allOutOfStock
                ? "All packs are out of stock. Please remove this item."
                : "This pack is out of stock. Switch to another pack or remove."}
               </div>`
            : "";

        // Quantity controls — disabled if frozen
        const qtyMinusDisabled = isFrozen || item.quantity <= 1;
        const qtyPlusDisabled = isFrozen || item.quantity >= (pack.stock || 0);

        div.innerHTML = `
            <div class="card-img">
                <img src="${item.mainImage}" alt="${item.name}"
                    onerror="this.src='/assets/images/logo/Logo.png'"
                    style="width:80px;height:80px;object-fit:cover;border-radius:8px;${isFrozen ? 'opacity:0.5;filter:grayscale(40%);' : ''}" />
            </div>
            <div class="product-d" style="margin-left:12px;flex:1;">
                <p style="font-weight:600;font-size:13px;margin-bottom:4px;${isFrozen ? 'color:#999;' : ''}">${item.name}</p>
                ${frozenBanner}
                <p style="color:#888;font-size:12px;margin-bottom:4px;">
                    ${isFrozen ? '<strike style="color:#ccc;">' : ''}₹${pack.price || 0}${isFrozen ? '</strike>' : ''}
                    ${(!isFrozen && pack.originalPrice && pack.originalPrice > pack.price)
                ? `<strike style="color:#bbb;margin-left:4px;">₹${pack.originalPrice}</strike>`
                : ""}
                </p>
                ${packs.length > 1
                ? `<select class="pack-select"
                             onchange="changeCartPack('${item.productId}', '${pack.weight}', this.value)"
                             style="font-size:12px;padding:3px 6px;border:1px solid ${isFrozen ? '#ef4444' : '#ccc'};border-radius:4px;margin-bottom:6px;background:${isFrozen ? '#fff5f5' : '#f9f9f9'};cursor:pointer;${allOutOfStock ? 'opacity:0.5;pointer-events:none;' : ''}"
                             ${allOutOfStock ? 'disabled' : ''}>
                             ${packOptions}
                       </select>`
                : `<p style="color:#aaa;font-size:11px;margin-bottom:6px;">Pack: ${pack.weight || "—"}</p>`
            }
                <div class="btns">
                    <div class="qty-control">
                        <button class="qty-btn"
                            onclick="updateQuantity('${item.productId}', ${item.quantity - 1}, '${pack.weight}')"
                            ${qtyMinusDisabled ? "disabled" : ""}
                            style="${qtyMinusDisabled ? "opacity:0.4;cursor:not-allowed;" : ""}">
                            −
                        </button>
                        <span class="qty-value" style="${isFrozen ? 'color:#ccc;' : ''}">${item.quantity}</span>
                        <button class="qty-btn"
                            onclick="updateQuantity('${item.productId}', ${item.quantity + 1}, '${pack.weight}')"
                            ${qtyPlusDisabled ? "disabled" : ""}
                            style="${qtyPlusDisabled ? "opacity:0.4;cursor:not-allowed;" : ""}">
                            +
                        </button>
                    </div>
                    <button class="remove"
                        onclick="removeFromCart('${item.productId}', '${pack.weight}')"
                        style="${isFrozen ? 'color:#ef4444;font-weight:700;' : ''}">
                        ${isFrozen ? '<i class="fas fa-trash-alt"></i> Remove' : 'Remove'}
                    </button>
                </div>
            </div>
        `;

        container.appendChild(div);
    });

    // ── Checkout button: block if any item is frozen ──
    if (checkoutBtn) {
        if (hasFrozenItems) {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = "0.5";
            checkoutBtn.style.cursor = "not-allowed";
            checkoutBtn.title = "Remove or fix out-of-stock items before checkout";
        } else {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = "1";
            checkoutBtn.style.cursor = "pointer";
            checkoutBtn.title = "";
        }
    }

    // ── Frozen items warning above checkout ──
    const existingWarning = container.parentElement?.querySelector(".cart-oos-warning");
    if (existingWarning) existingWarning.remove();

    if (hasFrozenItems && checkoutBtn) {
        const warning = document.createElement("div");
        warning.className = "cart-oos-warning";
        warning.style.cssText = "text-align:center;padding:10px 12px;font-size:12px;color:#b91c1c;font-weight:600;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:8px 0;";
        warning.innerHTML = '<i class="fas fa-exclamation-circle"></i> Some items are out of stock. Update or remove them to proceed.';
        checkoutBtn.parentElement.insertBefore(warning, checkoutBtn);
    }

}

// ─────────────────────────────────────────────────────────────────────────────
//  WIRE UP "ADD TO CART" BUTTONS — now passes pack weight
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

    document.querySelectorAll(".addtoplate").forEach(btn => {
        const card = btn.closest(".card, .gift-card");
        const isOutOfStock = card && card.querySelector(".stock-label");

        if (isOutOfStock) {
            btn.disabled = true;
            btn.textContent = "Out of Stock";
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
            return;
        }

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const productId = btn.dataset.id;
            const packWeight = btn.dataset.packWeight || "";
            if (!productId) {
                showToast("Product ID missing.", "error");
                return;
            }
            addToCart(productId, btn, packWeight);
        });
    });

    // Checkout button
    const checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            window.location.href = "/checkout";
        });
    }

    // Load cart on page load
    loadCart();
});