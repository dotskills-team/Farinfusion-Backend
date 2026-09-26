/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { Courier } from "./courier.model";
import {
  CourierDeliveryStatus,
  CourierName,
  CourierStatus,
} from "./courier.interface";
import { Order } from "../order/order.model";
import { DeliveryStatus, OrderStatus } from "../order/order.interface";
import { Product } from "../product/product.model";

const BASE_URL = "https://portal.packzy.com/api/v1";

const headers = {
  "Api-Key": process.env.STEADFAST_API_KEY,
  "Secret-Key": process.env.STEADFAST_SECRET_KEY,
  "Content-Type": "application/json",
};

const MAX_DESC_LENGTH = 500;

const mapOrderToSteadfast = (order: any) => {
  const products = order.products || [];

  let parts = products.map((p: any) => {
    const name = p.product?.title || "Item";
    return { name, qty: p.quantity };
  });

  const buildDescription = (items: any[]) =>
    items.map((p) => `${p.name} x${p.qty}`).join(", ");

  let description = buildDescription(parts);

  if (description.length <= MAX_DESC_LENGTH) {
    return {
      invoice: order.customOrderId,
      recipient_name: order.billingDetails?.fullName,
      recipient_phone: order.billingDetails?.phone,
      recipient_address: order.billingDetails?.address,
      cod_amount: order.total,
      note: order?.note || "Auto generated order",
      item_description: description,
      delivery_type: 0,
    };
  }

  let totalNamesLength = parts.reduce(
    (sum: number, p: any) => sum + p.name.length,
    0,
  );

  const reservedLength = parts.length * 6;
  const availableForNames = MAX_DESC_LENGTH - reservedLength;

  const shrinkRatio = availableForNames / totalNamesLength;

  const minLength = 5;

  parts = parts.map((p: any) => {
    let newLen = Math.floor(p.name.length * shrinkRatio);

    if (newLen < minLength) newLen = minLength;

    if (newLen < p.name.length) {
      return {
        ...p,
        name: p.name.slice(0, newLen - 3) + "...",
      };
    }

    return p;
  });

  description = buildDescription(parts);

  if (description.length > MAX_DESC_LENGTH) {
    description = description.slice(0, MAX_DESC_LENGTH - 3) + "...";
  }

  return {
    invoice: order.customOrderId,
    recipient_name: order.billingDetails?.fullName,
    recipient_phone: order.billingDetails?.phone,
    recipient_address: order.billingDetails?.address,
    cod_amount: order.total,
    note: order?.note || "Auto generated order",
    item_description: description,
    delivery_type: 0,
  };
};

const trackCourier = async (trackingCode: string) => {
  const courier = await Courier.findOne({ trackingCode });

  if (!courier) {
    throw new AppError(httpStatus.NOT_FOUND, "Courier not found");
  }

  const res = await axios.get(
    `${BASE_URL}/status_by_trackingcode/${trackingCode}`,
    { headers },
  );

  // console.log("TRACK RESPONSE:", res.data);

  const apiStatus = res.data?.delivery_status || res.data?.status;

  if (!apiStatus) {
    throw new AppError(400, "Invalid tracking response");
  }

  let mappedStatus = CourierDeliveryStatus.IN_TRANSIT;

  switch (apiStatus?.toLowerCase()) {
    case "pending":
      mappedStatus = CourierDeliveryStatus.PENDING;
      break;

    case "picked_up":
      mappedStatus = CourierDeliveryStatus.PICKED_UP;
      break;

    case "in_review":
      mappedStatus = CourierDeliveryStatus.IN_REVIEW;
      break;

    case "partial_delivered":
      mappedStatus = CourierDeliveryStatus.PARTIAL;
      break;

    case "delivered":
      mappedStatus = CourierDeliveryStatus.DELIVERED;
      break;

    case "cancelled":
      mappedStatus = CourierDeliveryStatus.CANCELLED;
      break;

    case "hold":
      mappedStatus = CourierDeliveryStatus.HOLD;
      break;

    default:
      mappedStatus = CourierDeliveryStatus.IN_TRANSIT;
  }

  if (courier?.deliveryStatus !== mappedStatus) {
    courier.deliveryStatus = mappedStatus;
    courier.rawResponse = res.data;
    await courier.save();

    const orderUpdate: any = {
      deliveryStatus: mappedStatus,
    };

    switch (mappedStatus) {
      case CourierDeliveryStatus.DELIVERED:
        orderUpdate.orderStatus = OrderStatus.COMPLETED;
        break;

      case CourierDeliveryStatus.CANCELLED:
        orderUpdate.orderStatus = OrderStatus.CANCELLED;
        break;

      case CourierDeliveryStatus.PARTIAL:
        orderUpdate.orderStatus = OrderStatus.PARTIAL;
        break;

      default:
        orderUpdate.orderStatus = OrderStatus.CONFIRMED;
    }

    await Order.findByIdAndUpdate(courier.order, orderUpdate);

    if (mappedStatus === CourierDeliveryStatus.CANCELLED) {
      const order = await Order.findById(courier.order).populate(
        "products.product",
      );

      if (order) {
        // if (!(order as any).isRestocked) {
        //   for (const item of order.products) {
        //     await Product.findByIdAndUpdate(item.product, {
        //       $inc: {
        //         availableStock: item.quantity,
        //         totalSold: -item.quantity,
        //       },
        //     });
        //   }

        //   (order as any).isRestocked = true;
        // }

        order.deliveryStatus = DeliveryStatus.CANCELLED;
        order.orderStatus = OrderStatus.CANCELLED;

        await order.save();
      }
    }
  }

  return courier;
};

