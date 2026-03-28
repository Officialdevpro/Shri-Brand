// ════════════════════════════════════════════════════════════════════════════
//  INVENTORY / PRODUCTION CALCULATOR — inventory.js
//  Extracted from tk.html and integrated into the index.html admin panel.
//  All toast/modal functions are prefixed with "inv" to avoid conflicts.
// ════════════════════════════════════════════════════════════════════════════

// ─── STATE ───────────────────────────────────────────────────────────────────
let curStep = 1,
  packLog = [];
let selSizeId = null;
let selSize = 0;
let dynCounter = 100; // start high so IDs don't clash with API box ids

// Inventory data loaded from API (keyed by boxId)
let _inventoryBoxes = []; // [{_id, label, weightGm, stock, ratePerBox, isDefault}]
let _rawMaterial = null;

const getPackRate = () =>
  parseFloat(document.getElementById("packRate").value) || 0;

// ─── BOX REGISTRY ─────────────────────────────────────────────────────────────
function getBoxRegistry() {
  const boxes = [];
  _inventoryBoxes.forEach((b) => {
    boxes.push({
      id: "sc-api-" + b._id,
      _id: b._id,
      size: b.weightGm,
      countId: "boxCount_" + b._id,
      rateId: "boxRate_" + b._id,
      label: b.label || b.weightGm + " gm",
      isDynamic: false,
      isDefault: b.isDefault,
    });
  });
  document.querySelectorAll("[data-dyn-box]").forEach((el) => {
    const idx = el.dataset.dynBox;
    const wEl = document.getElementById("dynBoxWeight_" + idx);
    const size = wEl ? parseInt(wEl.value) || 0 : 0;
    boxes.push({
      id: "sc-dyn-" + idx,
      _id: null,
      size,
      countId: "dynBoxCount_" + idx,
      rateId: "dynBoxRate_" + idx,
      label: size ? size + " gm" : "Custom",
      isDynamic: true,
      isDefault: false,
    });
  });
  return boxes;
}

// ─── EDIT MODE (Inventory only) ──────────────────────────────────────────────
function toggleEdit(cardId, btn) {
  const card = document.getElementById(cardId);
  const isEditing = card.classList.contains("edit-mode");
  if (!isEditing) {
    card.classList.add("edit-mode");
    const visibleInputs = card.querySelectorAll(
      '.f-input:not([type="hidden"])',
    );
    visibleInputs.forEach((inp) => inp.removeAttribute("readonly"));
    btn.classList.add("save-mode");
    btn.title = "Save";
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    if (visibleInputs[0]) visibleInputs[0].focus();
  } else {
    card.classList.remove("edit-mode");
    const visibleInputs2 = card.querySelectorAll(
      '.f-input:not([type="hidden"])',
    );
    visibleInputs2.forEach((inp) => inp.setAttribute("readonly", ""));
    btn.classList.remove("save-mode");
    btn.title = "Edit";
    btn.innerHTML = '<i class="fa-solid fa-pen"></i>';

    if (cardId === "card-stick") {
      saveRawMaterial();
    } else if (card.dataset.apiBoxId) {
      saveBoxType(card.dataset.apiBoxId, card);
    } else if (card.dataset.dynBox) {
      updateDynName(card.dataset.dynBox);
      const idx = card.dataset.dynBox;
      const fieldsWrap = card.querySelector(".inv-fields");
      if (
        fieldsWrap &&
        fieldsWrap.style.gridTemplateColumns.includes("1fr 1fr 1fr")
      ) {
        const countVal =
          document.getElementById("dynBoxCount_" + idx)?.value || "0";
        const rateVal =
          document.getElementById("dynBoxRate_" + idx)?.value || "0";
        const weightVal =
          document.getElementById("dynBoxWeight_" + idx)?.value || "0";
        fieldsWrap.style.gridTemplateColumns = "1fr 1fr";
        fieldsWrap.innerHTML = `
          <div class="inv-f">
            <label>Stock</label>
            <input class="f-input" type="number" id="dynBoxCount_${idx}" value="${countVal}" min="0" readonly
              oninput="refreshSizeCards();updatePreview();">
            <span class="inv-f-hint">Available boxes</span>
          </div>
          <div class="inv-f">
            <label>Rate ₹ / box</label>
            <input class="f-input" type="number" id="dynBoxRate_${idx}" value="${rateVal}" min="0" step="0.1" readonly
              oninput="refreshSizeCards();">
            <span class="inv-f-hint">Per box cost</span>
          </div>
          <input type="hidden" id="dynBoxWeight_${idx}" value="${weightVal}">`;
        createBoxTypeAPI(idx, weightVal, countVal, rateVal, card);
      }
    } else if (cardId === "card-labour") {
      saveLabourRate();
    }

    updatePreview();
    refreshSizeCards();
  }
}

