---
name: explorar
description: Etapa 1 SDD — Explora código, specs y memoria existentes y resume el contexto de una nueva funcionalidad (contexto.md)
argument-hint: <descripción de la funcionalidad>
disable-model-invocation: true
---

Funcionalidad: $ARGUMENTS

1. Calcula el siguiente número `NNN` en `specs/features/` y un nombre corto en kebab-case.
2. Delega en el subagente `explorador`. Pásale la descripción y `NNN`, y pídele el contenido de `contexto.md`. No explores tú mismo: así tu contexto queda limpio.
3. Con su salida, crea `specs/features/NNN-nombre/contexto.md` a partir de `specs/_plantillas/contexto.md`.
4. Añade la funcionalidad a `specs/features/README.md`.
5. Muestra el resumen al usuario. Si faltan capas horizontales previas, destácalo.
6. DETENTE. No requiere aprobación. El siguiente paso es `/especificar NNN`.
