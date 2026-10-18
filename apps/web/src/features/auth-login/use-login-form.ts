'use client';

import { accountLockedClientSchema, loginRequestClientSchema } from '@perchados/contracts/client';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type RefCallback, type SyntheticEvent } from 'react';

import { useApiClient } from '@/shared/api/api-config-provider';
import { PANEL_PATH } from '@/shared/auth/auth-constants';

import { DEFAULT_LOCK_MINUTES, LOGIN_MESSAGES, lockedMessage } from './login-messages';

const REQUEST_TIMEOUT_MS = 10_000;

export interface FieldErrors {
  username: string | null;
  password: string | null;
}

const NO_ERRORS: FieldErrors = { username: null, password: null };

/** Primer mensaje de cada campo según los esquemas del contrato (RF-001, RF-003). */
function validate(username: string, password: string) {
  const parsed = loginRequestClientSchema.safeParse({ username, password });
  if (parsed.success) {
    return { data: parsed.data, errors: NO_ERRORS };
  }
  const errors: FieldErrors = { ...NO_ERRORS };
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if ((field === 'username' || field === 'password') && errors[field] === null) {
      errors[field] = issue.message;
    }
  }
  return { data: null, errors };
}

/** Mensaje para una respuesta no satisfactoria de la API (401, 423, 429 u otra). */
function messageForFailure(status: number, error: unknown): string {
  if (status === 401) {
    return LOGIN_MESSAGES.invalidCredentials;
  }
  if (status === 423) {
    const locked = accountLockedClientSchema.safeParse(error);
    return lockedMessage(locked.success ? locked.data.lockedMinutesRemaining : DEFAULT_LOCK_MINUTES);
  }
  return status === 429 ? LOGIN_MESSAGES.rateLimited : LOGIN_MESSAGES.unexpected;
}

export interface LoginFormModel {
  username: string;
  password: string;
  fieldErrors: FieldErrors;
  formError: string | null;
  submitting: boolean;
  bindUsername: RefCallback<HTMLInputElement>;
  bindPassword: RefCallback<HTMLInputElement>;
  onUsernameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPasswordChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

/** Estado, validación y envío del formulario de acceso; traduce las respuestas de la API. */
export function useLoginForm(): LoginFormModel {
  const client = useApiClient();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usernameEl, setUsernameEl] = useState<HTMLInputElement | null>(null);
  const [passwordEl, setPasswordEl] = useState<HTMLInputElement | null>(null);

  const failWith = (message: string) => {
    setFormError(message);
    setSubmitting(false);
  };

  const sendCredentials = async (body: { username: string; password: string }) => {
    try {
      const { response, error } = await client.POST('/v1/auth/login', {
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        router.replace(PANEL_PATH);
        return;
      }
      failWith(messageForFailure(response.status, error));
    } catch {
      // Red caída o tiempo agotado: la petición no se completó, así que no cuenta como intento (CB-007)
      failWith(LOGIN_MESSAGES.offline);
    }
  };

  const submit = async () => {
    if (submitting) {
      return;
    }
    setFormError(null);
    const { data, errors } = validate(username, password);
    setFieldErrors(errors);
    if (!data) {
      (errors.username ? usernameEl : passwordEl)?.focus();
      return;
    }
    setSubmitting(true);
    await sendCredentials(data);
  };

  return {
    username,
    password,
    fieldErrors,
    formError,
    submitting,
    bindUsername: setUsernameEl,
    bindPassword: setPasswordEl,
    onUsernameChange: (event) => {
      setUsername(event.target.value);
      setFieldErrors((current) => ({ ...current, username: null }));
    },
    onPasswordChange: (event) => {
      setPassword(event.target.value);
      setFieldErrors((current) => ({ ...current, password: null }));
    },
    onSubmit: (event) => {
      event.preventDefault();
      void submit();
    },
  };
}
