import httpStatus from "http-status-codes";
import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ScheduleServices } from "./schedule.service";

const createSchedule = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleServices.createSchedule(
    req.body,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Schedule created successfully",
    data: result,
  });
});

const getMySchedules = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleServices.getMySchedules(
    req.user as JwtPayload,
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Schedules retrieved successfully",
    data: result.data,
  });
});

const getSingleSchedule = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleServices.getSingleSchedule(
    req.params.id as string,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Schedule retrieved successfully",
    data: result.data,
  });
});

const updateSchedule = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleServices.updateSchedule(
    req.params.id as string,
    req.body,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Schedule updated successfully",
    data: result,
  });
});

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleServices.deleteSchedule(
    req.params.id as string,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Schedule deleted successfully",
    data: result.data,
  });
});

export const ScheduleControllers = {
  createSchedule,
  getMySchedules,
  getSingleSchedule,
  updateSchedule,
  deleteSchedule,
};