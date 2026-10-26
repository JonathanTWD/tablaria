import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ApiErrorDetail } from '@wisedata/shared';
import type { z } from 'zod';

export class ZodValidationPipe<
  TSchema extends z.ZodType,
> implements PipeTransform<unknown, z.output<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details: ApiErrorDetail[] = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new BadRequestException({ message: 'Validation failed', details });
    }
    return result.data;
  }
}
