// /* eslint-disable @typescript-eslint/no-explicit-any */
// import axios from "axios";
// import httpStatus from "http-status-codes";
// import AppError from "../../../errorHelpers/appError";
// import { Courier } from "../courier.model";
// import {
//   CourierDeliveryStatus,
//   CourierName,
//   CourierStatus,
// } from "../courier.interface";
// import { Order } from "../../order/order.model";
// import { DeliveryStatus, OrderStatus } from "../../order/order.interface";
// import { Product } from "../../product/product.model";

// const BASE_URL = process.env.PATHAO_BASE_URL;

// let cachedToken: string | null = null;
// let tokenExpireTime: number | null = null;

// const getPathaoToken = async () => {
//   if (cachedToken && tokenExpireTime && Date.now() < tokenExpireTime) {
//     return cachedToken;
//   }

//   try {
//     const res = await axios.post(`${BASE_URL}/aladdin/api/v1/issue-token`, {
//       client_id: process.env.PATHAO_CLIENT_ID,
//       client_secret: process.env.PATHAO_CLIENT_SECRET,
//       grant_type: "password",
//       username: process.env.PATHAO_USERNAME,
//       password: process.env.PATHAO_PASSWORD,
//     });

//     cachedToken = res.data?.access_token;

//     tokenExpireTime = Date.now() + (res.data?.expires_in || 3600) * 1000;

//     return cachedToken;
//   } catch (error: any) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       error?.response?.data?.message || "Failed to authenticate Pathao",
//     );
//   }
// };

// const getHeaders = async () => {
//   const token = await getPathaoToken();

//   return {
//     Authorization: `Bearer ${token}`,
//     Accept: "application/json",
//     "Content-Type": "application/json",
//   };
// };

// const getAreas = async (zoneId: number) => {
//   const headers = await getHeaders();

//   const res = await axios.get(
//     `${BASE_URL}/aladdin/api/v1/zones/${zoneId}/area-list`,
//     { headers },
//   );

//   return res.data;
// };

// const getZones = async (cityId: number) => {
//   const headers = await getHeaders();

//   const res = await axios.get(
//     `${BASE_URL}/aladdin/api/v1/cities/${cityId}/zone-list`,
//     { headers },
//   );

//   return res.data;
// };

// const getCities = async () => {
//   const headers = await getHeaders();

//   const res = await axios.get(`${BASE_URL}/aladdin/api/v1/city-list`, {
//     headers,
//   });

//   return res.data;
// };

// const mapOrderToPathao = (order: any, store: any) => {
//   const recipientPhone = order.billingDetails?.phone
//     ?.replace(/^(\+88|88)/, "")
//     .trim();

//   if (!recipientPhone || recipientPhone.length !== 11) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Recipient phone must be exactly 11 digits for Pathao",
//     );
//   }

//   let recipientAddress = order.billingDetails?.address?.trim() || "";

//   if (!recipientAddress) {
//     recipientAddress = "Dhaka, Bangladesh";
//   }

//   if (recipientAddress.length < 10) {
//     recipientAddress = `${recipientAddress}, Bangladesh`;
//   }

//   const itemDescription =
//     order.products
//       ?.map((item: any) => `${item.product?.title} x${item.quantity}`)
//       .join(", ")
//       .slice(0, 240) || "Order items";

//   return {
//     store_id: store.store_id,

//     merchant_order_id: order.customOrderId,

//     recipient_name: order.billingDetails?.fullName || "Customer",

//     recipient_phone: recipientPhone,

//     recipient_address: recipientAddress,

//     recipient_city: store.city_id,
//     recipient_zone: store.zone_id,
//     recipient_area: 1,

//     delivery_type: 48,

//     item_type: 2,
//     // delivery_fee: order?.shippingCost || 0,

//     special_instruction: order.note || "Auto generated order",

//     item_quantity:
//       order.products?.reduce(
//         (sum: number, item: any) => sum + item.quantity,
//         0,
//       ) || 1,

//     item_weight: 0.5,

//     item_description: itemDescription,

//     amount_to_collect: Number(order.total),
//   };
// };

// const createCourier = async (orderId: any) => {
//   const order = await Order.findById({ _id: orderId }).populate(
//     "products.product",
//   );

