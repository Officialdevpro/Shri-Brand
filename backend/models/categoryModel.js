const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            unique: true,
            lowercase: true,
            trim: true,
        },
        label: {
            type: String,
            required: [true, "Display label is required"],
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

categorySchema.index({ order: 1 });

module.exports = mongoose.model("Category", categorySchema);