async function saveRawMaterial() {
  try {
    const quantityKg =
      parseFloat(document.getElementById("stickKg").value) || 0;
    const ratePerKg =
      parseFloat(document.getElementById("stickRate").value) || 0;
    const res = await fetch(
      "/api/v1/production/inventory/raw-material",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantityKg, ratePerKg }),
      },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Update failed");
    invShowToast(
      "success",
      "Stick Stock Saved",
      `${quantityKg} kg @ ₹${ratePerKg}/kg updated.`,
    );
  } catch (err) {
    invShowToast("error", "Save Failed", err.message);
  }
}

async function saveLabourRate() {
  try {
    const labourRatePerBox =
      parseFloat(document.getElementById("packRate").value) || 0;
    const res = await fetch(
      "/api/v1/production/inventory/raw-material",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labourRatePerBox }),
      },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Update failed");
    invShowToast(
      "success",
      "Labour Rate Saved",
      `₹${labourRatePerBox}/box updated.`,
    );
  } catch (err) {
    invShowToast("error", "Save Failed", err.message);
  }
}

async function saveBoxType(boxId, card) {
  try {
    const stock =
      parseFloat(document.getElementById("boxCount_" + boxId)?.value) || 0;
    const ratePerBox =
      parseFloat(document.getElementById("boxRate_" + boxId)?.value) || 0;
    const label = card.querySelector(".inv-hd-name")?.textContent?.trim();
    const res = await fetch(
      "/api/v1/production/inventory/boxes/" + boxId,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock, ratePerBox, label }),
      },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Update failed");
    const b = _inventoryBoxes.find((b) => b._id === boxId);
    if (b) {
      b.stock = stock;
      b.ratePerBox = ratePerBox;
    }
    invShowToast(
      "success",
      "Box Updated",
      `${label}: ${stock} boxes @ ₹${ratePerBox}/box saved.`,
    );
  } catch (err) {
    invShowToast("error", "Save Failed", err.message);
  }
}

async function createBoxTypeAPI(idx, weightGm, stock, ratePerBox, card) {
  if (!weightGm || !ratePerBox) return;
  try {
    const label = `${weightGm} gm Box`;
    const res = await fetch(
      "/api/v1/production/inventory/boxes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          weightGm: Number(weightGm),
          stock: Number(stock),
          ratePerBox: Number(ratePerBox),
        }),
      },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Create failed");
    const newBox = json.data;
    _inventoryBoxes.push(newBox);
    card.remove();
    renderBoxCard(newBox, document.getElementById("boxInventoryGrid"));
    refreshSizeCards();
    invShowToast("success", "Box Type Created", `${label} added to inventory.`);
  } catch (err) {
    invShowToast("error", "Create Failed", err.message);
  }
}

