// REST API request/response types

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'viewer' | 'editor' | 'admin';
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export type ProjectType = 'SYSTEM' | 'STARTUP' | 'USER';

export interface Project {
  id: string;
  displayId: string;
  name: string;
  description?: string;
  projectType: ProjectType;
  ownerId: string;
  startupId?: string | null;
  parentId: string | null;
  depth: number;
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
  children?: Project[];
  _count?: { files: number; children: number };
}

export interface SysMLFile {
  id: string;
  displayId: string;
  projectId: string;
  name: string;
  content: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface Startup {
  id: string;        // e.g. "ENT-NUMERIC-001"
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number; projects: number };
  memberRole?: StartupRole;
}

export type StartupRole = 'SITE_ADMIN' | 'STARTUP_ADMIN' | 'STARTUP_USER';

export interface StartupMember {
  id: string;
  startupId: string;
  userId: string;
  role: StartupRole;
  user?: { id: string; email: string; name: string };
  createdAt: string;
}

export type ElementLockStatus = 'available' | 'checked_out' | 'read_only';

export interface ElementLock {
  id: string;
  displayId: string;   // e.g. "ELM-54PQ9"
  fileId: string;
  elementName: string;
  lockedBy: string;
  user?: { id: string; name: string; email: string };
  lockedAt: string;
}

export interface LockNotification {
  id: string;
  displayId: string;   // e.g. "NTF-99321"
  elementName: string;
  projectId: string;
  projectName: string;
  fileId: string;
  fileName: string;
  requesterId: string;
  holderId: string;
  requester?: { id: string; name: string; email: string };
  holder?: { id: string; name: string; email: string };
  message?: string | null;
  read: boolean;
  createdAt: string;
}

export type LockOperation = 'CHECK_OUT' | 'CHECK_IN';

export interface AuditLogEntry {
  id: string;
  projectId: string;
  fileId: string;
  elementName: string;
  userId: string;
  user?: { id: string; name: string; email: string };
  operation: LockOperation;
  createdAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export type ApiResponse<T> = { data: T; error?: never } | { data?: never; error: ApiError };
