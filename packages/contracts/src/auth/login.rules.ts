/**
 * Reglas y mensajes de las credenciales (RF-001, RF-003). Módulo sin dependencias: lo comparten los esquemas
 * completos (zod clásico, para la API y OpenAPI) y los esquemas ligeros del navegador (zod/mini).
 */
export const USERNAME_MAX_LENGTH = 64;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_MIN_LENGTH = 8;

export const USERNAME_PATTERN_SOURCE = String.raw`^\p{L}+$`;
export const USERNAME_REGEX = new RegExp(USERNAME_PATTERN_SOURCE, 'u');

export const CREDENTIAL_MESSAGES = {
  usernameRequired: 'Escribe tu usuario',
  usernameLettersOnly: 'El usuario solo puede tener letras',
  usernameTooLong: `El usuario no puede superar ${String(USERNAME_MAX_LENGTH)} caracteres`,
  passwordRequired: 'Escribe tu contraseña',
  passwordTooLong: `La contraseña no puede superar ${String(PASSWORD_MAX_LENGTH)} caracteres`,
  passwordTooShort: `La contraseña debe tener al menos ${String(PASSWORD_MIN_LENGTH)} caracteres`,
} as const;
