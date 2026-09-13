/**
 * schema-metadata.ts
 *
 * Controlled, human-curated description of every collection Gemini is
 * allowed to know about and query through `query_database`.
 *
 * This is intentionally NOT auto-generated from Mongoose schemas at runtime:
 * we want a human-reviewed allowlist of collections/fields, so that a schema
 * change in the app never silently exposes a new sensitive field to the AI.
 *
 * Every logical `key` below maps 1:1 to an entry in `COLLECTION_MODEL_MAP`
 * (see query-executor.ts) and to the actual Mongoose model that backs it.
 */

export interface FieldMeta {
  name: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "objectId"
    | "array"
    | "object";
  description: string;
  /** For enum-like fields, the allowed values (helps Gemini build correct filters). */
  enumValues?: string[];
  /** If this field is a reference, which logical collection key it points to. */
  ref?: string;
}

export interface CollectionMeta {
  /** Logical name exposed to Gemini (used as `collection` in query_database). */
  key: string;
  description: string;
  fields: FieldMeta[];
  /** Fields that exist on the model but are NEVER returned to the AI. */
  blockedFields: string[];
  /** Free-text notes about relationships / business meaning, shown to Gemini. */
  notes?: string;
}

export const schemaMetadata: Record<string, CollectionMeta> = {
  orders: {
    key: "orders",
    description:
      "Customer orders, both online storefront orders and POS orders logged in the main order flow. This is the primary source for revenue, sales counts, order status, delivery status, and cancellations.",
    fields: [
      { name: "_id", type: "objectId", description: "Order id." },
      {
        name: "customOrderId",
        type: "string",
        description: "Human-readable order number.",
      },
      {
        name: "orderType",
        type: "string",
        description: "Where the order was placed.",
        enumValues: ["POS", "ONLINE"],
      },
      {
        name: "customer",
        type: "objectId",
        description: "The customer who placed the order.",
        ref: "users",
      },
      {
        name: "billingDetails",
        type: "object",
        description: "fullName, phone, email, address of the buyer.",
      },
      {
        name: "products",
        type: "array",
        description:
          "Line items: { product (ref products), title, quantity, reservedQuantity, pendingQuantity, isWaitingStock, fulfilledAt, price }.",
      },
      {
        name: "subtotal",
        type: "number",
        description: "Sum of line item prices before shipping/discount.",
      },
      {
        name: "shippingCost",
        type: "number",
        description: "Shipping/delivery fee charged.",
      },
      {
        name: "discount",
        type: "number",
        description: "Discount amount applied to the order.",
      },
      {
        name: "total",
        type: "number",
        description:
          "Final order amount. Use this field (not subtotal) when the admin asks about 'revenue' or 'total sales'.",
      },
      {
        name: "orderStatus",
        type: "string",
        description: "Business status of the order.",
        enumValues: [
          "PENDING",
          "RESPONDED",
          "COMPLETED",
          "WAITING_FOR_STOCK",
          "CONFIRMED",
          "PARTIAL",
          "PROCESSING",
          "SHIPPED",
          "DELIVERED",
          "CANCELLED",
          "DAMAGE",
          "NO_RESPONSE",
        ],
      },
      {
        name: "deliveryStatus",
        type: "string",
        description: "Courier/delivery pipeline status.",
        enumValues: [
          "PENDING",
          "PICKED_UP",
          "HOLD",
          "PARTIAL",
          "COURIERASSIGNED",
          "NOT_SHIPPED",
          "IN_TRANSIT",
          "DELIVERED",
          "RETURNED",
          "CANCELLED",
          "IN_REVIEW",
        ],
      },
      {
        name: "payment",
        type: "string",
        description: "Free-text payment note/method captured on the order.",
      },
      {
        name: "transactionId",
        type: "string",
        description: "Payment transaction reference.",
      },
      {
        name: "courierName",
        type: "string",
        description: "Courier assigned to ship this order.",
      },
      {
        name: "trackingNumber",
        type: "string",
        description: "Courier tracking number.",
      },
      {
        name: "returnCount",
        type: "number",
        description: "How many times items on this order were returned.",
      },
      {
        name: "totalReturnedQuantity",
        type: "number",
        description: "Total quantity returned across this order.",
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag. Normally filter isDeleted: false.",
      },
      {
        name: "isPublished",
        type: "boolean",
        description: "Whether the order is visible/active.",
      },
      {
        name: "seller",
        type: "objectId",
        description: "Staff user who created/owns this order.",
        ref: "users",
      },
      {
        name: "confirmedBy",
        type: "objectId",
        description: "Staff user who confirmed the order.",
        ref: "users",
      },
      {
        name: "confirmedAt",
        type: "date",
        description: "When the order was confirmed.",
      },
      {
        name: "deliveredAt",
        type: "date",
        description: "When the order was delivered.",
      },
      {
        name: "cancelledAt",
        type: "date",
        description: "When the order was cancelled.",
      },
      {
        name: "createdAt",
        type: "date",
        description:
          "Order creation timestamp. Use this for 'this month' / 'last month' / date-range questions.",
      },
      { name: "updatedAt", type: "date", description: "Last update time." },
    ],
    blockedFields: [],
    notes:
      "orders.products.product references products._id. orders.customer references users._id. Revenue questions should sum `total` (or `subtotal` if explicitly asked pre-discount/shipping) over matching orders, typically excluding CANCELLED orders unless the admin asks about cancellations specifically.",
  },

  products: {
    key: "products",
    description:
      "Product catalog: pricing, stock, sales counters, ratings. Source of truth for 'best selling', 'out of stock', 'top products' questions.",
    fields: [
      { name: "_id", type: "objectId", description: "Product id." },
      { name: "title", type: "string", description: "Product name." },
      { name: "slug", type: "string", description: "URL slug." },
      {
        name: "brand",
        type: "objectId",
        description: "Brand this product belongs to.",
        ref: "brands",
      },
      {
        name: "category",
        type: "objectId",
        description: "Category this product belongs to.",
        ref: "categories",
      },
      { name: "size", type: "string", description: "Size variant, if any." },
      { name: "price", type: "number", description: "Selling price." },
      {
        name: "discountPrice",
        type: "number",
        description: "Discounted price, if any.",
      },
      {
        name: "buyingPrice",
        type: "number",
        description: "Cost price / purchase price (for margin analysis).",
      },
      {
        name: "totalSold",
        type: "number",
        description:
          "Running total quantity sold. Use for 'best selling product' questions.",
      },
      {
        name: "availableStock",
        type: "number",
        description:
          "Current stock on hand. Use for 'out of stock' / 'low stock' questions (e.g. availableStock <= 0 or < 10).",
      },
      {
        name: "totalAddedStock",
        type: "number",
        description: "Cumulative stock ever added.",
      },
      {
        name: "totalReturned",
        type: "number",
        description: "Cumulative quantity returned.",
      },
      {
        name: "restockCount",
        type: "number",
        description: "How many times this product has been restocked.",
      },
      {
        name: "status",
        type: "string",
        description: "Product status.",
        enumValues: ["ACTIVE", "INACTIVE"],
      },
      {
        name: "isFeatured",
        type: "boolean",
        description: "Whether featured on storefront.",
      },
      {
        name: "isBestSelling",
        type: "boolean",
        description: "Manually/derived best-selling flag.",
      },
      {
        name: "isCusFavorite",
        type: "boolean",
        description: "Customer-favorite flag.",
      },
      {
        name: "ratings",
        type: "number",
        description: "Average rating.",
      },
      {
        name: "barcode",
        type: "string",
        description: "Barcode used for POS scanning.",
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag. Normally filter isDeleted: false.",
      },
      {
        name: "createdAt",
        type: "date",
        description: "When the product was created.",
      },
    ],
    blockedFields: ["reviews"],
    notes:
      "products.brand references brands._id, products.category references categories._id. `reviews` is embedded raw review text and is excluded from AI queries — use the `reviews` collection info in orders/products aggregate counts instead if needed, or the dedicated review collection metadata below is for the separate Review model.",
  },

  categories: {
    key: "categories",
    description: "Product categories.",
    fields: [
      { name: "_id", type: "objectId", description: "Category id." },
      { name: "title", type: "string", description: "Category name." },
      { name: "slug", type: "string", description: "URL slug." },
      {
        name: "status",
        type: "string",
        description: "Category status.",
        enumValues: ["ACTIVE", "INACTIVE"],
      },
      {
        name: "productCount",
        type: "number",
        description: "Cached count of products in this category.",
      },
      {
        name: "showOrder",
        type: "number",
        description: "Display order on storefront.",
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: [],
    notes:
      "'Which category generated the most revenue' requires joining orders.products.product -> products.category -> categories, typically via an aggregate pipeline with $lookup.",
  },

  brands: {
    key: "brands",
    description: "Product brands.",
    fields: [
      { name: "_id", type: "objectId", description: "Brand id." },
      { name: "title", type: "string", description: "Brand name." },
      { name: "slug", type: "string", description: "URL slug." },
      {
        name: "status",
        type: "string",
        description: "Brand status.",
        enumValues: ["ACTIVE", "INACTIVE"],
      },
      {
        name: "productCount",
        type: "number",
        description: "Cached count of products for this brand.",
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: [],
  },

  users: {
    key: "users",
    description:
      "Staff and customer accounts. Use for headcount, role breakdowns, and staff/customer lookups. NEVER return password or auth-related fields.",
    fields: [
      { name: "_id", type: "objectId", description: "User id." },
      { name: "name", type: "string", description: "Full name." },
      { name: "email", type: "string", description: "Email address." },
      { name: "phone", type: "string", description: "Phone number." },
      { name: "address", type: "string", description: "Address." },
      {
        name: "role",
        type: "string",
        description: "Account role.",
        enumValues: [
          "ADMIN",
          "MANAGER",
          "MODERATOR",
          "TELESALES",
          "CUSTOMER",
          "GENERALSTAFF",
        ],
      },
      {
        name: "isActive",
        type: "string",
        description: "Account status.",
        enumValues: ["ACTIVE", "INACTIVE", "BLOCKED"],
      },
      {
        name: "isVerified",
        type: "boolean",
        description: "Whether email/account is verified.",
      },
      {
        name: "salary",
        type: "number",
        description: "Base salary (staff only).",
      },
      {
        name: "commissionSalary",
        type: "number",
        description: "Commission-based pay (staff only).",
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      {
        name: "createdAt",
        type: "date",
        description: "Account creation time.",
      },
    ],
    blockedFields: ["password"],
    notes:
      "Customers are users with role CUSTOMER. Staff are the other roles. `password` is a hash and must never be selected or returned under any circumstances.",
  },

  payments: {
    key: "payments",
    description:
      "Payment transactions tied to orders. Use for payment-status/payment-method breakdowns rather than order.payment free text when precision matters.",
    fields: [
      {
        name: "_id",
        type: "objectId",
        description: "Payment id.",
      },
      {
        name: "order",
        type: "objectId",
        description: "The order this payment belongs to.",
        ref: "orders",
      },
      {
        name: "paymentMethod",
        type: "string",
        description: "How the customer paid.",
        enumValues: ["COD", "STRIPE"],
      },
      {
        name: "paymentStatus",
        type: "string",
        description: "Payment state.",
        enumValues: ["UNPAID", "PAID", "FAILED"],
      },
      {
        name: "transactionId",
        type: "string",
        description: "Gateway transaction id.",
      },
      { name: "amount", type: "number", description: "Amount paid." },
      {
        name: "createdAt",
        type: "date",
        description: "When the payment record was created.",
      },
    ],
    blockedFields: ["invoiceUrl", "checkoutUrl"],
  },

  coupons: {
    key: "coupons",
    description: "Discount coupons.",
    fields: [
      { name: "_id", type: "objectId", description: "Coupon id." },
      { name: "code", type: "string", description: "Coupon code." },
      {
        name: "discountType",
        type: "string",
        description: "Type of discount.",
        enumValues: ["PERCENT", "FIXED"],
      },
      {
        name: "discountValue",
        type: "number",
        description: "Discount amount/percent.",
      },
      {
        name: "minOrderAmount",
        type: "number",
        description: "Minimum order amount required.",
      },
      {
        name: "maxDiscount",
        type: "number",
        description: "Discount cap.",
      },
      {
        name: "expiryDate",
        type: "date",
        description: "When the coupon expires.",
      },
      {
        name: "usageLimit",
        type: "number",
        description: "Max number of times it can be used.",
      },
      {
        name: "usedCount",
        type: "number",
        description: "How many times it has been used.",
      },
      {
        name: "isActive",
        type: "boolean",
        description: "Whether the coupon is currently active.",
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
    ],
    blockedFields: [],
  },

  returns: {
    key: "returns",
    description:
      "Return/exchange parcels raised against orders — use for return-rate and refund questions.",
    fields: [
      { name: "_id", type: "objectId", description: "Return id." },
      {
        name: "order",
        type: "objectId",
        description: "Order being returned against.",
        ref: "orders",
      },
      {
        name: "customer",
        type: "objectId",
        description: "Customer who returned.",
        ref: "users",
      },
      {
        name: "returnedProducts",
        type: "array",
        description:
          "Line items: { product (ref products), quantity, orderedQuantity, buyingPrice, sellingPrice, reason, isDamaged }.",
      },
      {
        name: "returnType",
        type: "string",
        description: "Scope of the return.",
        enumValues: ["FULL", "PARTIAL"],
      },
      {
        name: "returnStatus",
        type: "string",
        description: "Processing status.",
        enumValues: [
          "PENDING",
          "APPROVED",
          "COMPLETED",
          "PROCESSING",
          "CANCELLED",
        ],
      },
      {
        name: "refundAmount",
        type: "number",
        description: "Amount refunded.",
      },
      {
        name: "refundStatus",
        type: "string",
        description: "Refund state.",
        enumValues: ["NOT_REQUIRED", "PENDING", "REFUNDED", "PROCESSED"],
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: ["customerInfo"],
  },

  pos_orders: {
    key: "pos_orders",
    description:
      "In-store POS orders (separate from the online `orders` collection, though some POS activity also flows into `orders` when orderType is POS — check both when the admin asks about in-store sales).",
    fields: [
      { name: "_id", type: "objectId", description: "POS order id." },
      {
        name: "products",
        type: "array",
        description: "{ product (ref products), quantity, price }.",
      },
      {
        name: "orderType",
        type: "string",
        description: "Fulfillment type.",
        enumValues: ["PICKUP", "DELIVERY"],
      },
      { name: "subtotal", type: "number", description: "Pre-fee amount." },
      { name: "tax", type: "number", description: "Tax charged." },
      {
        name: "deliveryFee",
        type: "number",
        description: "Delivery fee charged.",
      },
      { name: "total", type: "number", description: "Final total." },
      {
        name: "status",
        type: "string",
        description: "Order status.",
        enumValues: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"],
      },
      {
        name: "createdBy",
        type: "objectId",
        description: "Staff who created the POS order.",
        ref: "users",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: [],
  },

  reviews: {
    key: "reviews",
    description: "Product reviews (separate moderated review collection).",
    fields: [
      { name: "_id", type: "objectId", description: "Review id." },
      {
        name: "product",
        type: "objectId",
        description: "Product being reviewed.",
        ref: "products",
      },
      {
        name: "order",
        type: "objectId",
        description: "Order tied to the review, if any.",
        ref: "orders",
      },
      {
        name: "customerName",
        type: "string",
        description: "Reviewer display name.",
      },
      { name: "rating", type: "number", description: "1-5 rating." },
      {
        name: "reviewText",
        type: "string",
        description: "Review body text.",
      },
      {
        name: "reviewSource",
        type: "string",
        description: "Where the review came from.",
        enumValues: ["FACEBOOK", "WEBSITE"],
      },
      {
        name: "status",
        type: "string",
        description: "Moderation status.",
        enumValues: ["PENDING", "APPROVED", "REJECTED"],
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: [],
  },

  leads: {
    key: "leads",
    description: "Sales leads captured before/around an order (telesales/CRM).",
    fields: [
      { name: "_id", type: "objectId", description: "Lead id." },
      { name: "name", type: "string", description: "Lead's name." },
      { name: "phone", type: "string", description: "Lead's phone." },
      {
        name: "hasOrderedToday",
        type: "boolean",
        description: "Whether they already ordered today.",
      },
      {
        name: "fraudProfile",
        type: "object",
        description:
          "{ totalOrders, deliveredOrders, cancelledOrders, successRate, cancelRate, risk, isFakeCustomer }.",
      },
      {
        name: "status",
        type: "string",
        description: "Lead pipeline status.",
        enumValues: [
          "NEW",
          "CONTACTED",
          "QUALIFIED",
          "WON",
          "LOST",
          "INACTIVE",
        ],
      },
      {
        name: "priority",
        type: "string",
        description: "Lead priority.",
        enumValues: ["LOW", "MEDIUM", "HIGH"],
      },
      {
        name: "assignedBy",
        type: "objectId",
        description: "Staff user assigned to this lead.",
        ref: "users",
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: [],
  },

  couriers: {
    key: "couriers",
    description: "Per-order courier consignment records and their live status.",
    fields: [
      { name: "_id", type: "objectId", description: "Courier record id." },
      {
        name: "order",
        type: "objectId",
        description: "Order this shipment belongs to.",
        ref: "orders",
      },
      {
        name: "courierName",
        type: "string",
        description: "Courier provider used.",
        enumValues: ["STEADFAST", "PATHAO", "REDX", "PAPERFLY"],
      },
      {
        name: "trackingCode",
        type: "string",
        description: "Tracking code.",
      },
      {
        name: "status",
        type: "string",
        description: "Consignment status.",
        enumValues: [
          "PENDING",
          "CREATED",
          "DELIVERED",
          "IN_TRANSIT",
          "CANCELLED",
          "FAILED",
        ],
      },
      {
        name: "deliveryStatus",
        type: "string",
        description: "Delivery-side status.",
        enumValues: [
          "PENDING",
          "IN_TRANSIT",
          "PARTIAL",
          "PICKED_UP",
          "IN_REVIEW",
          "DELIVERED",
          "PARTIAL_DELIVERED",
          "CANCELLED",
          "HOLD",
        ],
      },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: ["rawResponse", "consignmentId"],
  },

  courier_settings: {
    key: "courier_settings",
    description:
      "Courier provider configuration (which providers are active, pickup info). Credentials and webhook URLs are never exposed.",
    fields: [
      { name: "_id", type: "objectId", description: "Settings id." },
      {
        name: "provider",
        type: "string",
        description: "Courier provider.",
        enumValues: [
          "STEADFAST",
          "PAPERFLY",
          "PATHAO",
          "REDX",
          "ECOURIER",
          "SUNDARBAN",
          "CUSTOM",
        ],
      },
      {
        name: "displayName",
        type: "string",
        description: "Human-readable name.",
      },
      {
        name: "isActive",
        type: "boolean",
        description: "Whether this provider is enabled.",
      },
      {
        name: "isSandbox",
        type: "boolean",
        description: "Whether running in sandbox/test mode.",
      },
    ],
    blockedFields: ["config", "webhookUrl", "pickupInfo", "notes"],
    notes:
      "This collection intentionally exposes almost nothing — it holds integration credentials (`config`) that must never reach the AI, even for an admin asking through natural language.",
  },

  product_blogs: {
    key: "product_blogs",
    description: "Marketing/content blog posts about products.",
    fields: [
      { name: "_id", type: "objectId", description: "Blog post id." },
      { name: "title", type: "string", description: "Post title." },
      { name: "category", type: "string", description: "Blog category." },
      {
        name: "contentType",
        type: "string",
        description: "Article or video.",
      },
      { name: "featured", type: "boolean", description: "Featured flag." },
      { name: "views", type: "number", description: "View count." },
      { name: "status", type: "string", description: "Publish status." },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: ["content"],
  },

  product_verifications: {
    key: "product_verifications",
    description:
      "Product authenticity/verification media posts (videos/photos proving genuine products).",
    fields: [
      { name: "_id", type: "objectId", description: "Verification id." },
      { name: "title", type: "string", description: "Title." },
      {
        name: "product",
        type: "objectId",
        description: "Product being verified.",
        ref: "products",
      },
      { name: "category", type: "string", description: "Category." },
      { name: "mediaType", type: "string", description: "Video or image." },
      { name: "featured", type: "boolean", description: "Featured flag." },
      { name: "views", type: "number", description: "View count." },
      { name: "status", type: "string", description: "Publish status." },
      {
        name: "isDeleted",
        type: "boolean",
        description: "Soft-delete flag.",
      },
      { name: "createdAt", type: "date", description: "Creation time." },
    ],
    blockedFields: [],
  },

  permissions: {
    key: "permissions",
    description: "Named permission entries used to build staff access control.",
    fields: [
      { name: "_id", type: "objectId", description: "Permission id." },
      { name: "title", type: "string", description: "Permission title." },
      { name: "url", type: "string", description: "Associated route/url." },
      { name: "group", type: "string", description: "Permission group." },
    ],
    blockedFields: [],
  },
};

/** Convenience list of every collection key Gemini is told about. */
export const ALLOWED_COLLECTION_KEYS = Object.keys(schemaMetadata);

/**
 * Renders a compact text block describing the schema for injection into the
 * Gemini system prompt. Kept deliberately terse to save tokens.
 */
export function renderSchemaForPrompt(): string {
  return ALLOWED_COLLECTION_KEYS.map((key) => {
    const meta = schemaMetadata[key];
    const fieldLines = meta.fields
      .map((f) => {
        const enumPart = f.enumValues ? ` [${f.enumValues.join("|")}]` : "";
        const refPart = f.ref ? ` (ref: ${f.ref})` : "";
        return `    - ${f.name}: ${f.type}${enumPart}${refPart} — ${f.description}`;
      })
      .join("\n");

    return `Collection "${key}": ${meta.description}\n${fieldLines}${
      meta.notes ? `\n  Notes: ${meta.notes}` : ""
    }`;
  }).join("\n\n");
}
