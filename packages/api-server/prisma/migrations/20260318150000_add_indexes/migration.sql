-- Add unique index on verifyToken for fast email verification lookups
CREATE UNIQUE INDEX IF NOT EXISTS "users_verifyToken_key" ON "users"("verifyToken");

-- Add index on projects.ownerId for fast project listing by user
CREATE INDEX IF NOT EXISTS "projects_ownerId_idx" ON "projects"("ownerId");

-- Add index on mcp_tokens(userId, revoked) for filtered token queries
CREATE INDEX IF NOT EXISTS "mcp_tokens_userId_revoked_idx" ON "mcp_tokens"("userId", "revoked");
