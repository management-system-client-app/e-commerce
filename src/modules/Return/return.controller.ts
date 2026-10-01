import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { AuthContext } from "../../app/middlewares/auth";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { returnService } from "./return.service";
import type {
  CreateReturnInput,
  ReturnIdParam,
  ReturnListQuery,
  ReviewReturnInput,
} from "./return.validation";

const requireAuth = (auth: AuthContext | undefined): AuthContext => {
  if (!auth) {
    throw AppError.unauthorized();
  }

  return auth;
};

const createReturn = async (
  req: ValidatedRequest<CreateReturnInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req.auth);

  if (auth.role !== "USER") {
    throw AppError.forbidden("Only customers can request a return");
  }

  const request = await returnService.createReturn(auth.id, req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Return request submitted",
    data: request,
  });
};

const getReturns = async (
  req: ValidatedRequest<unknown, Record<string, string>, ReturnListQuery>,
  res: Response,
): Promise<void> => {
  const result = await returnService.getReturns(requireAuth(req.auth), req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Return requests fetched",
    data: result.items,
    meta: result.meta,
  });
};

const getReturn = async (
  req: ValidatedRequest<unknown, ReturnIdParam>,
  res: Response,
): Promise<void> => {
  const request = await returnService.getReturn(requireAuth(req.auth), req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Return request fetched",
    data: request,
  });
};

const reviewReturn = async (
  req: ValidatedRequest<ReviewReturnInput, ReturnIdParam>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req.auth);

  if (auth.role !== "ADMIN") {
    throw AppError.forbidden();
  }

  const request = await returnService.reviewReturn(
    auth.id,
    req.validatedParams.id,
    req.validatedBody,
  );

  res.status(200).json({
    success: true,
    message: `Return request ${req.validatedBody.decision.toLowerCase()}`,
    data: request,
  });
};

export const returnController = {
  createReturn,
  getReturns,
  getReturn,
  reviewReturn,
};
