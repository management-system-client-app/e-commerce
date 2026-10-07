import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { categoryService } from "./category.service";
import type { CategoryListQuery, CreateCategoryInput } from "./category.validation";

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

export const categoryController = {
  createCategory,
  getCategories,
};
