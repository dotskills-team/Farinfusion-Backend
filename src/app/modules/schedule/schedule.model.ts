import { Schema, model } from "mongoose";
import { ISchedule } from "./schedule.interface";

const scheduleSchema = new Schema<ISchedule>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    date: {
      type: String,
      required: true,
      index: true,
    },

    time: {
      type: String,
      required: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scheduleSchema.index({ user: 1, date: 1 });

export const Schedule = model<ISchedule>("Schedule", scheduleSchema);