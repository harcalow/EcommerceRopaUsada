---
id: ADR-007
estado: aceptada   # propuesta | aceptada | reemplazada por ADR-XXX
aprobacion: dueño (Harold) el 2026-10-15, aplicada por el orquestador con su autorización explícita en el chat
fecha: 2026-10-15
---

# ADR-007 — Sesión en servidor con cookie opaca y hash argon2id

## Contexto
La 002 (RF-020 a RF-026) y la 001 exigen:
- Caducidad **absoluta** configurable (8 h) que la actividad no prolonga, con un error distinto para «sesión caducada».
- **Revocación inmediata:** al cerrar sesión se revoca la actual; al desactivar la cuenta, todas.
- Rol leído de la base de datos, sesiones simultáneas y protección CSRF.
- Hash lento con sal y parámetros ≥ OWASP, con una verificación de entre 100 y 500 ms.

**Entorno:** se desarrolla en Windows 11 con Docker Desktop (contenedores Linux) y se despliega en contenedores (ADR-003). Más adelante llegará una app móvil (Expo).

## Opciones consideradas

### Mecanismo de sesión
1. **Sesión en servidor (PostgreSQL) + cookie opaca HttpOnly.**
   - **Pros:**
     - Revocación inmediata y trivial (`revoked_at`).
     - Caducidad absoluta guardada en la fila, inmune a reinicios y al reloj del proceso (CB-017).
     - El rol y el estado se leen de la BD en cada petición, así que un cambio de rol o una desactivación se aplica al instante.
     - La cookie no revela nada (CA-026).
     - Sin secretos de firma que rotar.
     - La misma credencial opaca servirá a la app móvil en `Authorization: Bearer`.
   - **Contras:**
     - Una consulta a la BD por petición autenticada (indexada; irrelevante en el MVP).
     - Necesita una tabla y su limpieza.
2. **JWT sin estado (cookie o cabecera).**
   - **Pros:** sin consulta por petición; estándar conocido.
   - **Contras:**
     - Revocar exige una lista de revocación o una consulta a la BD, lo que reintroduce el estado y anula la ventaja.
     - El rol queda congelado en el token hasta que caduca.
     - Hace falta gestionar y rotar el secreto o las claves, con riesgo de errores de configuración (`alg`, `none`, verificación).
     - El tamaño de la cookie es mayor.
3. **JWT de acceso corto + *refresh token* en BD.**
   - **Contras:** dos credenciales, rotación del *refresh token* y una ventana de minutos sin revocación. Más piezas para el mismo resultado que la opción 1.

### Algoritmo de hash
1. **argon2id** (`@node-rs/argon2`, napi-rs).
   - **Pros:**
     - Primera recomendación de OWASP; resistente a GPU y ASIC por su coste de memoria.
     - Sin límite de 72 bytes: admite emojis y contraseñas largas (CB-012).
     - Binarios **precompilados** para `win32-x64`, `linux-x64-gnu/musl` y `arm64`: sin `node-gyp` ni compiladores en Windows ni en imágenes `slim`/`alpine`.
   - **Contras:**
     - Consumo de memoria por hash (se acota con los parámetros y con el límite de peticiones).
     - Dependencia nativa (mitigada con los binarios precompilados y la instalación dentro del contenedor).
2. **bcrypt** (`bcrypt` nativo o `bcryptjs`).
   - **Pros:** muy extendido; `bcryptjs` no tiene dependencias nativas.
   - **Contras:**
     - Trunca a 72 bytes, con riesgo en contraseñas largas o multibyte.
     - OWASP lo considera solo para sistemas heredados.
     - Sin dureza de memoria.
     - `bcryptjs` es lento en JS puro y bloquea el *event loop*.
     - `bcrypt` nativo arrastra los problemas de `node-gyp` en Windows.

## Decisión
**Sesión en servidor con cookie opaca + argon2id.**

