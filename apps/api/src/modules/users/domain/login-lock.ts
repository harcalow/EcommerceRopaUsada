/** Fallos consecutivos que bloquean una cuenta (RF-008). Lo fija la spec: no es configuración. */
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;

/** Duración del bloqueo en minutos (RF-008). */
export const LOGIN_LOCK_MINUTES = 30;

const MS_PER_MINUTE = 60_000;

export interface LoginLockProps {
  readonly failedAttempts: number;
  readonly lockedUntil: Date | null;
}

/**
 * Contador de fallos y bloqueo temporal de un inicio de sesión (RF-008, RF-009, RF-017).
 * Inmutable: cada transición devuelve un estado nuevo. La persistencia aplica las mismas reglas
 * de forma atómica con la hora de la BD; esta clase es su especificación ejecutable y la que
 * interpreta el estado leído.
 */
export class LoginLock {
  readonly failedAttempts: number;
  readonly lockedUntil: Date | null;

  constructor(props: LoginLockProps) {
    this.failedAttempts = props.failedAttempts;
    this.lockedUntil = props.lockedUntil;
  }

  static none(): LoginLock {
    return new LoginLock({ failedAttempts: 0, lockedUntil: null });
  }

  /** Bloqueada mientras `lockedUntil > now`; a la hora exacta ya está vencida (RF-017). */
  isLocked(now: Date): boolean {
    return this.lockedUntil !== null && this.lockedUntil.getTime() > now.getTime();
  }

  /** Minutos que faltan, redondeados hacia arriba (mínimo 1 si sigue bloqueada); 0 si no lo está. */
  minutesRemaining(now: Date): number {
    if (this.lockedUntil === null || !this.isLocked(now)) {
      return 0;
    }
    return Math.ceil((this.lockedUntil.getTime() - now.getTime()) / MS_PER_MINUTE);
  }

  /**
   * Registra un fallo. Con el bloqueo vigente no cambia nada (no se alarga, CB-005); con el bloqueo
   * vencido empieza un contador nuevo (CB-013); el quinto fallo seguido bloquea 30 minutos.
   */
  recordFailure(now: Date): LoginLock {
    if (this.isLocked(now)) {
      return this;
    }
    const base = this.lockedUntil === null ? this.failedAttempts : 0;
    const failedAttempts = base + 1;
    if (failedAttempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
      return new LoginLock({
        failedAttempts,
        lockedUntil: new Date(now.getTime() + LOGIN_LOCK_MINUTES * MS_PER_MINUTE),
      });
    }
    return new LoginLock({ failedAttempts, lockedUntil: null });
  }

  /** Un acierto reinicia el contador y limpia el bloqueo (RF-009, CA-008). */
  recordSuccess(): LoginLock {
    return LoginLock.none();
  }
}
