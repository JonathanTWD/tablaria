import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({ name: z.string().min(1), quantity: z.coerce.number() }),
  );

  it('returns the parsed value when input is valid', () => {
    expect(pipe.transform({ name: 'Tornillos', quantity: '12' })).toEqual({
      name: 'Tornillos',
      quantity: 12,
    });
  });

  it('throws BadRequestException with one detail per invalid field', () => {
    let error: unknown;
    try {
      pipe.transform({ name: '', quantity: 'abc' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      details: { path: string }[];
    };
    expect(response.details.map((detail) => detail.path)).toEqual([
      'name',
      'quantity',
    ]);
  });
});
