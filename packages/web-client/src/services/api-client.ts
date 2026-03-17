import { useAuthStore } from '../store/auth.js';

const BASE_URL = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message ?? `Request failed: ${res.status}`);
  }
  return json.data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ accessToken: string; user: import('@systemodel/shared-types').User }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string) =>
      request<{ accessToken: string; user: import('@systemodel/shared-types').User }>('/auth/register', {
        method: 'POST', body: JSON.stringify({ email, password, name }),
      }),
    me: () => request<import('@systemodel/shared-types').User>('/auth/me'),
    google: (credential: string) =>
      request<{ accessToken: string; user: import('@systemodel/shared-types').User }>('/auth/google', {
        method: 'POST', body: JSON.stringify({ credential }),
      }),
    resendVerify: () => request<{ message: string }>('/auth/resend-verify', { method: 'POST' }),
  },
  projects: {
    list: () => request<import('@systemodel/shared-types').Project[]>('/projects'),
    create: (name: string, description?: string) =>
      request<import('@systemodel/shared-types').Project>('/projects', {
        method: 'POST', body: JSON.stringify({ name, description }),
      }),
    get: (id: string) => request<import('@systemodel/shared-types').Project>(`/projects/${id}`),
    delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
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
    delete: (projectId: string, fileId: string) =>
      request<void>(`/projects/${projectId}/files/${fileId}`, { method: 'DELETE' }),
  },
};
