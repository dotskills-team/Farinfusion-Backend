import { z } from "zod";

const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createScheduleZodSchema = z.object({
  title: z
    .string({
      required_error: "Title is required",
    })
    .min(2, "Title must be at least 2 characters"),

  description: z.string().max(500, "Description is too long").optional(),

  date: z
    .string({
      required_error: "Date is required",
    })
    .regex(dateRegex, "Date must be in YYYY-MM-DD format"),

  time: z
    .string({
      required_error: "Time is required",
    })
    .regex(timeRegex, "Time must be in HH:mm format"),
});

export const updateScheduleZodSchema = z.object({
  title: z.string().min(2).optional(),

  description: z.string().max(500).optional(),

  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format").optional(),

  time: z.string().regex(timeRegex, "Time must be in HH:mm format").optional(),
});