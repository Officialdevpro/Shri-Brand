// Updated product data using ORIGINAL names & images
const productsPd = [
  {
    id: 1,
    name: "JASMINE",
    price: 599,
    stock: 120,
    description: "Premium Jasmine incense sticks",
    image: "../assets/products/1.png",
  },
  {
    id: 2,
    name: "THALAMPOO",
    price: 1900,
    stock: 85,
    description: "Traditional Thalampoo incense sticks",
    image: "../assets/products/2.png",
  },
  {
    id: 3,
    name: "LAVANDAR",
    price: 199,
    stock: 45,
    description: "Refreshing Lavandar incense sticks",
    image: "../assets/products/3.png",
  },
  {
    id: 4,
    name: "ROSE",
    price: 899,
    stock: 30,
    description: "Natural Rose fragrance incense sticks",
    image: "../assets/products/5.png",
  },
  {
    id: 5,
    name: "THALAMPOO",
    price: 2499,
    stock: 15,
    description: "Premium quality Thalampoo incense sticks",
    image: "../assets/products/2.png",
  },
];


// DOM Elements
const productFormPd = document.getElementById("productFormPd");
const productsListPd = document.getElementById("productsListPd");
const searchInputPd = document.getElementById("searchInputPd");
const uploadTriggerPd = document.getElementById("uploadTriggerPd");
const productImageInputPd = document.getElementById("productImagePd");
const imagePreviewPd = document.getElementById("imagePreviewPd");
const clearBtnPd = document.getElementById("clearBtnPd");
const resetFormBtnPd = document.getElementById("resetFormBtnPd");
const stockModalPd = document.getElementById("stockModalPd");
const closeModalPd = document.getElementById("closeModalPd");
const updateStockBtnPd = document.getElementById("updateStockBtnPd");
const modalProductNamePd = document.getElementById("modalProductNamePd");
const currentStockPd = document.getElementById("currentStockPd");
const stockChangePd = document.getElementById("stockChangePd");
const resultStockPd = document.getElementById("resultStockPd");
const messageBoxPd = document.getElementById("messageBoxPd");
const messageTitlePd = document.getElementById("messageTitlePd");
const messageBodyPd = document.getElementById("messageBodyPd");
const closeMessagePd = document.getElementById("closeMessagePd");
const navLinksPd = document.querySelectorAll(".nav-link-pd");
const sectionsPd = document.querySelectorAll(".main-content-pd section");
const menuTogglePd = document.getElementById("menuTogglePd");
const overlayPd = document.getElementById("overlayPd");
const sidebarPd = document.querySelector(".sidebar-pd");

let currentProductIdPd = null;
let currentImageUrlPd = null;

