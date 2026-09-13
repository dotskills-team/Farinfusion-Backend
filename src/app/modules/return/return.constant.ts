export const returnSearchableFields = [
  "notes",
  "returnStatus",
  "refundStatus",
  "returnType",
  "order.customOrderId"
];

export const returnPopulateFields = [
  {
    path: "order",
  },
  {
    path: "customer",
    select: "name email phone role",
  },
  {
    path: "seller",
    select: "name email phone role",
  },
  {
    path: "courier",
  },
  {
    path: "processedBy",
    select: "name email role",
  },
  {
    path: "returnedProducts.product",
  },
];