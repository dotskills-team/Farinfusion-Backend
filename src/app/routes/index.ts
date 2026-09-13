import { Router } from "express";
import { userRoutes } from "../modules/user/user.route";
import { authRoutes } from "../modules/auth/auth.route";
import { categoryRoutes } from "../modules/category/category.route";
import { brandRoutes } from "../modules/brand/brand.route";
import { productRoutes } from "../modules/product/product.route";
import { leadRoutes } from "../modules/lead/lead.route";
import { orderRoutes } from "../modules/order/order.route";
import { courierRoutes } from "../modules/courier/courier.route";
import { posRoutes } from "../modules/pos/pos.route";
import { dashboardRoutes } from "../modules/dashboard/dashboard.route";
import { couponRoutes } from "../modules/coupon/coupon.route";
import { permissionRoutes } from "../modules/permission/permission.route";
import { ProductPurchaseRoutes } from "../modules/purchase/productPurchase.route";
import { returnRoutes } from "../modules/return/return.route";
import { courierSettingsRoutes } from "../modules/courierSettings/courierSettings.route";
import { reviewRoutes } from "../modules/review/review.route";
import { ProductVerificationRoutes } from "../modules/productVerification/productVerification.route";
import { ProductBlogRoutes } from "../modules/productBlog/productBlog.route";
import { aiRoutes } from "../modules/ai/ai.route";

export const router = Router();

const moduleRoutes = [
  {
    path: "/user",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/category",
    route: categoryRoutes,
  },
  {
    path: "/product-verifications",
    route: ProductVerificationRoutes,
  },
  {
    path: "/product-blog",
    route: ProductBlogRoutes,
  },
  {
    path: "/brand",
    route: brandRoutes,
  },
  {
    path: "/product",
    route: productRoutes,
  },
  {
    path: "/returns",
    route: returnRoutes,
  },
  {
    path: "/lead",
    route: leadRoutes,
  },
  {
    path: "/order",
    route: orderRoutes,
  },
  {
    path: "/couriers",
    route: courierRoutes,
  },
  {
    path: "/coupon",
    route: couponRoutes,
  },
  {
    path: "/permission",
    route: permissionRoutes,
  },
  {
    path: "/pos",
    route: posRoutes,
  },
  {
    path: "/review",
    route: reviewRoutes,
  },
  {
    path: "/dashboard",
    route: dashboardRoutes,
  },
  {
    path: "/courier-settings",
    route: courierSettingsRoutes,
  },
  {
    path: "/product-purchase",
    route: ProductPurchaseRoutes,
  },
  {
    path: "/ai",
    route: aiRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});
