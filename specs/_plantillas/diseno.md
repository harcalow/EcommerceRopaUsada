---
id: NNN
spec: ./spec.md
estado: borrador # borrador | aprobada | cumplida
autor: arquitecto
---

# Diseño NNN — <Título>

## Resumen de la solución

## Cobertura de requisitos
| RF / CB | Cómo se resuelve |
|---------|------------------|
| RF-001 | |

## Componentes
<!-- Módulos de la API, pantallas y componentes de web/mobile, paquetes compartidos.
     Incluye estados de UI: carga, vacío, error. -->

## Contratos de API
<!-- Endpoints: método, ruta, request, response, errores. Esquemas en packages/contracts. -->

## Modelo de datos
<!-- Entidades, campos, relaciones, índices y migraciones. -->

## Impacto en lo existente
<!-- Qué código, contratos, datos o specs cambian. Riesgo de regresión.
     Para rebanadas verticales: confirmar que NO se crea infraestructura nueva. -->

## Decisiones técnicas
<!-- ADR nuevos o existentes. -->

## Requisitos por plataforma (ADR-006)
<!-- Solo las plataformas afectadas:
- Web: componentes del design system usados, accesibilidad, impacto en el presupuesto (LCP/INP/CLS, JS inicial).
- API: ruta del contrato OpenAPI, versión (/v1), errores problem+json nuevos, migraciones, rate limits.
- Móvil: comportamiento sin conexión, permisos del dispositivo, impacto en el tamaño del binario.
- Integraciones: timeouts, reintentos, idempotencia, adaptador fake o sandbox, alertas. -->

## Seguridad y privacidad

## Estrategia de pruebas
<!-- Unitarias, integración, e2e; qué CA y CB cubre cada nivel. -->

## Riesgos
