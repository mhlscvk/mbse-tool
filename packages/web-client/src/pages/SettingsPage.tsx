import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/Layout/Header.js';
import { formatDate, formatDateTime } from '../utils/locale.js';
import { api, type McpTokenInfo, type McpTokenCreated, type BugReportInfo, type StartupInvitation } from '../services/api-client.js';
import type { AiKeyInfo } from '../services/api-client.js';
import { useTheme, type ThemeColors } from '../store/theme.js';
import { useAuthStore } from '../store/auth.js';
import type { Startup, StartupMember, StartupRole, User, FeatureFlags } from '@systemodel/shared-types';

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

type SettingsTab = 'account' | 'ai-provider' | 'mcp' | 'admin' | 'bug-reports' | 'startups';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const [searchParams] = useSearchParams();
  const { t: tr } = useTranslation();

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'account', label: tr('settings.tab_account') },
    { id: 'ai-provider', label: tr('settings.tab_ai_provider') },
    { id: 'mcp', label: tr('settings.tab_mcp') },
    ...(isAdmin ? [
      { id: 'startups' as SettingsTab, label: tr('settings.tab_enterprises') },
      { id: 'admin' as SettingsTab, label: tr('settings.tab_admin') },
      { id: 'bug-reports' as SettingsTab, label: tr('settings.tab_bug_reports') },
    ] : []),
  ];

  const initialTab = tabs.some(tab => tab.id === searchParams.get('tab')) ? searchParams.get('tab') as SettingsTab : 'account';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
      <Header title={tr('settings.page_title')} />
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: 24, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                whiteSpace: 'nowrap', flexShrink: 0,
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
        {activeTab === 'startups' && isAdmin && <StartupsSection />}
        {activeTab === 'admin' && isAdmin && <AdminSection />}
        {activeTab === 'bug-reports' && isAdmin && <BugReportsSection />}
      </div>
    </div>
  );
}

// ─── Account Section ─────────────────────────────────────────────────────────

