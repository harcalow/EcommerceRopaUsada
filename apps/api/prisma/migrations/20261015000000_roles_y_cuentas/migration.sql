-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "username_key" VARCHAR(64) NOT NULL,
    "role_id" UUID NOT NULL,
    "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "password_hash" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "account_username_key_key" ON "account"("username_key");

-- CreateIndex
CREATE INDEX "account_role_id_idx" ON "account"("role_id");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dato de referencia: toda base de datos necesita el rol administrador
INSERT INTO "role" ("id", "code", "name")
VALUES (gen_random_uuid(), 'admin', 'administrador')
ON CONFLICT ("code") DO NOTHING;
