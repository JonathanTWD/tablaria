import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ApiErrorDetail } from '@tablaria/shared';
import type { z } from 'zod';

/** Parses `value` or throws the API's 400 validation error, with one detail per issue. */
export function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details: ApiErrorDetail[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new BadRequestException({ message: 'Validation failed', details });
  }
  return result.data;
}

export class ZodValidationPipe<
  TSchema extends z.ZodType,
> implements PipeTransform<unknown, z.output<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    return parseOrThrow(this.schema, value);
  }
}
