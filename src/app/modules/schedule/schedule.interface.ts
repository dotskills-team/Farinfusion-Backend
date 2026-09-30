import { Types } from "mongoose";

export interface ISchedule {
  _id?: Types.ObjectId;

  user: Types.ObjectId;

  title: string;

  description?: string;

  date: string;

  time: string;

  isDeleted?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}