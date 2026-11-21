import React, { useMemo, useState } from 'react';
import { COLORS } from '../theme';
import type { ActivityItem } from '../types';
import {
  CarIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  ClockIcon,
  FilterIcon,
  MapPinIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  UnlockIcon,
  XIcon,
} from '../components/Icons';

interface Props {
  feed: ActivityItem[];
  onRefresh: () => void;
  refreshing: boolean;
  onSelectFacilityId?: (facilityId: string) => void;
}

type ActionFilterType = 'all' | 'completed' | 'reserved' | 'released' | 'expired' | 'unlocked';

const ACTION_FILTERS: { key: ActionFilterType; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'completed', label: 'معاينات منجزة' },
  { key: 'reserved', label: 'في الطريق' },
  { key: 'released', label: 'إلغاء حجز' },
  { key: 'unlocked', label: 'فتح للمعاينة' },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilterType>('all');
  const [centerFilter, setCenterFilter] = useState<string>('الكل');

  // Dynamically extract unique centers present in the feed
  const uniqueCenters = useMemo(() => {
    const centers = new Set<string>();
    feed.forEach((item) => {
      if (item.center && item.center.trim()) {
        centers.add(item.center.trim());
      }
    });
    return Array.from(centers).sort();
  }, [feed]);

  // Filter feed based on search query, action type, and center
  const filteredFeed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return feed.filter((item) => {
      // Action type filter
      if (actionFilter !== 'all' && item.action !== actionFilter) {
        return false;
      }

      // Center filter
      if (centerFilter !== 'الكل' && item.center !== centerFilter) {
        return false;
      }

      // Search query filter (matches worker_name, summary, or center)
      if (q) {
        const matchesWorker = item.worker_name && item.worker_name.toLowerCase().includes(q);
        const matchesSummary = item.summary && item.summary.toLowerCase().includes(q);
        const matchesCenter = item.center && item.center.toLowerCase().includes(q);
        if (!matchesWorker && !matchesSummary && !matchesCenter) {
          return false;
        }
      }

      return true;
    });
  }, [feed, searchQuery, actionFilter, centerFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || actionFilter !== 'all' || centerFilter !== 'الكل';

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
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '800', color: COLORS.ink, margin: 0 }}>
            سجل نشاط الفريق الحي
          </h2>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              backgroundColor: '#F1F5F9',
              color: '#475569',
              padding: '2px 7px',
              borderRadius: '10px',
            }}
          >
            {filteredFeed.length}
          </span>
        </div>

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
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'inline-flex', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
            <RefreshCwIcon size={13} color={COLORS.primary} />
          </span>
          <span>{refreshing ? 'جارٍ التحديث...' : 'تحديث'}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: `1.5px solid ${searchQuery ? COLORS.primary : COLORS.border}`,
          padding: '0 10px',
          height: '42px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <SearchIcon size={18} color={COLORS.muted} style={{ flexShrink: 0, marginLeft: '6px' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث باسم الموظف، المنشأة، المركز، أو الملاحظة..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontSize: '13px',
            color: COLORS.ink,
            fontFamily: 'inherit',
          }}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              background: '#E2E8F0',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <XIcon size={12} color="#334155" />
          </button>
        ) : null}
      </div>

      {/* Filter Chips: Action Types */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {ACTION_FILTERS.map((f) => {
          const isActive = actionFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActionFilter(f.key)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                border: `1px solid ${isActive ? COLORS.primary : '#E2E8F0'}`,
                backgroundColor: isActive ? COLORS.primary : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Filter Chips: Centers (if multiple centers exist) */}
      {uniqueCenters.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: COLORS.muted,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <FilterIcon size={12} color={COLORS.muted} />
            <span>المركز:</span>
          </span>

          <button
            type="button"
            onClick={() => setCenterFilter('الكل')}
            style={{
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: '700',
              border: `1px solid ${centerFilter === 'الكل' ? COLORS.primaryDark : '#E2E8F0'}`,
              backgroundColor: centerFilter === 'الكل' ? COLORS.primaryDark : '#F8FAFC',
              color: centerFilter === 'الكل' ? '#FFFFFF' : '#64748B',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            الكل
          </button>

          {uniqueCenters.map((c) => {
            const isActive = centerFilter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCenterFilter(c)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: '700',
                  border: `1px solid ${isActive ? COLORS.primaryDark : '#E2E8F0'}`,
                  backgroundColor: isActive ? COLORS.primaryDark : '#F8FAFC',
                  color: isActive ? '#FFFFFF' : '#64748B',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {/* Clear Filters Prompt */}
      {hasActiveFilters && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: COLORS.muted,
            padding: '2px 4px',
          }}
        >
          <span>
            عرض {filteredFeed.length} من أصل {feed.length} نشاط
          </span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActionFilter('all');
              setCenterFilter('الكل');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.primary,
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '12px',
              padding: 0,
            }}
          >
            مسح الفلاتر
          </button>
        </div>
      )}

      {/* Feed List or Empty State */}
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
      ) : filteredFeed.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
            color: COLORS.muted,
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <SearchIcon size={32} color={COLORS.muted} />
          </div>
          <p style={{ margin: 0, fontWeight: '600' }}>لا توجد أنشطة مطابقة للبحث أو الفلتر المحدد.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActionFilter('all');
              setCenterFilter('الكل');
            }}
            style={{
              marginTop: '10px',
              padding: '6px 14px',
              backgroundColor: COLORS.primary,
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            عرض جميع الأنشطة
          </button>
        </div>
      ) : (
        filteredFeed.map((item) => {
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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {item.action === 'completed' ? (
                      <>
                        <ClipboardListIcon size={14} color={COLORS.green} />
                        <span>عرض تفاصيل المعاينة والعينات</span>
                      </>
                    ) : (
                      <>
                        <MapPinIcon size={14} color={COLORS.primary} />
                        <span>عرض المنشأة</span>
                      </>
                    )}
                    <span>←</span>
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
