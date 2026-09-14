/* eslint-disable @typescript-eslint/no-unused-vars */
import httpStatus from "http-status-codes";
import { IUser, Role } from "./user.interface";
import { User } from "./user.model";
import AppError from "../../errorHelpers/appError";
import bcryptjs from "bcryptjs";
import { envVars } from "../../config/env";
import { JwtPayload } from "jsonwebtoken";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { userSearchableFields } from "./user.constants copy";
import { Order } from "../order/order.model";
import { Types } from "mongoose";

export const getStaffStats = async (queryObj: any) => {
  const totalStaffs = await User.countDocuments({
    role: { $ne: "CUSTOMER" },
    isDeleted: false,
  });

  const fixedSalaryAgg = await User.aggregate([
    {
      $match: {
        role: { $ne: "CUSTOMER" },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalFixedSalary: {
          $sum: { $ifNull: ["$salary", 0] },
        },
      },
    },
  ]);

  const totalFixedSalary = fixedSalaryAgg[0]?.totalFixedSalary || 0;

  const commissionAgg = await Order.aggregate([
    {
      $match: {
        isDeleted: false,
        isPublished: true,
        orderStatus: { $in: ["COMPLETED", "PARTIAL"] },
        deliveryStatus: { $in: ["DELIVERED", "PARTIAL"] },
        seller: { $ne: null },
        ...queryObj,
      },
    },

    {
      $addFields: {
        orderValue: {
          $subtract: ["$total", { $ifNull: ["$shippingCost", 0] }],
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
    { $unwind: "$seller" },

    {
      $match: {
        "seller.role": { $ne: "CUSTOMER" },
      },
    },

    {
      $addFields: {
        commissionAmount: {
          $cond: [
            { $gt: ["$seller.commissionSalary", 0] },
            {
              $multiply: [
                "$orderValue",
                { $divide: ["$seller.commissionSalary", 100] },
              ],
            },
            0,
          ],
        },
      },
    },

    {
      $group: {
        _id: null,
        totalSalaryByProduct: { $sum: "$commissionAmount" },
      },
    },
  ]);

  const totalSalaryByProduct = commissionAgg[0]?.totalSalaryByProduct || 0;

  const totalSalary = totalFixedSalary + totalSalaryByProduct;

  return {
    totalStaffs,
    totalFixedSalary,
    totalSalaryByProduct,
    totalSalary,
  };
};

const createUserService = async (payload: Partial<IUser>) => {
  const { email, password, ...rest } = payload;

  const isExistUser = await User.findOne({ email });

  if (isExistUser) {
    throw new AppError(httpStatus.BAD_REQUEST, "User already exist");
  }

  const hashPassword = await bcryptjs.hash(password as string, 10);
  const user = await User.create({
    email,
    password: hashPassword,
    ...rest,
  });

  const { password: _, ...userWithoutPassword } = user.toObject();

  return userWithoutPassword;
};

const getMe = async (userId: string) => {
  const user = await User.findById(userId).select("-password");
  return {
    data: user,
  };
};

const getSingleUser = async (id: string) => {
  const user = await User.findById(id).populate("permissions");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
  }
  return {
    data: user,
  };
};

const updateUser = async (
  userId: string,
  payload: Partial<IUser>,
  decodedToken: JwtPayload,
) => {
  // Check if user exists
  const existingUser = await User.findById(userId);
  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Without Admin Role Restrictions
  if (decodedToken.role !== Role.ADMIN) {
    if (userId !== decodedToken.userId) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "You are not authorized to update this user.",
      );
    }

    if (payload.password) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You cannot update your password here.",
      );
    }

    if (
      payload.role ||
      payload.isActive ||
      payload.isDeleted ||
      payload.isVerified
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not authorized to modify these fields.",
      );
    }
  }

  if (payload.password) {
    const hashedPassword = await bcryptjs.hash(
      payload.password,
      Number(envVars.BCRYPT_SALT_ROUND),
    );
    payload.password = hashedPassword;
  }

  if (payload.permissions) {
    if (typeof payload.permissions === "string") {
      try {
        payload.permissions = JSON.parse(payload.permissions);
      } catch {
        throw new AppError(400, "Invalid permissions format");
      }
    }
  }

  // No restrictions for Admin — directly update
  const updatedUser = await User.findByIdAndUpdate(userId, payload, {
    new: true,
    runValidators: true,
  });

  return updatedUser;
};