// Counter animation function
function animateCounterPd(element, start, end, duration = 2000) {
  const startTime = performance.now();
  const step = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.floor(progress * (end - start) + start);

    // Format number with commas
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

// Initialize the application
function initPd() {
  renderProductsPd();
  updateProductStatsPd();

  // Animate counters on load
  setTimeout(() => {
    animateStatsPd();
  }, 500);
}

// Animate all statistics counters
function animateStatsPd() {
  const totalProducts = productsPd.length;
  const totalStocks = productsPd.reduce(
    (sum, product) => sum + product.stock,
    0,
  );

  animateCounterPd(
    document.getElementById("totalProductsPd"),
    0,
    totalProducts,
  );
  animateCounterPd(document.getElementById("totalStocksPd"), 0, totalStocks);
  animateCounterPd(document.getElementById("lowStockPd"), 0, 10);
  animateCounterPd(document.getElementById("highStockPd"), 0, 1002);
}

// Render product list
function renderProductsPd(filter = "") {
  productsListPd.innerHTML = "";

  const filteredProducts = productsPd.filter((product) =>
    product.name.toLowerCase().includes(filter.toLowerCase()),
  );

  filteredProducts.forEach((product) => {
    const productItem = document.createElement("div");
    productItem.className = "product-item-pd";
    productItem.dataset.id = product.id;

    productItem.innerHTML = `
            <div class="product-image-pd">
              ${product.image
        ? `<img src="${product.image}" alt="${product.name}">`
        : `<div class="no-image-pd"><i class="fas fa-image"></i></div>`
      }
            </div>
            <div class="product-info-pd">
              <h4>${product.name}</h4>
              <div class="product-meta-pd">
                <span class="product-price-pd">
                  <i class="fas fa-dollar-sign"></i> ${product.price}
                </span>
                <span class="product-stock-pd">
                  <i class="fas fa-box"></i> ${product.stock} units
                </span>
              </div>
            </div>
            <div class="product-actions-pd">
              <button class="btn-action-pd btn-edit-pd" onclick="editProductPd(${product.id})">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-action-pd btn-update-stock-pd" onclick="openStockModalPd(${product.id})">
                <i class="fas fa-boxes"></i>
              </button>
              <button class="btn-action-pd btn-delete-pd" onclick="deleteProductPd(${product.id})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `;

    productsListPd.appendChild(productItem);
  });
}

// Update product statistics
function updateProductStatsPd() {
  const totalProducts = productsPd.length;
  const totalStocks = productsPd.reduce(
    (sum, product) => sum + product.stock,
    0,
  );

  document.getElementById("totalProductsPd").textContent = totalProducts;
  document.getElementById("totalStocksPd").textContent = totalStocks;
}

// Show message function
function showMessagePd(title, body, type = "success") {
  messageTitlePd.textContent = title;
  messageBodyPd.textContent = body;

  // Set icon based on message type
  const icon = messageBoxPd.querySelector(".message-icon-pd i");
  icon.className =
    type === "success"
      ? "fas fa-check"
      : type === "error"
        ? "fas fa-times"
        : "fas fa-info-circle";

  // Set color based on type
  const messageIcon = messageBoxPd.querySelector(".message-icon-pd");
  messageIcon.style.backgroundColor =
    type === "success"
      ? "var(--success)"
      : type === "error"
        ? "var(--danger)"
        : "var(--warning)";

  // Show message
  messageBoxPd.style.display = "block";

  // Auto hide after 5 seconds
  setTimeout(() => {
    hideMessagePd();
  }, 5000);
}

// Hide message function
function hideMessagePd() {
  messageBoxPd.style.display = "none";
}

// Handle form submission
productFormPd.addEventListener("submit", function (e) {
  e.preventDefault();

  const id = document.getElementById("productIdPd").value;
  const name = document.getElementById("productNamePd").value;
  const price = parseFloat(document.getElementById("productPricePd").value);
  const stock =
    parseInt(document.getElementById("productStockPd").value) || 0;
  const description = document.getElementById("productDescriptionPd").value;

  if (!name || !price) {
    showMessagePd(
      "Validation Error",
      "Please fill in all required fields",
      "error",
    );
    return;
  }

  if (id) {
    // Update existing product
    const index = productsPd.findIndex((p) => p.id == id);
    if (index !== -1) {
      productsPd[index] = {
        ...productsPd[index],
        name,
        price,
        stock,
        description,
        image: currentImageUrlPd || productsPd[index].image,
      };
      showMessagePd("Success", "Product updated successfully!", "success");
    }
  } else {
    // Add new product
    const newProduct = {
      id:
        productsPd.length > 0
          ? Math.max(...productsPd.map((p) => p.id)) + 1
          : 1,
      name,
      price,
      stock,
      description,
      image: currentImageUrlPd,
    };
    productsPd.push(newProduct);
    showMessagePd("Success", "Product added successfully!", "success");
  }

  // Reset form
  resetFormPd();
  renderProductsPd();
  updateProductStatsPd();
  animateStatsPd();
});

// Clear form for adding new product
clearBtnPd.addEventListener("click", function () {
  resetFormPd();
  showMessagePd("Form Cleared", "Ready to add new product", "info");
});

// Reset form button
resetFormBtnPd.addEventListener("click", function () {
  resetFormPd();
  showMessagePd("Form Reset", "All fields have been cleared", "info");
});

// Edit product
function editProductPd(id) {
  const product = productsPd.find((p) => p.id == id);
  if (!product) return;

  document.getElementById("productIdPd").value = product.id;
  document.getElementById("productNamePd").value = product.name;
  document.getElementById("productPricePd").value = product.price;
  document.getElementById("productStockPd").value = product.stock;
  document.getElementById("productDescriptionPd").value =
    product.description;

  currentImageUrlPd = product.image;
  if (product.image) {
    imagePreviewPd.innerHTML = `<img src="${product.image}" alt="${product.name}">`;
  } else {
    resetImagePreviewPd();
  }

  // Scroll to form
  document.querySelector(".card-pd").scrollIntoView({ behavior: "smooth" });
  showMessagePd("Edit Mode", `Editing: ${product.name}`, "info");
}

// Delete product - USING CUSTOM MODAL INSTEAD OF ALERT
function deleteProductPd(id) {
  const product = productsPd.find((p) => p.id == id);
  if (!product) return;

  // Create custom confirmation modal
  const confirmModal = document.createElement('div');
  confirmModal.className = 'modal-pd';
  confirmModal.id = 'confirmDeleteModalPd';
  confirmModal.innerHTML = `
          <div class="modal-content-pd" style="max-width: 400px;">
            <div class="modal-header-pd">
              <h3 class="modal-title-pd"><i class="fas fa-exclamation-triangle"></i> Confirm Delete</h3>
              <button class="modal-close-pd" onclick="closeConfirmModalPd()">&times;</button>
            </div>
            <div class="form-group-pd">
              <p style="color: var(--dark); font-size: 1.1rem; text-align: center;">
                Are you sure you want to delete <strong>"${product.name}"</strong>?
              </p>
              <p style="color: var(--gray); font-size: 0.9rem; text-align: center; margin-top: 10px;">
                This action cannot be undone.
              </p>
            </div>
            <div style="display: flex; gap: 15px; margin-top: 25px;">
              <button type="button" class="btn-pd btn-secondary-pd" style="flex: 1;" onclick="closeConfirmModalPd()">
                <i class="fas fa-times"></i> Cancel
              </button>
              <button type="button" class="btn-pd btn-danger-pd" style="flex: 1; background-color: var(--danger);" onclick="confirmDeletePd(${id})">
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
          </div>
        `;

  document.body.appendChild(confirmModal);
  confirmModal.classList.add('active-pd');
}

// Close confirmation modal
function closeConfirmModalPd() {
  const modal = document.getElementById('confirmDeleteModalPd');
  if (modal) {
    modal.classList.remove('active-pd');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }
}

// Confirm delete function
function confirmDeletePd(id) {
  const product = productsPd.find((p) => p.id == id);
  if (!product) return;

  const index = productsPd.findIndex((p) => p.id == id);
  if (index !== -1) {
    const productName = productsPd[index].name;
    productsPd.splice(index, 1);
    renderProductsPd();
    updateProductStatsPd();
    animateStatsPd();

    // If we deleted the product being edited, reset form
    if (document.getElementById("productIdPd").value == id) {
      resetFormPd();
    }

    showMessagePd(
      "Deleted",
      `Product "${productName}" has been deleted`,
      "success",
    );
  }

  closeConfirmModalPd();
}

// Open stock update modal
function openStockModalPd(id) {
  const product = productsPd.find((p) => p.id == id);
  if (!product) return;

  currentProductIdPd = id;
  modalProductNamePd.value = product.name;
  currentStockPd.value = product.stock;
  stockChangePd.value = ""; // Clear stock change field
  resultStockPd.value = product.stock; // Set result to current stock
  stockModalPd.classList.add("active-pd");

  // Focus on stock change input
  setTimeout(() => {
    stockChangePd.focus();
  }, 300);
}

// Calculate result stock when stock change is entered
stockChangePd.addEventListener("input", function () {
  const current = parseInt(currentStockPd.value) || 0;
  const change = parseInt(this.value) || 0;
  const result = current + change;
  resultStockPd.value = result < 0 ? 0 : result;
});

// Close stock update modal
function closeStockModalPd() {
  stockModalPd.classList.remove("active-pd");
  currentProductIdPd = null;
}

// Handle stock update
updateStockBtnPd.addEventListener("click", function () {
  if (!currentProductIdPd) return;

  const changeValue = parseInt(stockChangePd.value);
  if (isNaN(changeValue)) {
    showMessagePd("Error", "Please enter a valid stock change", "error");
    return;
  }

  const index = productsPd.findIndex((p) => p.id == currentProductIdPd);
  if (index !== -1) {
    const oldStock = productsPd[index].stock;
    const newStockValue = oldStock + changeValue;

    if (newStockValue < 0) {
      showMessagePd("Error", "Stock cannot be negative", "error");
      return;
    }

    productsPd[index].stock = newStockValue;
    renderProductsPd();
    updateProductStatsPd();
    animateStatsPd();
    closeStockModalPd();

    const changeText = changeValue >= 0 ? `+${changeValue}` : changeValue;
    showMessagePd(
      "Stock Updated",
      `${productsPd[index].name} stock updated: ${oldStock} ${changeText} = ${newStockValue}`,
      "success",
    );
  }
});

// Image upload handling
uploadTriggerPd.addEventListener("click", function () {
  productImageInputPd.click();
});

productImageInputPd.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.match("image.*")) {
    showMessagePd("Error", "Please select an image file", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    currentImageUrlPd = e.target.result;
    imagePreviewPd.innerHTML = `<img src="${currentImageUrlPd}" alt="Preview">`;
  };
  reader.readAsDataURL(file);
});