//   if (!order) {
//     throw new AppError(httpStatus.NOT_FOUND, "Order not found");
//   }

//   const existing = await Courier.findOne({
//     order: order._id,
//     status: { $ne: CourierStatus.CANCELLED },
//   });

//   //   if (existing) {
//   //     throw new AppError(
//   //       httpStatus.BAD_REQUEST,
//   //       "Courier already created for this order",
//   //     );
//   //   }

//   try {
//     const headers = await getHeaders();

//     const stores = await axios.get(`${BASE_URL}/aladdin/api/v1/stores`, {
//       headers,
//     });

//     // console.log(stores.data?.data);

//     const storeList = stores.data?.data?.data || [];

//     const selectedStore =
//       storeList.find((store: any) => store.is_default_store) ||
//       storeList.find((store: any) => store.is_active === 1);

//     if (!selectedStore) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         "No active Pathao store found",
//       );
//     }

//     const payload = mapOrderToPathao(order, selectedStore);

//     const res = await axios.post(`${BASE_URL}/aladdin/api/v1/orders`, payload, {
//       headers,
//     });

//     const responseData = res.data?.data?.data || res.data?.data || {};
//     const consignmentId = responseData?.consignment_id
//       ? responseData.rawResponse?.consignment_id
//       : responseData.consignment_id;

//     const trackingNumber =
//       responseData?.rawResponse?.tracking_number ||
//       responseData?.rawResponse?.consignment_id ||
//       responseData?.consignment_id?.toString();

//     const courierPayload: any = {
//       order: order._id,
//       courierName: CourierName.PATHAO,
//       trackingCode: responseData?.consignment_id,
//       consignmentId,
//       status: CourierStatus.CREATED,
//       deliveryStatus: DeliveryStatus.COURIERASSIGNED,
//       rawResponse: responseData,
//     };

//     // console.log(responseData);

//     if (consignmentId && !isNaN(consignmentId)) {
//       courierPayload.consignmentId = consignmentId;
//     }

//     const courier = await Courier.create(courierPayload);
//     console.log(courier);

//     order.courierName = CourierName.PATHAO;
//     order.trackingNumber =
//       responseData?.rawResponse?.consignment_id ||
//       trackingNumber ||
//       consignmentId?.toString() ||
//       "";
//     order.deliveryStatus = responseData?.deliveryStatus;
//     if (!order.courierAssignedAt) {
//       order.courierAssignedAt = new Date();
//     }

//     await order.save();

//     return courier;
//   } catch (error: any) {
//     if (error instanceof AppError) {
//       throw error;
//     }

//     console.log("PATHAO ERROR:", error);

//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       error?.response?.data?.message || "Pathao courier creation failed",
//     );
//   }
// };

// const trackCourier = async (trackingCode: string) => {
//   const courier = await Courier.findOne({
//     $or: [{ trackingCode }, { consignmentId: trackingCode }],
//   });

//   if (!courier) {
//     throw new AppError(httpStatus.NOT_FOUND, "Courier not found");
//   }

//   const headers = await getHeaders();

//   const res = await axios.get(
//     `${BASE_URL}/aladdin/api/v1/orders/${trackingCode}/info`,
//     { headers },
//   );

//   const pathaoStatus = res.data?.data?.order_status?.toLowerCase();

//   let mappedStatus = CourierDeliveryStatus.IN_TRANSIT;

//   switch (pathaoStatus) {
//     case "pending":
//       mappedStatus = CourierDeliveryStatus.PENDING;
//       break;

//     case "picked_up":
//       mappedStatus = CourierDeliveryStatus.PICKED_UP;
//       break;

//     case "delivered":
//       mappedStatus = CourierDeliveryStatus.DELIVERED;
//       break;

//     case "partial_delivered":
//       mappedStatus = CourierDeliveryStatus.PARTIAL;
//       break;

//     case "cancelled":
//       mappedStatus = CourierDeliveryStatus.CANCELLED;
//       break;

//     case "on_hold":
//       mappedStatus = CourierDeliveryStatus.HOLD;
//       break;

//     default:
//       mappedStatus = CourierDeliveryStatus.IN_TRANSIT;
//   }

