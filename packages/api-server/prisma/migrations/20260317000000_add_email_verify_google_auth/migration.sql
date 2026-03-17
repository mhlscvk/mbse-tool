-- AlterTable: make passwordHash optional (for Google OAuth users)
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AddColumn: email verification
ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "verifyToken" TEXT;
ALTER TABLE "users" ADD COLUMN "verifyTokenExp" TIMESTAMP(3);

-- AddColumn: Google OAuth
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
