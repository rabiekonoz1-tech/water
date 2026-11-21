import React from 'react';
import { COLORS } from '../theme';
import type { User } from '../types';
import { LogOutIcon, SmartphoneIcon } from './Icons';

interface Props {
  user: User;
  onLogout: () => void;
  deferredPrompt?: any;
  onInstall?: () => void;
}

export const TopBar: React.FC<Props> = ({ user, onLogout, deferredPrompt, onInstall }) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        backgroundColor: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Right section: Logo + Logout Icon Button + App/User Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img
          src="/logo.jpg"
          alt="شعار الشركة"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '19px',
            objectFit: 'cover',
            border: `1.5px solid ${COLORS.border}`,
            flexShrink: 0,
          }}
        />

        {/* Logout Button (Icon ONLY, directly next to Logo) */}
        <button
          type="button"
          onClick={onLogout}
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FEE2E2',
            color: COLORS.red,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background-color 0.15s ease',
          }}
        >
          <LogOutIcon size={18} color={COLORS.red} />
        </button>

        <div style={{ textAlign: 'right', marginRight: '2px' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: COLORS.ink, lineHeight: 1.2 }}>
            معاينات مياه المنوفية
          </div>
          <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '2px', fontWeight: '500' }}>
            {user.name} <span style={{ color: COLORS.primary, fontWeight: '700' }}>({user.code})</span>
          </div>
        </div>
      </div>

      {/* Left section: Install App button (if deferredPrompt is active) */}
      <div>
        {deferredPrompt && onInstall && (
          <button
            type="button"
            onClick={onInstall}
            style={{
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: '700',
              padding: '6px 12px',
              backgroundColor: COLORS.primary,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
            }}
          >
            <SmartphoneIcon size={15} color="#FFFFFF" />
            <span>تثبيت التطبيق</span>
          </button>
        )}
      </div>
    </header>
  );
};
