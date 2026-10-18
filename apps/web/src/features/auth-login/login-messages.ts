/** Textos del login centralizados (spec 001; 429 y 5xx propuestos en el diseño). */
export const LOGIN_MESSAGES = {
  invalidCredentials: 'Usuario o contraseña incorrectos',
  offline: 'No hay conexión, inténtalo de nuevo',
  rateLimited: 'Demasiados intentos desde este equipo. Espera un momento y vuelve a intentarlo',
  unexpected: 'No pudimos verificar tus datos. Inténtalo de nuevo en unos minutos',
  sessionExpired: 'Tu sesión ha caducado. Vuelve a iniciar sesión',
  capsLock: 'Bloq Mayús está activado',
  forgotPassword: '¿Olvidaste tu contraseña?',
  forgotPasswordContact: 'Escribe al responsable de la tienda a',
} as const;

/** Minutos de bloqueo de la spec (RF-008) si la API no indica los restantes. */
export const DEFAULT_LOCK_MINUTES = 30;

export function lockedMessage(minutes: number): string {
  const unit = minutes === 1 ? 'minuto' : 'minutos';
  return `Demasiados intentos. Vuelve a intentarlo en ${String(minutes)} ${unit}`;
}