const createCourier = async (orderId: string) => {
  const order = await Order.findById({ _id: orderId }).populate(
    "products.product",
  );

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }
  const existing = await Courier.findOne({ order: orderId });

  if (existing) {
    existing.status = CourierStatus.CANCELLED; // mark old one
    await existing.save();
  }

  const payload = mapOrderToSteadfast(order);

  try {
    const res = await axios.post(`${BASE_URL}/create_order`, payload, {
      headers,
    });

    const consignment = res.data?.consignment;

    const courier = await Courier.create({
      order: order._id,
      courierName: CourierName.STEADFAST,
      consignmentId: consignment?.consignment_id,
      trackingCode: consignment?.tracking_code,
      status: CourierStatus.CREATED,
      rawResponse: res.data,
    });

    order.courierName = "STEADFAST";
    order.trackingNumber = consignment?.tracking_code;
    order.deliveryStatus = DeliveryStatus.IN_TRANSIT;

    await order.save();

    return courier;
  } catch (error: any) {
    await Courier.create({
      order: order._id,
      courierName: CourierName.STEADFAST,
      status: CourierStatus.FAILED,
      rawResponse: error?.response?.data,
    });

    throw new AppError(
      httpStatus.BAD_REQUEST,
      error?.response?.data?.message || "Courier creation failed",
    );
  }
};

export const syncCourierOrderStatus = async (
  courier: any,
  mappedStatus: CourierDeliveryStatus,
  collectedAmount?: number,
) => {
  const orderUpdate: any = {
    deliveryStatus: mappedStatus,
  };

  switch (mappedStatus) {
    case CourierDeliveryStatus.DELIVERED:
      orderUpdate.orderStatus = OrderStatus.COMPLETED;
      orderUpdate.deliveredAt = new Date();
      break;

    case CourierDeliveryStatus.PARTIAL:
      orderUpdate.orderStatus = OrderStatus.PARTIAL;
      orderUpdate.partialDeliveredAt = new Date();
      break;

    case CourierDeliveryStatus.CANCELLED:
      orderUpdate.orderStatus = OrderStatus.CANCELLED;
      orderUpdate.cancelledAt = new Date();
      break;

    case CourierDeliveryStatus.HOLD:
      orderUpdate.holdAt = new Date();

      break;

    case CourierDeliveryStatus.PICKED_UP:
      orderUpdate.pickedUpAt = new Date();

      break;

    default:
      orderUpdate.orderStatus = OrderStatus.CONFIRMED;
      orderUpdate.confirmedAt = new Date();
  }

  await Order.findByIdAndUpdate(courier.order, {
    ...orderUpdate,
    ...((collectedAmount ?? 0) > 0 && {
      total: collectedAmount,
    }),
  });

 
};


 // if (mappedStatus === CourierDeliveryStatus.CANCELLED) {
  //   const order = await Order.findById(courier.order);

  //   if (order && !(order as any).isRestocked) {
  //     for (const item of order.products) {
  //       await Product.findByIdAndUpdate(item.product, {
  //         $inc: {
  //           availableStock: item.quantity,
  //           totalSold: -item.quantity,
  //         },
  //       });
  //     }

  //     (order as any).isRestocked = true;
  //     await order.save();
  //   }
  // }

export const CourierServices = {
  createCourier,
  trackCourier,
};
