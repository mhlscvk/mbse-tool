import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { useTheme } from '../../store/theme.js';

interface HeaderProps {
  title?: string;
  showSave?: boolean;
  onSave?: () => void;
  saving?: boolean;
}

export default function Header({ title, showSave, onSave, saving }: HeaderProps) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const onTrainingPage = location.pathname === '/training';
  const onSettingsPage = location.pathname === '/settings';
  const t = useTheme();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navBtn: React.CSSProperties = {
    background: 'transparent', color: t.textSecondary,
    border: `1px solid ${t.border}`, borderRadius: 4,
    padding: '3px 10px', cursor: 'pointer', fontSize: 12,
  };

  return (
    <header style={{
      height: 48,
      background: t.bgSecondary,
      borderBottom: `1px solid ${t.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 16,
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
      <div style={{ flex: 1 }} />
      {/* Theme toggle */}
      <button
        onClick={t.toggle}
        style={{
          background: 'transparent', color: t.textSecondary,
          border: `1px solid ${t.border}`, borderRadius: 4,
          padding: '3px 10px', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 5,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.info; (e.currentTarget as HTMLButtonElement).style.color = t.info; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.border; (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary; }}
        title={t.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {t.mode === 'dark' ? '\u2600' : '\u263D'} {t.mode === 'dark' ? 'Light' : 'Dark'}
      </button>
      {!onTrainingPage && (
        <button
          onClick={() => navigate('/training')}
          style={navBtn}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.info; (e.currentTarget as HTMLButtonElement).style.color = t.info; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.border; (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary; }}
          title="Open interactive SysML v2 training"
        >
          Training
        </button>
      )}
      {!onSettingsPage && user && (
        <button
          onClick={() => navigate('/settings')}
          style={navBtn}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.info; (e.currentTarget as HTMLButtonElement).style.color = t.info; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.border; (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary; }}
          title="MCP connection settings"
        >
          Settings
        </button>
      )}
      {showSave && (
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            background: saving ? t.btnDisabled : t.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '4px 14px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 13,
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
