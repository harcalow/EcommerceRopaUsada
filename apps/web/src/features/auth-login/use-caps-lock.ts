import { useCallback, useState, type KeyboardEvent } from 'react';

export interface CapsLockState {
  capsLockOn: boolean;
  /** Se pasan al campo: se evalúa en cada `keydown`/`keyup`, así que cubre Bloq Mayús activado antes de enfocar (CB-009). */
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onKeyUp: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Al salir del campo el aviso deja de tener sentido. */
  onBlur: () => void;
}

/** Detecta Bloq Mayús con `getModifierState('CapsLock')` (RF-006). */
export function useCapsLock(): CapsLockState {
  const [capsLockOn, setCapsLockOn] = useState(false);
  const evaluate = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(event.getModifierState('CapsLock'));
  }, []);
  const onBlur = useCallback(() => {
    setCapsLockOn(false);
  }, []);
  return { capsLockOn, onKeyDown: evaluate, onKeyUp: evaluate, onBlur };
}
