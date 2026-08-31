import { Types } from "mongoose";

export enum ReturnStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  COMPLETED = "COMPLETED",
  PROCESSING = "PROCESSING",
  CANCELLED = "CANCELLED",
}

export enum ReturnType {
  FULL = "FULL",
  PARTIAL = "PARTIAL",
}

export enum ReturnReason {
  CUSTOMER_REFUSED = "CUSTOMER_REFUSED",
  DAMAGED = "DAMAGED",
  WRONG_PRODUCT = "WRONG_PRODUCT",
  EXCHANGE = "EXCHANGE",
  COURIER_RETURN = "COURIER_RETURN",
  ADDRESS_ISSUE = "ADDRESS_ISSUE",
  DUPLICATE_ORDER = "DUPLICATE_ORDER",
  OTHER = "OTHER",
}

export enum RefundStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING = "PENDING",
  REFUNDED = "REFUNDED",
  PROCESSED = "PROCESSED",
}

export interface IReturnedProduct {
  product: Types.ObjectId;
  quantity: number;

  orderedQuantity: number;

  buyingPrice?: number;
  sellingPrice?: number;

  reason: ReturnReason;

  shouldRestock: boolean;
  isDamaged: boolean;

  restockCount: number;

  notes?: string;
}

export interface IReturnParcel {
  order: Types.ObjectId;

  customer?: Types.ObjectId;

  seller?: Types.ObjectId;
  customerInfo?: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  courier?: Types.ObjectId;

  returnedProducts: IReturnedProduct[];

  returnType: ReturnType;

  returnStatus: ReturnStatus;

  refundAmount: number;

  refundStatus: RefundStatus;

  processedBy: Types.ObjectId;
  pickupDate?: Date;
  notes?: string;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}
