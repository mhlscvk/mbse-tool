import { useAuthStore } from '../store/auth.js';

const BASE_URL = '/api';
const REQUEST_TIMEOUT_MS = 30_000;

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
      // Auto-logout on expired/invalid token (use store flag to prevent multiple redirects)
      if (res.status === 401 && token) {
        const store = useAuthStore.getState();
        if (store.token) {
          store.clearAuth();
          window.location.href = '/login';
        }
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
    create: (name: string, description?: string, parentId?: string, projectType?: import('@systemodel/shared-types').ProjectType, startupId?: string) =>
      request<import('@systemodel/shared-types').Project>('/projects', {
        method: 'POST', body: JSON.stringify({ name, description, parentId, projectType, startupId }),
      }),
    get: (id: string) => request<import('@systemodel/shared-types').Project>(`/projects/${id}`),
    rename: (id: string, name: string, description?: string) =>
      request<import('@systemodel/shared-types').Project>(`/projects/${id}`, {
        method: 'PATCH', body: JSON.stringify({ name, description }),
      }),
    delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
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
    listUsers: () =>
      request<import('@systemodel/shared-types').User[]>('/admin/users'),
    listUserProjects: (userId: string) =>
      request<{ user: { id: string; name: string; email: string }; projects: Array<{ id: string; displayId: string; name: string; description?: string; projectType: string; createdAt: string; updatedAt: string; _count: { files: number; children: number } }> }>(`/admin/users/${userId}/projects`),
    listProjectFiles: (projectId: string) =>
      request<Array<{ id: string; displayId: string; name: string; size: number; createdAt: string; updatedAt: string }>>(`/admin/projects/${projectId}/files`),
    readFile: (fileId: string) =>
      request<{ id: string; displayId: string; name: string; content: string; size: number; projectId: string }>(`/admin/files/${fileId}`),
  },
  bugReports: {
    create: (description: string, pageUrl: string, screenshot?: string) =>
      request<BugReportInfo>('/bug-reports', {
        method: 'POST', body: JSON.stringify({ description, pageUrl, screenshot }),
      }),
    list: (status?: string, page = 1, limit = 20) =>
      request<{ reports: BugReportInfo[]; total: number }>(`/bug-reports?${new URLSearchParams({
        ...(status ? { status } : {}), page: String(page), limit: String(limit),
      })}`),
    updateStatus: (id: string, status: string) =>
      request<BugReportInfo>(`/bug-reports/${id}`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      }),
    delete: (id: string) =>
      request<void>(`/bug-reports/${id}`, { method: 'DELETE' }),
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
  startups: {
    list: () => request<import('@systemodel/shared-types').Startup[]>('/startups'),
    create: (name: string, slug: string) =>
      request<import('@systemodel/shared-types').Startup>('/startups', {
        method: 'POST', body: JSON.stringify({ name, slug }),
      }),
    get: (id: string) => request<import('@systemodel/shared-types').Startup>(`/startups/${id}`),
    update: (id: string, data: { name?: string; slug?: string }) =>
      request<import('@systemodel/shared-types').Startup>(`/startups/${id}`, {
        method: 'PATCH', body: JSON.stringify(data),
      }),
    delete: (id: string) => request<void>(`/startups/${id}`, { method: 'DELETE' }),
    members: {
      list: (startupId: string) =>
        request<import('@systemodel/shared-types').StartupMember[]>(`/startups/${startupId}/members`),
      add: (startupId: string, email: string, role: import('@systemodel/shared-types').StartupRole) =>
        request<import('@systemodel/shared-types').StartupMember>(`/startups/${startupId}/members`, {
          method: 'POST', body: JSON.stringify({ email, role }),
        }),
      updateRole: (startupId: string, userId: string, role: import('@systemodel/shared-types').StartupRole) =>
        request<import('@systemodel/shared-types').StartupMember>(`/startups/${startupId}/members/${userId}`, {
          method: 'PATCH', body: JSON.stringify({ role }),
        }),
      remove: (startupId: string, userId: string) =>
        request<void>(`/startups/${startupId}/members/${userId}`, { method: 'DELETE' }),
    },
    invitations: {
      list: (startupId: string) =>
        request<StartupInvitation[]>(`/startups/${startupId}/invitations`),
      revoke: (startupId: string, invitationId: string) =>
        request<void>(`/startups/${startupId}/invitations/${invitationId}`, { method: 'DELETE' }),
    },
  },
  elementLocks: {
    list: (projectId: string, fileId: string) =>
      request<import('@systemodel/shared-types').ElementLock[]>(
        `/projects/${projectId}/element-locks/files/${fileId}/locks`,
      ),
    checkOut: (projectId: string, fileId: string, elementName: string) =>
      request<import('@systemodel/shared-types').ElementLock>(
        `/projects/${projectId}/element-locks/files/${fileId}/locks`,
        { method: 'POST', body: JSON.stringify({ elementName }) },
      ),
    checkIn: (projectId: string, fileId: string, elementName: string) =>
      request<void>(
        `/projects/${projectId}/element-locks/files/${fileId}/locks/${encodeURIComponent(elementName)}`,
        { method: 'DELETE' },
      ),
    forceCheckIn: (projectId: string, fileId: string, elementName: string) =>
      request<void>(
        `/projects/${projectId}/element-locks/files/${fileId}/locks/${encodeURIComponent(elementName)}/force`,
        { method: 'DELETE' },
      ),
    auditLog: (projectId: string, opts?: { fileId?: string; limit?: number; offset?: number }) =>
      request<import('@systemodel/shared-types').AuditLogEntry[]>(
        `/projects/${projectId}/element-locks/audit-log?${new URLSearchParams({
          ...(opts?.fileId ? { fileId: opts.fileId } : {}),
          ...(opts?.limit ? { limit: String(opts.limit) } : {}),
          ...(opts?.offset ? { offset: String(opts.offset) } : {}),
        })}`,
      ),
  },
  notifications: {
    list: (unread?: boolean) =>
      request<import('@systemodel/shared-types').LockNotification[]>(
        `/notifications${unread ? '?unread=true' : ''}`,
      ),
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    create: (elementName: string, fileId: string) =>
      request<import('@systemodel/shared-types').LockNotification>('/notifications', {
        method: 'POST', body: JSON.stringify({ elementName, fileId }),
      }),
    markRead: (id: string) =>
      request<import('@systemodel/shared-types').LockNotification>(`/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    markAllRead: () =>
      request<{ success: boolean }>('/notifications/mark-all-read', { method: 'POST' }),
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

export interface StartupInvitation {
  id: string;
  startupId: string;
  email: string;
  role: string;
  invitedBy: string;
  createdAt: string;
}

export interface BugReportInfo {
  id: string;
  userId: string;
  user?: { id: string; name: string; email: string };
  description: string;
  screenshot: string | null;
  pageUrl: string;
  status: string;
  createdAt: string;
}
