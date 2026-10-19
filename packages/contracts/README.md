# @perchados/contracts

Fuente de verdad del contrato de la API.

## Propósito
Define los esquemas Zod de entradas y salidas de la API y de ellos se genera el OpenAPI versionado en `/v1`. Los errores siguen `application/problem+json` (`type`, `title`, `status`, `detail`, `correlationId`).

## Qué contiene
- Esquemas Zod por rebanada (peticiones, respuestas, errores).
- Esquema común de `problem+json`.
- Generación del documento OpenAPI.

## Quién lo usa
- `apps/api`: valida entradas y salidas.
- `packages/api-client`: genera el cliente a partir del OpenAPI.

## Reglas
- ✅ Contract-first: la primera tarea de toda rebanada con API define o actualiza el esquema aquí.
- ✅ Rutas bajo `/v1`; un cambio incompatible exige `/v2` y convivencia.
- ❌ No definir tipos de petición o respuesta ad hoc en las apps.
- ❌ No romper `/v1` una vez publicado.

## Capa en que se rellena
001 (base técnica): esquema `problem+json` y base de OpenAPI. Después, cada rebanada añade los suyos.
