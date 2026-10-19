# Memoria del proyecto: decisiones y aprendizajes

La skill `/archivar` añade aquí una entrada al cerrar cada funcionalidad. La etapa `/explorar` la lee antes de empezar otra.
Las decisiones de arquitectura NO van aquí: van en `specs/01-arquitectura/adr/`.

<!-- Formato de entrada:
## NNN — <Título> (AAAA-MM-DD)
- **Decisiones:**
- **Aprendizajes:**
- **Desviaciones y resolución:**
-->

## 001 — Login de administrador (2026-10-18)
Funcionalidad única del proyecto; incluye la base técnica (RT-001 a RT-022). Verificación: APROBADO CON OBSERVACIONES, sin bloqueantes. Cierre aprobado por el dueño con observaciones (leyó el diff de las rutas ⚠️).

- **Decisiones (fuera de ADR):**
  - La base técnica entra en la 001 como RT-xxx de `diseno.md` y en hitos (0 base existente → 5 correcciones de la etapa 6), no como funcionalidades horizontales (ADR-010).
  - El hito 5 (T-44 a T-50) se añadió al reaprobar el diseño: IP del cliente web → API (RT-022, ADR-011) y lint de `@perchados/contracts/client` (ADR-012).
  - `toUsernameKey` es la única fuente de `username_key` (trim + NFC + minúsculas por carácter, sin expansión): la clave no puede alargarse, porque el `VARCHAR(64)` de `login_attempt_unknown` fallaba con 500.
  - Intentos contra usuarios inexistentes se cuentan en `login_attempt_unknown` sin crear cuentas; el bloqueo se decide con la hora de la BD (`registerFailedAttempt` atómico).
  - Límite de peticiones en PostgreSQL (`rate_limit_counter`) con `@nestjs/throttler`; la IP sale de `request.ip` salvo token interno válido (RT-022).
  - Respuesta única `invalid-credentials` para inexistente, contraseña incorrecta, desactivada o sin rol admin (no revela cuentas).
- **Aprendizajes:**
  - Vitest con cobertura deja un candado en `%LOCALAPPDATA%\Temp\vitest-coverage-<hash>.lock`. Si el proceso muere, el PID puede reutilizarse y aparece «coverage report directory … already in use». Arreglo pendiente: script que borre los candados cuyo PID no sea un `node` de Vitest.
  - El hook `pruebas_afectadas.py` ejecutaba `pnpm test` de todo el monorepo al final de cada turno. Solapado con agentes dio falsos rojos y `contracts/dist` vacío (lint de la API intermitente). Se endureció el grafo de `turbo.json`; la causa raíz (hook solo sobre lo afectado, sin solaparse) sigue pendiente.
  - E2E de login: tras enviar, esperar la respuesta de `POST /v1/auth/login` de ese envío (`logInAndWaitForResponse`). Un aviso del intento anterior seguía montado y las aserciones lo veían como propio.
  - Un subagente que deja procesos en segundo plano puede repetir ediciones (líneas duplicadas, middleware registrado dos veces) y romper la compilación. Regla: ningún agente entrega con procesos vivos (protocolo-subagente, sección 5).
  - La prueba de p95 del login (RT-021, ≤ 1 s) da 340–500 ms en solitario y más de 1 s cuando coincide con el hook o con una tanda E2E. En CI no compite; en local da falsos rojos.
  - Docker en WSL con 2 CPU y 2,8 GB: builds de 20–44 min. Coste: unos 60 lanzamientos de subagentes (ver `retrospectiva-001-proceso.md`).
- **Desviaciones y resolución:**
  - Hallazgos de la etapa 6 (username_key, XFF, duplicados, logout) → resueltos en el hito 5; la 2.ª pasada del revisor confirma RT-022.
  - T-49: la comprobación del bundle (secreto fuera de estáticos) se sustituyó por `apps/web/src/shared/api/server-secret-boundary.test.ts`. Anotado en la tarea.
  - `tasks.md` tenía la línea 1 corrupta (`---[x] |…`); corregida en el cierre.
  - Pendientes de seguimiento (no son tareas de otra spec; detalle en `specs/00-vision/roadmap.md`, sección «Seguimiento de la 001»): TRUST_PROXY=0 en producción; prueba de IPv4 mapeada en `client-ip`; registro de IP y user-agent en logs (decisión del dueño, RT-006); hook `use-login-form.ts` de ~70 líneas; literales y formato menores; dos llamadas a `/v1/auth/session` por carga del panel; aviso GHSA-rgwj-5xj2-c3m3 en mysql2 (override 3.22.0 → 3.23.1, requiere el candado de dependencias).
