import { Inject, Injectable } from '@nestjs/common';
import {
  CSRF_COOKIE_NAME,
  SECURE_CSRF_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@perchados/contracts';
import type { Request, Response } from 'express';

import { APP_CONFIG } from '../../../shared/config/config.module';
import type { AppConfig } from '../../../shared/config/load-config';
import type { OpenedSession } from '../application/open-session.use-case';

/** La cookie sobrevive 24 h a la sesión para poder responder `auth/session-expired` (ADR-007). */
const GRACE_HOURS = 24;
const SECONDS_PER_HOUR = 3600;
const INSECURE_ENVS: readonly AppConfig['env'][] = ['development', 'test'];
const EPOCH = new Date(0).toUTCString();

type CookieConfig = Pick<AppConfig, 'env' | 'session'>;

interface CookieAttributes {
  readonly name: string;
  readonly value: string;
  readonly maxAgeSeconds: number;
  readonly httpOnly: boolean;
}

/** Extrae el valor de una cookie del encabezado `Cookie`; la primera con ese nombre gana. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

/** Escribe, lee y borra las cookies de sesión y CSRF con los atributos de ADR-007. */
@Injectable()
export class SessionCookies {
  private readonly secure: boolean;
  private readonly domain: string | undefined;
  private readonly maxAgeSeconds: number;
  readonly sessionName: string;
  readonly csrfName: string;

  constructor(@Inject(APP_CONFIG) config: CookieConfig) {
    this.secure = !INSECURE_ENVS.includes(config.env);
    this.domain = config.session.cookieDomain;
    this.maxAgeSeconds = Math.ceil((config.session.ttlHours + GRACE_HOURS) * SECONDS_PER_HOUR);
    this.sessionName = this.secure ? SECURE_SESSION_COOKIE_NAME : SESSION_COOKIE_NAME;
    this.csrfName = this.secure ? SECURE_CSRF_COOKIE_NAME : CSRF_COOKIE_NAME;
  }

  /** Token de sesión del encabezado `Cookie` de la petición, si lo trae. */
  readSessionToken(request: Request): string | undefined {
    return readCookie(request.headers.cookie, this.sessionName);
  }

  /** Fija las dos cookies de una sesión recién abierta. */
  write(response: Response, opened: OpenedSession): void {
    this.append(response, {
      name: this.sessionName,
      value: opened.token,
      maxAgeSeconds: this.maxAgeSeconds,
      httpOnly: true,
    });
    this.append(response, {
      name: this.csrfName,
      value: opened.csrfToken,
      maxAgeSeconds: this.maxAgeSeconds,
      httpOnly: false,
    });
  }

  /** Borra ambas cookies (`Max-Age=0`) con los mismos `Path` y `Domain` con que se fijaron. */
  clear(response: Response): void {
    this.append(response, { name: this.sessionName, value: '', maxAgeSeconds: 0, httpOnly: true });
    this.append(response, { name: this.csrfName, value: '', maxAgeSeconds: 0, httpOnly: false });
  }

  private append(response: Response, cookie: CookieAttributes): void {
    response.append('Set-Cookie', this.serialize(cookie));
  }

  private serialize(cookie: CookieAttributes): string {
    const parts = [`${cookie.name}=${cookie.value}`, `Max-Age=${String(cookie.maxAgeSeconds)}`];
    if (cookie.maxAgeSeconds === 0) {
      parts.push(`Expires=${EPOCH}`);
    }
    parts.push('Path=/');
    if (this.domain !== undefined) {
      parts.push(`Domain=${this.domain}`);
    }
    if (cookie.httpOnly) {
      parts.push('HttpOnly');
    }
    if (this.secure) {
      parts.push('Secure');
    }
    parts.push('SameSite=Strict');
    return parts.join('; ');
  }
}