const getMyCustomers = async (
  userId: string,
  query: Record<string, string>,
) => {
  const { searchTerm, page = "1", limit = "10" } = query;

  const queryObj: any = {
    seller: new Types.ObjectId(userId),
    isDeleted: false,
    isPublished: true,
  };

  // DATE FILTER
  if (query["createdAt[gte]"] || query["createdAt[lte]"]) {
    queryObj.createdAt = {};

    if (query["createdAt[gte]"]) {
      queryObj.createdAt.$gte = new Date(query["createdAt[gte]"]);
    }

    if (query["createdAt[lte]"]) {
      queryObj.createdAt.$lte = new Date(query["createdAt[lte]"]);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const matchStage: any = queryObj;

  if (searchTerm) {
    matchStage.$or = [
      {
        "billingDetails.fullName": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        "billingDetails.phone": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        "billingDetails.email": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        customOrderId: {
          $regex: searchTerm,
          $options: "i",
        },
      },
    ];
  }

  const customers = await Order.aggregate([
    {
      $match: matchStage,
    },

    {
      $sort: {
        createdAt: -1,
      },
    },

    {
      $group: {
        _id: "$billingDetails.phone",

        fullName: {
          $first: "$billingDetails.fullName",
        },

        phone: {
          $first: "$billingDetails.phone",
        },

        email: {
          $first: "$billingDetails.email",
        },

        address: {
          $first: "$billingDetails.address",
        },

        totalOrders: {
          $sum: 1,
        },

        totalSpent: {
          $sum: "$total",
        },

        customOrderIds: {
          $push: "$customOrderId",
        },

        latestOrderDate: {
          $max: "$createdAt",
        },
      },
    },

    {
      $skip: skip,
    },

    {
      $limit: Number(limit),
    },
  ]);

  const totalAgg = await Order.aggregate([
    {
      $match: matchStage,
    },
    {
      $group: {
        _id: "$billingDetails.phone",
      },
    },
    {
      $count: "total",
    },
  ]);

  return {
    data: customers,
    meta: {
      total: totalAgg[0]?.total || 0,
      page: Number(page),
      limit: Number(limit),
    },
  };
};

const deleteUser = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
  }

  await User.findByIdAndDelete(id);

  return {
    data: null,
  };
};

const getAllUsers = async (query: Record<string, string>) => {
  const queryObj: any = {};

  if (query["createdAt[gte]"] || query["createdAt[lte]"]) {
    queryObj.createdAt = {};

    if (query["createdAt[gte]"]) {
      queryObj.createdAt.$gte = new Date(query["createdAt[gte]"]);
    }

    if (query["createdAt[lte]"]) {
      queryObj.createdAt.$lte = new Date(query["createdAt[lte]"]);
    }
  }

  delete query["createdAt[gte]"];
  delete query["createdAt[lte]"];

  const queryBuilder = new QueryBuilder(
    User.find({ role: { $ne: "CUSTOMER" }, isDeleted: false }),
    query,
  );

  const usersData = queryBuilder
    .filter()
    .search(userSearchableFields)
    .sort()
    .fields()
    .paginate();

  const [data, meta, staffStats] = await Promise.all([
    usersData.build(),
    queryBuilder.getMeta(),
    getStaffStats(queryObj),
  ]);

  return {
    data,
    meta: {
      ...meta,
      ...staffStats,
    },
  };
};
const getAllTrashUsers = async (query: Record<string, string>) => {
  const queryObj: any = {};

  // DATE FILTER
  if (query["createdAt[gte]"] || query["createdAt[lte]"]) {
    queryObj.createdAt = {};

    if (query["createdAt[gte]"]) {
      queryObj.createdAt.$gte = new Date(query["createdAt[gte]"]);
    }

    if (query["createdAt[lte]"]) {
      queryObj.createdAt.$lte = new Date(query["createdAt[lte]"]);
    }
  }

  // REMOVE SPECIAL FIELDS
  delete query["createdAt[gte]"];
  delete query["createdAt[lte]"];

  const queryBuilder = new QueryBuilder(
    User.find({ role: { $ne: "CUSTOMER" }, isDeleted: true, ...queryObj }),
    query,
  );
  const usersData = queryBuilder
    .filter()
    .search(userSearchableFields)
    .sort()
    .fields()
    .paginate();

  const [data, meta] = await Promise.all([
    usersData.build(),
    queryBuilder.getMeta(),
  ]);

  return {
    data,
    meta,
  };
};

