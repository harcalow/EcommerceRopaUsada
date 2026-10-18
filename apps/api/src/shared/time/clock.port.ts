/** Token de inyección del reloj. */
export const CLOCK = Symbol('CLOCK');

/** Fuente de la hora actual; se sustituye por un reloj falso en las pruebas. */
export interface Clock {
  now(): Date;
}
