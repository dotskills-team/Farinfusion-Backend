import { Router } from "express";
// NOTE: adjust the three imports below (paths and Role names) to match your existing return.route.ts
import { checkAuth } from "../../middlewares/checkAuth";
import { validateRequest } from "../../middlewares/validateRequest";
import { Role } from "../user/user.interface";
import { WrongAssignedProductValidations } from "./wrongassignedproduct.validation";
import { WrongAssignedProductControllers } from "./wrongassignedproduct.controller";

const router = Router();

router.post(
  "/",
  checkAuth( Role.ADMIN, Role.MANAGER, Role.MODERATOR, Role.TELESALES),
  validateRequest(
    WrongAssignedProductValidations.createWrongAssignedProductValidationSchema,
  ),
  WrongAssignedProductControllers.createWrongAssignedProduct,
);

router.get(
  "/",
  checkAuth( Role.ADMIN, Role.MANAGER, Role.MODERATOR, Role.TELESALES),
  WrongAssignedProductControllers.getAllWrongAssignedProducts,
);

router.get(
  "/:id",
  checkAuth( Role.ADMIN, Role.MANAGER, Role.MODERATOR, Role.TELESALES),
  WrongAssignedProductControllers.getSingleWrongAssignedProduct,
);

router.patch(
  "/:id",
  checkAuth( Role.ADMIN, Role.MANAGER),
  validateRequest(
    WrongAssignedProductValidations.updateWrongAssignedProductValidationSchema,
  ),
  WrongAssignedProductControllers.updateWrongAssignedProduct,
);

router.delete(
  "/:id",
  checkAuth( Role.ADMIN),
  WrongAssignedProductControllers.deleteWrongAssignedProduct,
);

export const WrongAssignedProductRoutes = router;