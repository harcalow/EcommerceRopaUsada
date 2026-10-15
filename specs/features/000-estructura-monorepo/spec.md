---
id: 000
titulo: Estructura base del monorepo
tipo: horizontal
estado: borrador
autor: arquitecto
---

# Spec 000 — Estructura base del monorepo

## Contexto y objetivo
Antes de construir cualquier funcionalidad de negocio, el repositorio necesita la estructura definida en ADR-001, ADR-002 y ADR-003. Así, cada agente sabrá dónde va cada pieza y el entorno local será reproducible con Docker. Ver `contexto.md`.

## Usuarios involucrados
Equipo de desarrollo (humano y agentes de IA).

## Historias de usuario
- **HU-01:** Como agente de desarrollo, quiero una estructura de carpetas y convenciones por aplicación, para ubicar cada cambio sin improvisar.
- **HU-02:** Como desarrollador, quiero levantar la infraestructura local con un solo comando, para no instalar servicios en mi máquina.

## Requisitos funcionales
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-001 | El repositorio debe declararse como monorepo con las áreas `apps/` y `packages/`. | Must |
| RF-002 | Cada aplicación (`api`, `web`, `mobile`) y el entorno Docker deben tener una skill de convenciones con ejemplos correctos e incorrectos, referenciada desde `CLAUDE.md`. | Must |
| RF-003 | El módulo de pagos debe reflejar en su estructura el puerto y los adaptadores de ADR-002. | Must |
| RF-004 | La infraestructura local (base de datos, almacenamiento, correo) debe levantarse con Docker Compose. | Must |
| RF-005 | `api` y `web` deben tener un Dockerfile multi-stage para producción. | Must |
| RF-006 | Todas las variables de entorno deben estar documentadas en `.env.example`. | Must |

## Criterios de aceptación
```gherkin
Característica: Estructura base del monorepo

  # CA-001 (RF-001)
  Escenario: El repositorio es un monorepo
    Dado el repositorio clonado
    Cuando se revisa la raíz
    Entonces existen "apps/", "packages/", "pnpm-workspace.yaml", "turbo.json" y "tsconfig.base.json"

  # CA-002 (RF-002)
  Escenario: Las convenciones de cada app se cargan bajo demanda
    Dado las skills "nestjs-hexagonal", "nextjs-app-router", "expo-router-mvvm" y "docker-dev"
    Cuando un agente trabaja en la app o el entorno correspondiente
    Entonces la skill describe la arquitectura, la estructura y las reglas con ejemplos ✅ correctos y ❌ incorrectos
    Y "CLAUDE.md" solo las referencia

  # CA-003 (RF-003)
  Escenario: Los pagos están desacoplados del proveedor
    Dado el módulo "apps/api/src/modules/payments"
    Cuando se revisa su estructura
    Entonces existen "application/ports/", "infrastructure/adapters/mercadopago/" e "infrastructure/adapters/fake/"

  # CA-004 (RF-004)
  Escenario: Infraestructura local con un solo comando
    Dado Docker instalado y un ".env" copiado de ".env.example"
    Cuando se ejecuta "docker compose up -d"
    Entonces arrancan los servicios "postgres", "storage" y "mailpit" y sus healthchecks quedan en "healthy"

  # CA-005 (RF-005)
  Escenario: Imágenes de producción seguras
    Dado "apps/api/Dockerfile" y "apps/web/Dockerfile"
    Cuando se revisan sus etapas
    Entonces ambos tienen las etapas "dev" y "prod" y la etapa "prod" se ejecuta con un usuario no root

  # CA-006 (RF-006)
  Escenario: Variables de entorno documentadas
    Dado "docker-compose.yml"
    Cuando se listan las variables que usa
    Entonces todas existen en ".env.example" con un valor de ejemplo no sensible
```

## Casos borde
| ID | Situación | Comportamiento esperado | RF |
|----|-----------|-------------------------|----|
| CB-001 | Se ejecuta `docker compose up` sin el perfil `apps` | Solo arranca la infraestructura (las apps aún no existen) | RF-004 |
| CB-002 | Los puertos 5432, 8025 o 9000 ya están ocupados en la máquina | Los puertos publicados son configurables desde `.env` | RF-004, RF-006 |
| CB-003 | Se intenta versionar `.env` | `.gitignore` lo excluye | RF-006 |
| CB-004 | Se reinician los contenedores | Los datos de `postgres` y `storage` persisten en volúmenes con nombre | RF-004 |

## Requisitos no funcionales
- No se instalan dependencias ni se generan proyectos con CLIs en esta funcionalidad.
- No se escribe lógica de negocio.

## Fuera de alcance
- Generar las aplicaciones Next.js, NestJS y Expo (siguiente capa horizontal).
- Pipeline de CI/CD y despliegue.

## Preguntas abiertas
- Ninguna que bloquee esta funcionalidad.
