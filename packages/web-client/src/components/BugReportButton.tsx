import React, { useState, useRef } from 'react';
import { api } from '../services/api-client.js';
import { useTheme } from '../store/theme.js';

export default function BugReportButton() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 5 * 1024 * 1024;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are accepted');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Screenshot must be under 5MB');
      return;
    }
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!description.trim()) { setError('Please describe the issue'); return; }
    setLoading(true);
    setError('');
    try {
      await api.bugReports.create(description.trim(), window.location.href, screenshot ?? undefined);
      setSuccess(true);
      setDescription('');
      setScreenshot(null);
      setFileName('');
      setTimeout(() => { setOpen(false); setSuccess(false); }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const close = () => { setOpen(false); setError(''); setSuccess(false); };

  const inputStyle: React.CSSProperties = {
    background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 4,
    padding: '8px 10px', color: t.text, fontSize: 12, outline: 'none', width: '100%',
    boxSizing: 'border-box', resize: 'vertical',
  };

  return (
    <>
      {/* Floating bug button */}
      <button
        onClick={() => setOpen(true)}
        title="Report a bug"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9998,
          width: 40, height: 40, borderRadius: '50%',
          background: t.accent, border: 'none', color: '#fff',
          fontSize: 18, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z" />
          <path d="M12 20v2M6 13H2M6 17H3M18 13h4M18 17h3" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.bgSecondary, borderRadius: 8, padding: 24,
              width: 420, maxHeight: '80vh', overflowY: 'auto',
              border: `1px solid ${t.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ color: t.text, margin: '0 0 16px', fontSize: 16 }}>Report a Bug</h3>

            {success ? (
              <div style={{ color: t.success, fontSize: 14, textAlign: 'center', padding: 20 }}>
                Thank you! Your report has been submitted.
              </div>
            ) : (
              <>
                <label style={{ color: t.textSecondary, fontSize: 11, marginBottom: 4, display: 'block' }}>
                  Describe the issue *
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What happened? What did you expect to happen?"
                  rows={4}
                  maxLength={5000}
                  style={inputStyle}
                />
                <div style={{ color: t.textDim, fontSize: 10, textAlign: 'right', marginTop: 2 }}>
                  {description.length}/5000
                </div>

                <label style={{ color: t.textSecondary, fontSize: 11, marginBottom: 4, marginTop: 12, display: 'block' }}>
                  Screenshot (optional)
                </label>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault(); setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? t.info : t.border}`, borderRadius: 4,
                    padding: 16, textAlign: 'center', cursor: 'pointer',
                    color: t.textSecondary, fontSize: 12,
                    transition: 'border-color 0.15s',
                  }}
                >
                  {screenshot ? (
                    <div>
                      <img src={screenshot} alt="preview" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 4 }} />
                      <div style={{ marginTop: 6, fontSize: 11, color: t.textDim }}>{fileName}</div>
                    </div>
                  ) : (
                    <>Drop a screenshot here or click to browse</>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
                  style={{ display: 'none' }}
                />
                {screenshot && (
                  <button
                    onClick={() => { setScreenshot(null); setFileName(''); }}
                    style={{ background: 'none', border: 'none', color: t.error, fontSize: 11, cursor: 'pointer', marginTop: 4, padding: 0 }}
                  >
                    Remove screenshot
                  </button>
                )}

                {error && <div style={{ color: t.error, fontSize: 12, marginTop: 8 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button
                    onClick={close}
                    style={{
                      background: t.btnBg, border: `1px solid ${t.border}`, borderRadius: 4,
                      padding: '8px 16px', color: t.text, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !description.trim()}
                    style={{
                      background: loading ? t.btnDisabled : t.accent, border: 'none', borderRadius: 4,
                      padding: '8px 16px', color: '#fff', fontSize: 12,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
