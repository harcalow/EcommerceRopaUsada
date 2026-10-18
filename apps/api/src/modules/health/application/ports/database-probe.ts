/** Puerto: comprueba que la base de datos responde. Rechaza si no lo hace. */
export interface DatabaseProbe {
  check(): Promise<void>;
}

export const DATABASE_PROBE = Symbol('DATABASE_PROBE');
