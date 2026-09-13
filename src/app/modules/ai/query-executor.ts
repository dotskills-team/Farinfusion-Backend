/**
 * query-executor.ts — Stage 6: Real MongoDB Query Executor
 *
 * Takes an ALREADY VALIDATED query (see query-validator.ts) and runs it
 * against the real database using the app's existing Mongoose models —
 * never a raw driver connection, and never anything Gemini touches directly.
 *
 * Using the existing Mongoose models (instead of `db.collection(name)`)
 * means every one of the app's own schema-level protections (casting,
 * `select: false`-style guards if added later, etc.) still applies on top
 * of the query-validator's allowlist.
 */

import { Model, PipelineStage } from "mongoose";
import { ParsedQueryDatabaseArgs } from "./ai.interface";
import { QUERY_TIMEOUT_MS } from "./query-validator";

import { Order } from "../order/order.model";
import { Product } from "../product/product.model";
import { User } from "../user/user.model";
import { Payment } from "../payment/payment.model";
import { Category } from "../category/category.model";
import { Brand } from "../brand/brand.model";
import { Coupon } from "../coupon/coupon.model";
import { ReturnParcel } from "../return/return.model";
import { POSOrder } from "../pos/pos.model";
import { Review } from "../review/review.model";
import { Lead } from "../lead/lead.model";
import { Courier } from "../courier/courier.model";
import { CourierSettings } from "../courierSettings/courierSettings.model";
import { ProductBlog } from "../productBlog/productBlog.model";
import { ProductVerification } from "../productVerification/productVerification.model";
import { Permission } from "../permission/permission.model";

/**
 * Maps each logical `collection` key (as known to Gemini via schema-metadata)
 * to the real Mongoose model backing it. Keep this in sync with
 * `schemaMetadata` in schema-metadata.ts — the validator already guarantees
 * `collection` is one of these keys before execution ever gets here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COLLECTION_MODEL_MAP: Record<string, Model<any>> = {
  orders: Order,
  products: Product,
  categories: Category,
  brands: Brand,
  users: User,
  payments: Payment,
  coupons: Coupon,
  returns: ReturnParcel,
  pos_orders: POSOrder,
  reviews: Review,
  leads: Lead,
  couriers: Courier,
  courier_settings: CourierSettings,
  product_blogs: ProductBlog,
  product_verifications: ProductVerification,
  permissions: Permission,
};

export interface ExecutionResult {
  data?: unknown;
  count?: number;
  truncated?: boolean;
}

export async function executeQuery(
  query: ParsedQueryDatabaseArgs,
): Promise<ExecutionResult> {
  const model = COLLECTION_MODEL_MAP[query.collection];
  if (!model) {
    // Should be unreachable if the validator ran first, but guard anyway.
    throw new Error(`No model registered for collection "${query.collection}".`);
  }

  const filter = query.filter ?? {};

  switch (query.operation) {
    case "count": {
      const count = await model
        .countDocuments(filter)
        .maxTimeMS(QUERY_TIMEOUT_MS);
      return { count };
    }

    case "find": {
      const limit = query.limit ?? 20;
      // Fetch one extra row to detect truncation without a second count query.
      const rows = await model
        .find(filter, query.projection)
        .limit(limit + 1)
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean();

      const truncated = rows.length > limit;
      return { data: truncated ? rows.slice(0, limit) : rows, truncated };
    }

    case "aggregate": {
      const pipeline = (query.pipeline ?? []) as unknown as PipelineStage[];
      const rows = await model
        .aggregate(pipeline)
        .option({ maxTimeMS: QUERY_TIMEOUT_MS });
      return { data: rows };
    }

    default:
      throw new Error(`Unsupported operation "${query.operation}".`);
  }
}
