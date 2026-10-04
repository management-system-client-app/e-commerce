import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

type RequestSchemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

export type ValidatedRequest<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
  TQuery = unknown,
> = Request & {
  validatedBody: TBody;
  validatedParams: TParams;
  validatedQuery: TQuery;
};

export const validateRequest =
  (schemas: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const validatedRequest = req as ValidatedRequest;

    try {
      if (schemas.body) {
        validatedRequest.validatedBody = schemas.body.parse(req.body);
      }

      if (schemas.params) {
        validatedRequest.validatedParams = schemas.params.parse(req.params) as Record<
          string,
          string
        >;
      }

      if (schemas.query) {
        validatedRequest.validatedQuery = schemas.query.parse(req.query);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
