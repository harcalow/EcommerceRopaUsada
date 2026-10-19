---
name: preparar-entorno
description: Checklist del entorno local antes de la etapa 5 (o de levantar la app): dependencias, .env, Docker en WSL, base de datos, Playwright, MCP y procesos o candados huérfanos. Úsala al empezar /implementar, /verificar o cuando el usuario pida levantar el proyecto.
---

Comprueba en este orden. Cada comando lleva `timeout`, y nada queda en primer plano. Informa en una tabla `comprobación → ok / falta → cómo se arregla`. **Detente** si falta algo que solo puede hacer el usuario.

| # | Comprobación | Cómo |
|---|---|---|
| 1 | Node 24 y pnpm 10 | `node -v`, `pnpm -v` |
| 2 | Dependencias instaladas y lockfile al día | `timeout 600 pnpm install --frozen-lockfile` |
| 3 | `.env` completo | No se puede leer (está bloqueado). Compara la **lista de claves** de `.env.example` con lo que el usuario confirme. Si falta alguna, dale un comando que genere el valor y lo añada **sin mostrarlo**: `node -e "require('fs').appendFileSync('.env','\nCLAVE='+require('crypto').randomBytes(32).toString('base64url')+'\n')"`. La validación de arranque (`env.schema.ts` en la api, `server-env.ts` en la web) es la prueba definitiva. |
| 4 | Docker Engine en WSL | En Windows no existe el comando `docker`. Usa `MSYS_NO_PATHCONV=1 timeout 300 wsl.exe -d Ubuntu --cd <ruta /mnt/c o ~/ del repo> -- docker compose up -d`, y después `docker ps` con el mismo `wsl.exe`. `pnpm infra:up` solo funciona dentro de WSL. |
| 5 | Migraciones y semilla | `timeout 300 pnpm db:migrate:deploy` y `timeout 300 pnpm db:seed` |
| 6 | Navegadores de Playwright | `timeout 600 pnpm --filter @perchados/web exec playwright install chromium` (solo si van a correr E2E) |
| 7 | MCP del proyecto | Context7, Engram, Playwright y GitHub conectados. Si Context7 falla, verifica las versiones con `npm view <paquete> version` y anótalo. |
| 8 | Sin procesos ni candados huérfanos | Puertos 3000 y 3001 libres (`netstat -ano`). Candados `%LOCALAPPDATA%\Temp\vitest-coverage-*.lock` cuyo PID no sea un `node.exe` vivo: bórralos (el hook `pruebas_afectadas.py` también lo hace). |
| 9 | Recursos de WSL | `%USERPROFILE%\.wslconfig`. Recomendado: repo clonado dentro de WSL (`~/proyectos/…`), no en `/mnt/c`. |

**Para levantar la app** (cuando el usuario quiera probar): las comprobaciones 1 a 5, y después `pnpm dev` en segundo plano. Espera a que respondan `http://localhost:3001/v1/health` y `http://localhost:3000/login`. Al terminar, detén `pnpm dev`, libera los puertos y ejecuta `docker compose down` vía `wsl.exe`.
