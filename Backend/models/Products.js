import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        price: {
            type: Number,
            required: true,
            min: 0,
        },

        image: {
            url: {
                type: String,
                required: true,
            },
            public_id: {
                type: String,
                required: true,
            },
        },

        description: {
            type: String,
            required: true,
            trim: true,
        },
        category: { type: String, trim: true, default: "Uncategorized", required: true },
        stock: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
        lowStockThreshold: { type: Number, default: 5, min: 0, validate: Number.isSafeInteger },
    },
    {
        timestamps: true,
    }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
