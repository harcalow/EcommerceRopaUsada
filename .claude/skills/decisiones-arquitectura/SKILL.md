---
name: decisiones-arquitectura
description: Cómo evaluar opciones técnicas y redactar ADRs (Architecture Decision Records) en este proyecto. Úsalo al proponer el stack, elegir una librería o servicio externo, o redactar un diseno.md.
user-invocable: false
---

# Decisiones de arquitectura (ADR)

## Cuándo hace falta un ADR
- Elegir o cambiar una pieza del stack (lenguaje, framework, base de datos, hosting).
- Incorporar un servicio externo (pagos, almacenamiento de imágenes, email, autenticación).
- Adoptar un patrón que afecta a varias funcionalidades (autenticación, manejo de errores, concurrencia).
- NO hace falta para decisiones locales a una sola tarea.

## Proceso
1. Lee los ADR existentes en `specs/01-arquitectura/adr/` para no contradecirlos.
2. Compara **al menos dos opciones** con estos criterios, en este orden:
   1. Cumple los requisitos de la spec y de la visión.
   2. Simplicidad y menor número de piezas móviles.
   3. Calidad del soporte para desarrollo asistido por IA (documentación abundante, tipado estático, convenciones claras).
   4. Coste de operación en la fase de MVP.
   5. Ecosistema y madurez.
3. Redacta el ADR con `specs/_plantillas/adr.md`, número correlativo y `estado: propuesta`.
4. Añádelo al índice `specs/01-arquitectura/adr/README.md`.
5. Si afecta al stack, actualiza `specs/01-arquitectura/stack.md` enlazando el ADR.

## Reglas
- Un ADR aceptado no se edita: se crea otro que lo reemplaza y se marca el antiguo como `reemplazada por ADR-XXX`.
- Solo el humano cambia un ADR a `aceptada` (un hook lo hace cumplir).
- Si una decisión depende de información de negocio que falta, el ADR queda en `propuesta` con la duda explícita.

## Requisitos transversales que todo plan debe considerar
- **Concurrencia sobre prendas únicas:** cómo se evita la doble venta.
- **Imágenes:** almacenamiento, redimensionado y entrega eficiente.
- **Pagos:** nunca almacenar datos de tarjeta; usar una pasarela externa.
- **Mobile-first** y rendimiento en redes móviles.
