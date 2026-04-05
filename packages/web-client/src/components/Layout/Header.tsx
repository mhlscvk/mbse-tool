import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { useTheme } from '../../store/theme.js';
import { useRecentFilesStore } from '../../store/recent-files.js';
import { api } from '../../services/api-client.js';
import type { LockNotification } from '@systemodel/shared-types';

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<LockNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const recentRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Click-outside to close recent dropdown
  useEffect(() => {
    if (!recentOpen) return;
    const handle = (e: MouseEvent) => {
      if (recentRef.current && !recentRef.current.contains(e.target as Node)) setRecentOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [recentOpen]);

  // Click-outside to close notification dropdown
  useEffect(() => {
    if (!notifOpen) return;
    const handle = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [notifOpen]);

  // Poll notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [notifs, { count }] = await Promise.all([
        api.notifications.list(),
        api.notifications.unreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

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
      padding: '0 12px',
      gap: 12,
      flexShrink: 0,
    }}>
      <span
        style={{ fontWeight: 700, color: '#A0522D', cursor: 'pointer', fontSize: 18, fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', flexShrink: 0 }}
        onClick={() => navigate('/projects')}
      >
        SysteModel
      </span>
      {title && (
        <>
          <span style={{ color: t.textDim }}>/</span>
          <span style={{ color: t.text, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{title}</span>
        </>
      )}
      {titleExtra}
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
      {/* Notifications */}
      {user && (
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            style={{
              ...navBtn,
              position: 'relative',
              background: notifOpen ? t.accent : 'transparent',
              color: notifOpen ? '#fff' : t.textSecondary,
              borderColor: notifOpen ? t.accent : t.border,
            }}
            title="Notifications"
          >
            Notifications
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: t.error, color: '#fff', fontSize: 9, fontWeight: 700,
                borderRadius: '50%', minWidth: 16, height: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div style={{
              position: 'absolute', top: 36, right: 0, zIndex: 9999,
              background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6,
              boxShadow: t.shadow, minWidth: 320, maxWidth: 420, padding: '4px 0',
              maxHeight: 400, overflowY: 'auto',
            }}>
              <div style={{ padding: '6px 12px', color: t.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: t.info, fontSize: 10, cursor: 'pointer', padding: 0 }}>
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '16px 12px', color: t.textDim, fontSize: 12, textAlign: 'center' }}>
                  No notifications
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: '8px 12px', cursor: 'pointer',
                      background: n.read ? 'transparent' : ('rgba(59,130,246,0.05)'),
                      borderLeft: n.read ? '3px solid transparent' : `3px solid ${t.info}`,
                    }}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      navigate(`/projects/${n.projectId}/files/${n.fileId}`);
                      setNotifOpen(false);
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.bgHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? 'transparent' : ('rgba(59,130,246,0.05)'); }}
                  >
                    <div style={{ fontSize: 12, color: t.text, marginBottom: 2 }}>
                      <strong>{n.requester?.name ?? 'Someone'}</strong> requests lock on <strong>{n.elementName}</strong>
                    </div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>
                      {n.projectName} / {n.fileName}
                    </div>
                    <div style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>
                      {timeAgo(new Date(n.createdAt).getTime())}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
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
    </header>
  );
}
