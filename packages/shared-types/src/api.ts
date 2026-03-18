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

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
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
  projectId: string;
  name: string;
  content: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export type ApiResponse<T> = { data: T; error?: never } | { data?: never; error: ApiError };
