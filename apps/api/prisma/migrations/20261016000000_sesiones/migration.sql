-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "csrf_token_hash" CHAR(64) NOT NULL,
    "account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_hash_key" ON "session"("token_hash");

-- CreateIndex
CREATE INDEX "session_account_id_idx" ON "session"("account_id");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
