import { Global, Module } from '@nestjs/common';

import { TRANSACTION_RUNNER } from '../transaction/transaction.port';

import { PrismaTransactionRunner } from './prisma-transaction';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, { provide: TRANSACTION_RUNNER, useClass: PrismaTransactionRunner }],
  exports: [PrismaService, TRANSACTION_RUNNER],
})
export class DatabaseModule {}
