import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ProductPurchaseServices } from "./productPurchase.service";

const createPurchase = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductPurchaseServices.createPurchase(
    req.body,
    req.user,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Purchase created successfully",
    data: result,
  });
});

const getAllPurchases = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductPurchaseServices.getAllPurchases(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Purchases retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getSinglePurchase = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductPurchaseServices.getSinglePurchase(
    req.params.id as string,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Purchase retrieved successfully",
    data: result,
  });
});

const updatePurchaseStatus = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const result = await ProductPurchaseServices.updatePurchaseStatus(
    id,
    req.body,
    req.user,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Purchase status updated successfully",
    data: result,
  });
});

const getPurchaseStats = catchAsync(async (req, res) => {
  const result = await ProductPurchaseServices.getPurchaseStats();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Purchase stats retrieved successfully",
    data: result,
  });
});

const updatePurchase = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductPurchaseServices.updatePurchase(
    req.params.id as string,
    req.body,
    req.user,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Purchase updated successfully",
    data: result,
  });
});

const deletePurchase = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductPurchaseServices.deletePurchase(
    req.params.id as string,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Purchase deleted successfully",
    data: result,
  });
});

export const ProductPurchaseControllers = {
  createPurchase,
  getAllPurchases,
  updatePurchaseStatus,
  getSinglePurchase,
  updatePurchase,
  deletePurchase,
  getPurchaseStats,
};
