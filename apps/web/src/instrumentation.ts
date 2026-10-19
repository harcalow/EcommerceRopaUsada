/**
 * Se ejecuta una vez al arrancar el servidor de Next.js (RT-007): si la configuración
 * es inválida, lanza y el proceso no arranca. El mensaje nombra la variable, nunca su valor.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  const { getServerEnv } = await import('./shared/config/server-env');
  getServerEnv();
}