//   if (courier.deliveryStatus !== mappedStatus) {
//     courier.deliveryStatus = mappedStatus;
//     courier.rawResponse = res.data;

//     await courier.save();

//     const orderUpdate: any = {
//       deliveryStatus: mappedStatus,
//     };

//     switch (mappedStatus) {
//       case CourierDeliveryStatus.DELIVERED:
//         orderUpdate.orderStatus = OrderStatus.COMPLETED;
//         break;

//       case CourierDeliveryStatus.CANCELLED:
//         orderUpdate.orderStatus = OrderStatus.CANCELLED;
//         break;

//       case CourierDeliveryStatus.PARTIAL:
//         orderUpdate.orderStatus = OrderStatus.PARTIAL;
//         break;

//       default:
//         orderUpdate.orderStatus = OrderStatus.CONFIRMED;
//     }

//     await Order.findByIdAndUpdate(courier.order, orderUpdate);

//     if (mappedStatus === CourierDeliveryStatus.CANCELLED) {
//       const order = await Order.findById(courier.order).populate(
//         "products.product",
//       );

//       if (order && !(order as any).isRestocked) {
//         for (const item of order.products) {
//           await Product.findByIdAndUpdate(item.product, {
//             $inc: {
//               availableStock: item.quantity,
//               totalSold: -item.quantity,
//             },
//           });
//         }

//         (order as any).isRestocked = true;

//         await order.save();
//       }
//     }
//   }

//   return courier;
// };

// export const PathaoProvider = {
//   createCourier,
//   trackCourier,
//   getCities,
// };


// v2


// /* eslint-disable @typescript-eslint/no-explicit-any */
// import axios from "axios";
// import httpStatus from "http-status-codes";
// import AppError from "../../../errorHelpers/appError";
// import { Courier } from "../courier.model";
// import {
//   CourierDeliveryStatus,
//   CourierName,
//   CourierStatus,
// } from "../courier.interface";
// import { Order } from "../../order/order.model";
// import { DeliveryStatus, OrderStatus } from "../../order/order.interface";
// import { Product } from "../../product/product.model";
// import { syncCourierOrderStatus } from "../courier.service";

// const BASE_URL = process.env.PATHAO_BASE_URL;

// let cachedToken: string | null = null;
// let tokenExpireTime: number | null = null;

// const getPathaoToken = async () => {
//   if (cachedToken && tokenExpireTime && Date.now() < tokenExpireTime) {
//     return cachedToken;
//   }

//   try {
//     const res = await axios.post(`${BASE_URL}/aladdin/api/v1/issue-token`, {
//       client_id: process.env.PATHAO_CLIENT_ID,
//       client_secret: process.env.PATHAO_CLIENT_SECRET,
//       grant_type: "password",
//       username: process.env.PATHAO_USERNAME,
//       password: process.env.PATHAO_PASSWORD,
//     });

//     cachedToken = res.data?.access_token;

//     tokenExpireTime = Date.now() + (res.data?.expires_in || 3600) * 1000;

//     return cachedToken;
//   } catch (error: any) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       error?.response?.data?.message || "Failed to authenticate Pathao",
//     );
//   }
// };

// const getHeaders = async () => {
//   const token = await getPathaoToken();

//   return {
//     Authorization: `Bearer ${token}`,
//     Accept: "application/json",
//     "Content-Type": "application/json",
//   };
// };

// const getAreas = async (zoneId: number) => {
//   const headers = await getHeaders();

//   const res = await axios.get(
//     `${BASE_URL}/aladdin/api/v1/zones/${zoneId}/area-list`,
//     { headers },
//   );

//   return res.data;
// };

// const getZones = async (cityId: number) => {
//   const headers = await getHeaders();

//   const res = await axios.get(
//     `${BASE_URL}/aladdin/api/v1/cities/${cityId}/zone-list`,
//     { headers },
//   );

//   return res.data;
// };

// const getCities = async () => {
//   const headers = await getHeaders();

//   const res = await axios.get(`${BASE_URL}/aladdin/api/v1/city-list`, {
//     headers,
//   });

//   return res.data;
// };

// const mapOrderToPathao = (order: any, store: any) => {
//   const recipientPhone = order.billingDetails?.phone
//     ?.replace(/^(\+88|88)/, "")
//     .trim();

