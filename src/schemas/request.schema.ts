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
    body: body ?? z.any(),
    params: params ?? z.any(),
    query: query ?? z.any(),
  });