async function deleteBoxTypeAPI(boxId, cardId) {
  try {
    const res = await fetch(
      "/api/v1/production/inventory/boxes/" + boxId,
      { method: "DELETE" },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Delete failed");
    _inventoryBoxes = _inventoryBoxes.filter((b) => b._id !== boxId);
    const card = document.getElementById(cardId);
    if (card) {
      card.style.transition = "opacity 0.2s, transform 0.2s";
      card.style.opacity = "0";
      card.style.transform = "translateY(-6px)";
      setTimeout(() => {
        card.remove();
        refreshSizeCards();
      }, 200);
    }
    const reg = getBoxRegistry();
    if (!reg.find((b) => b.id === selSizeId)) {
      selSizeId = reg[0]?.id || null;
      selSize = reg[0]?.size || 0;
    }
    invShowToast("success", "Box Removed", "Box type deleted from inventory.");
  } catch (err) {
    invShowToast("error", "Delete Failed", err.message);
  }
}

// ─── ADD NEW BOX CARD ─────────────────────────────────────────────────────────
function addNewBoxCard() {
  const grid = document.getElementById("boxInventoryGrid");
  const idx = dynCounter;
  const cardId = "card-box-dyn-" + idx;

  const card = document.createElement("div");
  card.className = "inv-card edit-mode new-card";
  card.id = cardId;
  card.style.marginBottom = "0";
  card.dataset.dynBox = idx;

  card.innerHTML = `
    <div class="inv-card-hd">
      <div class="inv-icon" style="background:rgba(127,4,3,0.04);border-color:rgba(127,4,3,0.18);">
        <i class="fa-solid fa-box" style="color:var(--crimson);opacity:0.7;"></i>
      </div>
      <div>
        <div class="inv-hd-name" id="dynName_${idx}">Custom Box</div>
        <div class="inv-hd-sub" id="dynSub_${idx}">Custom pack</div>
      </div>
      <div class="inv-hd-actions">
        <button class="btn-edit-inv save-mode" title="Save" onclick="toggleEdit('${cardId}',this)">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="btn-del-inv" title="Remove" onclick="removeBoxCard('${cardId}')">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    </div>
    <div class="inv-fields" style="grid-template-columns:1fr 1fr 1fr;">
      <div class="inv-f">
        <label>Stock</label>
        <input class="f-input" type="number" id="dynBoxCount_${idx}" value="0" min="0" placeholder="0"
          oninput="refreshSizeCards();updatePreview();">
        <span class="inv-f-hint">Available boxes</span>
      </div>
      <div class="inv-f">
        <label>Weight (gm)</label>
        <input class="f-input" type="number" id="dynBoxWeight_${idx}" value="" min="1" placeholder="gm"
          oninput="updateDynName(${idx});refreshSizeCards();">
        <span class="inv-f-hint">Pack weight in grams</span>
      </div>
      <div class="inv-f">
        <label>Rate ₹ / box</label>
        <input class="f-input" type="number" id="dynBoxRate_${idx}" value="" min="0" step="0.1" placeholder="0.00"
          oninput="refreshSizeCards();">
        <span class="inv-f-hint">Per box cost</span>
      </div>
    </div>`;

  grid.appendChild(card);
  dynCounter++;
  refreshSizeCards();
  card.querySelector(".f-input").focus();
}

function updateDynName(idx) {
  const wEl = document.getElementById("dynBoxWeight_" + idx);
  const nameEl = document.getElementById("dynName_" + idx);
  const subEl = document.getElementById("dynSub_" + idx);
  if (!wEl || !nameEl) return;
  const w = parseInt(wEl.value);
  nameEl.textContent = w ? w + " gm Box" : "Custom Box";
  if (subEl) subEl.textContent = w ? w + " gm custom pack" : "Custom pack";
}

function removeBoxCard(cardId, boxId) {
  if (boxId) {
    deleteBoxTypeAPI(boxId, cardId);
    return;
  }
  const card = document.getElementById(cardId);
  if (!card) return;
  card.style.transition = "opacity 0.2s, transform 0.2s";
  card.style.opacity = "0";
  card.style.transform = "translateY(-6px)";
  setTimeout(() => {
    card.remove();
    const reg = getBoxRegistry();
    if (!reg.find((b) => b.id === selSizeId)) {
      selSizeId = reg[0]?.id || null;
      selSize = reg[0]?.size || 0;
    }
    updatePreview();
    refreshSizeCards();
  }, 200);
}

// ─── STEPS ───────────────────────────────────────────────────────────────────
function goStep(n) {
  if (n === 3) buildRates();
  document
    .querySelectorAll("#page-inventory .inv-page")
    .forEach((p, i) => p.classList.toggle("active", i + 1 === n));
  curStep = n;
  updateSteps();
  refreshSizeCards();
}

function updateSteps() {
  for (let i = 1; i <= 3; i++) {
    const sp = document.getElementById("sp" + i);
    const sn = document.getElementById("sn" + i);
    if (!sp || !sn) continue;
    sp.className = "step-pill";
    if (i < curStep) {
      sp.classList.add("done");
      sn.innerHTML =
        '<i class="fa-solid fa-check" style="font-size:10px;"></i>';
    } else if (i === curStep) {
      sp.classList.add("active");
      sn.textContent = i;
    } else {
      sn.textContent = i;
    }
  }
}

// ─── SIZE CARDS (Step 2) ─────────────────────────────────────────────────────
function setSizeById(id, size) {
  selSizeId = id;
  selSize = size;
  refreshSizeCards();
  updatePreview();
}

function refreshSizeCards() {
  const reg = getBoxRegistry();
  const grid = document.getElementById("sizeSelGrid");
  if (!grid) return;
  const { balances } = getBalancesAll();
  grid.innerHTML = reg
    .map((b) => {
      const rate = parseFloat(document.getElementById(b.rateId)?.value) || 0;
      const stock =
        balances[b.id] !== undefined
          ? balances[b.id]
          : parseInt(document.getElementById(b.countId)?.value) || 0;
      const active = selSizeId === b.id;
      return `<div class="size-sel-card ${active ? "active" : ""}" id="${b.id}" onclick="setSizeById('${b.id}',${b.size})">
      <div class="sc-top-row">
        <div class="sc-grams">${b.size || "—"}<span style="font-size:16px;color:var(--ink-muted);font-weight:400;"> g</span></div>
        <div class="sc-radio"></div>
      </div>
      <div class="sc-rate">₹${rate.toFixed(2)} / box</div>
      <div class="sc-stock-tag">${stock} boxes left</div>
    </div>`;
    })
    .join("");
}

// ─── BALANCES ─────────────────────────────────────────────────────────────────
function getBalancesAll() {
  const reg = getBoxRegistry();
  let stick = parseFloat(document.getElementById("stickKg").value) || 0;
  const balances = {};
  reg.forEach((b) => {
    balances[b.id] = parseInt(document.getElementById(b.countId)?.value) || 0;
  });
  packLog.forEach((p) => {
    stick -= (p.boxes * p.size) / 1000;
    if (balances[p.boxId] !== undefined) balances[p.boxId] -= p.boxes;
  });
  return { stick, balances };
}

// ─── PREVIEW ─────────────────────────────────────────────────────────────────
function updatePreview() {
  const boxes = parseInt(document.getElementById("packBoxes").value) || 0;
  if (!boxes) {
    clearPrev();
    return;
  }
  const { stick, balances } = getBalancesAll();
  const needed = (boxes * selSize) / 1000;
  const aftStick = stick - needed;
  const aftBox = (balances[selSizeId] ?? 0) - boxes;
  setPrev("pv_need", needed.toFixed(2) + " kg", "");
  setPrev(
    "pv_stick",
    aftStick.toFixed(2) + " kg",
    aftStick < 0 ? "warn" : "ok",
  );
  setPrev("pv_box", aftBox + " boxes", aftBox < 0 ? "warn" : "ok");
}

function clearPrev() {
  ["pv_need", "pv_stick", "pv_box"].forEach((id) => setPrev(id, "—", ""));
}
function setPrev(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = "prev-chip-val" + (cls ? " " + cls : "");
}

// ─── ADD PACK ─────────────────────────────────────────────────────────────────
function addPack() {
  const name = document.getElementById("fragranceSelect").value;
  const boxes = parseInt(document.getElementById("packBoxes").value) || 0;
  if (!name) {
    invShowModal(
      "warning",
      "No Fragrance Selected",
      "Please choose a fragrance from the product list before adding to the packing log.",
    );
    return;
  }
  if (boxes < 1) {
    invShowModal(
      "warning",
      "Invalid Quantity",
      "Please enter at least 1 box to pack.",
    );
    return;
  }

  // ── PACK-MATCH VALIDATION ──────────────────────────────────────────────────
  // Check that the selected product actually has a pack matching the chosen box size
  const selectedProduct = allFragProducts.find((p) => p.id === selectedFragId);
  if (selectedProduct) {
    const matchingPack = selectedProduct.packs.find(
      (pk) => Number(pk.weightValue) === Number(selSize),
    );
    if (!matchingPack) {
      const availableSizes = selectedProduct.packs
        .map((pk) => pk.weight || pk.weightValue + "g")
        .join(", ");
      invShowModal(
        "error",
        "Box Size Mismatch",
        `"${name}" does not have a ${selSize}g pack. Please select a matching box size or choose a different product.`,
        availableSizes
          ? `Available pack sizes for "${name}": ${availableSizes}`
          : `"${name}" has no packs configured. Please add packs in the Products section first.`,
      );
      return;
    }
  }

  const { stick, balances } = getBalancesAll();
  const stickNeeded = (boxes * selSize) / 1000;
  const boxAvail = balances[selSizeId] ?? 0;
  if (stickNeeded > stick + 0.0001) {
    invShowModal(
      "error",
      "Insufficient Stick Stock",
      "Not enough raw stick stock to complete this packing run.",
      `Required: ${stickNeeded.toFixed(2)} kg\nAvailable: ${stick.toFixed(2)} kg\nShortfall: ${(stickNeeded - stick).toFixed(2)} kg`,
    );
    return;
  }
  if (boxes > boxAvail) {
    invShowModal(
      "error",
      "Insufficient Box Stock",
      `Not enough ${selSize}g boxes available for this order.`,
      `Required: ${boxes} boxes\nAvailable: ${boxAvail} boxes\nShortfall: ${boxes - boxAvail} boxes`,
    );
    return;
  }
  const reg = getBoxRegistry();
  const box = reg.find((b) => b.id === selSizeId);
  const rate = parseFloat(document.getElementById(box?.rateId)?.value) || 0;
  packLog.push({
    name,
    productId: selectedFragId,
    size: selSize,
    boxes,
    boxId: selSizeId,
    boxRate: rate,
  });
  renderLog();
  invShowToast(
    "success",
    "Added to Packing List",
    `${boxes} × ${selSize}g ${name} logged successfully.`,
  );
  document.getElementById("packBoxes").value = "";
  document.getElementById("fragranceSelect").value = "";
  const trigger = document.getElementById("fragTrigger");
  const trigText = document.getElementById("fragTriggerText");
  if (trigger) trigger.classList.remove("has-value");
  if (trigText) trigText.textContent = "— Choose a fragrance —";
  selectedFragId = null;
  clearPrev();
  refreshSizeCards();
}

// ─── RENDER LOG ───────────────────────────────────────────────────────────────
function renderLog() {
  const el = document.getElementById("packLog");
  if (!packLog.length) {
    el.innerHTML = `<div class="inv-empty-state"><div class="inv-empty-ico"><i class="fa-regular fa-clipboard"></i></div><p>No entries yet.<br>Select a fragrance and add boxes above.</p></div>`;
    return;
  }
  const sr = parseFloat(document.getElementById("stickRate").value) || 0;
  const pr = getPackRate();
  el.innerHTML =
    '<div class="pack-list">' +
    packLog
      .map((p, i) => {
        const sc = p.size * (sr / 1000);
        const tot = sc + p.boxRate + pr;
        const mrp = Math.ceil((tot * 2) / 5) * 5;
        const su = ((p.boxes * p.size) / 1000).toFixed(2);
        return `<div class="pack-item">
      <div class="pi-head">
        <div class="pi-left">
          <div class="pi-badge">${p.size}g</div>
          <div><div class="pi-name">${p.name}</div><div class="pi-sub">${p.boxes} boxes &middot; ${su} kg stick</div></div>
        </div>
        <div class="pi-right">
          <div class="pi-mrp"><div class="pi-mrp-val">₹${mrp}</div><div class="pi-mrp-lbl">MRP / box</div></div>
          <button class="pi-del" data-idx="${i}"><i class="fa-solid fa-times"></i></button>
        </div>
      </div>
      <div class="pi-stats">
        <div class="pi-stat"><div class="pi-stat-l">Cost / Box</div><div class="pi-stat-v">₹${tot.toFixed(2)}</div></div>
        <div class="pi-stat"><div class="pi-stat-l">Stick Cost</div><div class="pi-stat-v">₹${sc.toFixed(2)}</div></div>
        <div class="pi-stat"><div class="pi-stat-l">Box Cost</div><div class="pi-stat-v">₹${p.boxRate.toFixed(2)}</div></div>
      </div>
    </div>`;
      })
      .join("") +
    "</div>";
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".pi-del");
  if (btn) {
    const idx = parseInt(btn.dataset.idx);
    if (!isNaN(idx)) {
      packLog.splice(idx, 1);
      renderLog();
      updatePreview();
      refreshSizeCards();
    }
  }
});

