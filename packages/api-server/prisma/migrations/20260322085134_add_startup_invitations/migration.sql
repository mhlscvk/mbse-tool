-- CreateTable
CREATE TABLE "startup_invitations" (
    "id" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "StartupRole" NOT NULL DEFAULT 'STARTUP_USER',
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "startup_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "startup_invitations_email_idx" ON "startup_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "startup_invitations_startupId_email_key" ON "startup_invitations"("startupId", "email");

-- AddForeignKey
ALTER TABLE "startup_invitations" ADD CONSTRAINT "startup_invitations_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "startups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
