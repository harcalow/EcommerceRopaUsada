---
id: ADR-003
estado: aceptada   # propuesta | aceptada | reemplazada por ADR-XXX
aprobacion: dueño (Harold) el 2026-10-15, aplicada por el orquestador con su autorización explícita en el chat
fecha: 2026-10-15
---

# ADR-003 — Docker para desarrollo y despliegue

## Contexto
El entorno debe ser reproducible para cualquier persona o agente: mismas versiones de base de datos y servicios, sin instalar nada en la máquina salvo Docker. También se busca que la imagen que se prueba en local sea la que llega a producción.

## Opciones consideradas
1. **Docker Compose para la infraestructura local + Dockerfiles multi-stage por aplicación.**
   - Pros: reproducible y portable entre proveedores de hosting.
   - Contras: requiere Docker Desktop en Windows y macOS.
2. **Servicios instalados en local.**
   - Contras: "en mi máquina funciona", versiones divergentes y difícil para los agentes.
3. **Entornos solo en la nube (Codespaces o similar).**
   - Contras: coste y dependencia de conexión.

## Decisión
Opción 1.

### Desarrollo (`docker-compose.yml`)
- **Siempre se levantan:**
  - `postgres`: base de datos.
  - `storage`: emulador compatible con S3 para las fotos de prendas. Al usar la API S3, el proveedor real (AWS S3, Cloudflare R2…) será solo configuración. La imagen concreta se elige al implementar, verificando su licencia y disponibilidad.
  - `mailpit`: captura los emails de desarrollo.
- **Perfil `apps`:** `api` y `web` con recarga en caliente, montando el código como volumen.
- `.env.example` documenta todas las variables; `.env` nunca se versiona.

### Producción
- Un Dockerfile multi-stage por aplicación desplegable (`apps/api`, `apps/web`) que use `turbo prune` para copiar solo lo necesario.
- Imagen final mínima, ejecutada con un usuario no root y con versiones de imagen base fijadas.

### Fuera de Docker
- **`apps/mobile`:** Expo necesita el dispositivo o emulador del desarrollador; las compilaciones de iOS y Android se hacen en EAS Build. En local, la app apunta a la API que corre en Docker.

## Consecuencias
- ➕ Basta con `docker compose up` para tener la infraestructura funcionando.
- ➕ El despliegue funciona en cualquier proveedor que acepte contenedores.
- ➖ Docker Desktop consume recursos en Windows; se recomienda el backend WSL2.
- Requisito previo: instalar Docker Desktop y Node.js LTS (este último para mobile, herramientas y servidores MCP).
