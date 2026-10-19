export const dynamic = 'force-dynamic';

/** Healthcheck de la web (Docker, CI): 200 si el servidor responde. La configuración ya se validó al arrancar. */
export function GET(): Response {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
