import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type ValidatedRequestData = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
};

export function validate(schema: ZodSchema<ValidatedRequestData>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(", ");
      return res.status(400).json({
        success: false,
        message,
      });
    }

    req.body = result.data.body ?? req.body;
    next();
  };
}
