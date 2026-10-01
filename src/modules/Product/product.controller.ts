import type { Response } from "express";
import { deleteCloudinaryImages, uploadImageBuffer } from "../../app/config/cloudinary";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { productService } from "./product.service";
import type {
  CreateProductInput,
  ProductIdParam,
  ProductListQuery,
  UpdateProductInput,
} from "./product.validation";

const createProduct = async (
  req: ValidatedRequest<CreateProductInput>,
  res: Response,
): Promise<void> => {
  const files = Array.isArray(req.files) ? req.files : [];
  const uploaded =
    files.length === 0
      ? []
      : await Promise.all(files.map((file) => uploadImageBuffer(file.buffer, "ecommerce/products")));

  try {
    const product = await productService.createProduct(
      req.validatedBody,
      uploaded.map((image) => ({
        url: image.url,
        alt: req.validatedBody.name,
      })),
    );

    res.status(201).json({
      success: true,
      message: "Product created",
      data: product,
    });
  } catch (error) {
    await deleteCloudinaryImages(uploaded.map((image) => image.publicId));
    throw error;
  }
};

const getAllProducts = async (
  req: ValidatedRequest<unknown, Record<string, string>, ProductListQuery>,
  res: Response,
): Promise<void> => {
  const result = await productService.getAllProducts(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Products fetched",
    data: result.items,
    meta: result.meta,
  });
};

const getSingleProduct = async (
  req: ValidatedRequest<unknown, ProductIdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.validatedParams;
  const product = await productService.getSingleProduct(id);

  res.status(200).json({
    success: true,
    message: "Product fetched",
    data: product,
  });
};

const updateProduct = async (
  req: ValidatedRequest<UpdateProductInput, ProductIdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.validatedParams;
  const product = await productService.updateProduct(id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Product updated",
    data: product,
  });
};

const deleteProduct = async (
  req: ValidatedRequest<unknown, ProductIdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.validatedParams;
  await productService.deleteProduct(id);

  res.status(200).json({
    success: true,
    message: "Product deleted",
  });
};

export const productController = {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
};
