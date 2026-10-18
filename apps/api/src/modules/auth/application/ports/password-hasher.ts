/** Token de inyección del puerto `PasswordHasher`. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** Hash de contraseñas (RF-018, RT-010). Nunca se registra ni devuelve la contraseña. */
export interface PasswordHasher {
  /** Hash con sal aleatoria de la contraseña normalizada a NFC. Rechaza más de 128 caracteres. */
  hash(password: string): Promise<string>;
  /** Comprueba la contraseña contra un hash guardado; una contraseña demasiado larga no verifica. */
  verify(hash: string, password: string): Promise<boolean>;
  /** Consume el mismo tiempo que `verify` para igualar tiempos si la cuenta no existe (CB-003, CB-004). */
  verifyDummy(password: string): Promise<void>;
  /** Indica si el hash guardado usa parámetros inferiores a los vigentes y conviene rehashear. */
  needsRehash(hash: string): boolean;
}
