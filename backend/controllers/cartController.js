const Cart = require("../models/cartModel");
const Product = require("../models/product");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

exports.getCart = catchAsync(async (req, res, next) => {
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
        cart = await Cart.create({ user: req.user.id, items: [] });
    }

    res.status(200).json({
        status: "success",
        data: {
            cart,
        },
    });
});

exports.addToCart = catchAsync(async (req, res, next) => {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);

    if (!product) {
        return next(new AppError("Product not found", 404));
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
        cart = await Cart.create({ user: req.user.id, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
        (item) => item.product._id.toString() === productId || item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += quantity;
    } else {
        cart.items.push({
            product: productId,
            quantity,
            price: product.price,
        });
    }

    await cart.save();

    res.status(200).json({
        status: "success",
        data: {
            cart,
        },
    });
});

exports.updateCartItem = catchAsync(async (req, res, next) => {
    // Placeholder
    res.status(200).json({ status: 'success', message: 'Cart updated' });
});

exports.removeFromCart = catchAsync(async (req, res, next) => {
    // Placeholder
    res.status(204).json({ status: 'success', data: null });
});

exports.clearCart = catchAsync(async (req, res, next) => {
    let cart = await Cart.findOne({ user: req.user.id });
    if (cart) {
        cart.items = [];
        await cart.save();
    }
    res.status(204).json({ status: 'success', data: null });
});
