
import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const replyZodSchema = z.object({
  text: z.string().trim().min(1, "Text required").max(2000),
});

export const assignZodSchema = z.object({
  moderatorId: objectId.nullable(),
});

export const transferZodSchema = z.object({
  toModeratorId: objectId,
  note: z.string().trim().max(300).optional(),
});

export const statusZodSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]),
});

export const linkLeadZodSchema = z.object({
  leadId: objectId,
});

export const availabilityZodSchema = z.object({
  chatStatus: z.enum(["ONLINE", "OFFLINE"]),
});

export const settingsZodSchema = z.object({
  autoAssign: z.boolean().optional(),
  slaMinutes: z.number().int().min(1).max(1440).optional(),
  returnToPoolMinutes: z.number().int().min(1).max(10080).optional(),
});

export const reactZodSchema = z.object({
  messageId: z.string().min(1),
  // null removes our reaction
  reaction: z.enum(["like", "love", "smile", "wow", "sad", "angry"]).nullable(),
});