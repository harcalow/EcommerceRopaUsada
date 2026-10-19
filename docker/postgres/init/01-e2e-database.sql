-- Base de datos de las pruebas E2E (apps/web/e2e). Solo se crea; las migraciones las aplica
-- DATABASE_URL=postgresql://<usuario>:<clave>@localhost:5432/perchados_e2e pnpm --filter @perchados/api db:migrate:deploy
-- Idempotente. Este script solo corre con el volumen de Postgres vacío; en un volumen existente
-- se crea a mano con el mismo CREATE DATABASE (ver docker-dev).
SELECT 'CREATE DATABASE perchados_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'perchados_e2e')\gexec
