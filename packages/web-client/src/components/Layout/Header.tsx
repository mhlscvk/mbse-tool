import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { useTheme } from '../../store/theme.js';
import { useRecentFilesStore } from '../../store/recent-files.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

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
  const isMobile = useIsMobile();
  const recentEntries = useRecentFilesStore((s) => s.entries);
  const [recentOpen, setRecentOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const recentRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside to close recent dropdown
  useEffect(() => {
    if (!recentOpen) return;
    const handle = (e: MouseEvent) => {
      if (recentRef.current && !recentRef.current.contains(e.target as Node)) setRecentOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [recentOpen]);

  // Click-outside to close mobile menu
  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

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

  // Mobile menu item style
  const mobileMenuItem: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    background: 'transparent', border: 'none', color: t.text,
    padding: '12px 16px', cursor: 'pointer', fontSize: 14,
  };

  return (
    <header style={{
      height: 48,
      background: t.bgSecondary,
      borderBottom: `1px solid ${t.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: isMobile ? 8 : 12,
      flexShrink: 0,
    }}>
      <span
        style={{ fontWeight: 700, color: '#A0522D', cursor: 'pointer', fontSize: isMobile ? 16 : 18, fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', flexShrink: 0 }}
        onClick={() => navigate('/projects')}
      >
        SysteModel
      </span>
      {title && (
        <>
          <span style={{ color: t.textDim }}>/</span>
          <span style={{ color: t.text, fontSize: isMobile ? 12 : 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{title}</span>
        </>
      )}
      {!isMobile && titleExtra}
      <div style={{ flex: 1 }} />

      {/* Save button always visible when applicable */}
      {showSave && (
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            background: saving ? t.btnDisabled : t.accent,
            color: '#fff', border: 'none', borderRadius: 4,
            padding: '4px 14px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13,
            flexShrink: 0,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      )}

      {/* ── Desktop nav ──────────────────────────────────────────────── */}
      {!isMobile && (
        <>
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
        </>
      )}

      {/* ── Mobile hamburger menu ────────────────────────────────────── */}
      {isMobile && (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              background: menuOpen ? t.accent : 'transparent',
              border: `1px solid ${menuOpen ? t.accent : t.border}`,
              borderRadius: 4, color: menuOpen ? '#fff' : t.text,
              cursor: 'pointer', fontSize: 18, padding: '2px 8px',
              lineHeight: 1, display: 'flex', alignItems: 'center',
            }}
            title="Menu"
          >
            {menuOpen ? '\u2715' : '\u2630'}
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 40, right: 0, zIndex: 9999,
              background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 8,
              boxShadow: t.shadow, minWidth: 220, padding: '4px 0',
            }}>
              {user && (
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, color: t.textSecondary, fontSize: 12 }}>
                  {user.email}
                </div>
              )}
              {/* Theme toggle */}
              <button
                onClick={() => { t.toggle(); setMenuOpen(false); }}
                style={mobileMenuItem}
              >
                {t.mode === 'dark' ? '\u2600 Light Mode' : '\u263D Dark Mode'}
              </button>
              {/* Recent files */}
              {recentEntries.length > 0 && recentEntries.slice(0, 3).map((entry) => (
                <button
                  key={entry.fileId}
                  onClick={() => {
                    navigate(`/projects/${entry.projectId}/files/${entry.fileId}`);
                    setMenuOpen(false);
                  }}
                  style={{ ...mobileMenuItem, fontSize: 12, color: t.success }}
                >
                  {entry.fileName} <span style={{ color: t.textDim, fontSize: 10 }}>({entry.projectName})</span>
                </button>
              ))}
              {!onTrainingPage && (
                <button
                  onClick={() => { navigate('/training'); setMenuOpen(false); }}
                  style={mobileMenuItem}
                >
                  Training
                </button>
              )}
              {!onSettingsPage && user && (
                <button
                  onClick={() => { navigate('/settings'); setMenuOpen(false); }}
                  style={mobileMenuItem}
                >
                  Settings
                </button>
              )}
              {user && (
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  style={{ ...mobileMenuItem, color: t.error, borderTop: `1px solid ${t.border}` }}
                >
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
