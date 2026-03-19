import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Layout/Header.js';
import { api, type McpTokenInfo, type McpTokenCreated } from '../services/api-client.js';
import type { AiKeyInfo } from '../services/api-client.js';
import { useTheme, type ThemeColors } from '../store/theme.js';
import { useAuthStore } from '../store/auth.js';

// ─── MCP client config templates ─────────────────────────────────────────────

function claudeDesktopConfig(serverUrl: string, token: string): string {
  return JSON.stringify({
    mcpServers: {
      systemodel: {
        type: 'streamablehttp',
        url: `${serverUrl}/mcp`,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  }, null, 2);
}

function cursorConfig(serverUrl: string, token: string): string {
  return JSON.stringify({
    mcpServers: {
      systemodel: {
        url: `${serverUrl}/mcp`,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  }, null, 2);
}

function vsCodeConfig(serverUrl: string, token: string): string {
  return JSON.stringify({
    servers: {
      systemodel: {
        type: 'http',
        url: `${serverUrl}/mcp`,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  }, null, 2);
}

function windsurfConfig(serverUrl: string, token: string): string {
  return JSON.stringify({
    mcpServers: {
      systemodel: {
        serverUrl: `${serverUrl}/mcp`,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  }, null, 2);
}

type ClientId = 'claude' | 'cursor' | 'vscode' | 'windsurf';

const clients: { id: ClientId; label: string; file: string; generator: (url: string, tok: string) => string }[] = [
  { id: 'claude', label: 'Claude Desktop', file: 'claude_desktop_config.json', generator: claudeDesktopConfig },
  { id: 'cursor', label: 'Cursor', file: '.cursor/mcp.json', generator: cursorConfig },
  { id: 'vscode', label: 'VS Code Copilot', file: '.vscode/mcp.json', generator: vsCodeConfig },
  { id: 'windsurf', label: 'Windsurf', file: '~/.codeium/windsurf/mcp_config.json', generator: windsurfConfig },
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type SettingsTab = 'account' | 'ai-provider' | 'mcp' | 'admin';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const [searchParams] = useSearchParams();

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'ai-provider', label: 'AI Provider' },
    { id: 'mcp', label: 'MCP' },
    ...(isAdmin ? [{ id: 'admin' as SettingsTab, label: 'Admin' }] : []),
  ];

  const initialTab = tabs.some(tab => tab.id === searchParams.get('tab')) ? searchParams.get('tab') as SettingsTab : 'account';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
      <Header title="Settings" />
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: 24 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent', border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${t.accent}` : '2px solid transparent',
                padding: '10px 20px', fontSize: 13, cursor: 'pointer',
                color: activeTab === tab.id ? t.text : t.textSecondary,
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'account' && <AccountSection />}
        {activeTab === 'ai-provider' && <AiProviderSection />}
        {activeTab === 'mcp' && <McpSection />}
        {activeTab === 'admin' && isAdmin && <AdminSection />}
      </div>
    </div>
  );
}

// ─── Account Section ─────────────────────────────────────────────────────────

function AccountSection() {
  const t = useTheme();
  const user = useAuthStore(s => s.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      const result = await api.auth.changePassword(currentPassword, newPassword);
      setSuccess(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const iStyle = inputStyle(t);

  return (
    <>
      <h2 style={{ color: t.info, fontSize: 18, marginBottom: 8 }}>Account</h2>
      <p style={{ color: t.textSecondary, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        Your account details and password management.
      </p>

      {/* Account info */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>Profile</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
          <span style={{ color: t.textSecondary }}>Email</span>
          <span style={{ color: t.text }}>{user?.email ?? '—'}</span>
          <span style={{ color: t.textSecondary }}>Name</span>
          <span style={{ color: t.text }}>{user?.name ?? '—'}</span>
          <span style={{ color: t.textSecondary }}>Role</span>
          <span style={{ color: t.text, textTransform: 'capitalize' }}>{user?.role ?? '—'}</span>
        </div>
      </div>

      {/* Change password */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>Change Password</h3>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
          <div>
            <label style={lStyle(t)}>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              style={iStyle}
            />
          </div>
          <div>
            <label style={lStyle(t)}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={iStyle}
            />
          </div>
          <div>
            <label style={lStyle(t)}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              style={iStyle}
            />
          </div>
          {error && <div style={{ color: t.error, fontSize: 13 }}>{error}</div>}
          {success && <div style={{ color: t.success, fontSize: 13 }}>{success}</div>}
          <button type="submit" disabled={saving} style={{
            background: saving ? t.btnDisabled : t.accent, color: '#fff',
            border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
            whiteSpace: 'nowrap' as const,
          }}>
            {saving ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>
    </>
  );
}

// ─── MCP Section ─────────────────────────────────────────────────────────────

function McpSection() {
  const t = useTheme();
  const [tokens, setTokens] = useState<McpTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [newlyCreated, setNewlyCreated] = useState<McpTokenCreated | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientId>('claude');

  const isDev = window.location.port === '5173';
  const serverUrl = isDev
    ? window.location.origin.replace(/:\d+$/, ':3003')
    : window.location.origin;

  const loadTokens = useCallback(async () => {
    try {
      const data = await api.mcpTokens.list();
      setTokens(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const result = await api.mcpTokens.create(
        newTokenName,
        expiresInDays ? expiresInDays : undefined,
      );
      setNewlyCreated(result);
      setNewTokenName('');
      setExpiresInDays('');
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setError('');
    try {
      await api.mcpTokens.revoke(id);
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const activeTokens = tokens.filter(tk => !tk.revoked);
  const revokedTokens = tokens.filter(tk => tk.revoked);
  const client = clients.find(c => c.id === selectedClient)!;

  const iStyle = inputStyle(t);

  return (
    <>
      <h2 style={{ color: t.info, fontSize: 18, marginBottom: 8 }}>MCP Connection</h2>
      <p style={{ color: t.textSecondary, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        Connect your AI client (Claude Desktop, Cursor, VS Code, Windsurf) to systemodel.
        Your AI runs on your own subscription — no API keys stored on our server.
      </p>

      {error && <div style={{ color: t.error, fontSize: 13, marginBottom: 16, padding: '8px 12px', background: t.errorBg, borderRadius: 4 }}>{error}</div>}

      {/* Create Token */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>Create Access Token</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={lStyle(t)}>Token name</label>
            <input
              value={newTokenName}
              onChange={e => setNewTokenName(e.target.value)}
              placeholder="e.g. Claude Desktop"
              required
              style={iStyle}
            />
          </div>
          <div style={{ width: 140 }}>
            <label style={lStyle(t)}>Expires in (days)</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={e => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="Never"
              min={1}
              max={365}
              style={iStyle}
            />
          </div>
          <button type="submit" disabled={creating || !newTokenName} style={{
            background: t.accent, color: '#fff', border: 'none', borderRadius: 4,
            padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' as const,
            opacity: creating || !newTokenName ? 0.5 : 1,
            cursor: creating || !newTokenName ? 'not-allowed' : 'pointer',
          }}>
            {creating ? 'Creating...' : 'Create Token'}
          </button>
        </form>
      </div>

      {/* Newly Created Token */}
      {newlyCreated && (
        <div style={{ background: t.successBg, border: `1px solid ${t.success}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: t.success, fontSize: 14, marginBottom: 8 }}>Token Created — Copy It Now</h3>
          <p style={{ color: t.textSecondary, fontSize: 12, marginBottom: 12 }}>
            This token will not be shown again. Store it securely.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, background: t.bgInput, color: t.success, padding: '10px 12px',
              borderRadius: 4, fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace',
            }}>
              {newlyCreated.token}
            </code>
            <button onClick={() => copyToClipboard(newlyCreated.token, 'token')} style={btnSecondary(t)}>
              {copied === 'token' ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Client Config Generator */}
          <div style={{ marginTop: 16 }}>
            <label style={lStyle(t)}>Generate config for:</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, marginTop: 6 }}>
              {clients.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClient(c.id)}
                  style={{
                    border: 'none', borderRadius: 4, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                    background: selectedClient === c.id ? t.accent : t.btnBg,
                    color: selectedClient === c.id ? '#fff' : t.textSecondary,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p style={{ color: t.textSecondary, fontSize: 12, marginBottom: 8 }}>
              Paste into <code style={{ color: t.info }}>{client.file}</code>:
            </p>
            <div style={{ position: 'relative' }}>
              <pre style={{
                background: t.bgInput, color: t.text, padding: '12px 14px',
                borderRadius: 4, fontSize: 12, overflow: 'auto', margin: 0,
                fontFamily: 'monospace', lineHeight: 1.5, border: `1px solid ${t.border}`,
              }}>
                {client.generator(serverUrl, newlyCreated.token)}
              </pre>
              <button
                onClick={() => copyToClipboard(client.generator(serverUrl, newlyCreated.token), 'config')}
                style={{ ...btnSecondary(t), position: 'absolute', top: 8, right: 8 }}
              >
                {copied === 'config' ? 'Copied!' : 'Copy Config'}
              </button>
            </div>
          </div>

          <button onClick={() => setNewlyCreated(null)} style={{ ...btnSecondary(t), marginTop: 12 }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Active Tokens */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>Active Tokens</h3>
        {loading ? (
          <p style={{ color: t.textSecondary, fontSize: 13 }}>Loading...</p>
        ) : activeTokens.length === 0 ? (
          <p style={{ color: t.textSecondary, fontSize: 13 }}>No active tokens. Create one above to connect your AI client.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeTokens.map(tk => (
              <div key={tk.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                background: t.bgInput, borderRadius: 4,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: t.text, fontSize: 13, fontWeight: 500 }}>{tk.name}</div>
                  <div style={{ color: t.textSecondary, fontSize: 11, marginTop: 2 }}>
                    <code style={{ fontFamily: 'monospace' }}>{tk.token}</code>
                    {' '}&middot;{' '}
                    Created {new Date(tk.createdAt).toLocaleDateString()}
                    {tk.lastUsed && <> &middot; Last used {new Date(tk.lastUsed).toLocaleDateString()}</>}
                    {tk.expiresAt && <> &middot; Expires {new Date(tk.expiresAt).toLocaleDateString()}</>}
                  </div>
                </div>
                <button onClick={() => handleRevoke(tk.id)} style={{
                  background: 'transparent', color: t.error, border: `1px solid ${t.error}`, borderRadius: 4,
                  padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                }}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked Tokens */}
      {revokedTokens.length > 0 && (
        <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: t.textSecondary, fontSize: 14, marginBottom: 12 }}>Revoked Tokens</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {revokedTokens.map(tk => (
              <div key={tk.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                background: t.bgInput, borderRadius: 4, opacity: 0.5,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: t.textSecondary, fontSize: 13 }}>{tk.name}</div>
                  <div style={{ color: t.textMuted, fontSize: 11 }}>
                    <code style={{ fontFamily: 'monospace' }}>{tk.token}</code>
                    {' '}&middot;{' '}Revoked
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>How It Works</h3>
        <div style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.7 }}>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: t.text }}>1.</strong> Create an access token above and name it after your AI client.
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: t.text }}>2.</strong> Copy the generated config into your AI client's configuration file.
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: t.text }}>3.</strong> Your AI client connects to systemodel via MCP and can read/edit your SysML files.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong style={{ color: t.text }}>4.</strong> AI inference runs on <em>your</em> subscription (Claude Pro, Cursor Pro, etc.) — zero cost to systemodel.
          </p>
        </div>

        <h4 style={{ color: t.text, fontSize: 13, marginTop: 16, marginBottom: 8 }}>Available MCP Tools</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12, color: t.textSecondary }}>
          <span><code style={{ color: t.info }}>list_projects</code> — List your projects</span>
          <span><code style={{ color: t.info }}>list_files</code> — List files in a project</span>
          <span><code style={{ color: t.info }}>read_file</code> — Read file content</span>
          <span><code style={{ color: t.info }}>create_file</code> — Create a new file</span>
          <span><code style={{ color: t.info }}>update_file</code> — Replace file content</span>
          <span><code style={{ color: t.info }}>apply_edit</code> — Precise line/col edit</span>
          <span><code style={{ color: t.info }}>delete_file</code> — Delete a file</span>
          <span><code style={{ color: t.info }}>search_files</code> — Search across files</span>
        </div>

        <h4 style={{ color: t.text, fontSize: 13, marginTop: 16, marginBottom: 8 }}>Supported AI Clients</h4>
        <div style={{ color: t.textSecondary, fontSize: 12, lineHeight: 1.7 }}>
          Claude Desktop &middot; Cursor &middot; VS Code (Copilot) &middot; Windsurf &middot; JetBrains &middot; Zed &middot; Claude Code CLI
        </div>
      </div>
    </>
  );
}

// ─── AI Provider Section ─────────────────────────────────────────────────────

type ProviderDef = { id: 'anthropic' | 'openai' | 'gemini'; label: string; color: string; models: string[] };

const PROVIDERS: ProviderDef[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', color: '#d4a27a', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'] },
  { id: 'openai', label: 'OpenAI (GPT)', color: '#74aa9c', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'] },
  { id: 'gemini', label: 'Google (Gemini)', color: '#4285f4', models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'] },
];

function AiProviderSection() {
  const t = useTheme();
  const [storedKeys, setStoredKeys] = useState<AiKeyInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderDef['id']>('anthropic');
  const [newKey, setNewKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(PROVIDERS[0].models[0]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [keyError, setKeyError] = useState('');

  const current = PROVIDERS.find(p => p.id === selectedProvider)!;
  const existingKey = storedKeys.find(k => k.provider === selectedProvider);

  useEffect(() => {
    api.aiKeys.list().then(setStoredKeys).catch(() => {});
  }, []);

  useEffect(() => {
    const existing = storedKeys.find(k => k.provider === selectedProvider);
    setSelectedModel(existing?.model ?? current.models[0]);
    setNewKey('');
    setSavedMsg('');
    setKeyError('');
  }, [selectedProvider, storedKeys]);

  const handleSave = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    setKeyError('');
    setSavedMsg('');
    try {
      await api.aiKeys.save(selectedProvider, newKey.trim(), selectedModel);
      setSavedMsg('Key saved securely. You won\'t see the full key again.');
      setNewKey('');
      const keys = await api.aiKeys.list();
      setStoredKeys(keys);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    if (existingKey) {
      await api.aiKeys.updateModel(selectedProvider, model).catch(() => {});
      const keys = await api.aiKeys.list();
      setStoredKeys(keys);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.aiKeys.remove(selectedProvider);
      const keys = await api.aiKeys.list();
      setStoredKeys(keys);
      setSavedMsg('');
    } catch { /* ignore */ }
  };

  const iStyle = inputStyle(t);

  return (
    <>
      <h2 style={{ color: t.info, fontSize: 18, marginBottom: 8 }}>AI Chat Provider</h2>
      <p style={{ color: t.textSecondary, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        Connect your AI account to chat from the editor.
        Your API key is encrypted and stored securely on the server.
        You will only see it once when you save it.
      </p>

      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        {/* Provider tabs */}
        <label style={{ display: 'block', color: t.textSecondary, fontSize: 11, marginBottom: 6 }}>Provider</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {PROVIDERS.map(p => {
            const connected = storedKeys.some(k => k.provider === p.id);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                style={{
                  border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                  background: selectedProvider === p.id ? p.color + '30' : t.btnBg,
                  color: selectedProvider === p.id ? p.color : t.textSecondary,
                  fontWeight: selectedProvider === p.id ? 600 : 400,
                  position: 'relative' as const,
                }}
              >
                {p.label}
                {connected && <span style={{ color: t.success, marginLeft: 4, fontSize: 10 }}>&bull;</span>}
              </button>
            );
          })}
        </div>

        {/* Status */}
        {existingKey ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            background: t.successBg, border: `1px solid ${t.success}`, borderRadius: 4, marginBottom: 16,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.success }} />
            <div style={{ flex: 1 }}>
              <span style={{ color: t.success, fontSize: 12 }}>Connected</span>
              <span style={{ color: t.textMuted, fontSize: 11, marginLeft: 8 }}>
                <code style={{ fontFamily: 'monospace' }}>{existingKey.maskedKey}</code>
              </span>
            </div>
            <button onClick={handleDisconnect} style={{
              background: 'transparent', color: t.error, border: `1px solid ${t.error}`,
              borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
            }}>Disconnect</button>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            background: t.bgInput, borderRadius: 4, marginBottom: 16,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.error }} />
            <span style={{ color: t.textSecondary, fontSize: 12 }}>Not connected — enter your API key below</span>
          </div>
        )}

        {/* API Key input */}
        <label style={{ display: 'block', color: t.textSecondary, fontSize: 11, marginBottom: 4 }}>
          {existingKey ? 'Replace API Key' : 'API Key'}
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <input
            type="text"
            name="ai-provider-key-input"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            placeholder={existingKey ? 'Enter new key to replace' : `Enter your ${current.label} API key`}
            style={{
              ...iStyle, fontFamily: 'monospace',
              // @ts-expect-error — WebkitTextSecurity is a non-standard CSS property for masking input
              WebkitTextSecurity: 'disc',
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving || !newKey.trim()}
            style={{
              background: saving || !newKey.trim() ? t.btnDisabled : t.accent, color: '#fff',
              border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12,
              cursor: saving || !newKey.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const,
            }}
          >{saving ? 'Saving...' : 'Save Key'}</button>
        </div>

        {keyError && <div style={{ color: t.error, fontSize: 12, marginBottom: 12 }}>{keyError}</div>}
        {savedMsg && <div style={{ color: t.success, fontSize: 12, marginBottom: 12 }}>{savedMsg}</div>}

        {/* Model selector */}
        <label style={{ display: 'block', color: t.textSecondary, fontSize: 11, marginBottom: 4 }}>Model</label>
        <select
          value={selectedModel}
          onChange={e => handleModelChange(e.target.value)}
          style={{
            width: '100%', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 4,
            padding: '8px 10px', color: t.text, fontSize: 13, outline: 'none',
          }}
        >
          {current.models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </>
  );
}

// ─── Shared style helpers ────────────────────────────────────────────────────

const lStyle = (t: ThemeColors): React.CSSProperties => ({
  display: 'block', color: t.textSecondary, fontSize: 11, marginBottom: 4,
});

const inputStyle = (t: ThemeColors): React.CSSProperties => ({
  width: '100%', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 4,
  padding: '8px 10px', color: t.text, fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
});

const btnSecondary = (t: ThemeColors): React.CSSProperties => ({
  background: t.btnBg, color: t.text, border: 'none', borderRadius: 4,
  padding: '6px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
});

// ─── Admin Section ──────────────────────────────────────────────────────────

function AdminSection() {
  const t = useTheme();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.admin.syncExamples();
      setSyncResult(result.message);
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ color: t.text, fontSize: 14, margin: '0 0 8px' }}>System Examples</h3>
        <p style={{ color: t.textSecondary, fontSize: 12, margin: '0 0 12px' }}>
          Re-import example files from the server's prisma/examples/ directory.
          This replaces all files in the Examples project with the versions on disk.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            background: t.accent, color: '#fff', border: 'none', borderRadius: 4,
            padding: '8px 16px', fontSize: 12,
            opacity: syncing ? 0.6 : 1,
            cursor: syncing ? 'default' : 'pointer',
          }}
        >
          {syncing ? 'Syncing...' : 'Sync Examples from Disk'}
        </button>
        {syncResult && (
          <div style={{ marginTop: 8, fontSize: 12, color: syncResult.includes('failed') ? '#e55' : t.accent }}>
            {syncResult}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ color: t.text, fontSize: 14, margin: '0 0 8px' }}>System Projects</h3>
        <p style={{ color: t.textSecondary, fontSize: 12, margin: 0 }}>
          System projects (isSystem) are visible to all users as read-only.
          As admin, you can create, edit, and delete files in system projects from the Projects page.
        </p>
      </div>
    </div>
  );
}
