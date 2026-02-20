/**
 * Product Cards Dynamic Creation
 * Renders product cards for Products, Combo Pack, and Gift Pack sections
 */

/**
 * Truncates text to a specified length and adds ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum character length (default: 60)
 * @returns {string} - Truncated text with "..." if needed
 */
function truncateText(text, maxLength = 60) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trim() + '...';
}

// Product Data Arrays - 8 Fragrances
const productsData = [
  {
    id: 1,
    name: "Jasmine",
    description: "Fresh, floral jasmine aroma",
    fullDescription: "A fresh, floral jasmine aroma inspired by the garlands of Tamil temples. It fills the space with festive and spiritual warmth, perfect for celebrations, rituals, and family gatherings.",
    price: 120,
    originalPrice: 199,
    discount: "40% Off",
    image: "./assets/images/Fragrances/1.png",
    type: "product",
    inStock: true
  },
  {
    id: 2,
    name: "Champa",
    description: "Traditional temple floral scent",
    fullDescription: "A traditional temple fragrance carrying the essence of South Indian shrines. Its nostalgic floral notes reflect ancient Tamil heritage, making it ideal for puja and festive home ambience.",
    price: 120,
    originalPrice: 199,
    discount: "40% Off",
    image: "./assets/images/Fragrances/2.png",
    type: "product",
    inStock: true
  },
  {
    id: 3,
    name: "Lavender",
    description: "Calming & soothing aromatic notes",
    fullDescription: "A calming, soothing scent crafted to bring peace and clarity. Perfect for meditation, yoga spaces, and bedtime rituals, blending herbal purity with gentle lavender notes.",
    price: 120,
    originalPrice: 199,
    discount: "40% Off",
    image: "./assets/images/Fragrances/3.png",
    type: "product",
    inStock: true
  },
  {
    id: 4,
    name: "Screw Pine",
    description: "Delicate, unique floral aroma",
    fullDescription: "A delicate, unique floral fragrance inspired by sacred screw pine blossoms. Its culturally rooted aroma offers a true temple-like experience for traditional scent lovers.",
    price: 120,
    originalPrice: 199,
    discount: "40% Off",
    image: "./assets/images/Fragrances/4.png",
    type: "product",
    inStock: true
  },
  {
    id: 5,
    name: "Rose",
    description: "Soft, devotional floral fragrance",
    fullDescription: "A soft devotional aroma reminiscent of divine rose garlands. Ideal for daily puja, meditation, and feminine spiritual spaces, creating a serene and soothing ambience.",
    price: 120,
    originalPrice: 199,
    discount: "40% Off",
    image: "./assets/images/Fragrances/5.png",
    type: "product",
    inStock: true
  },
  {
    id: 6,
    name: "Sandal",
    description: "Classic woody, sacred aroma",
    fullDescription: "A classic sacred woody fragrance revered in Vedic rituals. Its pure sandal aroma enhances focus and clarity, perfect for homams, poojas, and deep spiritual practice.",
    price: 120,
    originalPrice: 199,
    discount: "40% Off",
    image: "./assets/images/Fragrances/6.png",
    type: "product",
    inStock: true
  },
  {
    id: 7,
    name: "Sacred Resin",
    description: "Resinous temple-style fragrance",
    fullDescription: "A rich temple-style resin fragrance known for its purifying qualities. It creates a sacred ceremonial aura, perfect for rituals, archana, and cleansing the spiritual environment.",
    price: 120,
    originalPrice: 199,
    discount: "40% Off",
    image: "./assets/images/Fragrances/7.png",
    type: "product",
    inStock: true
  },
  {
    id: 8,
    name: "Javathu",
    description: "Rich, distinctive devotional fragrance",
    fullDescription: "A rich devotional aroma reflecting Tamil Nadu's aromatic heritage. Deep and traditional, it helps you connect with cultural roots and adds a meaningful spiritual touch.",
    price: 120,
    originalPrice: 199,
    discount: "40% Off",
    image: "./assets/images/Fragrances/8.png",
    type: "product",
    inStock: true
  }
];

// Combo Pack Data
const comboPackData = [
  {
    id: 101,
    name: "8 Fragrances Pack",
    description: "Complete collection of all 8 divine fragrances in one pack.",
    price: 799,
    originalPrice: 1199,
    discount: "33% Off",
    image: "./assets/images/images/8fragrances.png",
    type: "combo",
    inStock: true
  },
  {
    id: 102,
    name: "Temple Essentials",
    description: "A curated selection of our most popular temple fragrances.",
    price: 399,
    originalPrice: 599,
    discount: "33% Off",
    image: "./assets/images/Fragrances/c1.png",
    type: "combo",
    inStock: true
  },
  {
    id: 103,
    name: "Floral Collection",
    description: "Jasmine, Rose, and Champa - the perfect floral trio.",
    price: 349,
    originalPrice: 499,
    discount: "30% Off",
    image: "./assets/images/Fragrances/c1.png",
    type: "combo",
    inStock: true
  }
];