//   if (!recipientPhone || recipientPhone.length !== 11) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Recipient phone must be exactly 11 digits for Pathao",
//     );
//   }

//   let recipientAddress = order.billingDetails?.address?.trim() || "";

//   if (!recipientAddress) {
//     recipientAddress = "Dhaka, Bangladesh";
//   }

//   if (recipientAddress.length < 10) {
//     recipientAddress = `${recipientAddress}, Bangladesh`;
//   }

//   const itemDescription =
//     order.products
//       ?.map((item: any) => `${item.product?.title} x${item.quantity}`)
//       .join(", ")
//       .slice(0, 240) || "Order items";

//   return {
//     store_id: store.store_id,

//     merchant_order_id: order.customOrderId,

//     recipient_name: order.billingDetails?.fullName || "Customer",

//     recipient_phone: recipientPhone,

//     recipient_address: recipientAddress,

//     recipient_city: store.city_id,
//     recipient_zone: store.zone_id,
//     recipient_area: 1,

//     delivery_type: 48,

//     item_type: 2,
//     // delivery_fee: order?.shippingCost || 0,

//     special_instruction: order.note || "Auto generated order",

//     item_quantity:
//       order.products?.reduce(
//         (sum: number, item: any) => sum + item.quantity,
//         0,
//       ) || 1,

//     item_weight: 0.5,

//     item_description: itemDescription,

//     amount_to_collect: Number(order.total),
//   };
// };

// const createCourier = async (orderId: any) => {
//   const order = await Order.findById({ _id: orderId }).populate(
//     "products.product",
//   );

//   if (!order) {
//     throw new AppError(httpStatus.NOT_FOUND, "Order not found");
//   }

//   const existing = await Courier.findOne({
//     order: order._id,
//     status: { $ne: CourierStatus.CANCELLED },
//   });

//   //   if (existing) {
//   //     throw new AppError(
//   //       httpStatus.BAD_REQUEST,
//   //       "Courier already created for this order",
//   //     );
//   //   }

//   try {
//     const headers = await getHeaders();

//     const stores = await axios.get(`${BASE_URL}/aladdin/api/v1/stores`, {
//       headers,
//     });

//     // console.log(stores.data?.data);

//     const storeList = stores.data?.data?.data || [];

//     const selectedStore =
//       storeList.find((store: any) => store.is_default_store) ||
//       storeList.find((store: any) => store.is_active === 1);

//     if (!selectedStore) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         "No active Pathao store found",
//       );
//     }

//     const payload = mapOrderToPathao(order, selectedStore);

//     const res = await axios.post(`${BASE_URL}/aladdin/api/v1/orders`, payload, {
//       headers,
//     });

//     const responseData = res.data?.data?.data || res.data?.data || {};
//     const consignmentId = responseData?.consignment_id
//       ? responseData.rawResponse?.consignment_id
//       : responseData.consignment_id;

//     const trackingNumber =
//       responseData?.rawResponse?.tracking_number ||
//       responseData?.rawResponse?.consignment_id ||
//       responseData?.consignment_id?.toString();

//     // const courierPayload: any = {
//     //   order: order._id,
//     //   courierName: CourierName.PATHAO,
//     //   trackingCode: responseData?.consignment_id,
//     //   consignmentId,
//     //   status: CourierStatus.CREATED,
//     //   deliveryStatus: DeliveryStatus.COURIERASSIGNED,
//     //   rawResponse: responseData,
//     // };

//     // // console.log(responseData);

//     // if (consignmentId && !isNaN(consignmentId)) {
//     //   courierPayload.consignmentId = consignmentId;
//     // }

//     // const courier = await Courier.create(courierPayload);
//     // console.log(courier);

//     // order.courierName = CourierName.PATHAO;
//     // order.trackingNumber =
//     //   responseData?.rawResponse?.consignment_id ||
//     //   trackingNumber ||
//     //   consignmentId?.toString() ||
//     //   "";
//     // order.deliveryStatus = responseData?.deliveryStatus;
//     // if (!order.courierAssignedAt) {
//     //   order.courierAssignedAt = new Date();
//     // }

