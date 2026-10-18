/**
 * Nombres de las cookies de sesión y CSRF (ADR-007). Módulo sin dependencias: lo comparten la API,
 * la web y la entrada ligera del navegador. Fuera de development/test se usan las variantes con el
 * prefijo `__Secure-`.
 */
export const SESSION_COOKIE_NAME = 'perchados_sid';
export const CSRF_COOKIE_NAME = 'perchados_csrf';
export const SECURE_COOKIE_PREFIX = '__Secure-';
export const SECURE_SESSION_COOKIE_NAME = `${SECURE_COOKIE_PREFIX}${SESSION_COOKIE_NAME}`;
export const SECURE_CSRF_COOKIE_NAME = `${SECURE_COOKIE_PREFIX}${CSRF_COOKIE_NAME}`;
