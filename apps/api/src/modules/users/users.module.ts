import { Module } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';

import { ACCOUNT_REPOSITORY } from './application/ports/account.repository';
import { UNKNOWN_LOGIN_ATTEMPTS_REPOSITORY } from './application/ports/unknown-login-attempts.repository';
import { PrismaAccountRepository } from './infrastructure/prisma-account.repository';
import { PrismaUnknownLoginAttemptsRepository } from './infrastructure/prisma-unknown-login-attempts.repository';

/** Cuentas de acceso: repositorio de cuentas y de intentos con usuario inexistente (T-24). */
@Module({
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository },
    {
      provide: UNKNOWN_LOGIN_ATTEMPTS_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): PrismaUnknownLoginAttemptsRepository =>
        new PrismaUnknownLoginAttemptsRepository(prisma),
    },
  ],
  exports: [ACCOUNT_REPOSITORY, UNKNOWN_LOGIN_ATTEMPTS_REPOSITORY],
})
export class UsersModule {}
