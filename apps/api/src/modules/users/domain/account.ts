import type { AccountStatus } from './account-status';
import type { LoginLock } from './login-lock';

export interface AccountProps {
  readonly id: string;
  readonly username: string;
  readonly usernameKey: string;
  readonly roleCode: string;
  readonly status: AccountStatus;
  readonly passwordHash: string;
  readonly lock: LoginLock;
}

/** Cuenta de acceso con su rol y su estado de bloqueo; la contraseña solo existe como hash. */
export class Account {
  readonly id: string;
  readonly username: string;
  readonly usernameKey: string;
  readonly roleCode: string;
  readonly status: AccountStatus;
  readonly passwordHash: string;
  readonly lock: LoginLock;

  constructor(props: AccountProps) {
    this.id = props.id;
    this.username = props.username;
    this.usernameKey = props.usernameKey;
    this.roleCode = props.roleCode;
    this.status = props.status;
    this.passwordHash = props.passwordHash;
    this.lock = props.lock;
  }

  isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  hasRole(roleCode: string): boolean {
    return this.roleCode === roleCode;
  }
}
