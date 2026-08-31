import { Schema, model } from "mongoose";
import {
  IReturnParcel,
  RefundStatus,
  ReturnReason,
  ReturnStatus,
  ReturnType,
} from "./return.interface";

const returnedProductSchema = new Schema(
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

    orderedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },

    buyingPrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    sellingPrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    reason: {
      type: String,
      enum: Object.values(ReturnReason),
      required: true,
    },

    shouldRestock: {
      type: Boolean,
      default: true,
    },

    isDamaged: {
      type: Boolean,
      default: false,
    },

    restockCount: {
      type: Number,
      default: 1,
      min: 1,
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const returnParcelSchema = new Schema<IReturnParcel>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    customerInfo: {
      name: String,
      phone: String,
      email: String,
      address: String,
    },

    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    courier: {
      type: Schema.Types.ObjectId,
      ref: "Courier",
    },

    returnedProducts: {
      type: [returnedProductSchema],
      required: true,
      validate: {
        validator: (val: unknown[]) => val.length > 0,
        message: "At least one returned product is required",
      },
    },

    returnType: {
      type: String,
      enum: Object.values(ReturnType),
      required: true,
    },

    returnStatus: {
      type: String,
      enum: Object.values(ReturnStatus),
      default: ReturnStatus.PENDING,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundStatus: {
      type: String,
      enum: Object.values(RefundStatus),
      default: RefundStatus.NOT_REQUIRED,
    },

    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pickupDate: {
      type: Date,
    },

    notes: {
      type: String,
      trim: true,
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

export const ReturnParcel = model<IReturnParcel>(
  "ReturnParcel",
  returnParcelSchema,
);