const getAllCustomers = async (query: Record<string, string>) => {
  const { searchTerm, page = "1", limit = "10" } = query;

  const queryObj: any = {
    isDeleted: false,
    isPublished: true,
  };

  // DATE FILTER
  if (query["createdAt[gte]"] || query["createdAt[lte]"]) {
    queryObj.createdAt = {};

    if (query["createdAt[gte]"]) {
      queryObj.createdAt.$gte = new Date(query["createdAt[gte]"]);
    }

    if (query["createdAt[lte]"]) {
      queryObj.createdAt.$lte = new Date(query["createdAt[lte]"]);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const matchStage: any = queryObj;

  // SEARCH
  if (searchTerm) {
    matchStage.$or = [
      {
        "billingDetails.fullName": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        "billingDetails.phone": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        "billingDetails.email": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        customOrderId: {
          $regex: searchTerm,
          $options: "i",
        },
      },
    ];
  }

  const aggregate = await Order.aggregate([
    {
      $match: matchStage,
    },

    // SORT NEWEST FIRST
    {
      $sort: {
        createdAt: -1,
      },
    },

    // GROUP BY PHONE
    {
      $group: {
        _id: "$billingDetails.phone",

        fullName: {
          $first: "$billingDetails.fullName",
        },

        phone: {
          $first: "$billingDetails.phone",
        },

        email: {
          $first: "$billingDetails.email",
        },

        address: {
          $first: "$billingDetails.address",
        },

        totalOrders: {
          $sum: 1,
        },

        totalSpent: {
          $sum: "$total",
        },

        latestOrderDate: {
          $max: "$createdAt",
        },

        customOrderIds: {
          $push: "$customOrderId",
        },

        orders: {
          $push: {
            _id: "$_id",
            customOrderId: "$customOrderId",
            total: "$total",
            orderStatus: "$orderStatus",
            deliveryStatus: "$deliveryStatus",
            createdAt: "$createdAt",
          },
        },

        seller: {
          $first: "$seller",
        },
      },
    },

    // LOOKUP SELLER
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
        preserveNullAndEmptyArrays: true,
      },
    },

    // LOOKUP LEAD
    {
      $lookup: {
        from: "leads",
        localField: "phone",
        foreignField: "phone",
        as: "leadInfo",
      },
    },

    {
      $unwind: {
        path: "$leadInfo",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $project: {
        _id: 0,

        fullName: 1,
        phone: 1,
        email: 1,
        address: 1,

        totalOrders: 1,
        totalSpent: 1,
        latestOrderDate: 1,

        customOrderIds: 1,
        orders: 1,

        seller: {
          _id: 1,
          name: 1,
          role: 1,
        },

        leadInfo: {
          _id: 1,
          status: 1,
          priority: 1,
          social: 1,
        },
      },
    },

    {
      $skip: skip,
    },

    {
      $limit: Number(limit),
    },
  ]);

  // TOTAL COUNT
  const totalAgg = await Order.aggregate([
    {
      $match: matchStage,
    },
    {
      $group: {
        _id: "$billingDetails.phone",
      },
    },
    {
      $count: "total",
    },
  ]);

  return {
    data: aggregate,
    meta: {
      total: totalAgg[0]?.total || 0,
      page: Number(page),
      limit: Number(limit),
      totalPage: Math.ceil((totalAgg[0]?.total || 0) / Number(limit)),
    },
  };
};

const getAllTrashCustomers = async (query: Record<string, string>) => {
  const { searchTerm, page = "1", limit = "10" } = query;

  const queryObj: any = {
    isDeleted: true,
    isPublished: true,
  };

  // DATE FILTER
  if (query["createdAt[gte]"] || query["createdAt[lte]"]) {
    queryObj.createdAt = {};

    if (query["createdAt[gte]"]) {
      queryObj.createdAt.$gte = new Date(query["createdAt[gte]"]);
    }

    if (query["createdAt[lte]"]) {
      queryObj.createdAt.$lte = new Date(query["createdAt[lte]"]);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const matchStage: any = queryObj;

  // SEARCH
  if (searchTerm) {
    matchStage.$or = [
      {
        "billingDetails.fullName": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        "billingDetails.phone": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        "billingDetails.email": {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        customOrderId: {
          $regex: searchTerm,
          $options: "i",
        },
      },
    ];
  }

  const aggregate = await Order.aggregate([
    {
      $match: matchStage,
    },

    {
      $sort: {
        createdAt: -1,
      },
    },

    {
      $group: {
        _id: "$billingDetails.phone",

        fullName: {
          $first: "$billingDetails.fullName",
        },

        phone: {
          $first: "$billingDetails.phone",
        },

        email: {
          $first: "$billingDetails.email",
        },

        address: {
          $first: "$billingDetails.address",
        },

        totalOrders: {
          $sum: 1,
        },

        totalSpent: {
          $sum: "$total",
        },

        latestOrderDate: {
          $max: "$createdAt",
        },

        customOrderIds: {
          $push: "$customOrderId",
        },

        orders: {
          $push: {
            _id: "$_id",
            customOrderId: "$customOrderId",
            total: "$total",
            orderStatus: "$orderStatus",
            deliveryStatus: "$deliveryStatus",
            createdAt: "$createdAt",
          },
        },
      },
    },

    {
      $skip: skip,
    },

    {
      $limit: Number(limit),
    },
  ]);

  const totalAgg = await Order.aggregate([
    {
      $match: matchStage,
    },
    {
      $group: {
        _id: "$billingDetails.phone",
      },
    },
    {
      $count: "total",
    },
  ]);

  return {
    data: aggregate,
    meta: {
      total: totalAgg[0]?.total || 0,
      page: Number(page),
      limit: Number(limit),
      totalPage: Math.ceil((totalAgg[0]?.total || 0) / Number(limit)),
    },
  };
};

const updateProfile = async (
  payload: Partial<IUser>,
  decodedToken: JwtPayload,
) => {
  const user = await User.findById(decodedToken.userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (payload.password) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can't change your password here",
    );
  }

  const updatedUser = await User.findByIdAndUpdate(
    decodedToken.userId,
    payload,
    {
      new: true,
      runValidators: true,
    },
  );
  return {
    data: updatedUser,
  };
};

export const UserServices = {
  createUserService,
  getMe,
  getSingleUser,
  updateUser,
  updateProfile,
  getAllUsers,
  getAllTrashUsers,
  getAllCustomers,
  getAllTrashCustomers,
  getMyCustomers,
  deleteUser,
};
