import { useAuthStore } from '../store/auth.js';

const BASE_URL = '/api';
const REQUEST_TIMEOUT_MS = 30_000;
let redirectingTo401 = false;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const json = await res.json();

    if (!res.ok) {
      // Auto-logout on expired/invalid token (prevent multiple redirects)
      if (res.status === 401 && token && !redirectingTo401) {
        redirectingTo401 = true;
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
      throw new Error(json.message ?? `Request failed: ${res.status}`);
    }
    return json.data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ accessToken: string; user: import('@systemodel/shared-types').User }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string) =>
      request<{ user: import('@systemodel/shared-types').User; message: string }>('/auth/register', {
        method: 'POST', body: JSON.stringify({ email, password, name }),
      }),
    me: () => request<import('@systemodel/shared-types').User>('/auth/me'),
    google: (credential: string) =>
      request<{ accessToken: string; user: import('@systemodel/shared-types').User }>('/auth/google', {
        method: 'POST', body: JSON.stringify({ credential }),
      }),
    resendVerify: (email: string) => request<{ message: string }>('/auth/resend-verify', {
      method: 'POST', body: JSON.stringify({ email }),
    }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string }>('/auth/password', {
        method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }),
      }),
    forgotPassword: (email: string) =>
      request<{ message: string }>('/auth/forgot-password', {
        method: 'POST', body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, newPassword: string) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST', body: JSON.stringify({ token, newPassword }),
      }),
  },
  projects: {
    list: () => request<import('@systemodel/shared-types').Project[]>('/projects'),
    create: (name: string, description?: string, parentId?: string) =>
      request<import('@systemodel/shared-types').Project>('/projects', {
        method: 'POST', body: JSON.stringify({ name, description, parentId }),
      }),
    get: (id: string) => request<import('@systemodel/shared-types').Project>(`/projects/${id}`),
    rename: (id: string, name: string, description?: string) =>
      request<import('@systemodel/shared-types').Project>(`/projects/${id}`, {
        method: 'PATCH', body: JSON.stringify({ name, description }),
      }),
    delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    clone: (id: string) => request<import('@systemodel/shared-types').Project>(`/projects/${id}/clone`, { method: 'POST' }),
    download: (id: string) => `${BASE_URL}/projects/${id}/download`,
  },
  files: {
    list: (projectId: string) =>
      request<import('@systemodel/shared-types').SysMLFile[]>(`/projects/${projectId}/files`),
    create: (projectId: string, name: string, content: string) =>
      request<import('@systemodel/shared-types').SysMLFile>(`/projects/${projectId}/files`, {
        method: 'POST', body: JSON.stringify({ name, content }),
      }),
    get: (projectId: string, fileId: string) =>
      request<import('@systemodel/shared-types').SysMLFile>(`/projects/${projectId}/files/${fileId}`),
    update: (projectId: string, fileId: string, content: string) =>
      request<import('@systemodel/shared-types').SysMLFile>(`/projects/${projectId}/files/${fileId}`, {
        method: 'PUT', body: JSON.stringify({ content }),
      }),
    rename: (projectId: string, fileId: string, name: string) =>
      request<import('@systemodel/shared-types').SysMLFile>(`/projects/${projectId}/files/${fileId}`, {
        method: 'PATCH', body: JSON.stringify({ name }),
      }),
    delete: (projectId: string, fileId: string) =>
      request<void>(`/projects/${projectId}/files/${fileId}`, { method: 'DELETE' }),
    download: (projectId: string, fileId: string) =>
      `${BASE_URL}/projects/${projectId}/files/${fileId}/download`,
    move: (projectId: string, fileId: string, targetProjectId: string) =>
      request<import('@systemodel/shared-types').SysMLFile>(`/projects/${projectId}/files/${fileId}/move`, {
        method: 'POST', body: JSON.stringify({ targetProjectId }),
      }),
  },
  aiKeys: {
    list: () => request<AiKeyInfo[]>('/ai/keys'),
    save: (provider: string, apiKey: string, model: string) =>
      request<AiKeySaveResult>('/ai/keys', {
        method: 'POST', body: JSON.stringify({ provider, apiKey, model }),
      }),
    updateModel: (provider: string, model: string) =>
      request<{ provider: string; model: string }>(`/ai/keys/${provider}`, {
        method: 'PATCH', body: JSON.stringify({ model }),
      }),
    remove: (provider: string) =>
      request<{ success: boolean }>(`/ai/keys/${provider}`, { method: 'DELETE' }),
  },
  admin: {
    syncExamples: () =>
      request<{ message: string }>('/admin/sync-examples', { method: 'POST' }),
  },
  mcpTokens: {
    list: () => request<McpTokenInfo[]>('/mcp-tokens'),
    create: (name: string, expiresInDays?: number) =>
      request<McpTokenCreated>('/mcp-tokens', {
        method: 'POST',
        body: JSON.stringify({ name, expiresInDays }),
      }),
    revoke: (id: string) =>
      request<{ success: boolean }>(`/mcp-tokens/${id}`, { method: 'DELETE' }),
  },
};

export interface AiKeyInfo {
  id: string;
  provider: string;
  maskedKey: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiKeySaveResult {
  provider: string;
  maskedKey: string;
  fullKey: string; // shown once
  model: string;
}

export interface McpTokenInfo {
  id: string;
  name: string;
  token: string;
  lastUsed: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface McpTokenCreated {
  id: string;
  name: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
}
