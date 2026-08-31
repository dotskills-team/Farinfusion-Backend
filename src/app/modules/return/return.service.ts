/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import AppError from "../../errorHelpers/appError";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { Order } from "../order/order.model";
import { Product } from "../product/product.model";
import { ReturnParcel } from "./return.model";
import {
  IReturnParcel,
  RefundStatus,
  ReturnStatus,
  ReturnType,
} from "./return.interface";
import {
  returnPopulateFields,
  returnSearchableFields,
} from "./return.constant";
import { OrderStatus } from "../order/order.interface";

const createReturn = async (
  payload: Partial<IReturnParcel>,
  user: JwtPayload,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (!payload.returnedProducts?.length) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "At least one returned product is required",
      );
    }

    const order = await Order.findById(payload.order)
      .populate("products.product")
      .session(session);

    if (!order) {
      throw new AppError(httpStatus.NOT_FOUND, "Order not found");
    }

    if (
      ![
        OrderStatus.CONFIRMED,
        OrderStatus.PARTIAL,
        OrderStatus.CANCELLED,
      ].includes(order.orderStatus as OrderStatus)
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Only finalized orders can be returned",
      );
    }

    for (const item of payload.returnedProducts) {
      const orderedProduct = order.products.find(
        (p: any) => p.product?._id?.toString() === item.product.toString(),
      );

      if (!orderedProduct) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Product not found in this order",
        );
      }

      if (item.quantity > orderedProduct.quantity) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Return quantity exceeds ordered quantity`,
        );
      }

      const previousReturns = await ReturnParcel.find({
        order: order._id,
        "returnedProducts.product": item.product,
        isDeleted: false,
      }).session(session);

      const alreadyReturned = previousReturns.reduce(
        (sum, r: any) =>
          sum +
          (r.returnedProducts
            ?.filter(
              (rp: any) => rp.product.toString() === item.product.toString(),
            )
            .reduce((acc: number, rp: any) => acc + rp.quantity, 0) || 0),
        0,
      );

      if (alreadyReturned + item.quantity > orderedProduct.quantity) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Return quantity exceeds remaining returnable quantity",
        );
      }

      if (!item.product) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Invalid product id received",
        );
      }

      // console.log("RETURN PRODUCT ID:", item.product);

      const product = await Product.findById(item.product).session(session);

      if (!product) {
        throw new AppError(httpStatus.NOT_FOUND, "Product not found");
      }

      const soldDeduction = Math.min(
        Number(product.totalSold || 0),
        Number(item.quantity || 0),
      );

      if (item.shouldRestock && !item.isDamaged) {
        await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: {
              availableStock: Number(item.quantity),
              totalReturned: Number(item.quantity),
              restockCount: 1,
              totalSold: soldDeduction,
            },
          },
          {
            session,
            new: true,
          },
        );
      } else {
        await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: {
              totalReturned: Number(item.quantity),
            },
          },
          {
            session,
            new: true,
          },
        );
      }

      item.orderedQuantity = orderedProduct.quantity;
      item.buyingPrice = product.buyingPrice || 0;
      item.sellingPrice = product.price || 0;
      item.restockCount = 1;
    }

    payload.customer = order.customer || undefined;
    payload.customerInfo = {
      name: order.billingDetails?.fullName || "Unknown Customer",
      phone: order.billingDetails?.phone || "",
      email: order.billingDetails?.email || "",
      address: order.billingDetails?.address || "",
    };

    payload.seller = order.seller || undefined;
    payload.courier = undefined;
    payload.processedBy = user.userId;
    payload.returnStatus = ReturnStatus.PENDING;

    if (!payload.refundStatus) {
      payload.refundStatus =
        (payload.refundAmount || 0) > 0
          ? RefundStatus.PENDING
          : RefundStatus.NOT_REQUIRED;
    }

    if (!payload.returnType) {
      const totalOrderedQty = order.products.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0,
      );

      const totalReturnedQty = payload.returnedProducts.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      payload.returnType =
        totalReturnedQty >= totalOrderedQty
          ? ReturnType.FULL
          : ReturnType.PARTIAL;
    }

    const created = await ReturnParcel.create([payload], { session });

    order.returnCount = (order.returnCount || 0) + 1;

    order.totalReturnedQuantity =
      (order.totalReturnedQuantity || 0) +
      payload.returnedProducts.reduce((sum, item) => sum + item.quantity, 0);

    await order.save({ session });

    await session.commitTransaction();

    return await ReturnParcel.findById(created[0]._id).populate(
      returnPopulateFields,
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// const getAllReturns = async (query: Record<string, string>) => {
//   const queryBuilder = new QueryBuilder(
//     ReturnParcel.find({ isDeleted: false }).populate(returnPopulateFields),
//     query,
//   );

//   const returnsData = queryBuilder
//     .filter()
//     .search(returnSearchableFields)
//     .sort()
//     .fields()
//     .paginate();

//   const [data, meta] = await Promise.all([
//     returnsData.build(),
//     queryBuilder.getMeta(),
//   ]);

//   return {
//     data,
//     meta,
//   };
// };

const getAllReturns = async (query: Record<string, string>) => {
  const queryObj: any = {};

  const dateFieldMap: Record<string, string> = {
    created: "createdAt",
    updated: "updatedAt",
    pickup: "pickupDate",
  };

  const dateType = query.dateType || "created";
  const dateField = dateFieldMap[dateType] || "createdAt";

  if (query["updatedAt[gte]"] || query["updatedAt[lte]"]) {
    queryObj[dateField] = {};

    if (query["updatedAt[gte]"]) {
      queryObj[dateField].$gte = new Date(query["updatedAt[gte]"]);
    }

    if (query["updatedAt[lte]"]) {
      queryObj[dateField].$lte = new Date(query["updatedAt[lte]"]);
    }
  }

  delete query["updatedAt[gte]"];
  delete query["updatedAt[lte]"];
  delete query.dateType;

  const queryBuilder = new QueryBuilder(
    ReturnParcel.find({
      isDeleted: false,
      ...queryObj,
    }).populate(returnPopulateFields),
    query,
  );

  const returnsData = queryBuilder
    .filter()
    .search(returnSearchableFields)
    .sort()
    .fields()
    .paginate();

  const [data, meta] = await Promise.all([
    returnsData.build(),
    queryBuilder.getMeta(),
  ]);

  return { data, meta };
};

const getSingleReturn = async (id: string) => {
  const result = await ReturnParcel.findById(id).populate(returnPopulateFields);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Return parcel not found");
  }

  return result;
};

const updateReturnStatus = async (
  id: string,
  payload: {
    returnStatus?: ReturnStatus;
    refundStatus?: RefundStatus;
  },
) => {
  const result = await ReturnParcel.findById(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Return parcel not found");
  }

  if (payload.returnStatus) {
    result.returnStatus = payload.returnStatus;
  }

  if (payload.refundStatus) {
    result.refundStatus = payload.refundStatus;
  }

  await result.save();

  return await ReturnParcel.findById(id).populate(returnPopulateFields);
};

const deleteReturn = async (id: string) => {
  const result = await ReturnParcel.findById(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Return parcel not found");
  }

  result.isDeleted = true;

  await result.save();

  return null;
};

export const ReturnServices = {
  createReturn,
  getAllReturns,
  getSingleReturn,
  updateReturnStatus,
  deleteReturn,
};
