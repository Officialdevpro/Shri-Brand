const Cart = require("../models/cartModel");
const Product = require("../models/productModel");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// ─────────────────────────────────────────────
//  HELPER: Check if user is authenticated
// ─────────────────────────────────────────────
const requireAuth = (req, res) => {
    const isApiRequest =
        req.xhr ||
        req.headers.accept?.includes("application/json") ||
        req.headers["content-type"]?.includes("application/json");

    if (isApiRequest) {
        return res.status(401).json({
            status: "fail",
            message: "You are not logged in. Please log in to access your cart.",
        });
    }

    return res.redirect("/auth");
};

// ─────────────────────────────────────────────
//  HELPER: Find or create user's cart
// ─────────────────────────────────────────────
const findOrCreateCart = async (userId) => {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
        cart = new Cart({ userId, items: [] });
        await cart.save();
    }
    return cart;
};

// ─────────────────────────────────────────────
//  HELPER: Find the default pack (first in-stock by weight, fallback to lowest)
// ─────────────────────────────────────────────
const getDefaultPack = (product) => {
    if (!product.packs || product.packs.length === 0) return null;
    const sorted = [...product.packs].sort((a, b) => a.weightValue - b.weightValue);
    // Prefer first pack that is in stock
    const inStock = sorted.find((p) => p.stock > 0);
    return inStock || sorted[0]; // fallback to lowest if all out
};

// ─────────────────────────────────────────────
//  GET CART  →  GET /api/cart
//  Validates cart against live product data:
//  - Removes items for deleted/deactivated products
//  - Removes items for packs that no longer exist
//  - Updates stock, price, name, image from live data
//  - Caps quantity if stock reduced
// ─────────────────────────────────────────────
exports.getCart = catchAsync(async (req, res, next) => {
    if (!req.user) return requireAuth(req, res);

    const cart = await findOrCreateCart(req.user.id);

    // Run full validation — cleans up stale items, refreshes all snapshots
    const { issues } = await cart.validateCart();

    return res.status(200).json({
        status: "success",
        data: { cart },
        // Send issues so frontend can show relevant notifications
        ...(issues.length > 0 && { issues }),
    });
});

// ─────────────────────────────────────────────
//  ADD TO CART  →  POST /api/cart
//  Body: { productId, quantity, packWeight? }
//  If packWeight is not provided, defaults to lowest pack
// ─────────────────────────────────────────────
exports.addToCart = catchAsync(async (req, res, next) => {
    if (!req.user) return requireAuth(req, res);

    const { productId, quantity = 1, packWeight } = req.body;

    // ── Validate input ──
    if (!productId) {
        return next(new AppError("Product ID is required.", 400));
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 1) {
        return next(new AppError("Quantity must be a positive number.", 400));
    }

    // ── Fetch product ──
    const product = await Product.findById(productId);

    if (!product) {
        return next(new AppError("Product not found.", 404));
    }

    if (!product.isActive) {
        return next(new AppError("This product is currently unavailable.", 400));
    }

    if (!product.packs || product.packs.length === 0) {
        return next(new AppError("This product has no available packs.", 400));
    }

    // ── Find the requested pack ──
    let selectedPack;
    if (packWeight) {
        selectedPack = product.getPackByWeight(packWeight);
        if (!selectedPack) {
            return next(new AppError(`Pack "${packWeight}" not found for this product.`, 400));
        }
    } else {
        // Default to lowest weight pack
        selectedPack = getDefaultPack(product);
    }

    // ── Stock check ──
    if (selectedPack.stock === 0) {
        return next(new AppError(`Sorry, ${selectedPack.weight} pack is out of stock.`, 400));
    }

    if (selectedPack.stock < parsedQty) {
        return next(
            new AppError(
                `Only ${selectedPack.stock} unit(s) of ${selectedPack.weight} available. Please reduce the quantity.`,
                400
            )
        );
    }

    // ── Find / create cart and add item ──
    const cart = await findOrCreateCart(req.user.id);

    // Check if same product + same pack already in cart
    const existingItem = cart.items.find(
        (item) =>
            item.productId.toString() === productId.toString() &&
            item.selectedPack.weight === selectedPack.weight
    );

    if (existingItem) {
        const newTotalQty = existingItem.quantity + parsedQty;
        if (newTotalQty > selectedPack.stock) {
            return next(
                new AppError(
                    `You already have ${existingItem.quantity} of ${selectedPack.weight} in your cart. Only ${selectedPack.stock} unit(s) are available in total.`,
                    400
                )
            );
        }
    }

    // Uses the cartModel's addItem instance method
    await cart.addItem(product, selectedPack, parsedQty);

    const updatedCart = await Cart.findOne({ userId: req.user.id });

    return res.status(200).json({
        status: "success",
        message: `${product.name} (${selectedPack.weight}) added to cart.`,
        data: { cart: updatedCart },
    });
});

