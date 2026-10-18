import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { NoStoreInterceptor } from './no-store.interceptor';

describe('NoStoreInterceptor', () => {
  it('fija Cache-Control: no-store y deja pasar la respuesta', async () => {
    const setHeader = vi.fn();
    const context = {
      switchToHttp: () => ({ getResponse: () => ({ setHeader }) }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('valor') };

    const result = await lastValueFrom(new NoStoreInterceptor().intercept(context, next));

    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(result).toBe('valor');
  });
});
