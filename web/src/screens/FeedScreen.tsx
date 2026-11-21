import React from 'react';
import { COLORS } from '../theme';
import type { ActivityItem } from '../types';
import {
  CarIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  ClockIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  UnlockIcon,
} from '../components/Icons';

interface Props {
  feed: ActivityItem[];
  onRefresh: () => void;
  refreshing: boolean;
  onSelectFacilityId?: (facilityId: string) => void;
}

function renderActionBadge(action: string) {
  switch (action) {
    case 'reserved':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: COLORS.amberSoft,
            color: COLORS.amber,
          }}
        >
          <CarIcon size={14} color={COLORS.amber} />
        </span>
      );
    case 'released':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: '#F1F5F9',
            color: COLORS.muted,
          }}
        >
          <RotateCcwIcon size={14} color={COLORS.muted} />
        </span>
      );
    case 'expired':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: COLORS.redSoft,
            color: COLORS.red,
          }}
        >
          <ClockIcon size={14} color={COLORS.red} />
        </span>
      );
    case 'completed':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: COLORS.greenSoft,
            color: COLORS.green,
          }}
        >
          <CheckCircleIcon size={14} color={COLORS.green} />
        </span>
      );
    case 'unlocked':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: COLORS.amberSoft,
            color: COLORS.amber,
          }}
        >
          <UnlockIcon size={14} color={COLORS.amber} />
        </span>
      );
    case 'plan_uploaded':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: '#E0F2FE',
            color: COLORS.primary,
          }}
        >
          <ClipboardListIcon size={14} color={COLORS.primary} />
        </span>
      );
  }
}

export const FeedScreen: React.FC<Props> = ({ feed, onRefresh, refreshing, onSelectFacilityId }) => {
  return (
    <div
      className="scroll-container"
      style={{
        flex: 1,
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingBottom: '80px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <h2 style={{ fontSize: '17px', fontWeight: '800', color: COLORS.ink }}>
          سجل نشاط الفريق الحي
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            color: COLORS.primary,
            fontWeight: '700',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ display: 'inline-flex', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
            <RefreshCwIcon size={13} color={COLORS.primary} />
          </span>
          <span>{refreshing ? 'جارٍ التحديث...' : 'تحديث'}</span>
        </button>
      </div>

      {feed.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            color: COLORS.muted,
            fontSize: '14px',
          }}
        >
          لا يوجد نشاط مسجل في الخطة المحددة بعد.
        </div>
      ) : (
        feed.map((item) => {
          const hasFacility = Boolean(item.facility_id);
          return (
            <div
              key={item.id}
              onClick={() => {
                if (hasFacility && onSelectFacilityId) {
                  onSelectFacilityId(item.facility_id!);
                }
              }}
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: '14px',
                padding: '12px 14px',
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                cursor: hasFacility ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (hasFacility) {
                  e.currentTarget.style.backgroundColor = '#F0F9FF';
                  e.currentTarget.style.borderColor = COLORS.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (hasFacility) {
                  e.currentTarget.style.backgroundColor = COLORS.surface;
                  e.currentTarget.style.borderColor = COLORS.border;
                }
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: COLORS.muted,
                    direction: 'ltr',
                    fontWeight: '500',
                  }}
                >
                  {new Date(item.created_at).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  —{' '}
                  {new Date(item.created_at).toLocaleDateString('ar-EG', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: COLORS.ink }}>
                    {item.worker_name}
                  </span>
                  {renderActionBadge(item.action)}
                </div>
              </div>

              <p style={{ fontSize: '14px', color: COLORS.ink, fontWeight: '500', margin: '2px 0', lineHeight: 1.4 }}>
                {item.summary}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                {item.center && (
                  <span style={{ fontSize: '11px', color: COLORS.muted }}>
                    المركز: {item.center}
                  </span>
                )}
                {hasFacility && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: item.action === 'completed' ? COLORS.green : COLORS.primary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {item.action === 'completed' ? '📋 عرض تفاصيل المعاينة والعينات' : '📍 عرض المنشأة'} ←
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
