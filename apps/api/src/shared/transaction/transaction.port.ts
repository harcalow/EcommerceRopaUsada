/** Token de inyección del puerto `TransactionRunner`. */
export const TRANSACTION_RUNNER = Symbol('TRANSACTION_RUNNER');

/**
 * Transacción en curso, opaca para la aplicación: solo se pasa de vuelta a los repositorios para
 * que sus escrituras participen en ella. Cada adaptador reconoce el contexto que él mismo creó.
 */
export interface TransactionContext {
  readonly kind: 'transaction';
}

/** Unidad de trabajo: ejecuta `work` de forma atómica; si lanza, todo lo escrito con `tx` se revierte. */
export interface TransactionRunner {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