// ─────────────────────────────────────────────
//  UPDATE CART ITEM  →  PATCH /api/cart/:productId
//  Body: { quantity?, packWeight?, newPackWeight? }
//  packWeight identifies which pack entry to update
//  newPackWeight switches the pack
// ─────────────────────────────────────────────
exports.updateCartItem = catchAsync(async (req, res, next) => {
    if (!req.user) return requireAuth(req, res);

    const { productId } = req.params;
    const { quantity, packWeight, newPackWeight } = req.body;

    // ── Fetch latest product ──
    const product = await Product.findById(productId);

    if (!product) {
        return next(new AppError("Product not found.", 404));
    }

    if (!product.isActive) {
        return next(new AppError("This product is currently unavailable.", 400));
    }

    // ── Find cart ──
    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
        return next(new AppError("Your cart is empty.", 404));
    }

    // ── Handle pack change ──
    if (newPackWeight && packWeight && newPackWeight !== packWeight) {
        await cart.changeItemPack(productId, packWeight, newPackWeight, product);

        const updatedCart = await Cart.findOne({ userId: req.user.id });
        return res.status(200).json({
            status: "success",
            message: `Pack changed to ${newPackWeight}.`,
            data: { cart: updatedCart },
        });
    }

    // ── Handle quantity update ──
    if (quantity !== undefined) {
        const parsedQty = parseInt(quantity, 10);
        if (isNaN(parsedQty) || parsedQty < 1) {
            return next(new AppError("Quantity must be a positive number.", 400));
        }

        // Find the pack to validate stock
        const itemPackWeight = packWeight || null;
        let targetItem;

        if (itemPackWeight) {
            targetItem = cart.items.find(
                (item) =>
                    item.productId.toString() === productId.toString() &&
                    item.selectedPack.weight === itemPackWeight
            );
        } else {
            targetItem = cart.items.find(
                (item) => item.productId.toString() === productId.toString()
            );
        }

        if (!targetItem) {
            return next(new AppError("Item not found in your cart.", 404));
        }

        // Check current stock from product
        const currentPack = product.getPackByWeight(targetItem.selectedPack.weight);
        if (currentPack && parsedQty > currentPack.stock) {
            return next(
                new AppError(
                    `Cannot set quantity to ${parsedQty}. Only ${currentPack.stock} unit(s) of ${targetItem.selectedPack.weight} are available.`,
                    400
                )
            );
        }

        await cart.updateItemQuantity(productId, targetItem.selectedPack.weight, parsedQty);

        // Update stock snapshot
        if (currentPack) {
            const itemIndex = cart.items.findIndex(
                (item) =>
                    item.productId.toString() === productId.toString() &&
                    item.selectedPack.weight === targetItem.selectedPack.weight
            );
            if (itemIndex > -1) {
                cart.items[itemIndex].selectedPack.stock = currentPack.stock;
                await cart.save();
            }
        }
    }

    const updatedCart = await Cart.findOne({ userId: req.user.id });

    return res.status(200).json({
        status: "success",
        message: "Cart updated successfully.",
        data: { cart: updatedCart },
    });
});

// ─────────────────────────────────────────────
//  REMOVE ITEM FROM CART  →  DELETE /api/cart/:productId
//  Query: ?packWeight=40g (optional, removes specific pack)
// ─────────────────────────────────────────────
exports.removeFromCart = catchAsync(async (req, res, next) => {
    if (!req.user) return requireAuth(req, res);

    const { productId } = req.params;
    const packWeight = req.query.packWeight || req.body.packWeight;

    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
        return next(new AppError("Your cart is empty.", 404));
    }

    const itemExists = cart.items.some(
        (item) => {
            const idMatch = item.productId.toString() === productId.toString();
            if (packWeight) {
                return idMatch && item.selectedPack.weight === packWeight;
            }
            return idMatch;
        }
    );

    if (!itemExists) {
        return next(new AppError("Item not found in your cart.", 404));
    }

    await cart.removeItem(productId, packWeight);

    return res.status(200).json({
        status: "success",
        message: "Item removed from cart.",
        data: { cart },
    });
});

// ─────────────────────────────────────────────
//  CLEAR ENTIRE CART  →  DELETE /api/cart
// ─────────────────────────────────────────────
exports.clearCart = catchAsync(async (req, res, next) => {
    if (!req.user) return requireAuth(req, res);

    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart || cart.items.length === 0) {
        return res.status(200).json({
            status: "success",
            message: "Cart is already empty.",
        });
    }

    await cart.clearCart();

    return res.status(200).json({
        status: "success",
        message: "Cart cleared successfully.",
        data: { cart },
    });
});

// ─────────────────────────────────────────────
//  VALIDATE CART  →  POST /api/cart/validate
// ─────────────────────────────────────────────
exports.validateCart = catchAsync(async (req, res, next) => {
    if (!req.user) return requireAuth(req, res);

    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart || cart.items.length === 0) {
        return res.status(200).json({
            status: "success",
            message: "Cart is empty.",
            data: { valid: true, issues: [] },
        });
    }

    const { valid, issues } = await cart.validateCart();

    return res.status(200).json({
        status: "success",
        data: {
            valid,
            issues,
            cart,
        },
    });
});