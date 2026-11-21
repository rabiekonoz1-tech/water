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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={onLogout}
          title="تسجيل الخروج"
          style={{
            color: COLORS.red,
            fontSize: '13px',
            fontWeight: '700',
            padding: '6px 10px',
            backgroundColor: COLORS.redSoft,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <LogOutIcon size={16} color={COLORS.red} />
          <span>خروج</span>
        </button>

        {deferredPrompt && onInstall && (
          <button
            type="button"
            onClick={onInstall}
            style={{
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: '700',
              padding: '6px 10px',
              backgroundColor: COLORS.primary,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <SmartphoneIcon size={15} color="#FFFFFF" />
            <span>تثبيت</span>
          </button>
        )}
      </div>

      <div style={{ textAlign: 'right', flex: 1, marginRight: '10px' }}>
        <div style={{ fontSize: '15px', fontWeight: '800', color: COLORS.ink, lineHeight: 1.2 }}>
          معاينات مياه المنوفية
        </div>
        <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '2px', fontWeight: '500' }}>
          {user.name} <span style={{ color: COLORS.primary, fontWeight: '700' }}>({user.code})</span>
        </div>
      </div>

      <img
        src="/logo.jpg"
        alt="شعار الشركة"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '19px',
          objectFit: 'cover',
          border: `1.5px solid ${COLORS.border}`,
        }}
      />
    </header>
  );
};
