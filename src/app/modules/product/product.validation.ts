import { z } from "zod";
import { ProductStatus } from "./product.interface";

// Review schema
const reviewSchema = z.object({
  user: z
    .string({ invalid_type_error: "User must be a string (ObjectId)" })
    .min(1, { message: "User is required" }),

  rating: z
    .number({ invalid_type_error: "Rating must be a number" })
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot be more than 5"),

  comment: z
    .string({ invalid_type_error: "Comment must be a string" })
    .optional(),

  date: z
    .string({ invalid_type_error: "Date must be a string" })
    .optional(),
});


// Create Product Schema
export const createProductZodSchema = z.object({
  title: z
    .string({ invalid_type_error: "Title must be a string" })
    .min(1, { message: "Title is required" }),

  brand: z
    .string({ invalid_type_error: "Brand must be a string (ObjectId)" })
    .min(1, { message: "Brand is required" }),
  isBestSelling: z.boolean().optional(),
  // category: z
  //   .string({ invalid_type_error: "Category must be a string (ObjectId)" })
  //   .min(1, { message: "Category is required" }),
  category: z
    .array(
      z
        .string({ invalid_type_error: "Category must be a string (ObjectId)" })
        .min(1, { message: "Category id cannot be empty" }),
      { invalid_type_error: "Category must be an array of ObjectIds" }
    )
    .min(1, { message: "At least one category is required" }),

  size: z
    .string({ invalid_type_error: "Size must be a string" })
    .optional(),

  slug: z
    .string({ invalid_type_error: "Slug must be a string" })
    .optional(),

  // Pricing
  price: z.preprocess(
    (val) => (typeof val === "string" ? Number(val) : val),
    z.number({ invalid_type_error: "Price must be a number" })
  ),

  discountPrice: z.preprocess(
    (val) => (typeof val === "string" ? Number(val) : val),
    z
      .number({ invalid_type_error: "Discount price must be a number" })
      .optional()
  ),

  buyingPrice: z.preprocess(
    (val) => (typeof val === "string" ? Number(val) : val),
    z
      .number({ invalid_type_error: "Buying price must be a number" })
      .optional()
  ),

  // Stock
  totalAddedStock: z.preprocess(
    (val) => (typeof val === "string" ? Number(val) : val),
    z
      .number({ invalid_type_error: "Total stock must be a number" })
      .int("Stock must be an integer")
      .nonnegative("Stock cannot be negative")
      .optional()
  ),

  totalSold: z.preprocess(
    (val) => (typeof val === "string" ? Number(val) : val),
    z
      .number({ invalid_type_error: "Total sold must be a number" })
      .int()
      .nonnegative()
      .optional()
  ),

  availableStock: z.preprocess(
    (val) => (typeof val === "string" ? Number(val) : val),
    z
      .number({ invalid_type_error: "Available stock must be a number" })
      .int()
      .nonnegative()
      .optional()
  ),

  status: z
    .enum([ProductStatus.ACTIVE, ProductStatus.INACTIVE], {
      invalid_type_error: "Status must be either ACTIVE or INACTIVE",
    })
    .optional(),
  isDeleted: z
    .boolean({ invalid_type_error: "isDeleted must be true or false" })
    .optional(),
  // Media
  // images: z
  //   .array(z.string({ invalid_type_error: "Image must be a string" })).optional(),

  // Ratings
  ratings: z
    .number({ invalid_type_error: "Ratings must be a number" })
    .min(0)
    .max(5)
    .optional(),

  reviews: z.array(reviewSchema).optional(),

  // Description
  description: z
    .string({ invalid_type_error: "Description must be a string" })
    .min(1, { message: "Description is required" }),
});


// Update Product Schema
export const updateProductZodSchema = createProductZodSchema.partial();