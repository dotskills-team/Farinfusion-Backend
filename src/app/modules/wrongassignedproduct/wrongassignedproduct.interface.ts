import { Types } from "mongoose";

export enum WrongProductStatus {
  OUTSIDE = "OUTSIDE", // product is still outside (with the courier or the customer)
  IN_WAREHOUSE = "IN_WAREHOUSE", // product has come back to the warehouse via a return
}

export interface IWrongAssignedProduct {
  _id?: Types.ObjectId;

  order: Types.ObjectId;
  orderNumber: string; // snapshot of order.customOrderId

  wrongProduct: Types.ObjectId; // the product that was sent by mistake
  intendedProduct: Types.ObjectId; // the product that should have been sent (what the customer ordered)
  quantity: number;

  status: WrongProductStatus;

  returnParcel?: Types.ObjectId; // the return parcel this record was matched with
  receivedAt?: Date;
  receivedBy?: Types.ObjectId;

  reportedBy: Types.ObjectId;
  notes?: string;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}