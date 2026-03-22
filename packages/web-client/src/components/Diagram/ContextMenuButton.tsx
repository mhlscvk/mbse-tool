import React from 'react';
import { useTheme } from '../../store/theme.js';

interface ContextMenuButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
  title?: string;
}

export default function ContextMenuButton({ icon, label, onClick, disabled, color, title }: ContextMenuButtonProps) {
  const t = useTheme();
  const textColor = color ?? t.text;

  return (
    <button
      onClick={() => { if (!disabled) onClick(); }}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '6px 12px', background: 'none', border: 'none',
        color: disabled ? t.textDim : textColor,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left', fontSize: 12,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = t.accentBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <span style={{ opacity: 0.7 }}>{icon}</span> {label}
    </button>
  );
}
