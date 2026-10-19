import { Injectable } from '@nestjs/common';

import type { TransactionContext, TransactionRunner } from '../transaction/transaction.port';

import type { Prisma } from './generated/client';
import { PrismaService } from './prisma.service';

/** Espera máxima para obtener conexión al abrir una transacción. */
export const TRANSACTION_MAX_WAIT_MS = 2000;
/** Duración máxima de una transacción: solo se admiten escrituras cortas, nunca derivación de hashes. */
export const TRANSACTION_TIMEOUT_MS = 5000;

/** Transacción interactiva de Prisma envuelta como contexto opaco para la capa de aplicación. */
export class PrismaTransactionContext implements TransactionContext {
  readonly kind = 'transaction' as const;

  constructor(readonly client: Prisma.TransactionClient) {}
}

/** Cliente con el que debe escribir un repositorio: el de la transacción si hay una, o el general. */
export function clientFor(
  prisma: PrismaService,
  tx: TransactionContext | undefined,
): Prisma.TransactionClient {
  return tx instanceof PrismaTransactionContext ? tx.client : prisma;
}

/** `TransactionRunner` sobre las transacciones interactivas de Prisma (PostgreSQL). */
@Injectable()
export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((client) => work(new PrismaTransactionContext(client)), {
      maxWait: TRANSACTION_MAX_WAIT_MS,
      timeout: TRANSACTION_TIMEOUT_MS,
    });
  }
}
