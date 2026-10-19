export const PROBLEM_TYPES = {
  validationError: 'validation-error',
  malformedRequest: 'malformed-request',
  invalidCredentials: 'auth/invalid-credentials',
  unauthenticated: 'auth/unauthenticated',
  sessionExpired: 'auth/session-expired',
  forbidden: 'auth/forbidden',
  csrfInvalid: 'auth/csrf-invalid',
  notFound: 'not-found',
  payloadTooLarge: 'payload-too-large',
  requestRejected: 'request-rejected',
  accountLocked: 'auth/account-locked',
  rateLimitExceeded: 'rate-limit-exceeded',
  internalError: 'internal-error',
  healthUnavailable: 'health/unavailable',
} as const;

export type ProblemType = (typeof PROBLEM_TYPES)[keyof typeof PROBLEM_TYPES];

export const PROBLEM_TYPE_VALUES = Object.values(PROBLEM_TYPES) as [ProblemType, ...ProblemType[]];
