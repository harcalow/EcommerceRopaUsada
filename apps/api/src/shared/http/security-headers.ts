import type { RequestHandler } from 'express';
import helmet from 'helmet';

/** HSTS de un año con subdominios (solo se emite donde la API va tras HTTPS). */
const HSTS_MAX_AGE_SECONDS = 31_536_000;

export interface SecurityHeadersOptions {
  /** `true` solo en `production`: HSTS por HTTP en local o CI rompería el acceso al localhost. */
  readonly hsts: boolean;
}

/**
 * Cabeceras de seguridad de la API (RT-015). Es una API JSON sin documentos: la CSP lo prohíbe
 * todo (`default-src 'none'`, `frame-ancestors 'none'`), además de `nosniff`,
 * `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cross-Origin-*` restrictivas y sin
 * `X-Powered-By`.
 */
export function securityHeaders(options: SecurityHeadersOptions): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    referrerPolicy: { policy: 'no-referrer' },
    xFrameOptions: { action: 'deny' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    xContentTypeOptions: true,
    strictTransportSecurity: options.hsts
      ? { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true }
      : false,
  });
}