//     // await order.save();



//     const courierPayload: any = {
//       order: order._id,
//       courierName: CourierName.PATHAO,
//       trackingCode: responseData?.consignment_id?.toString(),
//       consignmentId,
//       status: CourierStatus.CREATED,
//       deliveryStatus: CourierDeliveryStatus.PENDING,
//       rawResponse: responseData,
//     };

//     if (consignmentId && !isNaN(consignmentId)) {
//       courierPayload.consignmentId = consignmentId;
//     }

//     const courier = await Courier.create(courierPayload);

//     order.courierName = CourierName.PATHAO;
//     order.trackingNumber =
//       responseData?.rawResponse?.tracking_number ||
//       trackingNumber ||
//       consignmentId?.toString() ||
//       "";

//     order.deliveryStatus = DeliveryStatus.COURIERASSIGNED;

//     if (!order.courierAssignedAt) {
//       order.courierAssignedAt = new Date();
//     }

//     await order.save();

//     return courier;
//   } catch (error: any) {
//     if (error instanceof AppError) {
//       throw error;
//     }

//     console.log("PATHAO ERROR:", error);

//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       error?.response?.data?.message || "Pathao courier creation failed",
//     );
//   }
// };

// const trackCourier = async (trackingCode: string) => {
//   const courier = await Courier.findOne({
//     $or: [{ trackingCode }, { consignmentId: trackingCode }],
//   });

//   if (!courier) {
//     throw new AppError(httpStatus.NOT_FOUND, "Courier not found");
//   }

//   const headers = await getHeaders();

//   const res = await axios.get(
//     `${BASE_URL}/aladdin/api/v1/orders/${trackingCode}/info`,
//     { headers },
//   );

//   const pathaoStatus = res.data?.data?.order_status?.toLowerCase();

//   let mappedStatus: CourierDeliveryStatus;

//   switch (pathaoStatus) {
//     case "pending":
//       mappedStatus = CourierDeliveryStatus.PENDING;
//       break;

//     case "picked_up":
//       mappedStatus = CourierDeliveryStatus.PICKED_UP;
//       break;

//     case "delivered":
//       mappedStatus = CourierDeliveryStatus.DELIVERED;
//       break;

//     case "partial_delivered":
//       mappedStatus = CourierDeliveryStatus.PARTIAL;
//       break;

//     case "cancelled":
//     case "returned":
//       mappedStatus = CourierDeliveryStatus.CANCELLED;
//       break;

//     case "on_hold":
//       mappedStatus = CourierDeliveryStatus.HOLD;
//       break;

//     default:
//       mappedStatus = CourierDeliveryStatus.IN_TRANSIT;
//   }

// if (courier.deliveryStatus !== mappedStatus) {
//   courier.deliveryStatus = mappedStatus;
//   courier.rawResponse = res.data;

//   await courier.save();
// }

// await syncCourierOrderStatus(courier, mappedStatus);

// return courier;

// };

// export const PathaoProvider = {
//   createCourier,
//   trackCourier,
//   getCities,
// };


// v3
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import httpStatus from "http-status-codes";
import AppError from "../../../errorHelpers/appError";
import { Courier } from "../courier.model";
import {
  CourierDeliveryStatus,
  CourierName,
  CourierStatus,
} from "../courier.interface";
import { Order } from "../../order/order.model";
import { DeliveryStatus, OrderStatus } from "../../order/order.interface";
import { Product } from "../../product/product.model";
import { syncCourierOrderStatus } from "../courier.service";
import { getCourierConfig } from "./getCourierConfig";
import { CourierProvider } from "../../courierSettings/courierSettings.interface";

let cachedToken: string | null = null;
let tokenExpireTime: number | null = null;

const getPathaoCredentials = async () => {
  const settings = await getCourierConfig(CourierProvider.PATHAO);

  if (
    !settings.config.baseUrl ||
    !settings.config.clientId ||
    !settings.config.clientSecret ||
    !settings.config.username ||
    !settings.config.password
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Pathao credentials are incomplete",
    );
  }

  return {
    baseUrl: settings.config.baseUrl,
    clientId: settings.config.clientId,
    clientSecret: settings.config.clientSecret,
    username: settings.config.username,
    password: settings.config.password,
    pickupInfo: settings.pickupInfo,
    isSandbox: settings.isSandbox,
  };
};

