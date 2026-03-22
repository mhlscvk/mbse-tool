-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('SYSTEM', 'STARTUP', 'USER');

-- CreateEnum
CREATE TYPE "StartupRole" AS ENUM ('SITE_ADMIN', 'STARTUP_ADMIN', 'STARTUP_USER');

-- CreateEnum
CREATE TYPE "LockOperation" AS ENUM ('CHECK_OUT', 'CHECK_IN');

-- CreateTable
CREATE TABLE "startups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "startups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "startup_members" (
    "id" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StartupRole" NOT NULL DEFAULT 'STARTUP_USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "startup_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "element_locks" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "element_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lock_notifications" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "message" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lock_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" "LockOperation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add displayId and projectType to projects
ALTER TABLE "projects" ADD COLUMN "displayId" TEXT;
ALTER TABLE "projects" ADD COLUMN "projectType" "ProjectType" NOT NULL DEFAULT 'USER';
ALTER TABLE "projects" ADD COLUMN "startupId" TEXT;

-- Backfill displayId for existing projects
UPDATE "projects" SET "displayId" = 'PRJ-USR-LEGACY-' || id WHERE "displayId" IS NULL AND "isSystem" = false;
UPDATE "projects" SET "displayId" = 'PRJ-SYS-0001-' || id WHERE "displayId" IS NULL AND "isSystem" = true;

-- Set projectType for existing system projects
UPDATE "projects" SET "projectType" = 'SYSTEM' WHERE "isSystem" = true;

-- Now make displayId NOT NULL and UNIQUE
ALTER TABLE "projects" ALTER COLUMN "displayId" SET NOT NULL;

-- AlterTable: Add displayId to sysml_files
ALTER TABLE "sysml_files" ADD COLUMN "displayId" TEXT;

-- Backfill displayId for existing files
UPDATE "sysml_files" SET "displayId" = 'FIL-' || id WHERE "displayId" IS NULL;

-- Now make displayId NOT NULL
ALTER TABLE "sysml_files" ALTER COLUMN "displayId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "startups_slug_key" ON "startups"("slug");
CREATE UNIQUE INDEX "startup_members_startupId_userId_key" ON "startup_members"("startupId", "userId");
CREATE INDEX "startup_members_startupId_idx" ON "startup_members"("startupId");
CREATE INDEX "startup_members_userId_idx" ON "startup_members"("userId");
CREATE UNIQUE INDEX "projects_displayId_key" ON "projects"("displayId");
CREATE INDEX "projects_startupId_idx" ON "projects"("startupId");
CREATE UNIQUE INDEX "sysml_files_displayId_key" ON "sysml_files"("displayId");
CREATE UNIQUE INDEX "element_locks_displayId_key" ON "element_locks"("displayId");
CREATE UNIQUE INDEX "element_locks_fileId_elementName_key" ON "element_locks"("fileId", "elementName");
CREATE INDEX "element_locks_fileId_idx" ON "element_locks"("fileId");
CREATE INDEX "element_locks_lockedBy_idx" ON "element_locks"("lockedBy");
CREATE UNIQUE INDEX "lock_notifications_displayId_key" ON "lock_notifications"("displayId");
CREATE INDEX "lock_notifications_holderId_read_idx" ON "lock_notifications"("holderId", "read");
CREATE INDEX "lock_notifications_requesterId_idx" ON "lock_notifications"("requesterId");
CREATE INDEX "audit_logs_projectId_fileId_idx" ON "audit_logs"("projectId", "fileId");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "startup_members" ADD CONSTRAINT "startup_members_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "startups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "startup_members" ADD CONSTRAINT "startup_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "startups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "element_locks" ADD CONSTRAINT "element_locks_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "sysml_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "element_locks" ADD CONSTRAINT "element_locks_lockedBy_fkey" FOREIGN KEY ("lockedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lock_notifications" ADD CONSTRAINT "lock_notifications_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lock_notifications" ADD CONSTRAINT "lock_notifications_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
