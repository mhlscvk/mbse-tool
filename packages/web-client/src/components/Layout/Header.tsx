import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';

interface HeaderProps {
  title?: string;
  showSave?: boolean;
  onSave?: () => void;
  saving?: boolean;
}

export default function Header({ title, showSave, onSave, saving }: HeaderProps) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <header style={{
      height: 48,
      background: '#2d2d30',
      borderBottom: '1px solid #3c3c3c',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 16,
      flexShrink: 0,
    }}>
      <span
        style={{ fontWeight: 700, color: '#569cd6', cursor: 'pointer', fontSize: 16 }}
        onClick={() => navigate('/projects')}
      >
        Systemodel
      </span>
      {title && (
        <>
          <span style={{ color: '#555' }}>/</span>
          <span style={{ color: '#d4d4d4', fontSize: 14 }}>{title}</span>
        </>
      )}
      <div style={{ flex: 1 }} />
      {showSave && (
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            background: saving ? '#3c3c3c' : '#0e639c',
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
          <span style={{ color: '#888', fontSize: 13 }}>{user.email}</span>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