const getPathaoToken = async (config: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}) => {
  if (cachedToken && tokenExpireTime && Date.now() < tokenExpireTime) {
    return cachedToken;
  }

  try {
    const res = await axios.post(`${config.baseUrl}/aladdin/api/v1/issue-token`, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "password",
      username: config.username,
      password: config.password,
    });

    cachedToken = res.data?.access_token;

    tokenExpireTime = Date.now() + (res.data?.expires_in || 3600) * 1000;

    return cachedToken;
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error?.response?.data?.message || "Failed to authenticate Pathao",
    );
  }
};

const getHeaders = async (config: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}) => {
  const token = await getPathaoToken(config);

  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
};

const getAreas = async (zoneId: number) => {
  const config = await getPathaoCredentials();
  const headers = await getHeaders(config);

  const res = await axios.get(
    `${config.baseUrl}/aladdin/api/v1/zones/${zoneId}/area-list`,
    { headers },
  );

  return res.data;
};

const getZones = async (cityId: number) => {
  const config = await getPathaoCredentials();
  const headers = await getHeaders(config);

  const res = await axios.get(
    `${config.baseUrl}/aladdin/api/v1/cities/${cityId}/zone-list`,
    { headers },
  );

  return res.data;
};

const getCities = async () => {
  const config = await getPathaoCredentials();
  const headers = await getHeaders(config);

  const res = await axios.get(`${config.baseUrl}/aladdin/api/v1/city-list`, {
    headers,
  });

  return res.data;
};

const mapOrderToPathao = (order: any, store: any) => {
  const recipientPhone = order.billingDetails?.phone
    ?.replace(/^(\+88|88)/, "")
    .trim();

  if (!recipientPhone || recipientPhone.length !== 11) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Recipient phone must be exactly 11 digits for Pathao",
    );
  }

  let recipientAddress = order.billingDetails?.address?.trim() || "";

  if (!recipientAddress) {
    recipientAddress = "Dhaka, Bangladesh";
  }

  if (recipientAddress.length < 10) {
    recipientAddress = `${recipientAddress}, Bangladesh`;
  }

  const itemDescription =
    order.products
      ?.map((item: any) => `${item.product?.title} x${item.quantity}`)
      .join(", ")
      .slice(0, 240) || "Order items";

  return {
    store_id: store.store_id,

    merchant_order_id: order.customOrderId,

    recipient_name: order.billingDetails?.fullName || "Customer",

    recipient_phone: recipientPhone,

    recipient_address: recipientAddress,

    recipient_city: store.city_id,
    recipient_zone: store.zone_id,
    recipient_area: 1,

    delivery_type: 48,

    item_type: 2,
    // delivery_fee: order?.shippingCost || 0,

    special_instruction: order.note || "Auto generated order",

    item_quantity:
      order.products?.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0,
      ) || 1,

    item_weight: 0.5,

    item_description: itemDescription,

    amount_to_collect: Number(order.total),
  };
};

