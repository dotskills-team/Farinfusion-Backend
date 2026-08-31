/* eslint-disable @typescript-eslint/no-unused-vars */
import httpStatus from "http-status-codes";
import { NextFunction, Request, Response } from "express";

import { CategoryServices } from "./product.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { deleteImageFromCloudinary } from "../../config/cloudinary.config";
import AppError from "../../errorHelpers/appError";
import { Product } from "./product.model";
import { CommonTrashService } from "../common/CommonTrashService";
import { JwtPayload } from "jsonwebtoken";

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body.data ? JSON.parse(req.body.data) : req.body;
  const user = req.user as JwtPayload;

  if (payload.images) {
    payload.images = Array.isArray(payload.images)
      ? payload.images
      : [payload.images];
  }

  // 🔹 Handle multiple images uploaded via multer
  // if (req.files && Array.isArray(req.files)) {
  //   payload.images = (req.files as Express.Multer.File[]).map(
  //     (file) => file.path,
  //   );
  // }

  const product = await CategoryServices.createProductService(payload, user);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product Created Successfully",
    data: product,
  });
});

const getSingleProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const productSlug = req.params.slug as string;
    const result = await CategoryServices.getSingleProduct(productSlug);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Product Retrieved Successfully",
      data: result.data,
    });
  },
);

const deleteProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id as string;
    const result = await CategoryServices.deleteProduct(productId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Product Deleted Successfully",
      data: result.data,
    });
  },
);

// const updateProduct = catchAsync(
//     async (req: Request, res: Response, next: NextFunction) => {
//         const productId = req.params.id as string;
//         const payload = req.body;
//
//         // Find existing product
//         const existingProduct = await Product.findById(productId);
//
//         if (!existingProduct) {
//             throw new AppError(httpStatus.NOT_FOUND, "Product not found");
//         }
//
//        // If new images uploaded
//     if (req.files && Array.isArray(req.files)) {
//       const newImages = (req.files as Express.Multer.File[]).map(
//         (file) => file.path
//       );
//
//       // delete old images
//       if (existingProduct.images?.length && newImages.length < 0) {
//         await Promise.all(
//           existingProduct.images.map((img) =>
//             deleteImageFromCloudinary(img)
//           )
//         );
//       }
//
//       payload.images = newImages;
//     }
//
//         const product = await CategoryServices.updateProduct(productId, payload);
//
//         sendResponse(res, {
//             statusCode: httpStatus.OK,
//             success: true,
//             message: "Product Updated Successfully",
//             data: product,
//         });
//     }
// );

const updateProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id as string;
    const user = req.user as JwtPayload;

    const payload = req.body.data ? JSON.parse(req.body.data) : req.body;
    // console.log(payload);

    const existingProduct = await Product.findById(productId);

    if (!existingProduct) {
      throw new AppError(httpStatus.NOT_FOUND, "Product not found");
    }

    if (payload.images) {
      payload.images = Array.isArray(payload.images)
        ? payload.images
        : [payload.images];
    }

    // If new images uploaded
    // if (req.files && Array.isArray(req.files)) {
    //   const newImages = (req.files as Express.Multer.File[]).map(
    //     (file) => file.path,
    //   );

    //   // delete old images
    //   if (existingProduct.images?.length && newImages.length < 0) {
    //     await Promise.all(
    //       existingProduct.images.map((img) => deleteImageFromCloudinary(img)),
    //     );
    //   }

    //   payload.images = newImages;
    // }

    const product = await CategoryServices.updateProduct(
      productId,
      payload,
      user,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Updated Successfully",
      data: product,
    });
  },
);

const toggleFeatured = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(404, "Product not found");
  }

  product.isFeatured = !product.isFeatured;
  await product.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Featured status updated",
    data: product,
  });
});

const getAllProducts = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query;
    const result = await CategoryServices.getAllProducts(
      query as Record<string, string>,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All Products Retrieved Successfully",
      data: result.data,
      meta: result.meta,
    });
  },
);

const assignMissingBarcodes = catchAsync(async (req, res) => {
  const result = await CategoryServices.assignMissingBarcodes();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Missing barcodes assigned successfully",
    data: result,
  });
});

const getAllTrashProducts = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query;
    const result = await CategoryServices.getAllTrashProducts(
      query as Record<string, string>,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All Trash Products Retrieved Successfully",
      data: result.data,
      meta: result.meta,
    });
  },
);

// trash update
const updateProductTrash = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  // @ts-expect-error
  const productData = await CommonTrashService(id, Product);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product Trash Status Updated",
    data: productData,
  });
});

const getRankedLowStockProducts = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query;
    const result = await CategoryServices.getRankedLowStockProducts(
      query as Record<string, string>,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Ranked Low Stock Products Retrieved Successfully",
      data: {
        hot: result.data.hot,
        medium: result.data.medium,
        normal: result.data.normal,
        meta: result.meta,
        stats: result.stats,
      },
    });
  },
);

export const ProductControllers = {
  createProduct,
  getSingleProduct,
  deleteProduct,
  updateProduct,
  getAllProducts,
  getAllTrashProducts,
  toggleFeatured,
  assignMissingBarcodes,
  updateProductTrash,
  getRankedLowStockProducts
};
