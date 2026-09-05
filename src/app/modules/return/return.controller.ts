/* eslint-disable @typescript-eslint/no-unused-vars */
import httpStatus from "http-status-codes";
import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ReturnServices } from "./return.service";

const createReturn = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JwtPayload;
    const payload = req.body;

    const result = await ReturnServices.createReturn(payload, user);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Return parcel created successfully",
      data: result,
    });
  },
);

// const getAllReturns = catchAsync(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const query = req.query;

//     const result = await ReturnServices.getAllReturns(
//       query as Record<string, string>,
//     );

//     sendResponse(res, {
//       success: true,
//       statusCode: httpStatus.OK,
//       message: "All return parcels retrieved successfully",
//       data: result.data,
//       meta: result.meta,
//     });
//   },
// );

const getAllReturns = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query;

    const result = await ReturnServices.getAllReturns(
      query as Record<string, string>,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All return parcels retrieved successfully",
      data: { data: result.data, stats: result.stats },
      meta: result.meta,
    });
  },
);


const getSingleReturn = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;

    const result = await ReturnServices.getSingleReturn(id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Return parcel retrieved successfully",
      data: result,
    });
  },
);

const updateReturnStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const payload = req.body;

    const result = await ReturnServices.updateReturnStatus(id, payload);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Return parcel updated successfully",
      data: result,
    });
  },
);

const deleteReturn = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;

    const result = await ReturnServices.deleteReturn(id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Return parcel deleted successfully",
      data: result,
    });
  },
);

export const ReturnControllers = {
  createReturn,
  getAllReturns,
  getSingleReturn,
  updateReturnStatus,
  deleteReturn,
};