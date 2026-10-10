
import { model, Schema } from "mongoose";
import {
  FbAssignType,
  FbConvStatus,
  IFbAssignmentLog,
  IFbConversation,
  IFbRecentMessage,
  IFbReplyLog,
  IFbSettings,
} from "./facebook.interface";

const fbConversationSchema = new Schema<IFbConversation>(
  {
    psid: { type: String, required: true, unique: true },
    fbThreadId: { type: String },
    customerName: { type: String, default: "Facebook User" },
    profilePic: { type: String },
    lastMid: { type: String },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastCustomerMessageAt: { type: Date },
    awaitingReplySince: { type: Date, default: null },
    slaNotified: { type: Boolean, default: false },
    unreadCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(FbConvStatus),
      default: FbConvStatus.UNASSIGNED,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assignedAt: { type: Date, default: null },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
  },
  { timestamps: true, versionKey: false },
);

const fbAssignmentLogSchema = new Schema<IFbAssignmentLog>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "FbConversation",
      required: true,
      index: true,
    },
    from: { type: Schema.Types.ObjectId, ref: "User", default: null },
    to: { type: Schema.Types.ObjectId, ref: "User", default: null },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: Object.values(FbAssignType), required: true },
    note: { type: String },
  },
  { timestamps: true, versionKey: false },
);

const fbReplyLogSchema = new Schema<IFbReplyLog>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "FbConversation",
      required: true,
      index: true,
    },
    mid: { type: String, index: true },
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

const fbSettingsSchema = new Schema<IFbSettings>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    autoAssign: { type: Boolean, default: true },
    slaMinutes: { type: Number, default: 5 },
    returnToPoolMinutes: { type: Number, default: 15 },
  },
  { timestamps: true, versionKey: false },
);

export const FbConversation = model<IFbConversation>(
  "FbConversation",
  fbConversationSchema,
);
export const FbAssignmentLog = model<IFbAssignmentLog>(
  "FbAssignmentLog",
  fbAssignmentLogSchema,
);
export const FbReplyLog = model<IFbReplyLog>("FbReplyLog", fbReplyLogSchema);
export const FbSettings = model<IFbSettings>("FbSettings", fbSettingsSchema);

// Meta's Conversations API can take minutes to return a new message, so the chat
// merges in this short-lived copy of recent webhook messages. MongoDB deletes
// each one automatically after the TTL below. Set it higher to keep them longer.
export const FB_RECENT_MESSAGE_TTL_HOURS = 24;

const fbRecentMessageSchema = new Schema<IFbRecentMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "FbConversation",
      required: true,
      index: true,
    },
    mid: { type: String, required: true, unique: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    text: { type: String, default: "" },
    attachments: [{ type: { type: String }, name: String, url: String }],
    sentBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    myReaction: { type: String, default: null },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

fbRecentMessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: FB_RECENT_MESSAGE_TTL_HOURS * 60 * 60 },
);

export const FbRecentMessage = model<IFbRecentMessage>(
  "FbRecentMessage",
  fbRecentMessageSchema,
);