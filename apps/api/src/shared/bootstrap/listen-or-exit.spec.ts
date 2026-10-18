import { describe, expect, it, vi } from 'vitest';

import { listenOrExit } from './listen-or-exit';

function setup(listen: (port: number) => Promise<unknown>) {
  const logger = { error: vi.fn<(message: string) => void>() };
  const exit = vi.fn<(code: number) => void>();
  return { app: { listen }, logger, exit };
}

describe('listenOrExit', () => {
  it('abre el puerto sin registrar errores ni salir', async () => {
    const { app, logger, exit } = setup(() => Promise.resolve());

    await expect(listenOrExit(app, 3001, logger, exit)).resolves.toBe(true);

    expect(logger.error).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('con el puerto ocupado nombra el puerto y sale con código 1', async () => {
    const inUse = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
    const { app, logger, exit } = setup(() => Promise.reject(inUse));

    await expect(listenOrExit(app, 3001, logger, exit)).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('3001'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('already in use'));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('ante cualquier otro fallo también nombra el puerto y sale con código 1', async () => {
    const { app, logger, exit } = setup(() => Promise.reject(new Error('boom')));

    await expect(listenOrExit(app, 4010, logger, exit)).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('4010'));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
