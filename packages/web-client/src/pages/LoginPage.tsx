import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api-client.js';
import { useAuthStore } from '../store/auth.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = mode === 'login'
        ? await api.auth.login(form.email, form.password)
        : await api.auth.register(form.email, form.password, form.name);
      setAuth(result.accessToken, result.user);
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e' }}>
      <div style={{ background: '#2d2d30', padding: 40, borderRadius: 8, width: 360, border: '1px solid #3c3c3c' }}>
        <h1 style={{ color: '#569cd6', marginBottom: 8, fontSize: 24 }}>Systemodel</h1>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 13 }}>SysML v2 Modeling Platform</p>

        <div style={{ display: 'flex', marginBottom: 24, gap: 8 }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
              background: mode === m ? '#0e639c' : '#3c3c3c', color: mode === m ? '#fff' : '#888',
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
            style={inputStyle}
          />
          {error && <div style={{ color: '#f48771', fontSize: 13 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            background: loading ? '#3c3c3c' : '#0e639c', color: '#fff',
            border: 'none', borderRadius: 4, padding: '10px 0',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, marginTop: 8,
          }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4,
  padding: '9px 12px', color: '#d4d4d4', fontSize: 13, outline: 'none',
};
