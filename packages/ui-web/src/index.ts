/**
 * Componentes públicos de `ui-web` (ADR-009): `Button` (T-29), `TextField` (T-30), `PasswordField` (T-31);
 * Link y Alert se exportan aquí a medida que se implementan (T-32 y T-33). `VisuallyHidden` y `Spinner` son internos.
 */
export { Button } from './Button';
export type { ButtonProps } from './Button';
export { TextField } from './TextField';
export type { TextFieldProps } from './TextField';
export { PasswordField } from './PasswordField';
export type { PasswordFieldProps } from './PasswordField';
export { Link } from './Link';
export type { LinkProps } from './Link';
export { Alert } from './Alert';
export type { AlertProps, AlertVariant } from './Alert';
