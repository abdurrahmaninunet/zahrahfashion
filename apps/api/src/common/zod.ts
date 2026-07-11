import { BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/** Parse request input with a Zod schema, mapping failures to 400s with field errors. */
export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    throw err;
  }
}
