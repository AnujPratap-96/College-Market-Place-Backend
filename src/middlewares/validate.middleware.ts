import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError, mapZodErrors } from '../utils/api-error';

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const mapped = mapZodErrors(result.error);
      throw new ApiError(400, 'Validation error', mapped);
    }

    req.validated = result.data;
    next();
  };
};

export default validate;
