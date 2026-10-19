/** Cabecera que enlaza web, API y logs (RT-006). */
export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/** Formato válido de un id de correlación. */
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
