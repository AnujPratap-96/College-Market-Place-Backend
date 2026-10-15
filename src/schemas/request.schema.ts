import { z, ZodTypeAny } from 'zod';

export const requestSchema = ({
  body,
  params,
  query,
}: {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}) =>
  z.object({
    body: body ?? z.any().optional(),
    params: params ?? z.any().optional(),
    query: query ?? z.any().optional(),
  });
