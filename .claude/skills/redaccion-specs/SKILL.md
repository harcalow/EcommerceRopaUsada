---
name: redaccion-specs
description: Guía y checklist para redactar specs funcionales de calidad (historias de usuario, requisitos RF, criterios de aceptación Given/When/Then). Úsalo al crear o revisar un spec.md.
user-invocable: false
---

# Cómo redactar una buena spec

## Historias de usuario (INVEST)
Cada historia debe ser **I**ndependiente, **N**egociable, **V**aliosa, **E**stimable, **S**mall (pequeña) y **T**estable.
Formato: `Como <rol>, quiero <acción>, para <beneficio>.` El beneficio es obligatorio.

## Requisitos funcionales
- Uno por fila, con ID `RF-NNN` único dentro de la spec.
- Redactados como "El sistema debe…", en términos observables por el usuario.
- Prioridad MoSCoW: el MVP solo incluye los **Must**.
- Sin tecnología: ❌ "guardar en PostgreSQL" → ✅ "conservar el historial de pedidos".

## Criterios de aceptación
- Cada RF tiene **al menos uno**.
- Formato: `Dado <contexto>, cuando <acción>, entonces <resultado observable>`.
- Valores concretos: ❌ "carga rápido" → ✅ "muestra los resultados en menos de 2 s con 1 000 prendas".
- Incluye el camino feliz **y** al menos un caso de error o límite.

## Checklist antes de entregar
- [ ] Todos los términos del dominio existen en `specs/00-vision/glosario.md`.
- [ ] Ningún RF menciona tecnologías.
- [ ] Cada RF tiene criterios de aceptación con valores concretos.
- [ ] La sección "Fuera de alcance" no está vacía.
- [ ] Las dudas de negocio están marcadas como `[POR ACLARAR]` en lugar de inventadas.
- [ ] Se repasaron las preguntas relevantes de la skill `dominio-ropa-usada`.

## Ejemplo
```
RF-003 — El sistema debe impedir que una prenda vendida se compre de nuevo.  (Must)

CA-005 (RF-003): Dado que la prenda "Chaqueta vaquera Levi's" está vendida,
cuando un usuario abre su ficha,
entonces ve la etiqueta "Vendida" y el botón "Comprar" no está disponible.
```
