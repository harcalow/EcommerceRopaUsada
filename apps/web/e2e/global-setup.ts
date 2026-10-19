/**
 * Calienta la API y la web antes de las pruebas: el primer login paga la conexión a la BD y el primer
 * argon2id, y rebasaría el tiempo de espera de 10 s de la interfaz (que mostraría «No hay conexión»).
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_WITH_API !== '1') {
    return;
  }
  const webUrl = `http://localhost:${process.env.E2E_WEB_PORT ?? '3100'}`;
  const apiUrl = `http://localhost:${process.env.E2E_API_PORT ?? '3101'}`;
  await fetch(`${webUrl}/login`);
  await fetch(`${apiUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: webUrl },
    body: JSON.stringify({ username: 'calentamiento', password: 'Calentamiento-1' }),
  });
}
