  // Product data with stock information
      let posProductsData = [
        { id: 1, name: "JASMINE", price: 599, stock: 15, image: "../assets/products/1.png" },
        { id: 2, name: "THALAMPOO", price: 1900, stock: 8, image: "../assets/products/2.png" },
        { id: 3, name: "LAVANDAR", price: 199, stock: 22, image: "../assets/products/3.png" },
        { id: 4, name: "ROSE", price: 1299, stock: 12, image: "../assets/products/5.png" },
        { id: 5, name: "THALAMPOO", price: 1900, stock: 8, image: "../assets/products/2.png" },
         { id: 7, name: "JASMINE", price: 599, stock: 15, image: "../assets/products/1.png" },
 { id: 8, name: "ROSE", price: 1299, stock: 12, image: "../assets/products/5.png" },
  { id: 6, name: "LAVANDAR", price: 199, stock: 22, image: "../assets/products/3.png" },
      ];

      let posCart = [];
      let posSelectedPayment = null;

      // Calculate available stock
      function posGetAvailableStock(productId) {
        const product = posProductsData.find(p => p.id === productId);
        if (!product) return 0;
        
        const cartItem = posCart.find(item => item.id === productId);
        const cartQuantity = cartItem ? cartItem.qty : 0;
        
        return product.stock - cartQuantity;
      }

      // Get stock badge class
      function posGetStockClass(availableStock) {
        if (availableStock <= 0) return 'pos-stock-out';
        if (availableStock <= 5) return 'pos-stock-low';
        return 'pos-stock-in';
      }

      // Get stock text
      function posGetStockText(availableStock) {
        if (availableStock <= 0) return 'Out of Stock';
        if (availableStock <= 5) return `Low: ${availableStock}`;
        return `Stock: ${availableStock}`;
      }

      function posRenderProducts() {
        // const q = document.getElementById('pos-search').value.toLowerCase();
        const productsDiv = document.getElementById('pos-products');
        productsDiv.innerHTML = "";
        
        posProductsData
          // .filter((p) => p.name.toLowerCase().includes(q)
          .forEach((p) => {
            const availableStock = posGetAvailableStock(p.id);
            const stockClass = posGetStockClass(availableStock);
            const stockText = posGetStockText(availableStock);
            
            productsDiv.innerHTML += `
              <div class="pos-product"  onclick="posAddToCart(${p.id})" ${availableStock <= 0 ? 'disabled' : ''}>
               <div class="product-left">
                <img src="${p.image}">
                <div class="pos-product-info">
                  <h4>${p.name}</h4>
                  <div class="pos-price-stock">
                    <p>₹${p.price}</p>
                  <span class="pos-stock-badge ${stockClass}">${stockText}</span>
                  </div>
                </div>
                </div>
               
              </div>`;
          });
      }

      function posAddToCart(id) {
        const availableStock = posGetAvailableStock(id);
        
        if (availableStock <= 0) {
          posShowMessage("Out of Stock", "This product is out of stock!");
          return;
        }
        
        let i = posCart.find((x) => x.id === id);
        if (i) {
          i.qty++;
        } else {
          const p = posProductsData.find((x) => x.id === id);
          posCart.push({ ...p, qty: 1 });
        }
        
        posRenderCart();
        posRenderProducts(); // Update stock display
        
      }

      function posRenderCart() {
        const cartDiv = document.getElementById('pos-cart');
        
        if (!posCart.length) {
          cartDiv.innerHTML = '<div class="pos-cart-empty">Your cart is empty.</div>';
          posUpdateTotal();
          return;
        }
        
        cartDiv.innerHTML = "";
        posCart.forEach((i) => {
          cartDiv.innerHTML += `
            <div class="pos-cart-item">
              <span>${i.name}</span>
              <div class="pos-qty">
                <button class="pos-minus" onclick="posChangeQty(${i.id}, -1)">-</button>
                <span>${i.qty}</span>
                <button class="pos-plus" onclick="posChangeQty(${i.id}, 1)">+</button>
              </div>
            </div>`;
        });
        posUpdateTotal();
      }

      function posChangeQty(id, v) {
        let i = posCart.find((x) => x.id === id);
        if (!i) return;
        
        const newQty = i.qty + v;
        
        if (v < 0) {
          i.qty = newQty;
          if (i.qty <= 0) {
            posCart = posCart.filter((x) => x.id !== id);
          }
        } else {
          const availableStock = posGetAvailableStock(id);
          if (availableStock <= 0) {
            posShowMessage("Stock Limit", "No more stock available!");
            return;
          }
          i.qty = newQty;
        }
        
        posRenderCart();
        posRenderProducts(); // Update stock display
      }

      function posUpdateTotal() {
        let sub = posCart.reduce((a, i) => a + i.price * i.qty, 0);
        let taxP = +document.getElementById('pos-taxInput').value || 0;
        let disP = +document.getElementById('pos-discountInput').value || 0;
        let taxed = sub + (sub * taxP) / 100;
        let total = taxed - (taxed * disP) / 100;

        document.getElementById('pos-item').innerText = "₹" + sub.toFixed(2);
        document.getElementById('pos-total').innerText = "₹" + total.toFixed(2);
      }

      function posSelectPayment(m, b) {
        posSelectedPayment = m;
        document
          .querySelectorAll(".pos-payments button")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      }

      function posOpenBill() {
        if (!posCart.length) {
          posShowMessage("Cart Empty", "Cart is empty! Add products first.");
          return;
        }
        if (!posSelectedPayment) {
          posShowMessage("Payment Required", "Select payment method!");
          return;
        }

        document.getElementById('pos-bName').innerText = document.getElementById('pos-custName').value || "-";
        document.getElementById('pos-bMobile').innerText = document.getElementById('pos-custMobile').value || "-";
        document.getElementById('pos-bPayment').innerText = posSelectedPayment;
        document.getElementById('pos-bTax').innerText = document.getElementById('pos-taxInput').value + "%";
        document.getElementById('pos-bDiscount').innerText = document.getElementById('pos-discountInput').value + "%";

        const bItems = document.getElementById('pos-bItems');
        bItems.innerHTML = "";
        posCart.forEach((i) => {
          bItems.innerHTML += `
            <div class="pos-row">
              <span>${i.name} x${i.qty}</span>
              <span>₹${(i.price * i.qty).toFixed(2)}</span>
            </div>`;
        });
        
        document.getElementById('pos-bTotal').innerText = document.getElementById('pos-total').innerText;
        document.getElementById('pos-modal').classList.add("show");
      }

      function posCloseBill() {
        document.getElementById('pos-modal').classList.remove("show");
      }

      function posConfirmOrder() {
        // Reduce stock permanently
        posCart.forEach(cartItem => {
          const product = posProductsData.find(p => p.id === cartItem.id);
          if (product) {
            product.stock -= cartItem.qty;
            if (product.stock < 0) product.stock = 0;
          }
        });
        
        const sendWhatsapp = document.getElementById('pos-sendWhatsapp').checked;
        const customerName = document.getElementById('pos-custName').value || "Customer";
        
        posShowMessage(
          "Order Confirmed",
          `Order placed for ${customerName}!${sendWhatsapp ? " WhatsApp bill sent." : ""}`
        );
        
        // Reset everything
        posCart = [];
        posSelectedPayment = null;
        document.querySelectorAll(".pos-payments button").forEach((b) => b.classList.remove("active"));
        document.getElementById('pos-custName').value = "";
        document.getElementById('pos-custMobile').value = "";
        document.getElementById('pos-taxInput').value = "1";
        document.getElementById('pos-discountInput').value = "0";
        
        posCloseBill();
        posRenderCart();
        posRenderProducts();
      }

      // Message modal functions
      function posShowMessage(title, text) {
        document.getElementById('pos-messageTitle').innerText = title;
        document.getElementById('pos-messageText').innerText = text;
        document.getElementById('pos-messageModal').classList.add('show');
      }

      function posCloseMessage() {
        document.getElementById('pos-messageModal').classList.remove('show');
      }

      // Initialize
      document.addEventListener('DOMContentLoaded', () => {
        posRenderProducts();
        posRenderCart();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            posCloseBill();
            posCloseMessage();
          }
        });
      });