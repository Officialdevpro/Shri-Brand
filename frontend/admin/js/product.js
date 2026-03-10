(function () {
  "use strict";

  const API = "http://127.0.0.1:5000/api/v1/products";
  const CAT_API = "http://127.0.0.1:5000/api/v1/categories";

  let products = [],
    isEditing = false,
    pendingDelId = null;
  let searchQ = "",
    fType = "",
    fCat = "";

  // Image state
  let heroState = { url: null, file: null };
  let stripStates = [
    { url: null, file: null },
    { url: null, file: null },
    { url: null, file: null },
    { url: null, file: null },
  ];
  let removedStrip = new Set();

  // Pack state — array of pack objects
  let packsState = [];

  // Category state
  const DEFAULT_CATS = [
    { name: "single", label: "Single" },
    { name: "combo", label: "Combo" },
    { name: "gift", label: "Gift" },
  ];
  let categoriesData = [];

  const $ = (id) => document.getElementById(id);

  init();

  function init() {
    bindUI();
    bindHeroSlot();
    renderStrip();
    renderPacks();
    fetchCategories();
    fetchProducts();
  }

  // ── Fetch ──────────────────────────────────────────
  async function fetchProducts() {
    try {
      const r = await fetch(`${API}?limit=200`);
      if (!r.ok) throw 0;
      const d = await r.json();
      products = Array.isArray(d) ? d : d.products || d.data || [];
    } catch {
      products = sampleData();
    }
    renderGrid();
    updateCount();
  }

  // ── Bind UI ────────────────────────────────────────
  function bindUI() {
    $("btnAddProduct").addEventListener("click", () => openDrawer(false));
    $("drawerClose").addEventListener("click", closeDrawer);
    $("btnCancel").addEventListener("click", closeDrawer);
    $("drawerOverlay").addEventListener("click", closeDrawer);
    $("btnSave").addEventListener("click", handleSave);
    $("btnAddPack").addEventListener("click", addPack);
    $("fName").addEventListener("input", () => {
      if (!isEditing) $("fSlug").value = toSlug($("fName").value);
    });
    $("searchInput").addEventListener("input", (e) => {
      searchQ = e.target.value.toLowerCase();
      renderGrid();
    });
    $("filterType").addEventListener("change", (e) => {
      fType = e.target.value;
      renderGrid();
    });
    $("filterCat").addEventListener("change", (e) => {
      fCat = e.target.value;
      renderGrid();
    });
    $("modalCancel").addEventListener("click", closeModal);
    $("modalConfirm").addEventListener("click", doDelete);

    // Category manager modal
    $("btnToggleCatMgr").addEventListener("click", openCatModal);
    $("catModalClose").addEventListener("click", closeCatModal);
    $("catModalBack").addEventListener("click", (e) => { if (e.target === $("catModalBack")) closeCatModal(); });
    $("btnAddCat").addEventListener("click", addCategory);
    $("newCatName").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } });
    $("newCatLabel").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } });

    // Confirm modal
    $("confirmModalCancel").addEventListener("click", closeConfirmModal);
    $("confirmModalClose").addEventListener("click", closeConfirmModal);
    $("confirmModalBack").addEventListener("click", (e) => { if (e.target === $("confirmModalBack")) closeConfirmModal(); });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDrawer();
        closeModal();
        closeCatModal();
        closeConfirmModal();
      }
    });
  }

  // ── Category Manager ────────────────────────────────
  function openCatModal() {
    $("catModalBack").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeCatModal() {
    $("catModalBack").classList.remove("open");
    // Only restore overflow if drawer isn't open
    if (!$("drawer").classList.contains("open")) {
      document.body.style.overflow = "";
    }
  }

  async function fetchCategories() {
    try {
      const r = await fetch(CAT_API);
      if (!r.ok) throw 0;
      const d = await r.json();
      categoriesData = d.data || [];
    } catch {
      categoriesData = [];
    }

    // Merge defaults if not already in DB
    const existingNames = new Set(categoriesData.map((c) => c.name.toLowerCase()));
    DEFAULT_CATS.forEach((dc) => {
      if (!existingNames.has(dc.name)) {
        categoriesData.push({ ...dc, _isDefault: true });
      }
    });

    populateCatDropdowns();
    renderCatManager();
  }

  function populateCatDropdowns() {
    const fType = $("fType");
    const filterType = $("filterType");
    const prevVal = fType.value;

    fType.innerHTML = "";
    categoriesData.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.label || c.name.charAt(0).toUpperCase() + c.name.slice(1);
      fType.appendChild(opt);
    });
    if (prevVal && [...fType.options].some((o) => o.value === prevVal)) {
      fType.value = prevVal;
    }

    const current = filterType.value;
    filterType.innerHTML = '<option value="">All Types</option>';
    categoriesData.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.label || c.name.charAt(0).toUpperCase() + c.name.slice(1);
      filterType.appendChild(opt);
    });
    if (current) filterType.value = current;
  }

  let dragSrcIdx = null;

  function renderCatManager() {
    const list = $("catManagerList");
    if (!list) return;

    if (categoriesData.length === 0) {
      list.innerHTML = '<div style="font-size:11px;color:#aa9988;padding:6px 0;">No categories yet.</div>';
      return;
    }

    list.innerHTML = categoriesData
      .map((c, i) => {
        const id = c._id || "";
        const isDefault = c._isDefault;
        return `<div class="cat-item" draggable="true" data-cat-idx="${i}">
          <span class="cat-item-grip"><i class="fas fa-grip-vertical"></i></span>
          <span class="cat-item-order">${i + 1}</span>
          <div class="cat-item-info">
            <span class="cat-item-name">${esc(c.name)}</span>
            <span class="cat-item-label">— ${esc(c.label || "")}</span>
          </div>
          ${isDefault ? '<span class="cat-item-badge">default</span>' : ''}
          ${!isDefault ? `<button type="button" class="cat-item-rm" data-cat-del="${id}" title="Delete category"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>`;
      })
      .join("");

    // Bind delete buttons
    list.querySelectorAll("[data-cat-del]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteCategory(btn.dataset.catDel);
      });
    });

    // Bind drag-and-drop
    list.querySelectorAll(".cat-item").forEach((el) => {
      el.addEventListener("dragstart", (e) => {
        dragSrcIdx = parseInt(el.dataset.catIdx, 10);
        el.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
        list.querySelectorAll(".cat-item").forEach((x) => x.classList.remove("drag-over"));
        dragSrcIdx = null;
      });
      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        el.classList.add("drag-over");
      });
      el.addEventListener("dragleave", () => {
        el.classList.remove("drag-over");
      });
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.classList.remove("drag-over");
        const targetIdx = parseInt(el.dataset.catIdx, 10);
        if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;

        // Reorder in array
        const [moved] = categoriesData.splice(dragSrcIdx, 1);
        categoriesData.splice(targetIdx, 0, moved);

        renderCatManager();
        populateCatDropdowns();
        saveCategoryOrder();
      });
    });
  }

  async function saveCategoryOrder() {
    // Update order values and PATCH each category that's in the DB
    const updates = categoriesData
      .map((c, i) => ({ ...c, order: i }))
      .filter((c) => c._id); // only save those with a DB id

    try {
      await Promise.all(
        updates.map((c) =>
          fetch(`${CAT_API}/${c._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: c.order }),
          })
        )
      );
      showNotif("Category order saved.", "success");
    } catch {
      showNotif("Could not save order.", "error");
    }
  }

  async function addCategory() {
    const nameEl = $("newCatName");
    const labelEl = $("newCatLabel");
    const name = nameEl.value.trim().toLowerCase();
    const label = labelEl.value.trim();

    if (!name) { showNotif("Category name is required.", "error"); return; }
    if (!label) { showNotif("Category label is required.", "error"); return; }

    try {
      const r = await fetch(CAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, label, order: categoriesData.length }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create category");
      }
      showNotif(`Category "${label}" created.`, "success");
      nameEl.value = "";
      labelEl.value = "";
      await fetchCategories();
    } catch (err) {
      showNotif(err.message || "Could not create category.", "error");
    }
  }

  async function deleteCategory(id) {
    if (!id) return;
    showConfirm(
      "Delete Category",
      "Are you sure you want to delete this category? Products using it will need to be reassigned.",
      async () => {
        try {
          const r = await fetch(`${CAT_API}/${id}`, { method: "DELETE" });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.message || "Delete failed");
          }
          showNotif("Category deleted.", "success");
          await fetchCategories();
        } catch (err) {
          showNotif(err.message || "Could not delete category.", "error");
        }
      }
    );
  }

  // ── Pack Manager ────────────────────────────────────
  function addPack(prefill = {}) {
    packsState.push({
      weight: prefill.weight || "",
      weightValue: prefill.weightValue || "",
      price: prefill.price || "",
      originalPrice: prefill.originalPrice || "",
      discountPercentage: prefill.discountPercentage || 0,
      stock: prefill.stock !== undefined ? prefill.stock : "",
      sku: prefill.sku || "",
      stickCount: prefill.stickCount || "",
      totalSold: prefill.totalSold || 0,
      lowStockThreshold: prefill.lowStockThreshold || 10,
    });
    renderPacks();
  }

  function removePack(idx) {
    packsState.splice(idx, 1);
    renderPacks();
  }

  function renderPacks() {
    const container = $("packsContainer");
    if (!container) return;
    container.innerHTML = "";

    packsState.forEach((pack, i) => {
      const row = document.createElement("div");
      row.className = "pack-row";
      row.innerHTML = `
        <div class="pack-row-head">
          <span class="pack-row-num">Pack ${i + 1}</span>
          <span class="pack-row-title" id="pack-title-${i}">${pack.weight ? pack.weight : "New Pack"}</span>
          ${packsState.length > 1 ? `<button type="button" class="pack-row-rm" data-rm="${i}" title="Remove pack"><i class="fas fa-times"></i></button>` : ""}
        </div>
        <div class="pack-grid">
          <div class="pack-field">
            <label>Weight Label <span style="color:#f87171">*</span></label>
            <input type="text" data-pack="${i}" data-key="weight" placeholder="e.g. 40g" value="${esc(pack.weight)}" />
          </div>
          <div class="pack-field">
            <label>Weight Value (g) <span style="color:#f87171">*</span></label>
            <input type="number" data-pack="${i}" data-key="weightValue" placeholder="40" min="0" value="${esc(pack.weightValue)}" />
          </div>
          <div class="pack-field">
            <label>Selling Price ₹ <span style="color:#f87171">*</span></label>
            <input type="number" data-pack="${i}" data-key="price" placeholder="199" step="0.01" min="0" value="${esc(pack.price)}" />
          </div>
          <div class="pack-field">
            <label>MRP / Original ₹</label>
            <input type="number" data-pack="${i}" data-key="originalPrice" placeholder="249" step="0.01" min="0" value="${esc(pack.originalPrice)}" />
          </div>
          <div class="pack-field">
            <label>Stock Units <span style="color:#f87171">*</span></label>
            <input type="number" data-pack="${i}" data-key="stock" placeholder="0" min="0" value="${esc(pack.stock)}" />
          </div>
          <div class="pack-field">
            <label>Stick Count</label>
            <input type="number" data-pack="${i}" data-key="stickCount" placeholder="40" min="0" value="${esc(pack.stickCount)}" />
          </div>
          <div class="pack-field">
            <label>Discount %</label>
            <input type="number" data-pack="${i}" data-key="discountPercentage" placeholder="0" min="0" max="100" value="${esc(pack.discountPercentage)}" />
          </div>
          <div class="pack-field">
            <label>Low Stock Alert At</label>
            <input type="number" data-pack="${i}" data-key="lowStockThreshold" placeholder="10" min="0" value="${esc(pack.lowStockThreshold)}" />
          </div>

        </div>`;

      // Live sync inputs → packsState
      row.querySelectorAll("[data-pack]").forEach((inp) => {
        inp.addEventListener("input", () => {
          const pi = parseInt(inp.dataset.pack, 10);
          const key = inp.dataset.key;
          packsState[pi][key] = inp.value;
          // Update title badge
          if (key === "weight") {
            const titleEl = $(`pack-title-${pi}`);
            if (titleEl) titleEl.textContent = inp.value || "New Pack";
          }
        });
      });

      // Remove button
      const rmBtn = row.querySelector("[data-rm]");
      if (rmBtn) {
        rmBtn.addEventListener("click", () => removePack(i));
      }

      container.appendChild(row);
    });

    // Auto-add a first pack when container is empty
    if (packsState.length === 0) {
      const hint = document.createElement("div");
      hint.className = "field-hint";
      hint.textContent = "No packs yet — click \"Add Pack\" to create the first one.";
      container.appendChild(hint);
    }
  }

  function readPacksFromDOM() {
    return packsState.map((p) => ({
      weight: (p.weight || "").trim(),
      weightValue: Number(p.weightValue) || 0,
      price: parseFloat(p.price) || 0,
      originalPrice: parseFloat(p.originalPrice) || undefined,
      discountPercentage: parseFloat(p.discountPercentage) || 0,
      stock: parseInt(p.stock, 10) || 0,
      sku: (p.sku || "").trim().toUpperCase() || undefined,
      stickCount: p.stickCount !== "" ? parseInt(p.stickCount, 10) : undefined,
      totalSold: parseInt(p.totalSold, 10) || 0,
      lowStockThreshold: parseInt(p.lowStockThreshold, 10) || 10,
    })).map((p) => {
      Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);
      return p;
    });
  }

  // ── Hero Slot ──────────────────────────────────────
  function bindHeroSlot() {
    const slot = $("heroSlot");
    const fi = $("heroFile");

    slot.addEventListener("click", () => {
      fi.click();
    });

    fi.addEventListener("change", () => {
      if (!fi.files[0]) return;
      heroState.file = fi.files[0];
      updateHeroPreview();
    });
  }

  function updateHeroPreview() {
    const slot = $("heroSlot");
    const prev = $("heroPreview");
    const ph = $("heroPlaceholder");

    if (heroState.file || heroState.url) {
      const src = heroState.file
        ? URL.createObjectURL(heroState.file)
        : heroState.url;
      prev.src = src;
      prev.style.display = "block";
      ph.style.display = "none";
      slot.classList.add("has-img");
    } else {
      prev.src = "";
      prev.style.display = "none";
      ph.style.display = "flex";
      slot.classList.remove("has-img");
    }
  }

  // ── Gallery Strip ──────────────────────────────────
  function renderStrip() {
    const strip = $("imgStrip");
    if (!strip) return;
    strip.innerHTML = "";

    for (let i = 0; i < 4; i++) {
      const state = stripStates[i];
      const removed = removedStrip.has(i);
      const hasImg = !!(state.url || state.file);

      const slot = document.createElement("div");
      slot.className =
        "img-strip-slot" +
        (hasImg ? " has-img" : "") +
        (removed ? " removed" : "");
      slot.dataset.idx = i;

      const num = document.createElement("div");
      num.className = "img-strip-slot-num";
      num.textContent = i + 1;
      slot.appendChild(num);

      if (removed) {
        const body = document.createElement("div");
        body.className = "img-strip-removed-body";
        body.innerHTML = `<i class="fas fa-trash-alt"></i><span>Removed</span>`;
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "btn-undo-strip";
        undo.textContent = "Undo";
        undo.addEventListener("click", (e) => {
          e.stopPropagation();
          removedStrip.delete(i);
          renderStrip();
        });
        body.appendChild(undo);
        slot.appendChild(body);
      } else if (hasImg) {
        const src = state.file ? URL.createObjectURL(state.file) : state.url;
        const img = document.createElement("img");
        img.className = "img-strip-preview";
        img.src = src;
        slot.appendChild(img);

        const ov = document.createElement("div");
        ov.className = "img-strip-overlay";
        ov.innerHTML = '<i class="fas fa-camera"></i>';
        slot.appendChild(ov);

        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "img-strip-rm";
        rm.innerHTML = "✕";
        rm.dataset.rm = i;
        rm.addEventListener("click", (e) => {
          e.stopPropagation();
          removedStrip.add(i);
          stripStates[i] = { url: null, file: null };
          renderStrip();
        });
        slot.appendChild(rm);
      } else {
        const body = document.createElement("div");
        body.className = "img-strip-slot-body";
        body.innerHTML = `<i class="fas fa-plus"></i><span>Add</span>`;
        slot.appendChild(body);
      }

      const fi = document.createElement("input");
      fi.type = "file";
      fi.accept = "image/*";
      slot.appendChild(fi);

      slot.addEventListener("click", (e) => {
        if (
          e.target.closest("[data-rm]") ||
          e.target.closest(".btn-undo-strip")
        )
          return;
        if (removed) return;
        fi.click();
      });

      fi.addEventListener("change", () => {
        if (!fi.files[0]) return;
        stripStates[i].file = fi.files[0];
        renderStrip();
      });

      strip.appendChild(slot);
    }
  }

  // ── Drawer ─────────────────────────────────────────
  function openDrawer(editing) {
    $("drawerTitle").textContent = editing ? "Edit Product" : "Add New Product";
    $("drawer").classList.add("open");
    $("drawerOverlay").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    $("drawer").classList.remove("open");
    $("drawerOverlay").classList.remove("open");
    document.body.style.overflow = "";
    resetForm();
  }

  // ── Grid ───────────────────────────────────────────
  function renderGrid() {
    const grid = $("productGrid");
    let list = products.filter((p) => {
      const s = (
        p.name +
        " " +
        (p.sku || "") +
        " " +
        (p.shortDescription || "")
      ).toLowerCase();
      return (
        (!searchQ || s.includes(searchQ)) &&
        (!fType || p.productType === fType) &&
        (!fCat || p.fragranceCategory === fCat)
      );
    });

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon"><i class="fas fa-spa"></i></div>
        <h3>No Products Found</h3>
        <p>${searchQ || fType || fCat ? "Try adjusting your search or filters." : 'Click "Add New Product" to get started.'}</p>
      </div>`;
      return;
    }

    grid.innerHTML = list.map((p, i) => cardHTML(p, i)).join("");
    grid
      .querySelectorAll("[data-edit]")
      .forEach((btn) =>
        btn.addEventListener("click", () => startEdit(btn.dataset.edit)),
      );
    grid
      .querySelectorAll("[data-del]")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          openModal(btn.dataset.del, btn.dataset.name),
        ),
      );
  }

  function updateCount() {
    $("countNum").textContent = products.length;
  }

  // ── Card HTML ──────────────────────────────────────
  function cardHTML(p, i) {
    const id = p._id || p.id;

    // Pack price range
    const packs = p.packs || [];
    const prices = packs.map((pk) => pk.price).filter((v) => v > 0);
    const minPrice = prices.length ? Math.min(...prices) : (p.price || 0);
    const maxPrice = prices.length ? Math.max(...prices) : minPrice;
    const priceDisplay =
      minPrice === maxPrice
        ? `₹${minPrice.toLocaleString("en-IN")}`
        : `₹${minPrice.toLocaleString("en-IN")} – ₹${maxPrice.toLocaleString("en-IN")}`;

    // Pack count label
    const packLabel =
      packs.length > 0
        ? `<span class="p-spec"><i class="fas fa-layer-group"></i>${packs.length} pack${packs.length > 1 ? "s" : ""}</span>`
        : "";

    // Total stock (virtual)
    const totalStock =
      packs.length > 0
        ? packs.reduce((s, pk) => s + (pk.stock || 0), 0)
        : (p.stock != null ? p.stock : null);

    const stockTagDesktop =
      totalStock == null
        ? ""
        : totalStock === 0
          ? `<span class="p-tag p-tag-out">Out of Stock</span>`
          : totalStock <= 5
            ? `<span class="p-tag p-tag-low">Low Stock · ${totalStock}</span>`
            : `<span class="p-tag p-tag-instock">In Stock · ${totalStock}</span>`;

    const stockTagMobile =
      totalStock == null
        ? ""
        : totalStock === 0
          ? `<span class="p-tag p-tag-out" style="font-size:8px;padding:2px 6px;">Out</span>`
          : totalStock <= 5
            ? `<span class="p-tag p-tag-low" style="font-size:8px;padding:2px 6px;">Low·${totalStock}</span>`
            : `<span class="p-tag p-tag-instock" style="font-size:8px;padding:2px 6px;">✓ ${totalStock}</span>`;

    const imgHtml = p.mainImage
      ? `<img src="${p.mainImage}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=\\'p-card-no-img\\'><i class=\\'fas fa-spa\\'></i></div>'">`
      : `<div class="p-card-no-img"><i class="fas fa-spa"></i></div>`;

    const mobImgHtml = p.mainImage
      ? `<img src="${p.mainImage}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`
      : `<div class="p-card-mob-img-ph"><i class="fas fa-spa"></i></div>`;

    const gallery = (p.images || []).slice(0, 3);
    const thumbs = gallery.length
      ? gallery.map((u) => `<img class="p-thumb" src="${u}" alt="">`).join("")
      : `<div class="p-thumb-ph"><i class="fas fa-image"></i></div>`;

    // Desktop specs
    const totalSold = packs.length
      ? packs.reduce((s, pk) => s + (pk.totalSold || 0), 0)
      : (p.totalSold || 0);

    const specs = [
      p.burnTime && `<div class="p-spec"><i class="fas fa-fire"></i>${p.burnTime}</div>`,
      totalSold > 0 && `<div class="p-spec"><i class="fas fa-chart-bar"></i>${totalSold} sold</div>`,
      packLabel,
    ]
      .filter(Boolean)
      .join("");

    const mobSpecs = [
      p.burnTime && `<div class="p-card-mob-spec"><i class="fas fa-fire"></i>${p.burnTime}</div>`,
      totalSold > 0 && `<div class="p-card-mob-spec"><i class="fas fa-chart-bar"></i>${totalSold} sold</div>`,
      packs.length > 0 && `<div class="p-card-mob-spec"><i class="fas fa-layer-group"></i>${packs.length} pack${packs.length > 1 ? "s" : ""}</div>`,
    ]
      .filter(Boolean)
      .join("");

    return `
    <div class="p-card" style="animation-delay:${i * 0.04}s">

      <!-- ─ DESKTOP: vertical card ─ -->
      <div class="p-card-img-wrap">
        ${imgHtml}
        <div class="p-card-badges">
          ${p.isFeatured ? '<span class="p-tag p-tag-featured">Featured</span>' : ""}
          ${p.isActive === false ? '<span class="p-tag p-tag-inactive">Inactive</span>' : ""}
          ${stockTagDesktop}
        </div>
      </div>

      <div class="p-card-body">

        <div class="p-card-meta-top">
          <div class="p-card-category">${p.fragranceCategory || "floral"}</div>
          <div class="p-card-type">${p.productType || "single"}</div>
        </div>
        <div class="p-card-name">${p.name}</div>
        ${p.sku ? `<div class="p-card-sku">SKU: ${p.sku}</div>` : '<div class="p-card-sku">&nbsp;</div>'}
        <div class="p-card-price-row">
          <div class="p-card-price">${priceDisplay}</div>
        </div>
        ${p.shortDescription ? `<div class="p-card-desc">${p.shortDescription}</div>` : ""}
        ${specs ? `<div class="p-card-specs">${specs}</div>` : ""}

        ${packs.length > 0 ? `<div class="p-card-packs">${packs.map((pk) => {
      const st = pk.stock === 0 ? 'out' : pk.stock <= 5 ? 'low' : 'in';
      const stLbl = pk.stock === 0 ? 'Out' : pk.stock + '';
      return `<div class="p-pack-chip"><span class="p-pack-chip-wt">${pk.weight || '?'}</span><span class="p-pack-chip-price">₹${(pk.price || 0).toLocaleString('en-IN')}</span><span class="p-pack-chip-stock ${st}">${stLbl}</span></div>`;
    }).join('')}</div>` : ""}

        <!-- ─ MOBILE: horizontal row ─ -->
        <div class="p-card-main-row">
          <div class="p-card-mob-img">
            ${mobImgHtml}
            <div class="p-card-mob-badges">
              ${p.isFeatured ? '<span class="p-tag p-tag-featured" style="font-size:8px;padding:2px 6px;">⭐</span>' : ""}
              ${p.isActive === false ? '<span class="p-tag p-tag-inactive" style="font-size:8px;padding:2px 6px;">Off</span>' : ""}
            </div>
          </div>

          <div class="p-card-mob-info">
            <div class="p-card-mob-stock">${stockTagMobile}</div>
            <div class="p-card-mob-name">${p.name}</div>
            <div class="p-card-mob-price-row">
              <div class="p-card-mob-price">${priceDisplay}</div>
            </div>
            <div class="p-card-mob-labels">
              <div class="p-card-mob-cat">${p.fragranceCategory || "floral"}</div>
              <div class="p-card-mob-type">${p.productType || "single"}</div>
            </div>
            ${mobSpecs ? `<div class="p-card-mob-specs">${mobSpecs}</div>` : ""}
          </div>
        </div>

      </div><!-- /p-card-body -->

      ${gallery.length ? `<div class="p-card-gallery">${thumbs}</div>` : ""}

      <div class="p-card-footer">
        <button class="p-card-btn p-card-btn-edit" data-edit="${id}"><i class="fas fa-pen"></i> Edit</button>
        <button class="p-card-btn p-card-btn-del" data-del="${id}" data-name="${p.name}"><i class="fas fa-trash-alt"></i> Delete</button>
      </div>
    </div>`;
  }

  // ── Edit ───────────────────────────────────────────
  async function startEdit(id) {
    // Always fetch fresh data from API on every Edit click
    let p;
    try {
      const r = await fetch(`${API}/${id}`);
      if (!r.ok) throw 0;
      const d = await r.json();
      p = d.product || d.data || d;
    } catch {
      // Fallback to cached data if API fails
      p = products.find((x) => (x._id || x.id) === id);
    }
    if (!p) return;
    isEditing = true;
    $("prodId").value = id;
    $("fName").value = p.name || "";
    $("fSlug").value = p.slug || "";
    $("fSku").value = p.sku || "";
    $("fType").value = p.productType || "single";
    $("fCategory").value = p.fragranceCategory || "floral";
    $("fShortDesc").value = p.shortDescription || "";
    $("fFullDesc").value = p.fullDescription || "";
    $("fBurnTime").value = p.burnTime || "";
    $("fUsedFor").value = Array.isArray(p.usedFor) ? p.usedFor.join(", ") : (p.usedFor || "");
    $("fFeatured").checked = !!p.isFeatured;
    $("fActive").checked = p.isActive !== false;

    // Load packs
    packsState = (p.packs || []).map((pk) => ({
      weight: pk.weight || "",
      weightValue: pk.weightValue || "",
      price: pk.price || "",
      originalPrice: pk.originalPrice || "",
      discountPercentage: pk.discountPercentage || 0,
      stock: pk.stock !== undefined ? pk.stock : "",
      sku: pk.sku || "",
      stickCount: pk.stickCount !== undefined ? pk.stickCount : "",
      totalSold: pk.totalSold || 0,
      lowStockThreshold: pk.lowStockThreshold || 10,
    }));
    if (packsState.length === 0) {
      // Fallback: create a single pack if old product has no packs
      packsState = [{
        weight: p.weight || "",
        weightValue: "",
        price: p.price || "",
        originalPrice: p.originalPrice || "",
        discountPercentage: p.discountPercentage || 0,
        stock: p.stock || "",
        sku: "",
        stickCount: p.stickCount || "",
        lowStockThreshold: 10,
      }];
    }
    renderPacks();

    // Load images
    heroState = { url: p.mainImage || null, file: null };
    stripStates = [0, 1, 2, 3].map((i) => ({
      url: (p.images || [])[i] || null,
      file: null,
    }));
    removedStrip = new Set();

    updateHeroPreview();
    renderStrip();
    openDrawer(true);
  }

  // ── Save ───────────────────────────────────────────
  async function handleSave() {
    const name = $("fName").value.trim();
    const sd = $("fShortDesc").value.trim();
    const fd = $("fFullDesc").value.trim();

    if (!name || !sd || !fd) {
      showNotif("Please fill in product name and descriptions.", "error");
      return;
    }

    // Validate packs
    const packs = readPacksFromDOM();
    if (packs.length === 0) {
      showNotif("At least one pack is required.", "error");
      return;
    }
    for (let i = 0; i < packs.length; i++) {
      if (!packs[i].weight) {
        showNotif(`Pack ${i + 1}: weight label is required.`, "error");
        return;
      }
      if (!packs[i].price || packs[i].price <= 0) {
        showNotif(`Pack ${i + 1}: selling price is required.`, "error");
        return;
      }
    }

    if (!isEditing && !heroState.file) {
      showNotif("Main product image is required.", "error");
      return;
    }

    const btn = $("btnSave");
    setLoading(btn, true);
    const form = new FormData();
    form.append("name", name);
    form.append("slug", $("fSlug").value || toSlug(name));
    form.append("sku", $("fSku").value);
    form.append("productType", $("fType").value);
    form.append("fragranceCategory", $("fCategory").value);
    form.append("shortDescription", sd);
    form.append("fullDescription", fd);
    form.append("burnTime", $("fBurnTime").value);
    form.append("usedFor", $("fUsedFor").value);
    form.append("packs", JSON.stringify(packs));
    form.append("isFeatured", $("fFeatured").checked ? "true" : "false");
    form.append("isActive", $("fActive").checked ? "true" : "false");

    if (heroState.file) form.append("mainImage", heroState.file);
    stripStates.forEach((s, i) => {
      if (s.file)
        form.append(isEditing ? `galleryImage${i}` : "images", s.file);
    });
    if (removedStrip.size > 0) {
      form.append("removeGalleryImages", [...removedStrip].join(","));
    }

    try {
      const id = $("prodId").value;
      const url = isEditing ? `${API}/${id}` : API;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        body: form,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Save failed");
      }
      const saved = await res.json();
      const prod = saved.data || saved.product || saved;
      if (isEditing) {
        const idx = products.findIndex((p) => (p._id || p.id) === id);
        if (idx !== -1) products[idx] = prod;
      } else {
        products.unshift(prod);
      }
      showNotif(
        isEditing
          ? "Product updated successfully."
          : "Product added to collection.",
        "success",
      );
      closeDrawer();
      renderGrid();
      updateCount();
    } catch (err) {
      showNotif(err.message || "Could not save product. Please try again.", "error");
    } finally {
      setLoading(btn, false);
    }
  }

  // ── Delete ─────────────────────────────────────────
  function openModal(id, name) {
    pendingDelId = id;
    $("modalText").textContent =
      `Delete "${name}"? This action cannot be undone.`;
    $("modalBack").classList.add("open");
  }
  function closeModal() {
    pendingDelId = null;
    $("modalBack").classList.remove("open");
  }
  async function doDelete() {
    if (!pendingDelId) return;
    const btn = $("modalConfirm");
    setLoading(btn, true, "Deleting…");
    try {
      const r = await fetch(`${API}/${pendingDelId}`, { method: "DELETE" });
      if (!r.ok) throw 0;
      products = products.filter((p) => (p._id || p.id) !== pendingDelId);
      showNotif("Product removed from collection.", "success");
      renderGrid();
      updateCount();
    } catch {
      showNotif("Delete failed. Please try again.", "error");
    } finally {
      setLoading(btn, false);
      closeModal();
    }
  }

  // ── Generic Confirm Modal ─────────────────────────
  let _confirmCallback = null;

  function showConfirm(title, message, onConfirm) {
    $("confirmModalTitle").textContent = title;
    $("confirmModalMsg").textContent = message;
    _confirmCallback = onConfirm;

    // Re-bind OK button (clone to remove old listeners)
    const okBtn = $("confirmModalOk");
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    newOk.id = "confirmModalOk";
    newOk.addEventListener("click", async () => {
      closeConfirmModal();
      if (_confirmCallback) await _confirmCallback();
      _confirmCallback = null;
    });

    $("confirmModalBack").classList.add("open");
  }

  function closeConfirmModal() {
    $("confirmModalBack").classList.remove("open");
    _confirmCallback = null;
  }

  // ── Form Reset ─────────────────────────────────────
  function resetForm() {
    isEditing = false;
    $("prodForm").reset();
    $("prodId").value = "";
    heroState = { url: null, file: null };
    stripStates = [
      { url: null, file: null },
      { url: null, file: null },
      { url: null, file: null },
      { url: null, file: null },
    ];
    removedStrip = new Set();
    packsState = [];
    updateHeroPreview();
    renderStrip();
    renderPacks();
  }

  // ── Notification ───────────────────────────────────
  function showNotif(msg, type = "info") {
    const el = $("notif");
    const icons = {
      success: "fa-check-circle",
      error: "fa-times-circle",
      info: "fa-info-circle",
    };
    el.className = `notif ${type}`;
    $("notifIcon").className = `fas ${icons[type]}`;
    $("notifText").textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 3800);
  }

  // ── Helpers ────────────────────────────────────────
  function toSlug(s) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function esc(v) {
    if (v == null || v === "") return "";
    return String(v).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function setLoading(btn, on, txt = "Saving…") {
    if (!btn) return;
    if (on) {
      btn._html = btn.innerHTML;
      btn.innerHTML = `<span class="spinner"></span> ${txt}`;
      btn.disabled = true;
    } else {
      btn.innerHTML = btn._html || btn.innerHTML;
      btn.disabled = false;
    }
  }

  // ── Sample Data (pack-based) ────────────────────────
  function sampleData() {
    return [
      {
        _id: "s1",
        name: "Rose Divine",
        slug: "rose-divine",
        sku: "SHRI-FLO-427",
        productType: "single",
        fragranceCategory: "floral",
        packs: [
          { weight: "40g", weightValue: 40, price: 199, originalPrice: 249, discountPercentage: 20, stock: 48, stickCount: 40, totalSold: 120, lowStockThreshold: 10 },
          { weight: "100g", weightValue: 100, price: 449, originalPrice: 549, discountPercentage: 18, stock: 22, stickCount: 100, totalSold: 94, lowStockThreshold: 10 },
        ],
        burnTime: "45 minutes",
        usedFor: ["pooja", "meditation"],
        shortDescription: "Premium hand-rolled rose incense crafted from Mysore rose petals and natural binders.",
        fullDescription: "Handcrafted using natural rose extracts sourced from the Mysore valley.",
        isFeatured: true,
        isActive: true,
        mainImage: null,
        images: [],
      },
      {
        _id: "s2",
        name: "Sandalwood Heritage",
        slug: "sandalwood-heritage",
        sku: "SHRI-WOO-312",
        productType: "single",
        fragranceCategory: "woody",
        packs: [
          { weight: "40g", weightValue: 40, price: 299, originalPrice: 399, discountPercentage: 25, stock: 3, stickCount: 40, totalSold: 89, lowStockThreshold: 10 },
          { weight: "80g", weightValue: 80, price: 549, originalPrice: 699, discountPercentage: 21, stock: 12, stickCount: 80, totalSold: 45, lowStockThreshold: 10 },
        ],
        burnTime: "55 minutes",
        usedFor: ["pooja", "yoga"],
        shortDescription: "Rare Mysore sandalwood aged and hand-rolled with a traditional masala base formula.",
        fullDescription: "Sourced from century-old sandalwood groves in Karnataka.",
        isFeatured: false,
        isActive: true,
        mainImage: null,
        images: [],
      },
      {
        _id: "s3",
        name: "Puja Combo Box",
        slug: "puja-combo-box",
        sku: "SHRI-MIX-198",
        productType: "combo",
        fragranceCategory: "mixed",
        packs: [
          { weight: "250g", weightValue: 250, price: 599, originalPrice: 799, discountPercentage: 25, stock: 0, stickCount: 200, totalSold: 42, lowStockThreshold: 5 },
        ],
        burnTime: "Varies",
        usedFor: ["pooja", "gifting"],
        shortDescription: "A curated collection of five sacred fragrances in one elegant gift-ready presentation box.",
        fullDescription: "Five premium fragrances expertly selected for the discerning devotee.",
        isFeatured: true,
        isActive: true,
        mainImage: null,
        images: [],
      },
    ];
  }
  // Expose for navigation refresh
  window.fetchProducts = fetchProducts;
})();