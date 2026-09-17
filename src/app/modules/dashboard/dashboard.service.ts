

import { Order } from "../order/order.model";
import { User } from "../user/user.model";
import { Product } from "../product/product.model";
import { Types } from "mongoose";
import AppError from "../../errorHelpers/appError";
import httpStatus from "http-status-codes";
import { Role } from "../user/user.interface";

const getDashboardOverview = async (
  userId: string,
  role: string,
  query: Record<string, string>,
) => {
  const queryObj: any = {};

  if (query["updatedAt[gte]"] || query["updatedAt[lte]"]) {
    queryObj.updatedAt = {};

    if (query["updatedAt[gte]"]) {
      queryObj.updatedAt.$gte = new Date(query["updatedAt[gte]"]);
    }

    if (query["updatedAt[lte]"]) {
      queryObj.updatedAt.$lte = new Date(query["updatedAt[lte]"]);
    }
  }

  if (query.orderStatus) {
    queryObj.orderStatus = query.orderStatus;
  }

  if (query.deliveryStatus) {
    queryObj.deliveryStatus = query.deliveryStatus;
  }

  let matchCondition: any = {
    isDeleted: false,
    isPublished: true,
    ...queryObj,
  };

  let staffPerformance = undefined;
  let myPerformance = undefined;

  // ---- Batch 1: independent queries. productCostAgg intentionally snapshots
  // matchCondition BEFORE the role-based mutations below (same as original order).
  const [productCostAgg, mySalaryUser, staffUsers] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          ...matchCondition,
          orderStatus: { $in: ["COMPLETED", "PARTIAL"] },
        },
      },
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.product",
          foreignField: "_id",
          as: "productData",
        },
      },
      { $unwind: "$productData" },
      {
        $group: {
          _id: null,
          totalCost: {
            $sum: {
              $multiply: [
                "$products.quantity",
                { $ifNull: ["$productData.buyingPrice", 0] },
              ],
            },
          },
        },
      },
    ]),
    role === Role.GENERALSTAFF ? User.findById(userId) : Promise.resolve(null),
    User.find({
      role: { $in: ["ADMIN", "MANAGER", "MODERATOR", "TELESALES"] },
      isDeleted: false,
    }),
  ]);

  const mySalary = mySalaryUser?.salary || 0;

  // ---- Role-based matchCondition mutation must stay sequential: later queries
  // depend on the final matchCondition value.
  if (role === Role.CUSTOMER) {
    const user = await User.findById(userId);
    if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

    matchCondition["billingDetails.email"] = user.email;
  }

  if ([Role.MODERATOR].includes(role as Role)) {
    matchCondition.seller = new Types.ObjectId(userId);
  }

  // ---- Date-range bookkeeping (pure computation, no I/O) ----
  const startDate = query["updatedAt[gte]"]
    ? new Date(query["updatedAt[gte]"])
    : new Date(new Date().setDate(1));

  const endDate = query["updatedAt[lte]"]
    ? new Date(query["updatedAt[lte]"])
    : new Date();

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const totalMonthlySalary = staffUsers.reduce(
    (sum, user) => sum + (user.salary || user.commissionSalary || 0),
    0,
  );

  const dailySalary = totalMonthlySalary / 30;
  const staffSalaryForPeriod = dailySalary * totalDays;

  const confirmedMatch = {
    ...matchCondition,
    orderStatus: "CONFIRMED",
  };

  // ---- Role-conditional promises (built now, resolved in the big batch below) ----
  const staffEarningsPromise =
    role === Role.ADMIN
      ? Order.aggregate([
          {
            $match: {
              isDeleted: false,
              isPublished: true,
              orderStatus: { $in: ["COMPLETED", "PARTIAL"] },
              deliveryStatus: { $in: ["DELIVERED", "PARTIAL"] },
              ...queryObj,
            },
          },
          {
            $addFields: {
              orderValue: {
                $max: [
                  {
                    $subtract: ["$total", { $ifNull: ["$shippingCost", 0] }],
                  },
                  0,
                ],
              },
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "seller",
              foreignField: "_id",
              as: "seller",
            },
          },
          {
            $unwind: {
              path: "$seller",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $addFields: {
              perOrderSalary: {
                $cond: [
                  { $gt: ["$seller.commissionSalary", 0] },
                  "$seller.commissionSalary",
                  0,
                ],
              },
            },
          },
          {
            $group: {
              _id: "$seller._id",
              sellerName: { $first: "$seller.name" },
              phone: { $first: "$seller.phone" },
              totalOrders: { $sum: 1 },
              totalOrderValue: { $sum: "$orderValue" },
              totalEarnings: { $sum: "$perOrderSalary" },
              avgPerOrderSalary: { $avg: "$perOrderSalary" },
            },
          },
          { $sort: { totalEarnings: -1 } },
        ])
      : Promise.resolve(undefined);

  const totalUsersPromise =
    role === Role.ADMIN ? User.countDocuments() : Promise.resolve(undefined);

  const totalProductsPromise =
    role === Role.ADMIN
      ? Product.countDocuments({ isDeleted: false })
      : Promise.resolve(undefined);

  const staffPerformancePromise = [Role.ADMIN, Role.MANAGER].includes(
    role as Role,
  )
    ? Order.aggregate([
        {
          $match: {
            isDeleted: false,
            isPublished: true,
            ...queryObj,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "seller",
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $unwind: {
            path: "$seller",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $group: {
            _id: "$seller._id",
            sellerName: { $first: "$seller.name" },
            email: { $first: "$seller.email" },
            phone: { $first: "$seller.phone" },
            role: { $first: "$seller.role" },
            profileImage: { $first: "$seller.profileImage" },
            commissionPerOrder: { $first: "$seller.commissionSalary" },
            totalOrders: { $sum: 1 },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "PENDING"] }, 1, 0] },
            },
            confirmedOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "CONFIRMED"] }, 1, 0] },
            },
            completedOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "COMPLETED"] }, 1, 0] },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "CANCELLED"] }, 1, 0] },
            },
            partialOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "PARTIAL"] }, 1, 0] },
            },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ["$orderStatus", ["COMPLETED", "PARTIAL"]] },
                  { $subtract: ["$total", { $ifNull: ["$shippingCost", 0] }] },
                  0,
                ],
              },
            },
            totalCommission: {
              $sum: {
                $cond: [
                  { $in: ["$orderStatus", ["COMPLETED", "PARTIAL"]] },
                  "$seller.commissionSalary",
                  0,
                ],
              },
            },
          },
        },
        { $sort: { totalOrders: -1 } },
      ])
    : Promise.resolve(undefined);

  const myPerformancePromise = [
    Role.MODERATOR,
    Role.GENERALSTAFF,
    Role.TELESALES,
  ].includes(role as Role)
    ? Order.aggregate([
        {
          $match: {
            seller: new Types.ObjectId(userId),
            isDeleted: false,
            isPublished: true,
            ...queryObj,
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "PENDING"] }, 1, 0] },
            },
            confirmedOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "CONFIRMED"] }, 1, 0] },
            },
            completedOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "COMPLETED"] }, 1, 0] },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "CANCELLED"] }, 1, 0] },
            },
            partialOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "PARTIAL"] }, 1, 0] },
            },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ["$orderStatus", ["COMPLETED", "PARTIAL"]] },
                  { $subtract: ["$total", { $ifNull: ["$shippingCost", 0] }] },
                  0,
                ],
              },
            },
          },
        },
      ])
    : Promise.resolve(undefined);

  // ---- Batch 2: everything that depends on the final matchCondition, plus
  // the role-conditional promises above. All independent of each other.
  const [
    totalOrders,
    orderStatsAgg,
    courierAssignedCount,
    inTransitCount,
    noResponseCount,
    revenueAgg,
    recentOrders,
    topProducts,
    confirmedProducts,
    staffEarnings,
    totalUsers,
    totalProducts,
    staffPerformanceResult,
    myPerformanceResult,
  ] = await Promise.all([
    Order.countDocuments(matchCondition),
    Order.aggregate([
      { $match: matchCondition },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
    ]),
    Order.countDocuments({
      ...matchCondition,
      deliveryStatus: "COURIERASSIGNED",
    }),
    Order.countDocuments({ ...matchCondition, deliveryStatus: "IN_TRANSIT" }),
    Order.countDocuments({ ...matchCondition, deliveryStatus: "NO_RESPONSE" }),
    Order.aggregate([
      {
        $match: {
          ...matchCondition,
          orderStatus: { $in: ["COMPLETED", "PARTIAL"] },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $subtract: ["$total", { $ifNull: ["$shippingCost", 0] }],
            },
          },
        },
      },
    ]),
    Order.find(matchCondition)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customer", "name email")
      .populate("seller", "name email"),
    Order.aggregate([
      {
        $match: {
          orderStatus: "COMPLETED",
          deliveryStatus: "DELIVERED",
          isDeleted: false,
          ...queryObj,
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalSoldInPeriod: { $sum: "$products.quantity" },
          totalRevenueInPeriod: {
            $sum: { $multiply: ["$products.price", "$products.quantity"] },
          },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalSoldInPeriod: -1 } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: { path: "$product", preserveNullAndEmptyArrays: false },
      },
      {
        $addFields: {
          availableStock: {
            $max: [
              {
                $subtract: [
                  { $ifNull: ["$product.totalAddedStock", 0] },
                  "$totalSoldInPeriod",
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          productId: "$product._id",
          title: "$product.title",
          price: "$product.price",
          buyingPrice: "$product.buyingPrice",
          images: "$product.images",
          availableStock: 1,
          totalSoldInPeriod: 1,
          totalRevenueInPeriod: 1,
          orderCount: 1,
        },
      },
    ]),
    Order.aggregate([
      { $match: confirmedMatch },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalSoldInPeriod: { $sum: "$products.quantity" },
          totalRevenueInPeriod: {
            $sum: { $multiply: ["$products.price", "$products.quantity"] },
          },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalSoldInPeriod: -1 } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          availableStock: {
            $max: [
              {
                $subtract: [
                  { $ifNull: ["$product.totalAddedStock", 0] },
                  "$totalSoldInPeriod",
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          productId: "$product._id",
          title: "$product.title",
          price: "$product.price",
          discountPrice: "$product.discountPrice",
          buyingPrice: "$product.buyingPrice",
          images: "$product.images",
          availableStock: 1,
          totalSold: { $sum: "$products.quantity" },
          totalSoldInPeriod: 1,
          totalRevenueInPeriod: 1,
          orderCount: 1,
        },
      },
    ]),
    staffEarningsPromise,
    totalUsersPromise,
    totalProductsPromise,
    staffPerformancePromise,
    myPerformancePromise,
  ]);

  staffPerformance = staffPerformanceResult;

  myPerformance = [Role.MODERATOR, Role.GENERALSTAFF, Role.TELESALES].includes(
    role as Role,
  )
    ? myPerformanceResult?.[0] || {
        totalOrders: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        partialOrders: 0,
        revenue: 0,
      }
    : undefined;

  const orderStats = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    PARTIAL: 0,
    COURIER_ASSIGNED: courierAssignedCount,
    IN_TRANSIT: inTransitCount,
    NO_RESPONSE: noResponseCount,
  };
  orderStatsAgg.forEach((item) => {
    orderStats[item._id as keyof typeof orderStats] = item.count;
  });

  const totalProductCost = productCostAgg[0]?.totalCost || 0;
  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalCost = totalProductCost;
  const netProfit = totalRevenue - totalCost;

  return {
    totalOrders,
    totalRevenue,
    totalUsers,
    totalProducts,
    orderStats,
    staffEarnings,

    staffPerformance,
    myPerformance,
    mySalary,
    topProducts,
    confirmedProducts,
    totalCost: totalProductCost,
    totalSalary: staffSalaryForPeriod,
    netProfit,
    recentOrders,
    role,
  };
};

export const DashboardService = {
  getDashboardOverview,
};