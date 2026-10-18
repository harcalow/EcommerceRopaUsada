/** Datos persistidos de una sesión; el token en claro nunca forma parte del dominio. */
export interface SessionProps {
  readonly id: string;
  readonly accountId: string;
  readonly csrfTokenHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

const MS_PER_HOUR = 3_600_000;

/** Sesión de servidor con caducidad absoluta desde `createdAt` (RF-020, RT-011). */
export class Session {
  readonly id: string;
  readonly accountId: string;
  readonly csrfTokenHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;

  constructor(props: SessionProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.csrfTokenHash = props.csrfTokenHash;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
  }

  /** Instante de caducidad absoluta: `createdAt + ttlHours` (admite decimales). */
  static expiryFor(createdAt: Date, ttlHours: number): Date {
    return new Date(createdAt.getTime() + ttlHours * MS_PER_HOUR);
  }

  /** Caducada cuando `now >= expiresAt` (CA-018): a las 8 h exactas ya no es válida. */
  isExpired(now: Date): boolean {
    return now.getTime() >= this.expiresAt.getTime();
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }
}
