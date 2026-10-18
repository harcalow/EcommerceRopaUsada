/** Estado de una cuenta; solo `ACTIVE` puede iniciar sesión (CB-012). */
export const ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function isAccountStatus(value: string): value is AccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value);
}
