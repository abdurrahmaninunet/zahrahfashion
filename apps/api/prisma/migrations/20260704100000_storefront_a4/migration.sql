CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CreateTable
CREATE TABLE "customer_sessions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_snapshots" (
    "id" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_synonyms" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "search_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_term_log" (
    "term" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "zero_result" BOOLEAN NOT NULL DEFAULT false,
    "last_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_term_log_pkey" PRIMARY KEY ("term")
);

-- CreateTable
CREATE TABLE "support_interactions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "channel" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "summary" VARCHAR(280) NOT NULL,
    "outcome" TEXT NOT NULL,
    "follow_up_at" TIMESTAMP(3),
    "follow_up_status" TEXT NOT NULL DEFAULT 'none',
    "assigned_to" TEXT,
    "parent_id" TEXT,
    "detail" JSONB,
    "staff_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_sessions_customer_id_idx" ON "customer_sessions"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_synonyms_term_key" ON "search_synonyms"("term");

-- CreateIndex
CREATE INDEX "support_interactions_customer_id_created_at_idx" ON "support_interactions"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "support_interactions_follow_up_status_follow_up_at_idx" ON "support_interactions"("follow_up_status", "follow_up_at");

-- CreateTable
CREATE TABLE "customer_credentials" (
    "customer_id" TEXT NOT NULL,
    "email_or_phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),

    CONSTRAINT "customer_credentials_pkey" PRIMARY KEY ("customer_id")
);

