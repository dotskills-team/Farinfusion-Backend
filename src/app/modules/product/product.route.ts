import express from "express";
import { Role } from "../user/user.interface";
import { multerUpload } from "../../config/multer.config";
import { checkAuth } from "../../middlewares/checkAuth";
// import { validateRequest } from "../../middlewares/validateRequest";
import { ProductControllers } from "./product.controller";
// import {
//   createProductZodSchema,
//   updateProductZodSchema,
// } from "./product.validation";

const router = express.Router();

router.post(
  "/create-product",
  checkAuth(...Object.values(Role)),
  multerUpload.none(),
  // validateRequest(createProductZodSchema),
  ProductControllers.createProduct,
);

router.post(
  "/assign-missing-barcodes",
  checkAuth(...Object.values(Role)),
  ProductControllers.assignMissingBarcodes,
);

router.get("/all-products", ProductControllers.getAllProducts);
router.get("/ranked-low-stock", ProductControllers.getRankedLowStockProducts);
router.get("/all-trash-products", ProductControllers.getAllTrashProducts);
router.get("/:slug", ProductControllers.getSingleProduct);
router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.MANAGER),
  ProductControllers.deleteProduct,
);
router.patch(
  "/:id/toggle-featured",
   checkAuth(...Object.values(Role)),
  ProductControllers.toggleFeatured,
);

router.patch(
  "/:id",
 checkAuth(...Object.values(Role)),
  multerUpload.none(),
  // validateRequest(updateProductZodSchema),
  ProductControllers.updateProduct,
);

// trash update
router.post(
  "/product-trash/:id",
  checkAuth(Role.ADMIN, Role.MANAGER),
  ProductControllers.updateProductTrash,
);
export const productRoutes = router;
