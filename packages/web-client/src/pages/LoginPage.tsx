import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api-client.js';
import { useAuthStore } from '../store/auth.js';
import { useTheme } from '../store/theme.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const t = useTheme();

  // Handle email verification redirect
  useEffect(() => {
    const verified = searchParams.get('verified');
    if (verified === 'success') {
      setInfo('Email verified successfully! You can now sign in.');
      setMode('login');
    } else if (verified === 'expired') {
      setError('Verification link expired. Please register again or resend verification.');
    }
  }, [searchParams]);

  // Google Sign-In callback
  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setError('');
    setLoading(true);
    try {
      const result = await api.auth.google(response.credential);
      setAuth(result.accessToken, result.user);
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  }, [setAuth, navigate]);

  // Load Google Identity Services script
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const initGoogle = () => {
      if (!win.google?.accounts?.id) return;
      win.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      if (googleBtnRef.current) {
        win.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: t.googleBtnTheme,
          size: 'large',
          width: 280,
          text: 'continue_with',
        });
      }
    };

    if (win.google?.accounts?.id) {
      initGoogle();
      return;
    }

    // Only load script once
    if (!scriptRef.current) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
      scriptRef.current = script;
    }

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
      // Cancel any pending Google prompts
      if (win.google?.accounts?.id?.cancel) {
        win.google.accounts.id.cancel();
      }
    };
  }, [handleGoogleResponse]);

  const [showResend, setShowResend] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setShowResend(false);
    setLoading(true);
    try {
      if (mode === 'register') {
        await api.auth.register(form.email, form.password, form.name);
        setInfo('Account created! Check your email for a verification link.');
        setMode('login');
      } else {
        const result = await api.auth.login(form.email, form.password);
        setAuth(result.accessToken, result.user);
        navigate('/projects');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      if (msg.toLowerCase().includes('verify')) setShowResend(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      await api.auth.resendVerify(form.email);
      setInfo('Verification email sent. Please check your inbox.');
      setShowResend(false);
    } catch {
      setError('Failed to resend verification email.');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 4,
    padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none',
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <div style={{ background: t.bgSecondary, padding: 40, borderRadius: 8, width: 360, border: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ color: '#A0522D', fontSize: 28, fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', margin: 0 }}>SysteModel</h1>
          <button
            onClick={t.toggle}
            style={{
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 4,
              color: t.textSecondary, cursor: 'pointer', fontSize: 14, padding: '2px 8px',
            }}
            title={t.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {t.mode === 'dark' ? '\u2600' : '\u263D'}
          </button>
        </div>
        <p style={{ color: t.textSecondary, marginBottom: 32, fontSize: 13 }}>SysML v2 Modeling Platform</p>

        <div style={{ display: 'flex', marginBottom: 24, gap: 8 }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(''); setInfo(''); }} style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
              background: mode === m ? t.accent : t.btnBg, color: mode === m ? '#fff' : t.textSecondary,
            }}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              style={inputStyle}
            />
          )}
          <input
            type="email" placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={mode === 'register' ? 8 : undefined}
            style={inputStyle}
          />
          {error && <div style={{ color: t.error, fontSize: 13 }}>{error}</div>}
          {showResend && form.email && (
            <button type="button" onClick={handleResend} style={{
              background: 'none', border: `1px solid ${t.border}`, borderRadius: 4,
              color: t.info, fontSize: 12, padding: '6px 0', cursor: 'pointer',
            }}>
              Resend verification email
            </button>
          )}
          {info && <div style={{ color: t.success, fontSize: 13 }}>{info}</div>}
          <button type="submit" disabled={loading} style={{
            background: loading ? t.btnDisabled : t.accent, color: '#fff',
            border: 'none', borderRadius: 4, padding: '10px 0',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, marginTop: 8,
          }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Google Sign-In */}
        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: t.border }} />
              <span style={{ color: t.textMuted, fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>
            <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
          </>
        )}
      </div>
    </div>
  );
}