// ─── BUILD RATES (Step 3) ─────────────────────────────────────────────────────
function buildRates() {
  const sr = parseFloat(document.getElementById("stickRate").value) || 0;
  const pr = getPackRate();
  const { stick, balances } = getBalancesAll();
  const tilesRow = document.getElementById("stockTilesRow");
  const reg = getBoxRegistry();
  const totalCols = 1 + reg.length;
  tilesRow.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;

  let stickTile = `<div class="stock-tile">
    <div class="st-label">Stick Left</div>
    <div class="st-val${stick < 0 ? " warn" : ""}">${stick.toFixed(2)} kg</div>
  </div>`;

  let boxTiles = reg
    .map((b) => {
      const bal = balances[b.id] ?? 0;
      return `<div class="stock-tile">
      <div class="st-label">${b.label} Left</div>
      <div class="st-val${bal < 0 ? " warn" : ""}">${bal}</div>
    </div>`;
    })
    .join("");

  tilesRow.innerHTML = stickTile + boxTiles;

  const rc = document.getElementById("rateCards");
  if (!packLog.length) {
    rc.innerHTML = `<div class="inv-empty-state"><div class="inv-empty-ico"><i class="fa-solid fa-chart-bar"></i></div><p>No packing entries found.<br>Go back to Step 2 to add items.</p></div>`;
    return;
  }

  rc.innerHTML = packLog
    .map((p, idx) => {
      const sc = p.size * (sr / 1000);
      const tot = sc + p.boxRate + pr;
      const mrp = Math.ceil((tot * 2) / 5) * 5;
      const totalVal = (mrp * p.boxes).toLocaleString("en-IN");
      return `
    <div class="inv-sec-label" style="margin-bottom:14px;">${p.name} &mdash; ${p.size}g Pack</div>
    <div class="rate-card">
      <div class="rc-top">
        <div>
          <div><span class="rc-name">${p.name}</span><span class="rc-sz-tag">${p.size} gm</span></div>
          <div class="rc-boxes">${p.boxes} boxes packed</div>
        </div>
        <div class="rc-mrp-block">
          <div class="rc-mrp-num">₹${mrp}</div>
          <div class="rc-mrp-lbl">MRP per box</div>
        </div>
      </div>
      <div class="rc-breakdown">
        <div class="rcb"><div class="rcb-lbl">Stick</div><div class="rcb-val">₹${sc.toFixed(2)}</div><div class="rcb-sub">${p.size}g &times; ₹${(sr / 1000).toFixed(3)}</div></div>
        <div class="rcb"><div class="rcb-lbl">Box</div><div class="rcb-val">₹${p.boxRate.toFixed(2)}</div><div class="rcb-sub">per box</div></div>
        <div class="rcb"><div class="rcb-lbl">Packing</div><div class="rcb-val">₹${pr.toFixed(2)}</div><div class="rcb-sub">labour</div></div>
        <div class="rcb hi"><div class="rcb-lbl">Total Cost</div><div class="rcb-val">₹${tot.toFixed(2)}</div><div class="rcb-sub">&times;2 &uarr;₹5 = ${mrp}</div></div>
      </div>
      <div class="rc-footer"><span>${p.boxes} boxes &times; ₹${mrp}</span><strong>₹${totalVal}</strong></div>
    </div>
    <div class="ws-card">
      <div class="ws-card-hd">
        <div class="ws-hd-left">
          <div class="ws-hd-icon"><i class="fa-solid fa-store"></i></div>
          <div>
            <div class="ws-hd-title">Wholesaler Pricing</div>
            <div class="ws-hd-sub">Cost ₹${tot.toFixed(2)} / box &middot; Exact price, no rounding</div>
          </div>
        </div>
        <div class="ws-mrp-badge">MRP ₹${mrp}</div>
      </div>
      ${[
        ["td-1", "Bulk Order Tier", 1000, 40],
        ["td-2", "Mid Order Tier", 500, 60],
        ["td-3", "Small Order Tier", 100, 80],
      ]
        .map(
          ([cls, label, defMin, defMk], t) => `
      <div class="ws-tier">
        <div class="ws-tier-left">
          <div class="ws-tier-name"><div class="tier-diamond ${cls}"></div>${label}</div>
          <div class="ws-controls">
            <div class="ws-ctrl"><div class="ws-ctrl-label">Min. Boxes</div>
              <div class="ws-ctrl-row"><input class="ws-in" type="number" id="ws_min${t + 1}_${idx}" value="${defMin}" min="1" oninput="calcWSTier(${idx})"><span class="ws-in-unit">boxes</span></div></div>
            <div class="ws-ctrl"><div class="ws-ctrl-label">Markup %</div>
              <div class="ws-ctrl-row"><input class="ws-in" type="number" id="ws_mk${t + 1}_${idx}" value="${defMk}" min="0" oninput="calcWSTier(${idx})"><span class="ws-in-unit">%</span></div></div>
          </div>
        </div>
        <div class="ws-tier-price"><div class="ws-price-val" id="ws_price${t + 1}_${idx}">—</div><div class="ws-price-lbl">Price / box</div><div class="ws-price-total" id="ws_tot${t + 1}_${idx}"></div></div>
      </div>`,
        )
        .join("")}
      <div class="ws-formula-bar">Formula: <strong>Cost ₹${tot.toFixed(2)} + Markup %</strong> &rarr; Exact price (no rounding)</div>
    </div>`;
    })
    .join("");

  packLog.forEach((_, idx) => calcWSTier(idx));
}

