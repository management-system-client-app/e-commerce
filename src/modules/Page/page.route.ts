import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { pageController } from "./page.controller";
import { pageSlugParamSchema, upsertPageSchema } from "./page.validation";

const router = Router();

router.get("/", asyncHandler(pageController.getPages));

router.get(
  "/manage",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(pageController.getAllPages),
);

router.get(
  "/:slug",
  validateRequest({ params: pageSlugParamSchema }),
  asyncHandler(pageController.getPage),
);

router.put(
  "/:slug",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: pageSlugParamSchema,
    body: upsertPageSchema,
  }),
  asyncHandler(pageController.upsertPage),
);

router.delete(
  "/:slug",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: pageSlugParamSchema }),
  asyncHandler(pageController.deletePage),
);

export const pageRoutes = router;