// Reset image preview
function resetImagePreviewPd() {
  currentImageUrlPd = null;
  imagePreviewPd.innerHTML = `
          <div class="upload-placeholder-pd">
            <i class="fas fa-cloud-upload-alt"></i>
            <p class="txt-samll-pd">Click to upload product image</p>
            <span class="upload-btn-pd" id="uploadTriggerPd">Choose Image</span>
          </div>
        `;
  // Reattach event listener
  document
    .getElementById("uploadTriggerPd")
    .addEventListener("click", function () {
      productImageInputPd.click();
    });
}

// Reset form
function resetFormPd() {
  document.getElementById("productIdPd").value = "";
  document.getElementById("productNamePd").value = "";
  document.getElementById("productPricePd").value = "";
  document.getElementById("productStockPd").value = "0";
  document.getElementById("productDescriptionPd").value = "";
  resetImagePreviewPd();
}

// Search functionality
searchInputPd.addEventListener("input", function () {
  renderProductsPd(this.value);
});

// Navigation
navLinksPd.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navLinksPd.forEach((l) => l.classList.remove("active-pd"));
    link.classList.add("active-pd");

    const target = link.dataset.section;
    sectionsPd.forEach((sec) => {
      sec.classList.remove("active-section-pd");
      if (sec.id === target) {
        sec.classList.add("active-section-pd");
      }
    });

    // Close mobile sidebar if open
    sidebarPd.classList.remove("active-pd");
    overlayPd.classList.remove("active-pd");
  });
});





// Modal close handlers
closeModalPd.addEventListener("click", closeStockModalPd);
stockModalPd.addEventListener("click", function (e) {
  if (e.target === stockModalPd) {
    closeStockModalPd();
  }
});

// Message close handler
closeMessagePd.addEventListener("click", hideMessagePd);

// Initialize the app
document.addEventListener("DOMContentLoaded", initPd);