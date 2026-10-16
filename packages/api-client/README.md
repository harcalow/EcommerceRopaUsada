# @perchados/api-client

Cliente tipado de la API, generado desde el OpenAPI.

## Propósito
Es el único medio por el que web y mobile llaman a la API.

## Qué contiene
- Código generado a partir del OpenAPI de `packages/contracts`.
- Configuración mínima (URL base, cabecera de correlación).

## Quién lo usa
- `apps/web` y `apps/mobile`.
- Las pruebas de contrato.

## Reglas
- ✅ Se regenera con el script de generación cuando cambia el contrato.
- ❌ No se edita a mano.
- ❌ Las apps no usan `fetch` ni `axios` directos contra la API.

## Capa en que se rellena
001 (base técnica), cuando exista el primer OpenAPI; después, con cada rebanada.
