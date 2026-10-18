import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { TEST_INTERNAL_API_SECRET } from '../../../test/helpers/internal-secret';
import { ConfigModule } from '../config/config.module';
import { loadConfig } from '../config/load-config';

import { DatabaseModule } from './database.module';
import { PrismaService } from './prisma.service';

const UNREACHABLE_DATABASE = 'postgresql://user:pass@127.0.0.1:1/unreachable';

async function createModule() {
  const config = loadConfig({
    DATABASE_URL: UNREACHABLE_DATABASE,
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    INTERNAL_API_SECRET: TEST_INTERNAL_API_SECRET,
  });
  return Test.createTestingModule({
    imports: [ConfigModule.forRoot(config), DatabaseModule],
  }).compile();
}

describe('PrismaService', () => {
  it('arranca y se cierra sin conectarse a una base de datos inalcanzable (conexión perezosa)', async () => {
    const moduleRef = await createModule();
    const app = moduleRef.createNestApplication();

    await app.init();
    const disconnect = vi.spyOn(app.get(PrismaService), '$disconnect');

    await app.close();

    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('falla solo al usarla, sin exponer la URL de conexión en el error', async () => {
    const moduleRef = await createModule();
    const prisma = moduleRef.get(PrismaService);

    const failure = await prisma.$queryRaw`SELECT 1`.then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain('pass');
    await prisma.$disconnect();
  });
});