// Gift Pack Data
const giftPackData = [
  {
    id: 201,
    name: "Premium Gift Set",
    description: "A premium collection of our finest fragrances.",
    price: 499,
    originalPrice: 699,
    discount: "28% Off",
    image: "./assets/images/images/8fragrances.png",
    type: "gift",
    inStock: true
  },
  {
    id: 202,
    name: "Festive Gift Box",
    description: "Perfect for special occasions and celebrations.",
    price: 399,
    originalPrice: 549,
    discount: "27% Off",
    image: "./assets/images/Fragrances/c1.png",
    type: "gift",
    inStock: true
  }
];

/**
 * Creates a product card HTML element
 * @param {Object} product - Product data object
 * @returns {string} - HTML string for the product card
 */
function createProductCard(product) {
  const stockLabel = product.inStock ? '' : '<span class="stock-label">Out of Stock</span>';

  return `
    <li>
      <div class="card">
        ${stockLabel}
        <div class="card-img">
          <img
            loading="lazy"
            src="${product.image}"
            alt="${product.name}"
            class="img"
          />
        </div>
        <div class="product-description">
          <p class="product-title">${product.name}</p>
          <small class="sample">${product.description}</small><br />
          <p class="rupees"><span class="rupees"></span>₹${product.price}</p>
          <span class="light">M.R.P:<strike class="light">₹${product.originalPrice}</strike>(${product.discount})</span>
        </div>
        <button
          class="addtoplate"
          data-item-name="${product.type}"
          data-id="${product.id}"
        >
          Add to Card
        </button>
      </div>
    </li>
  `;
}

/**
 * Creates a gift pack card HTML element (slightly different structure for cards-container)
 * @param {Object} product - Product data object
 * @returns {string} - HTML string for the gift pack card
 */
function createGiftPackCard(product) {
  const stockLabel = product.inStock ? '' : '<span class="stock-label">Out of Stock</span>';

  return `
    <div class="card">
      ${stockLabel}
      <div class="card-img">
        <img
          loading="lazy"
          src="${product.image}"
          alt="${product.name}"
          class="img"
        />
      </div>
      <div class="product-description">
        <p class="product-title">${product.name}</p>
        <small class="sample">${product.description}</small><br />
        <p class="rupees"><span class="rupees"></span>₹${product.price}</p>
        <span class="light">M.R.P:<strike class="light">₹${product.originalPrice}</strike>(${product.discount})</span>
      </div>
      <button
        class="addtoplate"
        data-item-name="${product.type}"
        data-id="${product.id}"
      >
        Add to Card
      </button>
    </div>
  `;
}

/**
 * Renders all product cards into their respective containers
 */
function renderProductCards() {
  // Render Products section
  const productsContainer = document.querySelector('.veg-container .products-ul');
  if (productsContainer) {
    productsContainer.innerHTML = productsData.map(createProductCard).join('');
  }

  // Render Combo Pack section
  const comboContainer = document.querySelector('.non-veg-container .products-ul');
  if (comboContainer) {
    comboContainer.innerHTML = comboPackData.map(createProductCard).join('');
  }

  // Render Gift Pack section
  const giftContainer = document.querySelector('.recommended-section .cards-container');
  if (giftContainer) {
    giftContainer.innerHTML = giftPackData.map(createGiftPackCard).join('');
  }

  // Attach event listeners to Add to Cart buttons
  attachAddToCartListeners();
}

// ========================================
// CART FUNCTIONALITY
// ========================================

// Cart state - stores items with id, quantity, and product reference
let cart = [];

// Get all products combined
function getAllProducts() {
  return [...productsData, ...comboPackData, ...giftPackData];
}

// Find product by ID
function findProductById(id) {
  return getAllProducts().find(p => p.id === parseInt(id));
}

/**
 * Add item to cart
 */
function addToCart(productId) {
  const product = findProductById(productId);
  if (!product) return;

  const existingItem = cart.find(item => item.id === product.id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      quantity: 1,
      product: product
    });
  }

  updateCartUI();
  saveCartToStorage();

  // Open cart panel
  const cardElement = document.getElementById('card');
  const backdrop = document.getElementById('cart-backdrop');
  if (cardElement && !cardElement.classList.contains('active')) {
    cardElement.classList.add('active');
    document.body.classList.add('no-scroll');
    if (backdrop) backdrop.classList.add('active');
  }
}

/**
 * Remove item from cart
 */
function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== parseInt(productId));
  updateCartUI();
  saveCartToStorage();
}

