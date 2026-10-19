import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { TEST_INTERNAL_API_SECRET } from '../../../test/helpers/internal-secret';
import { AppModule } from '../../app.module';

import { APP_CONFIG } from './config.module';
import { loadConfig, type AppConfig } from './load-config';

describe('ConfigModule', () => {
  it('expone la configuración validada de forma global bajo APP_CONFIG', async () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      INTERNAL_API_SECRET: TEST_INTERNAL_API_SECRET,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(config)],
    }).compile();

    expect(moduleRef.get<AppConfig>(APP_CONFIG)).toBe(config);
  });
});
