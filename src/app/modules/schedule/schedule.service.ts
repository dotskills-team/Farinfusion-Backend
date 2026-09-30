import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import AppError from "../../errorHelpers/appError";
import { Schedule } from "./schedule.model";
import { ISchedule } from "./schedule.interface";

const createSchedule = async (payload: Partial<ISchedule>, user: JwtPayload) => {
  const schedule = await Schedule.create({
    ...payload,
    user: user.userId,
  });

  return schedule;
};

const getMySchedules = async (
  user: JwtPayload,
  query: Record<string, string>,
) => {
  const filter: Record<string, any> = {
    user: user.userId,
    isDeleted: false,
  };

  if (query.date) {
    filter.date = query.date;
  } else if (query.month) {
    filter.date = { $regex: `^${query.month}-` };
  }

  const data = await Schedule.find(filter).sort({ date: 1, time: 1 });

  return {
    data,
  };
};

const getSingleSchedule = async (id: string, user: JwtPayload) => {
  const schedule = await Schedule.findOne({
    _id: id,
    user: user.userId,
    isDeleted: false,
  });

  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  return {
    data: schedule,
  };
};

const updateSchedule = async (
  id: string,
  payload: Partial<ISchedule>,
  user: JwtPayload,
) => {
  const schedule = await Schedule.findOne({
    _id: id,
    user: user.userId,
    isDeleted: false,
  });

  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  const updatedSchedule = await Schedule.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return updatedSchedule;
};

const deleteSchedule = async (id: string, user: JwtPayload) => {
  const schedule = await Schedule.findOne({
    _id: id,
    user: user.userId,
    isDeleted: false,
  });

  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  schedule.isDeleted = true;

  await schedule.save();

  return {
    data: null,
  };
};

export const ScheduleServices = {
  createSchedule,
  getMySchedules,
  getSingleSchedule,
  updateSchedule,
  deleteSchedule,
};