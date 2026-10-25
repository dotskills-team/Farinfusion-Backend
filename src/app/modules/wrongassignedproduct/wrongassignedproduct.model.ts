import { Schema, model } from "mongoose";
import { IWrongAssignedProduct, WrongProductStatus } from "./wrongassignedproduct.interface";


const wrongAssignedProductSchema = new Schema<IWrongAssignedProduct>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    orderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    wrongProduct: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    intendedProduct: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    status: {
      type: String,
      enum: Object.values(WrongProductStatus),
      default: WrongProductStatus.OUTSIDE,
      index: true,
    },

    returnParcel: {
      type: Schema.Types.ObjectId,
      ref: "ReturnParcel",
    },

    receivedAt: {
      type: Date,
    },

    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Prevent more than one open (OUTSIDE) record for the same order + product pair
wrongAssignedProductSchema.index(
  { order: 1, intendedProduct: 1, wrongProduct: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: WrongProductStatus.OUTSIDE,
      isDeleted: false,
    },
  },
);

export const WrongAssignedProduct = model<IWrongAssignedProduct>(
  "WrongAssignedProduct",
  wrongAssignedProductSchema,
);