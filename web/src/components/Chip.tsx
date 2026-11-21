import React from 'react';
import { COLORS } from '../theme';

interface Props {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: { bg: string; fg: string };
  badge?: number | string;
}

export const Chip: React.FC<Props> = ({ label, active, onClick, tone, badge }) => {
  const bg = active ? (tone ? tone.fg : COLORS.primary) : (tone ? tone.bg : COLORS.surface);
  const color = active ? '#FFFFFF' : (tone ? tone.fg : COLORS.ink);
  const border = active ? 'transparent' : (tone ? tone.fg + '44' : COLORS.border);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '20px',
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        fontSize: '13px',
        fontWeight: active ? '700' : '600',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        flexShrink: 0,
        height: '34px',
      }}
    >
      <span>{label}</span>
      {badge !== undefined && (
        <span
          style={{
            backgroundColor: active ? 'rgba(255,255,255,0.25)' : COLORS.bg,
            color: active ? '#FFFFFF' : COLORS.muted,
            padding: '1px 6px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: '700',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
};
