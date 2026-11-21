import React from 'react';
import { COLORS } from '../theme';
import type { UserRole } from '../types';
import { BellIcon, ClipboardListIcon, MessageSquareIcon, SettingsIcon } from './Icons';

export type TabType = 'plan' | 'feed' | 'followups' | 'admin';

interface Props {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  userRole: UserRole;
  followupCount?: number;
}

export const BottomNav: React.FC<Props> = ({ currentTab, onChangeTab, userRole, followupCount = 0 }) => {
  const tabs: {
    key: TabType;
    label: string;
    icon: (active: boolean) => React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    {
      key: 'plan',
      label: 'الخطة',
      icon: (active) => (
        <ClipboardListIcon size={22} color={active ? COLORS.primary : COLORS.muted} strokeWidth={active ? 2.4 : 2} />
      ),
    },
    {
      key: 'feed',
      label: 'نشاط الفريق',
      icon: (active) => (
        <MessageSquareIcon size={22} color={active ? COLORS.primary : COLORS.muted} strokeWidth={active ? 2.4 : 2} />
      ),
    },
    {
      key: 'followups',
      label: 'المتابعات',
      icon: (active) => (
        <BellIcon size={22} color={active ? COLORS.primary : COLORS.muted} strokeWidth={active ? 2.4 : 2} />
      ),
    },
    {
      key: 'admin',
      label: 'الإدارة',
      icon: (active) => (
        <SettingsIcon size={22} color={active ? COLORS.primary : COLORS.muted} strokeWidth={active ? 2.4 : 2} />
      ),
      adminOnly: true,
    },
  ];

  return (
    <nav
      className="safe-bottom"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        position: 'sticky',
        bottom: 0,
        zIndex: 30,
        paddingTop: '6px',
        paddingBottom: '8px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
      }}
    >
      {tabs
        .filter((t) => !t.adminOnly || userRole === 'admin')
        .map((t) => {
          const active = currentTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChangeTab(t.key)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                color: active ? COLORS.primary : COLORS.muted,
                position: 'relative',
                padding: '4px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px' }}>
                {t.icon(active)}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: active ? '800' : '600',
                  color: active ? COLORS.primary : COLORS.muted,
                }}
              >
                {t.label}
              </span>

              {t.key === 'followups' && followupCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: '50%',
                    marginLeft: '8px',
                    backgroundColor: COLORS.amber,
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '0 5px',
                    fontSize: '10px',
                    fontWeight: '800',
                    lineHeight: '16px',
                  }}
                >
                  {followupCount}
                </span>
              )}
            </button>
          );
        })}
    </nav>
  );
};
