import { Types } from "mongoose";

export enum FbConvStatus {
  UNASSIGNED = "UNASSIGNED",
  OPEN = "OPEN",
  CONVERTED = "CONVERTED",
  CLOSED = "CLOSED",
}

export enum FbAssignType {
  AUTO = "AUTO",
  MANUAL = "MANUAL",
  TRANSFER = "TRANSFER",
  CLAIM = "CLAIM",
  RELEASE = "RELEASE",
  SLA = "SLA",
}

export interface IFbConversation {
  _id?: Types.ObjectId;
  psid: string;
  fbThreadId?: string;
  customerName: string;
  profilePic?: string;
  lastMid?: string;
  lastMessageAt: Date;
  lastCustomerMessageAt?: Date;
  awaitingReplySince?: Date | null;
  slaNotified?: boolean;
  unreadCount: number;
  status: FbConvStatus;
  assignedTo?: Types.ObjectId | null;
  assignedAt?: Date | null;
  lead?: Types.ObjectId | null;
}

export interface IFbAssignmentLog {
  _id?: Types.ObjectId;
  conversation: Types.ObjectId;
  from?: Types.ObjectId | null;
  to?: Types.ObjectId | null;
  by?: Types.ObjectId | null;
  type: FbAssignType;
  note?: string;
}

// Message text save hoy na, shudhu kon moderator reply korlo seta (report + "ke pathalo" dekhar jonno)
export interface IFbReplyLog {
  _id?: Types.ObjectId;
  conversation: Types.ObjectId;
  mid: string;
  sentBy: Types.ObjectId;
}

export interface IFbSettings {
  key: string;
  autoAssign: boolean;
  slaMinutes: number;
  returnToPoolMinutes: number;
}