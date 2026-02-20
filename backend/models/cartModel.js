const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
            required: [true, "Cart must belong to a user"],
        },
        items: [
            {
                product: {
                    type: mongoose.Schema.ObjectId,
                    ref: "Product",
                    required: [true, "Cart item must have a product"],
                },
                quantity: {
                    type: Number,
                    required: [true, "Cart item must have a quantity"],
                    min: [1, "Quantity must be at least 1"],
                    default: 1,
                },
                price: {
                    type: Number,
                    required: [true, "Cart item must have a price"],
                },
            },
        ],
        totalQuantity: {
            type: Number,
            default: 0,
        },
        totalPrice: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Calculate totals before saving
cartSchema.pre("save", function (next) {
    this.totalQuantity = this.items.reduce((acc, item) => acc + item.quantity, 0);
    this.totalPrice = this.items.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
    );
    next();
});

// Populate product details
cartSchema.pre(/^find/, function (next) {
    this.populate({
        path: "items.product",
        select: "name price mainImage slug stock",
    });
    next();
});

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
