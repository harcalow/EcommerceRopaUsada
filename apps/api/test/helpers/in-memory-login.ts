import type { PasswordHasher } from '../../src/modules/auth/application/ports/password-hasher';
import type {
  LoginAudit,
  LoginAuditEvent,
} from '../../src/modules/auth/application/ports/login-audit';
import type {
  AccountRepository,
  AccountWithObservedAt,
} from '../../src/modules/users/application/ports/account.repository';
import type { LoginLockSnapshot } from '../../src/modules/users/application/ports/login-lock-snapshot';
import type { UnknownLoginAttemptsRepository } from '../../src/modules/users/application/ports/unknown-login-attempts.repository';
import { Account, type AccountProps } from '../../src/modules/users/domain/account';
import { LoginLock } from '../../src/modules/users/domain/login-lock';
import type {
  TransactionContext,
  TransactionRunner,
} from '../../src/shared/transaction/transaction.port';

/** Hash de prueba legible: `hash:<contraseña>`. No es criptografía; solo para dobles. */
export function fakeHash(password: string): string {
  return `hash:${password}`;
}

/** Hasher de prueba que registra qué ramas se ejecutaron (para comprobar la igualación de tiempos). */
export class FakePasswordHasher implements PasswordHasher {
  readonly verifyCalls: string[] = [];
  readonly dummyCalls: string[] = [];
  readonly hashCalls: string[] = [];
  outdatedHashes = new Set<string>();
  /** Sonda opcional: si devuelve verdadero al llamar a una derivación, se anota como llamada en transacción. */
  inTransaction: () => boolean = () => false;
  /** Derivaciones (hash, verify, verifyDummy) que se hicieron con la transacción abierta. */
  readonly callsInsideTransaction: string[] = [];

  private probe(operation: string): void {
    if (this.inTransaction()) {
      this.callsInsideTransaction.push(operation);
    }
  }

  hash(password: string): Promise<string> {
    this.probe('hash');
    this.hashCalls.push(password);
    return Promise.resolve(`new:${password}`);
  }

  verify(hash: string, password: string): Promise<boolean> {
    this.probe('verify');
    this.verifyCalls.push(password);
    return Promise.resolve(hash === fakeHash(password) || hash === `new:${password}`);
  }

  verifyDummy(password: string): Promise<void> {
    this.probe('verifyDummy');
    this.dummyCalls.push(password);
    return Promise.resolve();
  }

  needsRehash(hash: string): boolean {
    return this.outdatedHashes.has(hash);
  }
}

/** Repositorio de cuentas en memoria con el contador y el bloqueo reales del dominio (`LoginLock`). */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly byKey = new Map<string, Account>();
  readonly transactionsSeen: (TransactionContext | undefined)[] = [];

  constructor(private readonly now: () => Date) {}

  add(props: Omit<AccountProps, 'lock'> & { lock?: LoginLock }): Account {
    const account = new Account({ ...props, lock: props.lock ?? LoginLock.none() });
    this.byKey.set(account.usernameKey, account);
    return account;
  }

  get(usernameKey: string): Account {
    const account = this.byKey.get(usernameKey);
    if (account === undefined) {
      throw new Error('unknown test account');
    }
    return account;
  }

  findByUsernameKey(usernameKey: string): Promise<AccountWithObservedAt | null> {
    const account = this.byKey.get(usernameKey);
    return Promise.resolve(account === undefined ? null : { account, observedAt: this.now() });
  }

  registerFailedAttempt(accountId: string): Promise<LoginLockSnapshot> {
    const current = this.byId(accountId);
    const observedAt = this.now();
    const lock = current.lock.recordFailure(observedAt);
    this.replace(current, { lock });
    return Promise.resolve({ lock, observedAt });
  }

  resetLoginAttempts(accountId: string, tx?: TransactionContext): Promise<void> {
    this.transactionsSeen.push(tx);
    this.replace(this.byId(accountId), { lock: LoginLock.none() });
    return Promise.resolve();
  }

  updatePasswordHash(
    accountId: string,
    passwordHash: string,
    tx?: TransactionContext,
  ): Promise<void> {
    this.transactionsSeen.push(tx);
    this.replace(this.byId(accountId), { passwordHash });
    return Promise.resolve();
  }

  private byId(accountId: string): Account {
    const found = [...this.byKey.values()].find((account) => account.id === accountId);
    if (found === undefined) {
      throw new Error('unknown test account id');
    }
    return found;
  }

  private replace(current: Account, change: Partial<AccountProps>): void {
    this.byKey.set(
      current.usernameKey,
      new Account({
        id: current.id,
        username: current.username,
        usernameKey: current.usernameKey,
        roleCode: current.roleCode,
        status: current.status,
        passwordHash: current.passwordHash,
        lock: current.lock,
        ...change,
      }),
    );
  }
}

/** Intentos de usuarios inexistentes en memoria, con las mismas reglas del dominio. */
export class InMemoryUnknownAttempts implements UnknownLoginAttemptsRepository {
  private readonly locks = new Map<string, LoginLock>();

  constructor(private readonly now: () => Date) {}

  registerFailedAttempt(usernameKey: string): Promise<LoginLockSnapshot> {
    const observedAt = this.now();
    const lock = (this.locks.get(usernameKey) ?? LoginLock.none()).recordFailure(observedAt);
    this.locks.set(usernameKey, lock);
    return Promise.resolve({ lock, observedAt });
  }

  count(): number {
    return this.locks.size;
  }
}

/** Unidad de trabajo de prueba: entrega un contexto reconocible y solo cuenta las ejecuciones. */
export class FakeTransactionRunner implements TransactionRunner {
  readonly context: TransactionContext = { kind: 'transaction' };
  runs = 0;
  /** Verdadero mientras el trabajo de la transacción se ejecuta: permite detectar trabajo lento dentro de la transacción. */
  active = false;

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.runs += 1;
    this.active = true;
    try {
      return await work(this.context);
    } finally {
      this.active = false;
    }
  }
}

/** Auditoría que guarda los eventos recibidos. */
export class RecordingLoginAudit implements LoginAudit {
  readonly events: LoginAuditEvent[] = [];

  record(event: LoginAuditEvent): void {
    this.events.push(event);
  }
}
