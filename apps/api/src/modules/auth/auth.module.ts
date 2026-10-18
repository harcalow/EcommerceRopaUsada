import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { APP_CONFIG } from '../../shared/config/config.module';
import type { AppConfig } from '../../shared/config/load-config';
import { RateLimitGuard } from '../../shared/rate-limit';

import { UsersModule } from '../users/users.module';

import { LogIn } from './application/log-in.use-case';
import { OpenSession, SESSION_TTL_HOURS } from './application/open-session.use-case';
import { LOGIN_AUDIT } from './application/ports/login-audit';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import { SESSION_REPOSITORY } from './application/ports/session.repository';
import { TOKEN_GENERATOR } from './application/ports/token-generator';
import { RevokeSession } from './application/revoke-session.use-case';
import { ValidateSession } from './application/validate-session.use-case';
import { Argon2idPasswordHasher } from './infrastructure/argon2id-password-hasher';
import { CryptoTokenGenerator } from './infrastructure/crypto-token-generator';
import { LoggerLoginAudit } from './infrastructure/logger-login-audit';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { AuthController } from './interface/auth.controller';
import { CsrfTokenVerifier } from './interface/csrf-token.verifier';
import { CsrfGuard } from './interface/guards/csrf.guard';
import { RolesGuard } from './interface/guards/roles.guard';
import { SessionGuard } from './interface/guards/session.guard';
import { SessionCookies } from './interface/session-cookie';

/** Autenticación: hash de contraseñas, sesiones de servidor, guard global privado por defecto y endpoints de sesión y logout. */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    {
      provide: PASSWORD_HASHER,
      inject: [APP_CONFIG],
      useFactory: (config: Pick<AppConfig, 'passwordHash'>): Argon2idPasswordHasher =>
        new Argon2idPasswordHasher(config.passwordHash),
    },
    {
      provide: SESSION_TTL_HOURS,
      inject: [APP_CONFIG],
      useFactory: (config: Pick<AppConfig, 'session'>): number => config.session.ttlHours,
    },
    { provide: TOKEN_GENERATOR, useClass: CryptoTokenGenerator },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: LOGIN_AUDIT, useClass: LoggerLoginAudit },
    OpenSession,
    LogIn,
    ValidateSession,
    RevokeSession,
    SessionCookies,
    CsrfTokenVerifier,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [PASSWORD_HASHER, OpenSession, ValidateSession, RevokeSession, SessionCookies],
})
export class AuthModule {}
