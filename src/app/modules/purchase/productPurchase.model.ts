import { Schema, model } from "mongoose";
import {
  IProductPurchase,
  PaymentStatus,
  PaymentType,
  PurchaseStatus,
} from "./productPurchase.interface";

const purchaseProductSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    buyingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const productPurchaseSchema = new Schema<IProductPurchase>(
  {
    products: {
      type: [purchaseProductSchema],
      required: true,
    },

    supplierName: {
      type: String,
      required: true,
      trim: true,
    },

    supplierPhone: {
      type: String,
      trim: true,
    },

    supplierAddress: {
      type: String,
      trim: true,
    },

    grandTotal: {
      type: Number,
      required: false,
      min: 0,
    },

    paymentType: {
      type: String,
      enum: Object.values(PaymentType),
      default: PaymentType.DUE,
    },

    paymentMethod: {
      type: String,
      trim: true,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
    },

    purchaseStatus: {
      type: String,
      enum: Object.values(PurchaseStatus),
      default: PurchaseStatus.PENDING,
    },

    invoiceNo: String,

    reference: String,

    notes: String,

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const ProductPurchase = model<IProductPurchase>(
  "ProductPurchase",
  productPurchaseSchema,
);
