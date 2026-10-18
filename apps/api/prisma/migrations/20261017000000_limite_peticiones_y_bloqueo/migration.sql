-- CreateTable
CREATE TABLE "login_attempt_unknown" (
    "username_key" VARCHAR(64) NOT NULL,
    "failed_attempts" INTEGER NOT NULL,
    "locked_until" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "login_attempt_unknown_pkey" PRIMARY KEY ("username_key")
);

-- CreateTable
CREATE TABLE "rate_limit_counter" (
    "key" VARCHAR(255) NOT NULL,
    "hits" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_counter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "login_attempt_unknown_updated_at_idx" ON "login_attempt_unknown"("updated_at");

-- CreateIndex
CREATE INDEX "rate_limit_counter_expires_at_idx" ON "rate_limit_counter"("expires_at");
