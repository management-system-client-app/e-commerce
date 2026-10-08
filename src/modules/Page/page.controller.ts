import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { pageService } from "./page.service";
import type { PageSlugParam, UpsertPageInput } from "./page.validation";

const getPages = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const pages = await pageService.getPages();

  res.status(200).json({
    success: true,
    message: "Pages fetched",
    data: pages,
  });
};

const getAllPages = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const pages = await pageService.getAllPages();

  res.status(200).json({
    success: true,
    message: "Pages fetched",
    data: pages,
  });
};

const getPage = async (
  req: ValidatedRequest<unknown, PageSlugParam>,
  res: Response,
): Promise<void> => {
  const page = await pageService.getPage(req.validatedParams.slug);

  res.status(200).json({
    success: true,
    message: "Page fetched",
    data: page,
  });
};

const upsertPage = async (
  req: ValidatedRequest<UpsertPageInput, PageSlugParam>,
  res: Response,
): Promise<void> => {
  const page = await pageService.upsertPage(req.validatedParams.slug, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Page saved",
    data: page,
  });
};

const deletePage = async (
  req: ValidatedRequest<unknown, PageSlugParam>,
  res: Response,
): Promise<void> => {
  await pageService.deletePage(req.validatedParams.slug);

  res.status(200).json({
    success: true,
    message: "Page deleted",
  });
};

export const pageController = {
  getPages,
  getAllPages,
  getPage,
  upsertPage,
  deletePage,
};
