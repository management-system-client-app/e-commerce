import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { categoryService } from "./category.service";
import type {
  CategoryIdParam,
  CategoryListQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category.validation";

const createCategory = async (
  req: ValidatedRequest<CreateCategoryInput>,
  res: Response,
): Promise<void> => {
  const category = await categoryService.createCategory(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Category created",
    data: category,
  });
};

const getCategories = async (
  req: ValidatedRequest<unknown, Record<string, string>, CategoryListQuery>,
  res: Response,
): Promise<void> => {
  const result = await categoryService.getCategories(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Categories fetched",
    data: result.items,
    meta: result.meta,
  });
};

const updateCategory = async (
  req: ValidatedRequest<UpdateCategoryInput, CategoryIdParam>,
  res: Response,
): Promise<void> => {
  const category = await categoryService.updateCategory(req.validatedParams.id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Category updated",
    data: category,
  });
};

const deleteCategory = async (
  req: ValidatedRequest<unknown, CategoryIdParam>,
  res: Response,
): Promise<void> => {
  await categoryService.deleteCategory(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Category deleted",
  });
};

export const categoryController = {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
};