const createCourier = async (orderId: any) => {
  const order = await Order.findById({ _id: orderId }).populate(
    "products.product",
  );

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  const existing = await Courier.findOne({
    order: order._id,
    status: { $ne: CourierStatus.CANCELLED },
  });

  //   if (existing) {
  //     throw new AppError(
  //       httpStatus.BAD_REQUEST,
  //       "Courier already created for this order",
  //     );
  //   }

  try {
    const config = await getPathaoCredentials();
    const headers = await getHeaders(config);

    const stores = await axios.get(`${config.baseUrl}/aladdin/api/v1/stores`, {
      headers,
    });

    // console.log(stores.data?.data);

    const storeList = stores.data?.data?.data || [];

    const selectedStore =
      storeList.find((store: any) => store.is_default_store) ||
      storeList.find((store: any) => store.is_active === 1);

    if (!selectedStore) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "No active Pathao store found",
      );
    }

    const payload = mapOrderToPathao(order, selectedStore);

    const res = await axios.post(
      `${config.baseUrl}/aladdin/api/v1/orders`,
      payload,
      {
        headers,
      },
    );

    const responseData = res.data?.data?.data || res.data?.data || {};
    const consignmentId = responseData?.consignment_id
      ? responseData.rawResponse?.consignment_id
      : responseData.consignment_id;

    const trackingNumber =
      responseData?.rawResponse?.tracking_number ||
      responseData?.rawResponse?.consignment_id ||
      responseData?.consignment_id?.toString();

    // const courierPayload: any = {
    //   order: order._id,
    //   courierName: CourierName.PATHAO,
    //   trackingCode: responseData?.consignment_id,
    //   consignmentId,
    //   status: CourierStatus.CREATED,
    //   deliveryStatus: DeliveryStatus.COURIERASSIGNED,
    //   rawResponse: responseData,
    // };

    // // console.log(responseData);

    // if (consignmentId && !isNaN(consignmentId)) {
    //   courierPayload.consignmentId = consignmentId;
    // }

    // const courier = await Courier.create(courierPayload);
    // console.log(courier);

    // order.courierName = CourierName.PATHAO;
    // order.trackingNumber =
    //   responseData?.rawResponse?.consignment_id ||
    //   trackingNumber ||
    //   consignmentId?.toString() ||
    //   "";
    // order.deliveryStatus = responseData?.deliveryStatus;
    // if (!order.courierAssignedAt) {
    //   order.courierAssignedAt = new Date();
    // }

    // await order.save();

    const courierPayload: any = {
      order: order._id,
      courierName: CourierName.PATHAO,
      trackingCode: responseData?.consignment_id?.toString(),
      consignmentId,
      status: CourierStatus.CREATED,
      deliveryStatus: CourierDeliveryStatus.PENDING,
      rawResponse: responseData,
    };

    if (consignmentId && !isNaN(consignmentId)) {
      courierPayload.consignmentId = consignmentId;
    }

    const courier = await Courier.create(courierPayload);

    order.courierName = CourierName.PATHAO;
    order.trackingNumber =
      responseData?.rawResponse?.tracking_number ||
      trackingNumber ||
      consignmentId?.toString() ||
      "";

    order.deliveryStatus = DeliveryStatus.COURIERASSIGNED;

    if (!order.courierAssignedAt) {
      order.courierAssignedAt = new Date();
    }

    await order.save();

    return courier;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }

    console.log("PATHAO ERROR:", error);

    throw new AppError(
      httpStatus.BAD_REQUEST,
      error?.response?.data?.message || "Pathao courier creation failed",
    );
  }
};

const trackCourier = async (trackingCode: string) => {
  const courier = await Courier.findOne({
    $or: [{ trackingCode }, { consignmentId: trackingCode }],
  });

  if (!courier) {
    throw new AppError(httpStatus.NOT_FOUND, "Courier not found");
  }

  const config = await getPathaoCredentials();
  const headers = await getHeaders(config);

  const res = await axios.get(
    `${config.baseUrl}/aladdin/api/v1/orders/${trackingCode}/info`,
    { headers },
  );

  const pathaoStatus = res.data?.data?.order_status?.toLowerCase();

  let mappedStatus: CourierDeliveryStatus;

  switch (pathaoStatus) {
    case "pending":
      mappedStatus = CourierDeliveryStatus.PENDING;
      break;

    case "picked_up":
      mappedStatus = CourierDeliveryStatus.PICKED_UP;
      break;

    case "delivered":
      mappedStatus = CourierDeliveryStatus.DELIVERED;
      break;

    case "partial_delivered":
      mappedStatus = CourierDeliveryStatus.PARTIAL;
      break;

    case "cancelled":
    case "returned":
      mappedStatus = CourierDeliveryStatus.CANCELLED;
      break;

    case "on_hold":
      mappedStatus = CourierDeliveryStatus.HOLD;
      break;

    default:
      mappedStatus = CourierDeliveryStatus.IN_TRANSIT;
  }

  if (courier.deliveryStatus !== mappedStatus) {
    courier.deliveryStatus = mappedStatus;
    courier.rawResponse = res.data;

    await courier.save();
  }

  await syncCourierOrderStatus(courier, mappedStatus);

  return courier;
};

export const PathaoProvider = {
  createCourier,
  trackCourier,
  getCities,
};