function calcWSTier(idx) {
  const sr = parseFloat(document.getElementById("stickRate").value) || 0;
  const pr = getPackRate();
  const p = packLog[idx];
  if (!p) return;
  const tot = p.size * (sr / 1000) + p.boxRate + pr;
  for (let t = 1; t <= 3; t++) {
    const mkEl = document.getElementById(`ws_mk${t}_${idx}`);
    const minEl = document.getElementById(`ws_min${t}_${idx}`);
    const prEl = document.getElementById(`ws_price${t}_${idx}`);
    const ttEl = document.getElementById(`ws_tot${t}_${idx}`);
    if (!mkEl) continue;
    const mk = parseFloat(mkEl.value) || 0;
    const minB = parseInt(minEl.value) || 0;
    const price = tot + (tot * mk) / 100;
    prEl.textContent = "₹" + price.toFixed(2);
    ttEl.textContent = minB
      ? `${minB} × ₹${price.toFixed(2)} = ₹${(price * minB).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "";
  }
}

// ─── COMMIT TO DATABASE ───────────────────────────────────────────────────────
async function commitToDatabase() {
  if (!packLog.length) {
    invShowModal(
      "warning",
      "Nothing to Commit",
      "Your packing list is empty. Add some entries in Step 2 before committing to the database.",
    );
    return;
  }
  const reg = getBoxRegistry();
  const packingEntries = packLog.map((p, idx) => {
    const box = reg.find((b) => b.id === p.boxId);
    // ── Collect wholesaler tier inputs from Step 3 UI ──────────────────────
    const wholesalerInputs = [1, 2, 3].map((t) => {
      const tierNames = [
        "Bulk Order Tier",
        "Mid Order Tier",
        "Small Order Tier",
      ];
      return {
        tierName: tierNames[t - 1],
        minBoxes:
          parseInt(document.getElementById(`ws_min${t}_${idx}`)?.value) ||
          [1000, 500, 100][t - 1],
        markupPercent:
          parseFloat(document.getElementById(`ws_mk${t}_${idx}`)?.value) ??
          [40, 60, 80][t - 1],
      };
    });
    return {
      productId: p.productId,
      productName: p.name,
      boxTypeId: box?._id || null,
      boxesPacked: p.boxes,
      wholesalerInputs,
    };
  });
  const missing = packingEntries.find((e) => !e.productId || !e.boxTypeId);
  if (missing) {
    invShowModal(
      "error",
      "Incomplete Data",
      "Some packing entries are missing a product ID or box type. Please reload and try again.",
    );
    return;
  }
  const btn = document.querySelector(".btn-commit");
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<div class="btn-commit-icon"><i class="fa-solid fa-circle-notch fa-spin"></i></div><div class="btn-commit-divider"></div>Committing…`;
  try {
    const res = await fetch(
      "/api/v1/production/runs/commit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packingEntries }),
      },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Commit failed");
    invShowToast("success", "Production Run Committed", json.message, 6000);
    if (json.data?.hasPriceChanges || json.data?.hasUpdateFailures) {
      const priceLines = (json.data.productUpdates || [])
        .filter((u) => u.priceChanged)
        .map(
          (u) =>
            `${u.productName} (${u.packWeight}): ₹${u.priceBefore} → ₹${u.priceAfter}`,
        )
        .join("\n");
      const failLines = (json.data.productUpdates || [])
        .filter((u) => u.error)
        .map((u) => `${u.productName}: ${u.error}`)
        .join("\n");
      const detail = [priceLines, failLines].filter(Boolean).join("\n---\n");
      invShowModal(
        "info",
        "Commit Summary",
        `Run ${json.data.runCode} · ${json.data.totalBoxesPacked} boxes packed.`,
        detail,
      );
    }
    packLog = [];
    renderLog();
    await loadInventory();
    goStep(1);
  } catch (err) {
    invShowModal("error", "Commit Failed", err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

// ─── LOAD INVENTORY FROM API ─────────────────────────────────────────────────
async function loadInventory() {
  try {
    const res = await fetch(
      "/api/v1/production/inventory",
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to load inventory");

    const { rawMaterial, boxes } = json.data;
    _rawMaterial = rawMaterial;
    _inventoryBoxes = boxes || [];

    document.getElementById("stickKg").value = rawMaterial?.quantityKg ?? 0;
    document.getElementById("stickRate").value = rawMaterial?.ratePerKg ?? 0;
    document.getElementById("packRate").value =
      rawMaterial?.labourRatePerBox ?? 0;

    const grid = document.getElementById("boxInventoryGrid");
    grid.innerHTML = "";
    _inventoryBoxes.forEach((b) => renderBoxCard(b, grid));

    if (_inventoryBoxes.length) {
      selSizeId = "sc-api-" + _inventoryBoxes[0]._id;
      selSize = _inventoryBoxes[0].weightGm;
    }

    refreshSizeCards();
    updatePreview();
    renderLog();

    ["stickKg", "stickRate", "packRate"].forEach((id) => {
      const el = document.getElementById(id);
      if (el)
        el.addEventListener("input", () => {
          updatePreview();
          refreshSizeCards();
        });
    });
  } catch (err) {
    invShowToast("error", "Inventory Load Failed", err.message);
  }
}

function renderBoxCard(b, grid) {
  const cardId = "card-box-api-" + b._id;
  const card = document.createElement("div");
  card.className = "inv-card";
  card.id = cardId;
  card.style.marginBottom = "0";
  card.dataset.apiBoxId = b._id;

  const canDelete = !b.isDefault;
  card.innerHTML = `
    <div class="inv-card-hd">
      <div class="inv-icon"><i class="fa-solid fa-box"></i></div>
      <div>
        <div class="inv-hd-name">${b.label || b.weightGm + " gm Box"}</div>
        <div class="inv-hd-sub">${b.isDefault ? "Default pack" : "Custom pack"}</div>
      </div>
      <div class="inv-hd-actions">
        <button class="btn-edit-inv" title="Edit" onclick="toggleEdit('${cardId}', this)">
          <i class="fa-solid fa-pen"></i>
        </button>
        ${
          canDelete
            ? `<button class="btn-del-inv" title="Remove" onclick="removeBoxCard('${cardId}','${b._id}')">
          <i class="fa-solid fa-times"></i>
        </button>`
            : ""
        }
      </div>
    </div>
    <div class="inv-fields">
      <div class="inv-f">
        <label>Stock</label>
        <input class="f-input" type="number" id="boxCount_${b._id}" value="${b.stock ?? 0}" min="0" readonly
          oninput="refreshSizeCards();updatePreview();">
        <span class="inv-f-hint">Available boxes</span>
      </div>
      <div class="inv-f">
        <label>Rate ₹ / box</label>
        <input class="f-input" type="number" id="boxRate_${b._id}" value="${b.ratePerBox ?? 0}" min="0" step="0.1" readonly
          oninput="refreshSizeCards();">
        <span class="inv-f-hint">Per box cost</span>
      </div>
    </div>`;

  grid.appendChild(card);
}

// ─── FRAGRANCE SIDEBAR ────────────────────────────────────────────────────────
let allFragProducts = [];
let selectedFragId = null;
const STOCK_HIGH = 50;
const STOCK_LOW = 1;

function packStockClass(stock) {
  if (stock > STOCK_HIGH) return "in-stock";
  if (stock > 0) return "low-stock";
  return "out-stock";
}

async function loadFragProducts(search = "") {
  const list = document.getElementById("fragProductList");
  if (list)
    list.innerHTML = `<div class="frag-sb-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading products…</div>`;
  try {
    const url = search
      ? "/api/v1/production/products?search=" +
        encodeURIComponent(search)
      : "/api/v1/production/products";
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to load products");
    allFragProducts = (json.data || []).map((p) => ({
      id: p.id || p._id,
      name: p.name,
      sku: p.sku,
      mainImage: p.mainImage,
      packs: (p.packs || []).map((pk) => ({
        weight: pk.weight,
        weightValue: pk.weightValue,
        stock: pk.stock ?? 0,
      })),
    }));
    renderFragProducts(allFragProducts);
  } catch (err) {
    if (list)
      list.innerHTML = `<div class="frag-sb-empty"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</div>`;
  }
}

function openFragSidebar() {
  document.getElementById("fragSidebar").classList.add("open");
  document.getElementById("fragOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  loadFragProducts();
  setTimeout(() => document.getElementById("fragSearch")?.focus(), 320);
}

function closeFragSidebar() {
  document.getElementById("fragSidebar").classList.remove("open");
  document.getElementById("fragOverlay").classList.remove("open");
  document.body.style.overflow = "";
  const searchEl = document.getElementById("fragSearch");
  if (searchEl) {
    searchEl.value = "";
  }
}

let _fragSearchTimer = null;
function filterFragProducts() {
  const q = (document.getElementById("fragSearch")?.value || "").trim();
  clearTimeout(_fragSearchTimer);
  _fragSearchTimer = setTimeout(() => loadFragProducts(q), 300);
}

function renderFragProducts(products) {
  const list = document.getElementById("fragProductList");
  if (!list) return;
  if (!products.length) {
    list.innerHTML = `<div class="frag-sb-empty"><i class="fa-solid fa-wind"></i>No fragrances found.</div>`;
    return;
  }
  list.innerHTML = products
    .map((p) => {
      const isSelected = selectedFragId === p.id;
      const packTags = p.packs
        .map(
          (pk) =>
            `<span class="frag-pack-tag ${packStockClass(pk.stock)}">${pk.weight} · ${pk.stock} left</span>`,
        )
        .join("");
      const imgHtml = p.mainImage
        ? `<img src="${p.mainImage}" alt="${p.name}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
         <div class="frag-prod-img-placeholder" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">
           <i class="fa-solid fa-wind"></i></div>`
        : `<div class="frag-prod-img-placeholder"><i class="fa-solid fa-wind"></i></div>`;
      return `<div class="frag-product-item${isSelected ? " selected" : ""}" onclick="selectFragProduct('${p.id}','${p.name}')">
      <div class="frag-prod-img">${imgHtml}</div>
      <div class="frag-prod-info">
        <div class="frag-prod-name">${p.name}</div>
        <div class="frag-prod-sku">${p.sku}</div>
        <div class="frag-prod-packs">${packTags}</div>
      </div>
      <div class="frag-prod-check"><i class="fa-solid fa-check"></i></div>
    </div>`;
    })
    .join("");
}

function selectFragProduct(id, name) {
  selectedFragId = id;
  document.getElementById("fragranceSelect").value = name;
  const trigger = document.getElementById("fragTrigger");
  const trigText = document.getElementById("fragTriggerText");
  if (trigger) trigger.classList.add("has-value");
  if (trigText) trigText.textContent = name;
  renderFragProducts(allFragProducts);
  setTimeout(() => {
    closeFragSidebar();
    updatePreview();
  }, 360);
}

// ─── TOAST SYSTEM ────────────────────────────────────────────────────────────
const INV_TOAST_ICONS = {
  success: "fa-circle-check",
  error: "fa-circle-xmark",
  warn: "fa-triangle-exclamation",
  info: "fa-circle-info",
};

function invShowToast(
  type = "info",
  title = "",
  message = "",
  duration = 4000,
) {
  const container = document.getElementById("invToastContainer");
  const id = "inv-toast-" + Date.now();
  const icon = INV_TOAST_ICONS[type] || INV_TOAST_ICONS.info;

  const el = document.createElement("div");
  el.className = `inv-toast toast-${type}`;
  el.id = id;
  el.innerHTML = `
    <div class="inv-toast-ico"><i class="fa-solid ${icon}"></i></div>
    <div class="inv-toast-body">
      <div class="inv-toast-title">${title}</div>
      ${message ? `<div class="inv-toast-msg">${message}</div>` : ""}
    </div>
    <button class="inv-toast-close" onclick="invDismissToast('${id}')"><i class="fa-solid fa-xmark"></i></button>
    <div class="inv-toast-progress" style="animation-duration:${duration}ms;"></div>`;

  container.appendChild(el);
  setTimeout(() => invDismissToast(id), duration);
}

function invDismissToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("hiding");
  setTimeout(() => el.remove(), 280);
}

// ─── MODAL SYSTEM ────────────────────────────────────────────────────────────
const INV_MODAL_CONFIG = {
  error: { icon: "fa-circle-xmark", cls: "inv-modal-error" },
  warning: { icon: "fa-triangle-exclamation", cls: "inv-modal-warning" },
  info: { icon: "fa-circle-info", cls: "inv-modal-info" },
};

function invShowModal(type = "info", title = "", message = "", detail = "") {
  const cfg = INV_MODAL_CONFIG[type] || INV_MODAL_CONFIG.info;
  const overlay = document.getElementById("invModalOverlay");
  const box = document.getElementById("invModalBox");

  box.className = "inv-modal-box " + cfg.cls;
  document.getElementById("invModalIcon").className = `fa-solid ${cfg.icon}`;
  document.getElementById("invModalTitle").textContent = title;
  document.getElementById("invModalMessage").textContent = message;

  const detailEl = document.getElementById("invModalDetail");
  if (detail) {
    detailEl.style.display = "";
    detailEl.textContent = detail;
  } else {
    detailEl.style.display = "none";
  }
  overlay.classList.add("open");
}

function invCloseModal(e) {
  if (e && e.target !== document.getElementById("invModalOverlay")) return;
  document.getElementById("invModalOverlay").classList.remove("open");
}
