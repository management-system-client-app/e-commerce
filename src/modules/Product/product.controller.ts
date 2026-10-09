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
      : await Promise.all(
          files.map((file) => uploadImageBuffer(file.buffer, "ecommerce/products", file.mimetype, file.originalname)),
        );

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

const getBestSellers = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const products = await productService.getBestSellers();

  res.status(200).json({
    success: true,
    message: "Best sellers fetched",
    data: products,
  });
};

const getRelatedProducts = async (
  req: ValidatedRequest<unknown, ProductIdParam>,
  res: Response,
): Promise<void> => {
  const products = await productService.getRelatedProducts(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Related products fetched",
    data: products,
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
  const files = Array.isArray(req.files) ? req.files : [];
  const uploaded =
    files.length === 0
      ? []
      : await Promise.all(
          files.map((file) => uploadImageBuffer(file.buffer, "ecommerce/products", file.mimetype, file.originalname)),
        );

  let product;
  try {
    product = await productService.updateProduct(
      id,
      req.validatedBody,
      uploaded.map((image) => ({ url: image.url, alt: req.validatedBody.name ?? "" })),
    );
  } catch (error) {
    await deleteCloudinaryImages(uploaded.map((image) => image.publicId));
    throw error;
  }

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
  const result = await productService.deleteProduct(id);

  res.status(200).json({
    success: true,
    message: result.archived
      ? "Product archived. It stays on past orders and is hidden from the shop."
      : "Product deleted",
    data: result,
  });
};

export const productController = {
  createProduct,
  getAllProducts,
  getBestSellers,
  getRelatedProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
};
