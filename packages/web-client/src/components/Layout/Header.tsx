import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { useTheme } from '../../store/theme.js';
import { useRecentFilesStore } from '../../store/recent-files.js';

interface HeaderProps {
  title?: string;
  titleExtra?: React.ReactNode;
  showSave?: boolean;
  onSave?: () => void;
  saving?: boolean;
}

export default function Header({ title, titleExtra, showSave, onSave, saving }: HeaderProps) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const onTrainingPage = location.pathname === '/training';
  const onSettingsPage = location.pathname === '/settings';
  const t = useTheme();
  const recentEntries = useRecentFilesStore((s) => s.entries);
  const [recentOpen, setRecentOpen] = useState(false);
  const recentRef = useRef<HTMLDivElement>(null);

  // Click-outside to close recent dropdown
  useEffect(() => {
    if (!recentOpen) return;
    const handle = (e: MouseEvent) => {
      if (recentRef.current && !recentRef.current.contains(e.target as Node)) setRecentOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [recentOpen]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navBtn: React.CSSProperties = {
    background: 'transparent', color: t.textSecondary,
    border: `1px solid ${t.border}`, borderRadius: 4,
    padding: '3px 10px', cursor: 'pointer', fontSize: 12,
  };

  const hoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = t.info; e.currentTarget.style.color = t.info; },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; },
  };

  // Format relative time
  const timeAgo = (ts: number): string => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <header style={{
      height: 48,
      background: t.bgSecondary,
      borderBottom: `1px solid ${t.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      flexShrink: 0,
    }}>
      <span
        style={{ fontWeight: 700, color: '#A0522D', cursor: 'pointer', fontSize: 18, fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
        onClick={() => navigate('/projects')}
      >
        SysteModel
      </span>
      {title && (
        <>
          <span style={{ color: t.textDim }}>/</span>
          <span style={{ color: t.text, fontSize: 14 }}>{title}</span>
        </>
      )}
      {titleExtra}
      <div style={{ flex: 1 }} />
      {/* Recent files */}
      {recentEntries.length > 0 && (
        <div ref={recentRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setRecentOpen((v) => !v)}
            style={{
              ...navBtn,
              background: recentOpen ? t.accent : 'transparent',
              color: recentOpen ? '#fff' : t.textSecondary,
              borderColor: recentOpen ? t.accent : t.border,
            }}
            title="Recent files"
          >
            Recent
          </button>
          {recentOpen && (
            <div style={{
              position: 'absolute', top: 36, right: 0, zIndex: 9999,
              background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6,
              boxShadow: t.shadow, minWidth: 280, maxWidth: 400, padding: '4px 0',
            }}>
              <div style={{ padding: '6px 12px', color: t.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Recent Files
              </div>
              {recentEntries.map((entry) => (
                <div
                  key={entry.fileId}
                  onClick={() => {
                    navigate(`/projects/${entry.projectId}/files/${entry.fileId}`);
                    setRecentOpen(false);
                  }}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.bgHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.success, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.fileName}
                    </div>
                    <div style={{ color: t.textMuted, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.projectName}
                    </div>
                  </div>
                  <span style={{ color: t.textDim, fontSize: 10, flexShrink: 0 }}>
                    {timeAgo(entry.accessedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Theme toggle */}
      <button
        onClick={t.toggle}
        style={{
          ...navBtn,
          display: 'flex', alignItems: 'center', gap: 5,
        }}
        {...hoverHandlers}
        title={t.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {t.mode === 'dark' ? '\u2600' : '\u263D'} {t.mode === 'dark' ? 'Light' : 'Dark'}
      </button>
      {!onTrainingPage && (
        <button onClick={() => navigate('/training')} style={navBtn} {...hoverHandlers} title="Open interactive SysML v2 training">
          Training
        </button>
      )}
      {!onSettingsPage && user && (
        <button onClick={() => navigate('/settings')} style={navBtn} {...hoverHandlers} title="MCP connection settings">
          Settings
        </button>
      )}
      {showSave && (
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            background: saving ? t.btnDisabled : t.accent,
            color: '#fff', border: 'none', borderRadius: 4,
            padding: '4px 14px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      )}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: t.textSecondary, fontSize: 13 }}>{user.email}</span>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', color: t.textSecondary, border: `1px solid ${t.btnBorder}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
