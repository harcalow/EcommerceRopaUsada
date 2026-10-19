import { Controller, Get, HttpException, Post } from '@nestjs/common';
import { PROBLEM_TYPES } from '@perchados/contracts';
import { z } from 'zod';

import { Public } from '../../src/shared/http/public.decorator';
import { ProblemException } from '../../src/shared/errors/problem.exception';
import { ZodBody } from '../../src/shared/validation/zod-body.decorator';

export const INTERNAL_DETAIL = 'internal-detail-must-not-leak';

export const createItemSchema = z.strictObject({
  name: z.string({ error: 'Escribe el nombre' }).min(1, { error: 'Escribe el nombre' }),
  address: z.strictObject({ city: z.string({ error: 'Escribe la ciudad' }) }),
});

type CreateItem = z.infer<typeof createItemSchema>;

/** Rutas de prueba bajo `/v1/test-routes` para ejercitar errores y validación. */
@Public()
@Controller('test-routes')
export class TestRoutesController {
  /** Veces que se ejecutó el cuerpo de `POST /items`; debe seguir en 0 si la validación falla. */
  static itemsCreated = 0;

  @Get('ok')
  ok(): { ok: true } {
    return { ok: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error(INTERNAL_DETAIL);
  }

  @Get('problem')
  problem(): never {
    throw new ProblemException({
      type: PROBLEM_TYPES.forbidden,
      detail: 'Sin permiso.',
    });
  }

  @Get('teapot')
  teapot(): never {
    throw new HttpException(INTERNAL_DETAIL, 418);
  }

  @Post('items')
  createItem(@ZodBody(createItemSchema) body: CreateItem): CreateItem {
    TestRoutesController.itemsCreated += 1;
    return body;
  }
}