function AccountSection() {
  const t = useTheme();
  const { t: tr } = useTranslation();
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
    if (newPassword !== confirmPassword) { setError(tr('settings.passwords_mismatch')); return; }
    if (newPassword.length < 8) { setError(tr('settings.password_too_short')); return; }
    setSaving(true);
    try {
      const result = await api.auth.changePassword(currentPassword, newPassword);
      setSuccess(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('settings.err_change_password'));
    } finally {
      setSaving(false);
    }
  };

  const iStyle = inputStyle(t);

  return (
    <>
      <h2 style={{ color: t.info, fontSize: 18, marginBottom: 8 }}>{tr('settings.section_account')}</h2>
      <p style={{ color: t.textSecondary, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        {tr('settings.account_description')}
      </p>

      {/* Account info */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>{tr('settings.section_profile')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
          <span style={{ color: t.textSecondary }}>{tr('settings.label_email')}</span>
          <span style={{ color: t.text }}>{user?.email ?? '—'}</span>
          <span style={{ color: t.textSecondary }}>{tr('settings.label_name')}</span>
          <span style={{ color: t.text }}>{user?.name ?? '—'}</span>
          <span style={{ color: t.textSecondary }}>{tr('settings.label_role')}</span>
          <span style={{ color: t.text, textTransform: 'capitalize' }}>{user?.role ?? '—'}</span>
        </div>
      </div>

      {/* Change password */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>{tr('settings.section_change_password')}</h3>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
          <div>
            <label style={lStyle(t)}>{tr('settings.label_current_password')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              style={iStyle}
            />
          </div>
          <div>
            <label style={lStyle(t)}>{tr('settings.label_new_password')}</label>
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
            <label style={lStyle(t)}>{tr('settings.label_confirm_new_password')}</label>
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
            {saving ? tr('settings.btn_updating') : tr('settings.btn_change_password')}
          </button>
        </form>
      </div>

      <RendererBetaSection />
    </>
  );
}

// ─── Renderer Beta Section ──────────────────────────────────────────────────
//
// Per-user opt-in for view-specific renderers under dogfooding. Off sends a
// null payload (delete the override, fall back to global default) rather than
// false — that way once a global default flips to true, users who never opted
// out still get the new renderer.

function RendererBetaSection() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.users.getFeatureFlags()
      .then(setFlags)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    setError('');
    try {
      const merged = await api.users.setFeatureFlags({
        'state-machine-new-renderer': next ? true : null,
      });
      setFlags(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const enabled = flags['state-machine-new-renderer'] === true;

  return (
    <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
      <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>{tr('settings.renderer_beta.title')}</h3>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: loading || saving ? 'default' : 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={loading || saving}
          onChange={e => handleToggle(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span style={{ flex: 1 }}>
          <span style={{ color: t.text, fontSize: 13, fontWeight: 500 }}>{tr('settings.renderer_beta.state_machine_label')}</span>
          <span style={{ display: 'block', color: t.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
            {tr('settings.renderer_beta.state_machine_description')}
          </span>
        </span>
      </label>
      {error && <div style={{ color: t.error, fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

// ─── MCP Section ─────────────────────────────────────────────────────────────

function McpSection() {
  const t = useTheme();
  const { t: tr } = useTranslation();
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
      setError(err instanceof Error ? err.message : tr('settings.err_load_tokens'));
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
      setError(err instanceof Error ? err.message : tr('settings.err_create_token'));
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
      setError(err instanceof Error ? err.message : tr('settings.err_revoke_token'));
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
      <h2 style={{ color: t.info, fontSize: 18, marginBottom: 8 }}>{tr('settings.section_mcp_connection')}</h2>
      <p style={{ color: t.textSecondary, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        {tr('settings.mcp_description')}
      </p>

      {error && <div style={{ color: t.error, fontSize: 13, marginBottom: 16, padding: '8px 12px', background: t.errorBg, borderRadius: 4 }}>{error}</div>}

      {/* Create Token */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>{tr('settings.section_create_token')}</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={lStyle(t)}>{tr('settings.label_token_name')}</label>
            <input
              value={newTokenName}
              onChange={e => setNewTokenName(e.target.value)}
              placeholder={tr('settings.token_name_placeholder')}
              required
              style={iStyle}
            />
          </div>
          <div style={{ width: 140 }}>
            <label style={lStyle(t)}>{tr('settings.label_expires_in_days')}</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={e => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
              placeholder={tr('settings.placeholder_never')}
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
            {creating ? tr('settings.btn_creating') : tr('settings.btn_create_token')}
          </button>
        </form>
      </div>

      {/* Newly Created Token */}
      {newlyCreated && (
        <div style={{ background: t.successBg, border: `1px solid ${t.success}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: t.success, fontSize: 14, marginBottom: 8 }}>{tr('settings.token_created_title')}</h3>
          <p style={{ color: t.textSecondary, fontSize: 12, marginBottom: 12 }}>
            {tr('settings.token_warning')}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, background: t.bgInput, color: t.success, padding: '10px 12px',
              borderRadius: 4, fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace',
            }}>
              {newlyCreated.token}
            </code>
            <button onClick={() => copyToClipboard(newlyCreated.token, 'token')} style={btnSecondary(t)}>
              {copied === 'token' ? tr('settings.btn_copied') : tr('settings.btn_copy')}
            </button>
          </div>

          {/* Client Config Generator */}
          <div style={{ marginTop: 16 }}>
            <label style={lStyle(t)}>{tr('settings.generate_config_for')}</label>
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
              {tr('settings.paste_into')} <code style={{ color: t.info }}>{client.file}</code>
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
                {copied === 'config' ? tr('settings.btn_copied') : tr('settings.btn_copy_config')}
              </button>
            </div>
          </div>

          <button onClick={() => setNewlyCreated(null)} style={{ ...btnSecondary(t), marginTop: 12 }}>
            {tr('settings.btn_dismiss')}
          </button>
        </div>
      )}

      {/* Active Tokens */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>{tr('settings.section_active_tokens')}</h3>
        {loading ? (
          <p style={{ color: t.textSecondary, fontSize: 13 }}>{tr('settings.tokens_loading')}</p>
        ) : activeTokens.length === 0 ? (
          <p style={{ color: t.textSecondary, fontSize: 13 }}>{tr('settings.no_active_tokens')}</p>
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
                    {tr('settings.token_created', { date: formatDate(tk.createdAt) })}
                    {tk.lastUsed && <> &middot; {tr('settings.token_last_used', { date: formatDate(tk.lastUsed) })}</>}
                    {tk.expiresAt && <> &middot; {tr('settings.token_expires', { date: formatDate(tk.expiresAt) })}</>}
                  </div>
                </div>
                <button onClick={() => handleRevoke(tk.id)} style={{
                  background: 'transparent', color: t.error, border: `1px solid ${t.error}`, borderRadius: 4,
                  padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                }}>
                  {tr('settings.btn_revoke')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked Tokens */}
      {revokedTokens.length > 0 && (
        <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: t.textSecondary, fontSize: 14, marginBottom: 12 }}>{tr('settings.section_revoked_tokens')}</h3>
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
                    {' '}&middot;{' '}{tr('settings.revoked_label')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: t.text, fontSize: 14, marginBottom: 12 }}>{tr('settings.section_how_it_works')}</h3>
        <div style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.7 }}>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: t.text }}>1.</strong> {tr('settings.how_step_1')}
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: t.text }}>2.</strong> {tr('settings.how_step_2')}
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: t.text }}>3.</strong> {tr('settings.how_step_3')}
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong style={{ color: t.text }}>4.</strong> <span dangerouslySetInnerHTML={{ __html: tr('settings.how_step_4') }} />
          </p>
        </div>

        <h4 style={{ color: t.text, fontSize: 13, marginTop: 16, marginBottom: 8 }}>{tr('settings.section_available_tools')}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12, color: t.textSecondary }}>
          <span><code style={{ color: t.info }}>list_projects</code> — {tr('settings.tool_list_projects')}</span>
          <span><code style={{ color: t.info }}>list_files</code> — {tr('settings.tool_list_files')}</span>
          <span><code style={{ color: t.info }}>read_file</code> — {tr('settings.tool_read_file')}</span>
          <span><code style={{ color: t.info }}>search_files</code> — {tr('settings.tool_search_files')}</span>
          <span><code style={{ color: t.info }}>update_file</code> — {tr('settings.tool_update_file')}</span>
          <span><code style={{ color: t.info }}>apply_edit</code> — {tr('settings.tool_apply_edit')}</span>
        </div>
        <p style={{ fontSize: 11, color: t.textSecondary, marginTop: 8, fontStyle: 'italic' }}>
          {tr('settings.tools_note')}
        </p>

        <h4 style={{ color: t.text, fontSize: 13, marginTop: 16, marginBottom: 8 }}>{tr('settings.section_supported_clients')}</h4>
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
  const { t: tr } = useTranslation();
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
      setSavedMsg(tr('settings.key_saved_msg'));
      setNewKey('');
      const keys = await api.aiKeys.list();
      setStoredKeys(keys);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : tr('settings.err_save_key'));
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
      <h2 style={{ color: t.info, fontSize: 18, marginBottom: 8 }}>{tr('settings.section_ai_chat_provider')}</h2>
      <p style={{ color: t.textSecondary, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        {tr('settings.ai_provider_description')}
      </p>

      <div style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
        {/* Provider tabs */}
        <label style={{ display: 'block', color: t.textSecondary, fontSize: 11, marginBottom: 6 }}>{tr('settings.label_provider')}</label>
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
              <span style={{ color: t.success, fontSize: 12 }}>{tr('settings.connected')}</span>
              <span style={{ color: t.textMuted, fontSize: 11, marginLeft: 8 }}>
                <code style={{ fontFamily: 'monospace' }}>{existingKey.maskedKey}</code>
              </span>
            </div>
            <button onClick={handleDisconnect} style={{
              background: 'transparent', color: t.error, border: `1px solid ${t.error}`,
              borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
            }}>{tr('settings.disconnect')}</button>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            background: t.bgInput, borderRadius: 4, marginBottom: 16,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.error }} />
            <span style={{ color: t.textSecondary, fontSize: 12 }}>{tr('settings.not_connected')}</span>
          </div>
        )}

        {/* API Key input */}
        <label style={{ display: 'block', color: t.textSecondary, fontSize: 11, marginBottom: 4 }}>
          {existingKey ? tr('settings.label_replace_api_key') : tr('settings.label_api_key')}
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
            placeholder={existingKey ? tr('settings.api_key_placeholder_replace') : tr('settings.api_key_placeholder_enter', { provider: current.label })}
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
          >{saving ? tr('settings.btn_saving') : tr('settings.btn_save_key')}</button>
        </div>

        {keyError && <div style={{ color: t.error, fontSize: 12, marginBottom: 12 }}>{keyError}</div>}
        {savedMsg && <div style={{ color: t.success, fontSize: 12, marginBottom: 12 }}>{savedMsg}</div>}

        {/* Model selector */}
        <label style={{ display: 'block', color: t.textSecondary, fontSize: 11, marginBottom: 4 }}>{tr('settings.label_model')}</label>
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

// ─── Startups (Enterprise) Section ──────────────────────────────────────────

function StartupsSection() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [startups, setStartups] = useState<Startup[]>([]);
  const [selected, setSelected] = useState<Startup | null>(null);
  const [members, setMembers] = useState<StartupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<StartupRole>('STARTUP_USER');
  const [addingMember, setAddingMember] = useState(false);
  const [invitations, setInvitations] = useState<StartupInvitation[]>([]);

  const fetchStartups = useCallback(async () => {
    try {
      const list = await api.startups.list();
      setStartups(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_load_enterprises'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStartups(); }, [fetchStartups]);

  const fetchMembers = useCallback(async (startupId: string) => {
    try {
      const [memberList, invList] = await Promise.all([
        api.startups.members.list(startupId),
        api.startups.invitations.list(startupId),
      ]);
      setMembers(memberList);
      setInvitations(invList);
    } catch { setMembers([]); setInvitations([]); }
  }, []);

  const selectStartup = (s: Startup) => {
    setSelected(s);
    fetchMembers(s.id);
  };

  const createStartup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    setError('');
    try {
      const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await api.startups.create(newName.trim(), slug);
      await fetchStartups();
      setNewName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_create_enterprise'));
    } finally {
      setCreating(false);
    }
  };

  const deleteStartup = async (s: Startup) => {
    if (!confirm(tr('settings.confirm_delete_enterprise', { name: s.name }))) return;
    try {
      await api.startups.delete(s.id);
      if (selected?.id === s.id) { setSelected(null); setMembers([]); }
      await fetchStartups();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_delete_enterprise'));
    }
  };

  const renameStartup = async (s: Startup) => {
    const name = prompt(tr('settings.prompt_rename_enterprise'), s.name);
    if (!name || name === s.name) return;
    try {
      const updated = await api.startups.update(s.id, { name: name.trim() });
      if (selected?.id === s.id) setSelected(updated);
      await fetchStartups();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_rename_enterprise'));
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !addEmail.trim() || addingMember) return;
    setAddingMember(true);
    setError('');
    try {
      await api.startups.members.add(selected.id, addEmail.trim(), addRole);
      await fetchMembers(selected.id);
      setAddEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_add_member'));
    } finally {
      setAddingMember(false);
    }
  };

  const changeRole = async (userId: string, role: StartupRole) => {
    if (!selected) return;
    try {
      await api.startups.members.updateRole(selected.id, userId, role);
      await fetchMembers(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_update_role'));
    }
  };

  const removeMember = async (userId: string, name: string) => {
    if (!selected || !confirm(tr('settings.confirm_remove_member', { name }))) return;
    try {
      await api.startups.members.remove(selected.id, userId);
      await fetchMembers(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_remove_member'));
    }
  };

  const revokeInvitation = async (invId: string, email: string) => {
    if (!selected || !confirm(tr('settings.confirm_revoke_invitation', { email }))) return;
    try {
      await api.startups.invitations.revoke(selected.id, invId);
      setInvitations(prev => prev.filter(i => i.id !== invId));
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_revoke_invitation'));
    }
  };

  const iStyle = inputStyle(t);
  const bStyle = btnSecondary(t);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ color: t.text, fontSize: 14, margin: '0 0 12px' }}>{tr('settings.section_enterprises')}</h3>
        {error && <div style={{ color: t.error, fontSize: 12, marginBottom: 8 }}>{error}</div>}

        {/* Create form */}
        <form onSubmit={createStartup} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tr('settings.placeholder_enterprise_name')} style={{ ...iStyle, width: 'auto', flex: 1, minWidth: 140 }} />
          <button type="submit" disabled={creating || !newName.trim()} style={{ background: t.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 12, cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.6 : 1 }}>
            {creating ? tr('settings.btn_creating') : tr('settings.btn_create_short')}
          </button>
        </form>

        {/* Startup list */}
        {loading ? (
          <div style={{ color: t.textMuted, fontSize: 13 }}>{tr('settings.tokens_loading')}</div>
        ) : startups.length === 0 ? (
          <div style={{ color: t.textMuted, fontSize: 13 }}>{tr('settings.no_enterprises_yet')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {startups.map(s => (
              <div
                key={s.id}
                onClick={() => selectStartup(s)}
                style={{
                  padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
                  background: selected?.id === s.id ? t.accentBg : t.bg,
                  border: `1px solid ${selected?.id === s.id ? t.accent : t.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
                onMouseEnter={e => { if (selected?.id !== s.id) e.currentTarget.style.borderColor = t.info; }}
                onMouseLeave={e => { if (selected?.id !== s.id) e.currentTarget.style.borderColor = t.border; }}
              >
                <div>
                  <div style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: t.textMuted, fontSize: 11 }}>
                    /{s.slug} &middot; {tr('settings.members_summary', { members: s._count?.members ?? 0, projects: s._count?.projects ?? 0 })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => renameStartup(s)} style={{ ...bStyle, fontSize: 11, padding: '4px 8px' }}>{tr('settings.btn_rename_short')}</button>
                  <button onClick={() => deleteStartup(s)} style={{ ...bStyle, fontSize: 11, padding: '4px 8px', color: t.error }}>{tr('settings.btn_delete_short')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member management */}
      {selected && (
        <div>
          <h3 style={{ color: t.text, fontSize: 14, margin: '0 0 12px' }}>
            {tr('settings.members_of', { name: selected.name })}
          </h3>

          {/* Add member form */}
          <form onSubmit={addMember} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder={tr('settings.placeholder_email_address')} type="email" style={{ ...iStyle, width: 'auto', flex: 1, minWidth: 160 }} />
            <select value={addRole} onChange={e => setAddRole(e.target.value as StartupRole)} style={{ ...iStyle, width: 'auto', minWidth: 120 }}>
              <option value="STARTUP_USER">{tr('settings.role_user')}</option>
              <option value="STARTUP_ADMIN">{tr('settings.role_admin')}</option>
            </select>
            <button type="submit" disabled={addingMember || !addEmail.trim()} style={{ background: t.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 12, cursor: addingMember ? 'default' : 'pointer', opacity: addingMember ? 0.6 : 1 }}>
              {addingMember ? tr('settings.btn_adding') : tr('settings.btn_add_short')}
            </button>
          </form>

          {members.length === 0 ? (
            <div style={{ color: t.textMuted, fontSize: 13 }}>{tr('settings.no_members_yet')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.text, fontSize: 12 }}>{m.user?.name ?? m.userId}</div>
                    <div style={{ color: t.textMuted, fontSize: 10 }}>{m.user?.email ?? ''}</div>
                  </div>
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.userId, e.target.value as StartupRole)}
                    style={{ background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 3, padding: '3px 6px', color: t.text, fontSize: 11 }}
                  >
                    <option value="STARTUP_USER">{tr('settings.role_user')}</option>
                    <option value="STARTUP_ADMIN">{tr('settings.role_admin')}</option>
                  </select>
                  <button onClick={() => removeMember(m.userId, m.user?.name ?? tr('settings.default_user_fallback'))} style={{ background: 'none', border: `1px solid ${t.error}`, borderRadius: 3, padding: '3px 8px', fontSize: 11, color: t.error, cursor: 'pointer' }}>
                    {tr('settings.btn_remove')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <>
              <h4 style={{ color: t.textSecondary, fontSize: 12, margin: '16px 0 8px', fontWeight: 600 }}>
                {tr('settings.pending_invitations', { count: invitations.length })}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {invitations.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: t.bg, border: `1px dashed ${t.warning}`, borderRadius: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: t.text, fontSize: 12 }}>{inv.email}</div>
                      <div style={{ color: t.warning, fontSize: 10 }}>{inv.role === 'STARTUP_ADMIN' ? tr('settings.pending_admin') : tr('settings.pending_user')}</div>
                    </div>
                    <button onClick={() => revokeInvitation(inv.id, inv.email)} style={{ background: 'none', border: `1px solid ${t.error}`, borderRadius: 3, padding: '3px 8px', fontSize: 11, color: t.error, cursor: 'pointer' }}>
                      {tr('settings.btn_revoke')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Admin Section ──────────────────────────────────────────────────────────

function AdminSection() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ message: string; error: boolean } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.admin.syncExamples();
      setSyncResult({ message: result.message, error: false });
    } catch (err) {
      setSyncResult({ message: err instanceof Error ? err.message : tr('settings.err_sync_failed'), error: true });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ color: t.text, fontSize: 14, margin: '0 0 8px' }}>{tr('settings.section_system_examples')}</h3>
        <p style={{ color: t.textSecondary, fontSize: 12, margin: '0 0 12px' }}>
          {tr('settings.sync_examples_description')}
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
          {syncing ? tr('settings.btn_syncing') : tr('settings.btn_sync_examples')}
        </button>
        {syncResult && (
          <div style={{ marginTop: 8, fontSize: 12, color: syncResult.error ? t.error : t.accent }}>
            {syncResult.message}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ color: t.text, fontSize: 14, margin: '0 0 8px' }}>{tr('settings.section_system_projects')}</h3>
        <p style={{ color: t.textSecondary, fontSize: 12, margin: 0 }}>
          {tr('settings.system_projects_description')}
        </p>
      </div>

      <AdminUsersPanel />
    </div>
  );
}

// ─── Admin Users Panel (read-only) ─────────────────────────────────────────

type AdminFile = { id: string; displayId: string; name: string; size: number; createdAt: string; updatedAt: string };
type AdminProject = { id: string; displayId: string; name: string; _count: { files: number; children: number } };

function AdminUsersPanel() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userProjects, setUserProjects] = useState<AdminProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<AdminFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ id: string; name: string; content: string } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.admin.listUsers();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('settings.err_load_users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (expanded && users.length === 0) loadUsers(); }, [expanded, users.length, loadUsers]);

  const loadUserProjects = async (userId: string) => {
    if (selectedUserId === userId) { setSelectedUserId(null); setSelectedProjectId(null); setViewingFile(null); return; }
    setSelectedUserId(userId);
    setSelectedProjectId(null);
    setViewingFile(null);
    setProjectsLoading(true);
    try {
      const result = await api.admin.listUserProjects(userId);
      setUserProjects(result.projects);
    } catch {
      setUserProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadProjectFiles = async (projectId: string) => {
    if (selectedProjectId === projectId) { setSelectedProjectId(null); setViewingFile(null); return; }
    setSelectedProjectId(projectId);
    setViewingFile(null);
    setFilesLoading(true);
    try {
      const files = await api.admin.listProjectFiles(projectId);
      setProjectFiles(files);
    } catch {
      setProjectFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  const readFile = async (fileId: string, fileName: string) => {
    if (viewingFile?.id === fileId) { setViewingFile(null); return; }
    setFileLoading(true);
    try {
      const file = await api.admin.readFile(fileId);
      setViewingFile({ id: file.id, name: file.name, content: file.content });
    } catch {
      setViewingFile(null);
    } finally {
      setFileLoading(false);
    }
  };

  return (
    <div>
      <h3
        style={{ color: t.text, fontSize: 14, margin: '0 0 8px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? '▾' : '▸'} {tr('settings.all_users_header')}
      </h3>
      <p style={{ color: t.textSecondary, fontSize: 12, margin: '0 0 8px' }}>
        {tr('settings.all_users_description')}
      </p>
      {expanded && (
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 4, overflow: 'hidden' }}>
          {loading && <div style={{ padding: 12, color: t.textSecondary, fontSize: 12 }}>{tr('settings.loading_users')}</div>}
          {error && <div style={{ padding: 12, color: t.error, fontSize: 12 }}>{error}</div>}
          {!loading && users.map((u, i) => (
            <div key={u.id}>
              {/* User row */}
              <div
                onClick={() => loadUserProjects(u.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                  background: i % 2 === 0 ? t.bg : t.bgSecondary,
                  borderBottom: `1px solid ${t.border}`,
                }}
              >
                <span style={{ color: t.textSecondary, fontSize: 10 }}>{selectedUserId === u.id ? '▾' : '▸'}</span>
                <span style={{ color: t.text, fontWeight: 500, minWidth: 140 }}>{u.name || tr('settings.no_name')}</span>
                <span style={{ color: t.textSecondary, flex: 1 }}>{u.email}</span>
                <span style={{
                  color: u.role === 'admin' ? t.accent : t.textSecondary,
                  fontSize: 10, textTransform: 'uppercase', fontWeight: 600,
                }}>{u.role}</span>
              </div>
              {/* User's projects */}
              {selectedUserId === u.id && (
                <div style={{ padding: '4px 0 8px 28px', background: t.bgSecondary }}>
                  {projectsLoading ? (
                    <div style={{ color: t.textSecondary, fontSize: 11, padding: '4px 12px' }}>{tr('settings.loading_projects')}</div>
                  ) : userProjects.length === 0 ? (
                    <div style={{ color: t.textSecondary, fontSize: 11, fontStyle: 'italic', padding: '4px 12px' }}>{tr('settings.no_personal_projects')}</div>
                  ) : userProjects.map(p => (
                    <div key={p.id}>
                      {/* Project row */}
                      <div
                        onClick={() => loadProjectFiles(p.id)}
                        style={{ fontSize: 11, color: t.text, padding: '4px 12px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}
                      >
                        <span style={{ color: t.textSecondary, fontSize: 9 }}>{selectedProjectId === p.id ? '▾' : '▸'}</span>
                        <span style={{ color: t.textSecondary, fontFamily: 'monospace', fontSize: 10 }}>{p.displayId}</span>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        <span style={{ color: t.textSecondary }}>{tr('settings.files_count', { count: p._count.files })}</span>
                      </div>
                      {/* Project's files */}
                      {selectedProjectId === p.id && (
                        <div style={{ padding: '2px 0 4px 44px' }}>
                          {filesLoading ? (
                            <div style={{ color: t.textSecondary, fontSize: 10 }}>{tr('settings.loading_files')}</div>
                          ) : projectFiles.length === 0 ? (
                            <div style={{ color: t.textSecondary, fontSize: 10, fontStyle: 'italic' }}>{tr('settings.no_files')}</div>
                          ) : projectFiles.map(f => (
                            <div key={f.id}>
                              <div
                                onClick={() => readFile(f.id, f.name)}
                                style={{ fontSize: 10, padding: '2px 0', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}
                              >
                                <span style={{ color: t.accent }}>
                                  {viewingFile?.id === f.id ? '▾' : '▸'} {f.name}.sysml
                                </span>
                                <span style={{ color: t.textSecondary }}>({Math.round(f.size / 1024 * 10) / 10} KB)</span>
                              </div>
                              {/* File content viewer (read-only) */}
                              {viewingFile?.id === f.id && (
                                <div style={{
                                  margin: '4px 0 8px', padding: 8, borderRadius: 4,
                                  background: t.bg, border: `1px solid ${t.border}`,
                                  maxHeight: 300, overflow: 'auto',
                                }}>
                                  {fileLoading ? (
                                    <div style={{ color: t.textSecondary, fontSize: 10 }}>{tr('settings.loading_content')}</div>
                                  ) : (
                                    <pre style={{
                                      margin: 0, fontSize: 11, fontFamily: 'monospace',
                                      color: t.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    }}>{viewingFile.content}</pre>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bug Reports Section (Admin) ────────────────────────────────────────────

function BugReportsSection() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [reports, setReports] = useState<BugReportInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.bugReports.list(statusFilter || undefined, page, 10);
      setReports(data.reports);
      setTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.bugReports.updateStatus(id, status);
      fetchReports();
    } catch { /* ignore */ }
  };

  const deleteReport = async (id: string) => {
    if (!confirm(tr('settings.confirm_delete_bug_report'))) return;
    try {
      await api.bugReports.delete(id);
      fetchReports();
    } catch { /* ignore */ }
  };

  const statusColors: Record<string, string> = { OPEN: '#e07040', RESOLVED: '#40a060', CLOSED: '#808080' };
  const totalPages = Math.ceil(total / 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ color: t.text, fontSize: 14, margin: 0 }}>{tr('settings.bug_reports_header', { total })}</h3>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 4, padding: '4px 8px', color: t.text, fontSize: 12 }}
        >
          <option value="">{tr('settings.filter_all')}</option>
          <option value="OPEN">{tr('settings.filter_open')}</option>
          <option value="RESOLVED">{tr('settings.filter_resolved')}</option>
          <option value="CLOSED">{tr('settings.filter_closed')}</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color: t.textMuted, fontSize: 13 }}>{tr('settings.tokens_loading')}</div>
      ) : reports.length === 0 ? (
        <div style={{ color: t.textMuted, fontSize: 13 }}>{tr('settings.no_bug_reports')}</div>
      ) : (
        reports.map(r => (
          <div key={r.id} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  background: statusColors[r.status] ?? '#808080', color: '#fff',
                  fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 600,
                }}>{r.status}</span>
                <span style={{ color: t.textSecondary, fontSize: 11 }}>
                  {r.user?.name ?? tr('settings.user_unknown')} ({r.user?.email})
                </span>
              </div>
              <span style={{ color: t.textDim, fontSize: 10 }}>
                {formatDateTime(r.createdAt)}
              </span>
            </div>

            <p style={{ color: t.text, fontSize: 12, margin: '0 0 8px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {r.description}
            </p>

            <div style={{ color: t.textDim, fontSize: 10, marginBottom: 8 }}>
              {tr('settings.page_label')} {r.pageUrl}
            </div>

            {r.screenshot && (
              <img
                src={r.screenshot}
                alt={tr('settings.alt_screenshot')}
                onClick={() => setPreviewImg(r.screenshot)}
                style={{ maxWidth: 200, maxHeight: 100, borderRadius: 4, cursor: 'pointer', border: `1px solid ${t.border}` }}
              />
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {r.status !== 'OPEN' && (
                <button onClick={() => updateStatus(r.id, 'OPEN')} style={{ background: '#e07040', color: '#fff', border: 'none', borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>{tr('settings.btn_open')}</button>
              )}
              {r.status !== 'RESOLVED' && (
                <button onClick={() => updateStatus(r.id, 'RESOLVED')} style={{ background: '#40a060', color: '#fff', border: 'none', borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>{tr('settings.action_resolve')}</button>
              )}
              {r.status !== 'CLOSED' && (
                <button onClick={() => updateStatus(r.id, 'CLOSED')} style={{ background: '#808080', color: '#fff', border: 'none', borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>{tr('settings.action_close')}</button>
              )}
              <button onClick={() => deleteReport(r.id)} style={{ background: 'none', border: `1px solid ${t.error}`, borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: t.error, marginLeft: 'auto' }}>{tr('settings.action_delete')}</button>
            </div>
          </div>
        ))
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ background: t.btnBg, border: `1px solid ${t.border}`, borderRadius: 3, padding: '4px 12px', fontSize: 11, cursor: page <= 1 ? 'default' : 'pointer', color: t.text, opacity: page <= 1 ? 0.4 : 1 }}>{tr('settings.btn_prev')}</button>
          <span style={{ color: t.textSecondary, fontSize: 11, lineHeight: '28px' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ background: t.btnBg, border: `1px solid ${t.border}`, borderRadius: 3, padding: '4px 12px', fontSize: 11, cursor: page >= totalPages ? 'default' : 'pointer', color: t.text, opacity: page >= totalPages ? 0.4 : 1 }}>{tr('settings.btn_next')}</button>
        </div>
      )}

      {/* Screenshot preview modal */}
      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <img src={previewImg} alt={tr('settings.alt_full_screenshot')} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
