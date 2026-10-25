import { z } from "zod";
import { WrongProductStatus } from "./wrongassignedproduct.interface";

const createWrongAssignedProductValidationSchema = z.object({
  body: z.object({
    order: z.string({
      required_error: "Order is required",
    }),

    wrongProduct: z.string({
      required_error: "Wrong product is required",
    }),

    intendedProduct: z.string({
      required_error: "Intended product is required",
    }),

    quantity: z.number().min(1).optional(),

    notes: z.string().optional(),
  }),
});

const updateWrongAssignedProductValidationSchema = z.object({
  body: z.object({
    status: z.nativeEnum(WrongProductStatus).optional(),
    notes: z.string().optional(),
  }),
});

export const WrongAssignedProductValidations = {
  createWrongAssignedProductValidationSchema,
  updateWrongAssignedProductValidationSchema,
};