export const wrongAssignedProductSearchableFields = ["orderNumber", "notes"];

export const wrongAssignedProductPopulateFields = [
  {
    path: "order",
    select: "customOrderId orderStatus billingDetails createdAt",
  },
  {
    path: "wrongProduct",
  },
  {
    path: "intendedProduct",
  },
  {
    path: "returnParcel",
    select: "returnStatus returnType createdAt",
  },
  {
    path: "reportedBy",
    select: "name email role",
  },
  {
    path: "receivedBy",
    select: "name email role",
  },
];