import React from 'react';
import i18n from '../i18n/index.js';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: 40, fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <h2 style={{ color: '#e06c75', marginBottom: 12 }}>{i18n.t('error_boundary.title')}</h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
              {this.state.error?.message ?? i18n.t('error_boundary.description')}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); }}
              style={{
                background: '#0e639c', color: '#fff', border: 'none',
                borderRadius: 4, padding: '8px 20px', cursor: 'pointer', fontSize: 14,
                marginRight: 8,
              }}
            >
              {i18n.t('error_boundary.try_again')}
            </button>
            <button
              onClick={() => { window.location.href = '/projects'; }}
              style={{
                background: 'transparent', color: '#569cd6', border: '1px solid #569cd6',
                borderRadius: 4, padding: '8px 20px', cursor: 'pointer', fontSize: 14,
              }}
            >
              {i18n.t('error_boundary.go_to_projects')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
