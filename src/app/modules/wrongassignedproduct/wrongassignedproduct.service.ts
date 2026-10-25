/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { ClientSession, Types } from "mongoose";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import AppError from "../../errorHelpers/appError";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { Order } from "../order/order.model";
import { Product } from "../product/product.model";


import { IWrongAssignedProduct, WrongProductStatus } from "./wrongassignedproduct.interface";
import { WrongAssignedProduct } from "./wrongassignedproduct.model";
import { wrongAssignedProductPopulateFields, wrongAssignedProductSearchableFields } from "./wrongassignedproduct.constants";

const createWrongAssignedProduct = async (
  payload: Partial<IWrongAssignedProduct>,
  user: JwtPayload,
) => {
  const { order: orderId, wrongProduct, intendedProduct } = payload;

  if (!orderId || !wrongProduct || !intendedProduct) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Order, wrong product and intended product are required",
    );
  }

  if (wrongProduct.toString() === intendedProduct.toString()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Wrong product and intended product cannot be the same",
    );
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  const intendedInOrder = order.products.find(
    (p: any) =>
      (p.product?._id || p.product)?.toString() === intendedProduct.toString(),
  );

  if (!intendedInOrder) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Intended product not found in this order",
    );
  }

  const wrongProductExists = await Product.findById(wrongProduct).select("_id");

  if (!wrongProductExists) {
    throw new AppError(httpStatus.NOT_FOUND, "Wrong product not found");
  }

  const quantity = Number(payload.quantity || 1);

  if (quantity > intendedInOrder.quantity) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Quantity exceeds ordered quantity of the intended product",
    );
  }

  const existing = await WrongAssignedProduct.findOne({
    order: orderId,
    intendedProduct,
    wrongProduct,
    status: WrongProductStatus.OUTSIDE,
    isDeleted: false,
  });

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This wrong product is already reported for this order",
    );
  }

  const created = await WrongAssignedProduct.create({
    order: orderId,
    orderNumber: (order as any).customOrderId || String(order._id),
    wrongProduct,
    intendedProduct,
    quantity,
    status: WrongProductStatus.OUTSIDE,
    reportedBy: user.userId,
    notes: payload.notes,
  });

  return await WrongAssignedProduct.findById(created._id).populate(
    wrongAssignedProductPopulateFields,
  );
};

const getAllWrongAssignedProducts = async (query: Record<string, string>) => {
  const queryBuilder = new QueryBuilder(
    WrongAssignedProduct.find({ isDeleted: false }).populate(
      wrongAssignedProductPopulateFields,
    ),
    query,
  );

  const productsData = queryBuilder
    .filter()
    .search(wrongAssignedProductSearchableFields)
    .sort()
    .fields()
    .paginate();

  const statsAgg = await WrongAssignedProduct.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const stats = {
    total: 0,
    OUTSIDE: 0,
    IN_WAREHOUSE: 0,
  };

  statsAgg.forEach((item) => {
    if (item._id in stats) {
      stats[item._id as keyof typeof stats] = item.count;
    }
    stats.total += item.count;
  });

  const [data, meta] = await Promise.all([
    productsData.build(),
    queryBuilder.getMeta(),
  ]);

  return { data, meta, stats };
};

const getSingleWrongAssignedProduct = async (id: string) => {
  const result = await WrongAssignedProduct.findOne({
    _id: id,
    isDeleted: false,
  }).populate(wrongAssignedProductPopulateFields);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Wrong assigned product not found");
  }

  return result;
};

// Manual update (e.g. the product reached the warehouse but no return was created)
const updateWrongAssignedProduct = async (
  id: string,
  payload: { status?: WrongProductStatus; notes?: string },
  user: JwtPayload,
) => {
  const result = await WrongAssignedProduct.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Wrong assigned product not found");
  }

  if (payload.notes !== undefined) {
    result.notes = payload.notes;
  }

  if (payload.status && payload.status !== result.status) {
    result.status = payload.status;

    if (payload.status === WrongProductStatus.IN_WAREHOUSE) {
      result.receivedAt = new Date();
      result.receivedBy = new Types.ObjectId(user.userId);
    } else {
      result.receivedAt = undefined;
      result.receivedBy = undefined;
      result.returnParcel = undefined;
    }
  }

  await result.save();

  return await WrongAssignedProduct.findById(id).populate(
    wrongAssignedProductPopulateFields,
  );
};

const deleteWrongAssignedProduct = async (id: string) => {
  const result = await WrongAssignedProduct.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Wrong assigned product not found");
  }

  result.isDeleted = true;
  await result.save();

  return null;
};

/**
 * Called when a return is created (return.service.ts -> createReturn).
 * Matches the returned products against the order's OUTSIDE records
 * (by intendedProduct) and marks them as IN_WAREHOUSE.
 */
const markAsReceivedByReturn = async (
  orderId: Types.ObjectId | string,
  returnId: Types.ObjectId | string,
  returnedProductIds: (Types.ObjectId | string)[],
  receivedBy: string,
  session?: ClientSession,
) => {
  if (!returnedProductIds.length) return;

  await WrongAssignedProduct.updateMany(
    {
      order: orderId,
      intendedProduct: {
        $in: returnedProductIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
      status: WrongProductStatus.OUTSIDE,
      isDeleted: false,
    },
    {
      $set: {
        status: WrongProductStatus.IN_WAREHOUSE,
        returnParcel: returnId,
        receivedAt: new Date(),
        receivedBy,
      },
    },
    { session },
  );
};

/**
 * Called when a return is deleted (return.service.ts -> deleteReturn).
 * Reverts the records matched with that return back to OUTSIDE.
 */
const revertByReturn = async (
  returnId: Types.ObjectId | string,
  session?: ClientSession,
) => {
  await WrongAssignedProduct.updateMany(
    {
      returnParcel: returnId,
      status: WrongProductStatus.IN_WAREHOUSE,
      isDeleted: false,
    },
    {
      $set: { status: WrongProductStatus.OUTSIDE },
      $unset: { returnParcel: "", receivedAt: "", receivedBy: "" },
    },
    { session },
  );
};

export const WrongAssignedProductServices = {
  createWrongAssignedProduct,
  getAllWrongAssignedProducts,
  getSingleWrongAssignedProduct,
  updateWrongAssignedProduct,
  deleteWrongAssignedProduct,
  markAsReceivedByReturn,
  revertByReturn,
};