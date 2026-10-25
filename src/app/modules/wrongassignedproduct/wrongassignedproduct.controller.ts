/* eslint-disable @typescript-eslint/no-unused-vars */
import httpStatus from "http-status-codes";
import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { WrongAssignedProductServices } from "./wrongassignedproduct.service";

const createWrongAssignedProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JwtPayload;

    const result = await WrongAssignedProductServices.createWrongAssignedProduct(
      req.body,
      user,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Wrong assigned product created successfully",
      data: result,
    });
  },
);

const getAllWrongAssignedProducts = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result =
      await WrongAssignedProductServices.getAllWrongAssignedProducts(
        req.query as Record<string, string>,
      );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Wrong assigned products retrieved successfully",
      data: { data: result.data, stats: result.stats },
      meta: result.meta,
    });
  },
);

const getSingleWrongAssignedProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;

    const result =
      await WrongAssignedProductServices.getSingleWrongAssignedProduct(id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Wrong assigned product retrieved successfully",
      data: result,
    });
  },
);

const updateWrongAssignedProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const user = req.user as JwtPayload;

    const result = await WrongAssignedProductServices.updateWrongAssignedProduct(
      id,
      req.body,
      user,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Wrong assigned product updated successfully",
      data: result,
    });
  },
);

const deleteWrongAssignedProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;

    const result = await WrongAssignedProductServices.deleteWrongAssignedProduct(
      id,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Wrong assigned product deleted successfully",
      data: result,
    });
  },
);

export const WrongAssignedProductControllers = {
  createWrongAssignedProduct,
  getAllWrongAssignedProducts,
  getSingleWrongAssignedProduct,
  updateWrongAssignedProduct,
  deleteWrongAssignedProduct,
};