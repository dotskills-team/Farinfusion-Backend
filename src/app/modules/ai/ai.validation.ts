import { z } from "zod";

export const aiChatValidationSchema = z.object({
  message: z
    .string({ required_error: "message is required" })
    .trim()
    .min(1, "message cannot be empty")
    .max(2000, "message is too long"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().trim().min(1).max(4000),
      }),
    )
    .max(20, "history is too long")
    .optional(),
});
