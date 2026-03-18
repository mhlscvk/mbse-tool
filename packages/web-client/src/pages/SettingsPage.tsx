import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Layout/Header.js';
import { api, type McpTokenInfo, type McpTokenCreated } from '../services/api-client.js';
import type { AiKeyInfo } from '../services/api-client.js';

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tokens, setTokens] = useState<McpTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [newlyCreated, setNewlyCreated] = useState<McpTokenCreated | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientId>('claude');

  // In production (behind reverse proxy), API is on the same origin.
  // In development, Vite proxies /api to localhost:3003, but MCP clients
  // connect directly so we need the actual API port.
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

  const activeTokens = tokens.filter(t => !t.revoked);
  const revokedTokens = tokens.filter(t => t.revoked);
  const client = clients.find(c => c.id === selectedClient)!;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <Header title="Settings" />
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', maxWidth: 800, width: '100%', margin: '0 auto' }}>

        {/* ── Section: AI Chat Provider ────────────────────────────────── */}
        <AiProviderSection />

        <div style={{ height: 1, background: '#3c3c3c', margin: '32px 0' }} />

        {/* ── Section: MCP Connection ─────────────────────────────────── */}
        <h2 style={{ color: '#569cd6', fontSize: 18, marginBottom: 8 }}>MCP Connection</h2>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
          Connect your AI client (Claude Desktop, Cursor, VS Code, Windsurf) to systemodel.
          Your AI runs on your own subscription — no API keys stored on our server.
        </p>

        {error && <div style={{ color: '#f48771', fontSize: 13, marginBottom: 16, padding: '8px 12px', background: '#3c1e1e', borderRadius: 4 }}>{error}</div>}

        {/* ── Create Token ────────────────────────────────────────────── */}
        <div style={{ background: '#2d2d30', border: '1px solid #3c3c3c', borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: '#d4d4d4', fontSize: 14, marginBottom: 12 }}>Create Access Token</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={labelStyle}>Token name</label>
              <input
                value={newTokenName}
                onChange={e => setNewTokenName(e.target.value)}
                placeholder="e.g. Claude Desktop"
                required
                style={inputStyle}
              />
            </div>
            <div style={{ width: 140 }}>
              <label style={labelStyle}>Expires in (days)</label>
              <input
                type="number"
                value={expiresInDays}
                onChange={e => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Never"
                min={1}
                max={365}
                style={inputStyle}
              />
            </div>
            <button type="submit" disabled={creating || !newTokenName} style={{
              ...btnPrimary,
              opacity: creating || !newTokenName ? 0.5 : 1,
              cursor: creating || !newTokenName ? 'not-allowed' : 'pointer',
            }}>
              {creating ? 'Creating...' : 'Create Token'}
            </button>
          </form>
        </div>

        {/* ── Newly Created Token (shown once) ────────────────────────── */}
        {newlyCreated && (
          <div style={{ background: '#1a3a1a', border: '1px solid #4ec9b0', borderRadius: 6, padding: 20, marginBottom: 24 }}>
            <h3 style={{ color: '#4ec9b0', fontSize: 14, marginBottom: 8 }}>Token Created — Copy It Now</h3>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
              This token will not be shown again. Store it securely.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{
                flex: 1, background: '#1e1e1e', color: '#4ec9b0', padding: '10px 12px',
                borderRadius: 4, fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace',
              }}>
                {newlyCreated.token}
              </code>
              <button
                onClick={() => copyToClipboard(newlyCreated.token, 'token')}
                style={btnSecondary}
              >
                {copied === 'token' ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* ── Client Config Generator ────────────────────────────── */}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Generate config for:</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, marginTop: 6 }}>
                {clients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClient(c.id)}
                    style={{
                      ...btnTab,
                      background: selectedClient === c.id ? '#0e639c' : '#3c3c3c',
                      color: selectedClient === c.id ? '#fff' : '#888',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                Paste into <code style={{ color: '#569cd6' }}>{client.file}</code>:
              </p>
              <div style={{ position: 'relative' }}>
                <pre style={{
                  background: '#1e1e1e', color: '#d4d4d4', padding: '12px 14px',
                  borderRadius: 4, fontSize: 12, overflow: 'auto', margin: 0,
                  fontFamily: 'monospace', lineHeight: 1.5,
                }}>
                  {client.generator(serverUrl, newlyCreated.token)}
                </pre>
                <button
                  onClick={() => copyToClipboard(client.generator(serverUrl, newlyCreated.token), 'config')}
                  style={{ ...btnSecondary, position: 'absolute', top: 8, right: 8 }}
                >
                  {copied === 'config' ? 'Copied!' : 'Copy Config'}
                </button>
              </div>
            </div>

            <button
              onClick={() => setNewlyCreated(null)}
              style={{ ...btnSecondary, marginTop: 12 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Active Tokens ───────────────────────────────────────────── */}
        <div style={{ background: '#2d2d30', border: '1px solid #3c3c3c', borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: '#d4d4d4', fontSize: 14, marginBottom: 12 }}>Active Tokens</h3>
          {loading ? (
            <p style={{ color: '#888', fontSize: 13 }}>Loading...</p>
          ) : activeTokens.length === 0 ? (
            <p style={{ color: '#888', fontSize: 13 }}>No active tokens. Create one above to connect your AI client.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeTokens.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: '#1e1e1e', borderRadius: 4,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#d4d4d4', fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                    <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                      <code style={{ fontFamily: 'monospace' }}>{t.token}</code>
                      {' '}&middot;{' '}
                      Created {new Date(t.createdAt).toLocaleDateString()}
                      {t.lastUsed && <> &middot; Last used {new Date(t.lastUsed).toLocaleDateString()}</>}
                      {t.expiresAt && <> &middot; Expires {new Date(t.expiresAt).toLocaleDateString()}</>}
                    </div>
                  </div>
                  <button onClick={() => handleRevoke(t.id)} style={btnDanger}>
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Revoked Tokens ──────────────────────────────────────────── */}
        {revokedTokens.length > 0 && (
          <div style={{ background: '#2d2d30', border: '1px solid #3c3c3c', borderRadius: 6, padding: 20, marginBottom: 24 }}>
            <h3 style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>Revoked Tokens</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {revokedTokens.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                  background: '#1e1e1e', borderRadius: 4, opacity: 0.5,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#888', fontSize: 13 }}>{t.name}</div>
                    <div style={{ color: '#666', fontSize: 11 }}>
                      <code style={{ fontFamily: 'monospace' }}>{t.token}</code>
                      {' '}&middot;{' '}Revoked
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── How It Works ────────────────────────────────────────────── */}
        <div style={{ background: '#2d2d30', border: '1px solid #3c3c3c', borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: '#d4d4d4', fontSize: 14, marginBottom: 12 }}>How It Works</h3>
          <div style={{ color: '#888', fontSize: 13, lineHeight: 1.7 }}>
            <p style={{ marginBottom: 8 }}>
              <strong style={{ color: '#d4d4d4' }}>1.</strong> Create an access token above and name it after your AI client.
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong style={{ color: '#d4d4d4' }}>2.</strong> Copy the generated config into your AI client's configuration file.
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong style={{ color: '#d4d4d4' }}>3.</strong> Your AI client connects to systemodel via MCP and can read/edit your SysML files.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong style={{ color: '#d4d4d4' }}>4.</strong> AI inference runs on <em>your</em> subscription (Claude Pro, Cursor Pro, etc.) — zero cost to systemodel.
            </p>
          </div>

          <h4 style={{ color: '#d4d4d4', fontSize: 13, marginTop: 16, marginBottom: 8 }}>Available MCP Tools</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12, color: '#888' }}>
            <span><code style={{ color: '#569cd6' }}>list_projects</code> — List your projects</span>
            <span><code style={{ color: '#569cd6' }}>list_files</code> — List files in a project</span>
            <span><code style={{ color: '#569cd6' }}>read_file</code> — Read file content</span>
            <span><code style={{ color: '#569cd6' }}>create_file</code> — Create a new file</span>
            <span><code style={{ color: '#569cd6' }}>update_file</code> — Replace file content</span>
            <span><code style={{ color: '#569cd6' }}>apply_edit</code> — Precise line/col edit</span>
            <span><code style={{ color: '#569cd6' }}>delete_file</code> — Delete a file</span>
            <span><code style={{ color: '#569cd6' }}>search_files</code> — Search across files</span>
          </div>

          <h4 style={{ color: '#d4d4d4', fontSize: 13, marginTop: 16, marginBottom: 8 }}>Supported AI Clients</h4>
          <div style={{ color: '#888', fontSize: 12, lineHeight: 1.7 }}>
            Claude Desktop &middot; Cursor &middot; VS Code (Copilot) &middot; Windsurf &middot; JetBrains &middot; Zed &middot; Claude Code CLI
          </div>
        </div>
      </div>
    </div>
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

  // When switching provider, set model to stored or default
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

  return (
    <>
      <h2 style={{ color: '#569cd6', fontSize: 18, marginBottom: 8 }}>AI Chat Provider</h2>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        Connect your AI account to chat from the editor.
        Your API key is encrypted and stored securely on the server.
        You will only see it once when you save it.
      </p>

      <div style={{ background: '#2d2d30', border: '1px solid #3c3c3c', borderRadius: 6, padding: 20, marginBottom: 24 }}>
        {/* Provider tabs */}
        <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 6 }}>Provider</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {PROVIDERS.map(p => {
            const connected = storedKeys.some(k => k.provider === p.id);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                style={{
                  border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                  background: selectedProvider === p.id ? p.color + '30' : '#3c3c3c',
                  color: selectedProvider === p.id ? p.color : '#888',
                  fontWeight: selectedProvider === p.id ? 600 : 400,
                  position: 'relative' as const,
                }}
              >
                {p.label}
                {connected && <span style={{ color: '#4ec9b0', marginLeft: 4, fontSize: 10 }}>&bull;</span>}
              </button>
            );
          })}
        </div>

        {/* Status for current provider */}
        {existingKey ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            background: '#1a2a1a', border: '1px solid #2a5a2a', borderRadius: 4, marginBottom: 16,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ec9b0' }} />
            <div style={{ flex: 1 }}>
              <span style={{ color: '#4ec9b0', fontSize: 12 }}>Connected</span>
              <span style={{ color: '#666', fontSize: 11, marginLeft: 8 }}>
                <code style={{ fontFamily: 'monospace' }}>{existingKey.maskedKey}</code>
              </span>
            </div>
            <button onClick={handleDisconnect} style={{
              background: 'transparent', color: '#f48771', border: '1px solid #5a2a2a',
              borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
            }}>Disconnect</button>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            background: '#1e1e1e', borderRadius: 4, marginBottom: 16,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f48771' }} />
            <span style={{ color: '#888', fontSize: 12 }}>Not connected — enter your API key below</span>
          </div>
        )}

        {/* API Key input (for new or update) */}
        <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 4 }}>
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
              flex: 1, background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4,
              padding: '8px 10px', color: '#d4d4d4', fontSize: 13, outline: 'none',
              fontFamily: 'monospace',
              // @ts-expect-error — WebkitTextSecurity is a non-standard CSS property for masking input
              WebkitTextSecurity: 'disc',
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving || !newKey.trim()}
            style={{
              background: saving || !newKey.trim() ? '#333' : '#0e639c', color: '#fff',
              border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12,
              cursor: saving || !newKey.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const,
            }}
          >{saving ? 'Saving...' : 'Save Key'}</button>
        </div>

        {keyError && <div style={{ color: '#f48771', fontSize: 12, marginBottom: 12 }}>{keyError}</div>}
        {savedMsg && <div style={{ color: '#4ec9b0', fontSize: 12, marginBottom: 12 }}>{savedMsg}</div>}

        {/* Model selector */}
        <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 4 }}>Model</label>
        <select
          value={selectedModel}
          onChange={e => handleModelChange(e.target.value)}
          style={{
            width: '100%', background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4,
            padding: '8px 10px', color: '#d4d4d4', fontSize: 13, outline: 'none',
          }}
        >
          {current.models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#888', fontSize: 11, marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4,
  padding: '8px 10px', color: '#d4d4d4', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  background: '#0e639c', color: '#fff', border: 'none', borderRadius: 4,
  padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap',
};

const btnSecondary: React.CSSProperties = {
  background: '#3c3c3c', color: '#d4d4d4', border: 'none', borderRadius: 4,
  padding: '6px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
};

const btnDanger: React.CSSProperties = {
  background: 'transparent', color: '#f48771', border: '1px solid #f48771', borderRadius: 4,
  padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
};

const btnTab: React.CSSProperties = {
  border: 'none', borderRadius: 4, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
};