/**
 * Update item quantity
 */
function updateQuantity(productId, change) {
  const item = cart.find(item => item.id === parseInt(productId));
  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    updateCartUI();
    saveCartToStorage();
  }
}

/**
 * Calculate cart totals
 */
function calculateCartTotals() {
  let subtotal = 0;
  let originalTotal = 0;

  cart.forEach(item => {
    subtotal += item.product.price * item.quantity;
    originalTotal += item.product.originalPrice * item.quantity;
  });

  const savings = originalTotal - subtotal;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return { subtotal, originalTotal, savings, totalItems };
}

/**
 * Create cart item HTML
 */
function createCartItemHTML(item) {
  return `
    <div class="product-details" data-cart-item-id="${item.id}">
      <div class="selecteditems">
        <div class="card-img">
          <img loading="lazy" src="${item.product.image}" alt="${item.product.name}" />
        </div>
        <div class="product-d">
          <h3 class="product-title">${item.product.name}</h3>
          <span class="light">M.R.P:<strike class="light">₹${item.product.originalPrice}</strike>(${item.product.discount})</span>
          <h3 class="rupees"><span class="rupees"></span><br />₹${item.product.price}</h3>
          <div class="btns">
            <div class="qty-control" data-product-id="${item.id}">
              <button class="qty-btn minus" onclick="updateQuantity(${item.id}, -1)">−</button>
              <span class="qty-value">${item.quantity}</span>
              <button class="qty-btn plus" onclick="updateQuantity(${item.id}, 1)">+</button>
            </div>
            <button class="remove" onclick="removeFromCart(${item.id})">
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Update cart UI
 */
function updateCartUI() {
  const cartContainer = document.getElementById('cart-items-container');
  const emptyMessage = document.getElementById('empty-cart-msg');
  const cartItemCount = document.getElementById('cart-item-count');
  const cartSubtotal = document.getElementById('cart-subtotal');
  const cartSavings = document.getElementById('cart-savings');
  const cartTotal = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('checkout-btn');

  const totals = calculateCartTotals();

  // Update cart items
  if (cart.length === 0) {
    if (emptyMessage) emptyMessage.style.display = 'flex';
    // Clear only cart items, keep empty message
    const cartItems = cartContainer.querySelectorAll('.product-details');
    cartItems.forEach(item => item.remove());
  } else {
    if (emptyMessage) emptyMessage.style.display = 'none';
    // Render cart items
    const cartItemsHTML = cart.map(createCartItemHTML).join('');
    // Remove existing items and add new ones
    const existingItems = cartContainer.querySelectorAll('.product-details');
    existingItems.forEach(item => item.remove());
    cartContainer.insertAdjacentHTML('beforeend', cartItemsHTML);
  }

  // Update totals
  if (cartItemCount) {
    cartItemCount.textContent = `${totals.totalItems} item${totals.totalItems !== 1 ? 's' : ''}`;
  }
  if (cartSubtotal) cartSubtotal.textContent = `₹${totals.subtotal}`;
  if (cartSavings) cartSavings.textContent = `₹${totals.savings}`;
  if (cartTotal) cartTotal.textContent = `₹${totals.subtotal}`;
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

  // Update nav cart count
  const navCartCount = document.getElementById('nav-cart-count');
  if (navCartCount) {
    navCartCount.textContent = totals.totalItems;
  }
}

/**
 * Attach event listeners to Add to Cart buttons
 */
function attachAddToCartListeners() {
  document.querySelectorAll('.addtoplate').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const productId = button.getAttribute('data-id');
      addToCart(productId);

      // Visual feedback
      button.textContent = 'Added!';
      button.style.backgroundColor = '#28a745';
      setTimeout(() => {
        button.textContent = 'Add to Card';
        button.style.backgroundColor = '#ffb000';
      }, 1000);
    });
  });
}

/**
 * Save cart to localStorage
 */
function saveCartToStorage() {
  localStorage.setItem('shriCart', JSON.stringify(cart.map(item => ({
    id: item.id,
    quantity: item.quantity
  }))));
}

/**
 * Load cart from localStorage
 */
function loadCartFromStorage() {
  const savedCart = localStorage.getItem('shriCart');
  if (savedCart) {
    const cartData = JSON.parse(savedCart);
    cart = cartData.map(item => {
      const product = findProductById(item.id);
      if (product) {
        return {
          id: item.id,
          quantity: item.quantity,
          product: product
        };
      }
      return null;
    }).filter(Boolean);
  }
}

// Initialize product cards and cart when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  renderProductCards();
  loadCartFromStorage();
  updateCartUI();

  // Checkout button - redirect to checkout page
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (cart.length > 0) {
        window.location.href = './checkout.html';
      }
    });
  }
});