### Sesión
- **Token:** 32 bytes de `crypto.randomBytes` codificados en base64url. En la tabla `session` solo se guarda su **SHA-256**, de modo que una fuga de la BD no permite suplantar sesiones.
- **Fila de sesión:** `account_id`, `created_at`, `expires_at = created_at + SESSION_TTL_HOURS`, `revoked_at` y `csrf_token_hash`.
- **Validación (una sola consulta):**

  | Situación | Respuesta |
  |-----------|-----------|
  | Token inexistente o revocado | 401 `auth/unauthenticated` |
  | `now ≥ expires_at` | 401 `auth/session-expired` |
  | Cuenta `DISABLED` | 401 |
  | Rol | Se lee de `role.code` |

- **Login:** genera un identificador nuevo y revoca el que traiga la petición (protección contra la fijación de sesión).
- **Cierre de sesión:** revoca la sesión actual y es idempotente.
- **Desactivación de la cuenta:** revoca todas sus sesiones en la misma transacción.
- **Sesiones simultáneas:** independientes.
- **Cookie `perchados_sid`:**
  - Atributos: `HttpOnly; SameSite=Strict; Path=/; Secure` (salvo `APP_ENV` `development`/`test`; con `Secure` lleva el prefijo `__Secure-`).
  - `Max-Age` = TTL + 24 h, para que tras caducar se siga enviando y se pueda responder `session-expired`.
  - `Domain` = `SESSION_COOKIE_DOMAIN` en producción.
- **Topología:**
  - El navegador llama a la API directamente con CORS restringido y credenciales.
  - Web y API deben compartir el **dominio registrable** (`perchados.com` / `api.perchados.com`). En local, `localhost:3000` y `localhost:3001` son el mismo sitio.
  - El servidor Next reenvía la cookie en sus llamadas a la API.
- **CSRF:** token sincronizador aleatorio por sesión, en la cookie `perchados_csrf` (legible por JS, `SameSite=Strict`) y guardado hasheado en la sesión.
  - Los métodos no seguros con sesión exigen la cabecera `X-CSRF-Token`, comparada en tiempo constante.
  - Todos los métodos no seguros rechazan un `Origin` presente que no esté en la lista de CORS. Esto cubre el login, que aún no tiene sesión.
  - Es defensa en profundidad sobre `SameSite=Strict`.
- **No se usa secreto de firma** (`SESSION_SECRET`): nada se firma.

### Hash
- **Algoritmo:** argon2id con `@node-rs/argon2`.
- **Parámetros iniciales:** `m = 19456 KiB, t = 4, p = 1`. Superan el mínimo OWASP (`m = 19 MiB, t = 2, p = 1`) y se calibran en el hito 2 para que una verificación tarde entre 100 y 500 ms.
- **Mínimos en la configuración:** la configuración rechaza cualquier combinación por debajo de la tabla OWASP según `t` (1 → 47104, 2 → 19456, 3 → 12288, 4 → 9216, ≥ 5 → 7168 KiB).
- **Rehash:** si los parámetros guardados en el hash son inferiores a los vigentes, se rehashea tras un login correcto.
- **Normalización:** NFC antes de hashear; longitud máxima de 128 caracteres.
- **Anti-enumeración:** `verifyDummy()` usa un hash ficticio calculado al arrancar, para igualar los tiempos cuando la cuenta no existe (CB-011).

## Consecuencias
- ➕ Revocación y caducidad absoluta exactas, y rol siempre actualizado, con el mínimo de piezas: solo PostgreSQL, sin Redis ni claves.
- ➕ Sin compiladores nativos en Windows ni en Docker. El `node_modules` del contenedor se instala dentro de él (volumen con nombre), nunca se comparte con Windows.
- ➕ El mismo token opaco servirá a la app móvil, en `Authorization: Bearer` y almacenamiento seguro, cuando llegue. Esa decisión se completará en su ADR.
- ➖ Una consulta a la BD por petición autenticada.
- ➖ El despliegue debe mantener web y API en el mismo dominio registrable: es una restricción para la futura capa de CD.
- ➖ El hash consume unos 19 MiB por verificación concurrente; queda acotado por el límite de 10/min en auth.
- Quedan pendientes la limpieza periódica de las sesiones caducadas (capa de tareas programadas) y, si la auditoría de la 001 lo requiere, guardar IP o *user agent* en la sesión.
- La auditoría de seguridad del hito 2 es **revisión humana obligatoria**.
