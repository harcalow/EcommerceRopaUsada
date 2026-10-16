---
id: 001
titulo: Login de administrador
tipo: vertical
---

# Contexto 001 — Login de administrador

## Idea original
El dueño entregó una spec completa del login del panel de administración y un mockup de la pantalla ([`mockup-login.png`](mockup-login.png)). Pidió evaluarla, guardarla e implementarla.

## Lo que ya existe
- Estructura agéntica, ADR-001 a ADR-006 (en `propuesta`), roadmap y plantillas.
- La capa horizontal **000** (estructura del monorepo + Docker) está especificada y diseñada, pendiente de aprobación.
- **Ningún código de aplicación:** no existen las apps web ni API, ni base de datos, sesiones, manejo de errores o design system.

## Memoria relevante
- Sin entradas en `specs/02-memoria/aprendizajes.md`. Engram aún no está instalado.
- El registro de componentes está vacío: no hay nada que reutilizar todavía.

## Clasificación
- **Tipo:** vertical. Es una historia de punta a punta (pantalla → API → datos → pruebas) con valor directo para el administrador.
- **Capas horizontales previas requeridas:**
  1. **000:** estructura del monorepo y Docker (con la base de datos PostgreSQL).
  2. **002 — Fundaciones:**
     - Apps `api` (NestJS) y `web` (Next.js) generadas, con lint, typecheck y pruebas.
     - Contratos (Zod → OpenAPI `/v1`) y cliente generado.
     - Prisma con migraciones versionadas.
     - Errores `problem+json` y logging estructurado.
     - Mecanismo de sesión y hash de contraseñas.
     - Rate limiting.
     - Tokens de marca y componentes base (botón, campo, enlace, aviso).
- **Fuera de este trabajo:** la app móvil, porque el panel es solo web.

## Riesgos y dudas iniciales
- **Seguridad:** es código de autenticación y requiere **revisión humana obligatoria** en la etapa de verificación.
- **Elección técnica de sesiones:** cookie con sesión en el servidor frente a JWT. Se decide en el diseño de 002 con un ADR.
- **Datos personales:** `HaroldAdmin` se crea desde el `.env`. Ningún agente lee ni escribe esa contraseña.
- El correo del responsable está pendiente; es configurable, así que no bloquea.
- **Entorno:** Node.js y Docker se están instalando en esta sesión.
