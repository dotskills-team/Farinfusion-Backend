import { Types } from "mongoose";

export enum PurchaseStatus {
  PENDING = "PENDING",
  ORDERED = "ORDERED",
  RECEIVED = "RECEIVED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
}

export interface IPurchaseProduct {
  product: Types.ObjectId;
  quantity: number;
  buyingPrice: number;
  totalAmount: number;
}

export enum PaymentType {
  FULL = "FULL",
  ADVANCE = "ADVANCE",
  DUE = "DUE",
}

export interface IProductPurchase {
  products: IPurchaseProduct[];

  supplierName: string;
  supplierPhone?: string;
  supplierAddress?: string;
  paidAmount?: number;
  dueAmount?: number;

  paymentType?: PaymentType;
  paymentMethod?: string;

  grandTotal?: number;
  paymentInfo: {
    paymentType: "FULL" | "ADVANCE" | "DUE";
    paidAmount: number;
    dueAmount: number;
    paymentMethod?: string;
  };
  purchaseDate: Date;

  paymentStatus: PaymentStatus;
  purchaseStatus: PurchaseStatus;

  invoiceNo?: string;
  reference?: string;
  notes?: string;

  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  isDeleted: boolean;
}
