import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler<T extends Request> = (
  req: T,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const asyncHandler =
  <T extends Request>(handler: AsyncRequestHandler<T>): RequestHandler =>
  (req, res, next) => {
    handler(req as T, res, next).catch(next);
  };
