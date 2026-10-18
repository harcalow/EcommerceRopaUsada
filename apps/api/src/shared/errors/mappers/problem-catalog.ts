import { PROBLEM_TYPES, type ProblemFieldError, type ProblemType } from '@perchados/contracts';

/** Contenido de un problema antes de añadirle el id de correlación. */
export interface ProblemSpec {
  readonly type: ProblemType;
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly errors?: readonly ProblemFieldError[];
  /** Campos de extensión del tipo (p. ej. `checks` de health); se añaden al cuerpo tal cual. */
  readonly extensions?: Readonly<Record<string, unknown>>;
}

type ProblemDefaults = Pick<ProblemSpec, 'status' | 'title' | 'detail'>;

/** Estado, título y detalle por defecto de cada tipo del catálogo `PROBLEM_TYPES`. */
export const PROBLEM_DEFAULTS: Readonly<Record<ProblemType, ProblemDefaults>> = {
  [PROBLEM_TYPES.validationError]: {
    status: 400,
    title: 'Datos no válidos',
    detail: 'Los datos enviados no son válidos.',
  },
  [PROBLEM_TYPES.malformedRequest]: {
    status: 400,
    title: 'Petición mal formada',
    detail: 'La petición no se pudo interpretar.',
  },
  [PROBLEM_TYPES.invalidCredentials]: {
    status: 401,
    title: 'Credenciales no válidas',
    detail: 'Usuario o contraseña incorrectos.',
  },
  [PROBLEM_TYPES.unauthenticated]: {
    status: 401,
    title: 'No autenticado',
    detail: 'Debes iniciar sesión para continuar.',
  },
  [PROBLEM_TYPES.sessionExpired]: {
    status: 401,
    title: 'Sesión caducada',
    detail: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
  },
  [PROBLEM_TYPES.forbidden]: {
    status: 403,
    title: 'Acceso denegado',
    detail: 'No tienes permiso para realizar esta acción.',
  },
  [PROBLEM_TYPES.csrfInvalid]: {
    status: 403,
    title: 'Petición no permitida',
    detail: 'No se pudo verificar el origen de la petición.',
  },
  [PROBLEM_TYPES.notFound]: {
    status: 404,
    title: 'No encontrado',
    detail: 'El recurso solicitado no existe.',
  },
  [PROBLEM_TYPES.payloadTooLarge]: {
    status: 413,
    title: 'Cuerpo demasiado grande',
    detail: 'El cuerpo de la petición supera el tamaño máximo permitido.',
  },
  [PROBLEM_TYPES.requestRejected]: {
    status: 400,
    title: 'Petición rechazada',
    detail: 'La petición no se puede atender tal como se envió.',
  },
  [PROBLEM_TYPES.accountLocked]: {
    status: 423,
    title: 'Cuenta bloqueada',
    detail: 'La cuenta está bloqueada temporalmente.',
  },
  [PROBLEM_TYPES.rateLimitExceeded]: {
    status: 429,
    title: 'Demasiadas peticiones',
    detail: 'Has superado el límite de peticiones. Inténtalo más tarde.',
  },
  [PROBLEM_TYPES.internalError]: {
    status: 500,
    title: 'Error interno',
    detail: 'Se produjo un error inesperado. Inténtalo de nuevo más tarde.',
  },
  [PROBLEM_TYPES.healthUnavailable]: {
    status: 503,
    title: 'Servicio no disponible',
    detail: 'El servicio no está disponible en este momento.',
  },
};

/** Construye un `ProblemSpec` completando con los valores por defecto del tipo. */
export function buildProblemSpec(
  type: ProblemType,
  overrides: Partial<Omit<ProblemSpec, 'type'>> = {},
): ProblemSpec {
  return { type, ...PROBLEM_DEFAULTS[type], ...overrides };
}
