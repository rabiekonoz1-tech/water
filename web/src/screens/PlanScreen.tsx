import React, { useMemo, useState } from 'react';
import { COLORS } from '../theme';
import type { Facility, MonthlyPlan, User } from '../types';
import { Chip } from '../components/Chip';
import { FacilityCard } from '../components/FacilityCard';
import { RefreshCwIcon, SearchIcon } from '../components/Icons';

type StatusFilter = 'all' | 'available' | 'reserved' | 'completed' | 'mine';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'available', label: 'متاح' },
  { key: 'reserved', label: 'في الطريق' },
  { key: 'completed', label: 'تمت المعاينة' },
  { key: 'mine', label: 'خاصتي' },
];

interface Props {
  user: User;
  plans: MonthlyPlan[];
  selectedPlanId: string;
  onSelectPlan: (id: string) => void;
  facilities: Facility[];
  onSelectFacility: (f: Facility) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export const PlanScreen: React.FC<Props> = ({
  user,
  plans,
  selectedPlanId,
  onSelectPlan,
  facilities,
  onSelectFacility,
  onRefresh,
  refreshing,
}) => {
  const [search, setSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Centers with counts
  const centersWithCount = useMemo(() => {
    const counts: Record<string, number> = {};
    facilities.forEach((f) => {
      const c = f.center || 'أخرى';
      counts[c] = (counts[c] || 0) + 1;
    });

    const list = [{ name: 'الكل', count: facilities.length }];
    Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .forEach((name) => {
        list.push({ name, count: counts[name] });
      });
    return list;
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (centerFilter !== 'الكل' && f.center !== centerFilter) return false;
      if (statusFilter === 'mine') {
        if (f.reserved_by_id !== user.id && f.completed_by_id !== user.id) return false;
      } else if (statusFilter !== 'all' && f.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          (f.name && f.name.toLowerCase().includes(q)) ||
          (f.address && f.address.toLowerCase().includes(q)) ||
          (f.facility_code && f.facility_code.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [facilities, centerFilter, statusFilter, search, user.id]);

  const completedCount = facilities.filter((f) => f.status === 'completed').length;
  const reservedCount = facilities.filter((f) => f.status === 'reserved').length;
  const availableCount = facilities.filter((f) => f.status === 'available').length;
  const progress = facilities.length ? Math.round((completedCount / facilities.length) * 100) : 0;

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  return (
    <div
      className="scroll-container"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 14px',
        gap: '10px',
        backgroundColor: '#F8FAFC',
      }}
    >
      {/* Plan Header & Switcher */}
      {plans.length > 1 ? (
        <div className="scroll-horizontal" style={{ gap: '6px', paddingBottom: '2px' }}>
          {plans.map((p) => (
            <Chip
              key={p.id}
              label={p.month_label}
              active={selectedPlanId === p.id}
              onClick={() => onSelectPlan(p.id)}
              badge={p.total_facilities}
            />
          ))}
        </div>
      ) : currentPlan ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 2px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '800', color: COLORS.ink, margin: 0 }}>
              {currentPlan.month_label}
            </h2>
            <span style={{ fontSize: '12px', color: COLORS.muted }}>
              إجمالي الخطة: {facilities.length} منشأة صناعية
            </span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            style={{
              padding: '6px 12px',
              backgroundColor: '#FFFFFF',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '10px',
              color: COLORS.primary,
              fontWeight: '700',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <RefreshCwIcon size={14} color={COLORS.primary} />
            </span>
            <span>{refreshing ? 'تحديث...' : 'تحديث'}</span>
          </button>
        </div>
      ) : null}

      {/* Sleek, Compact Progress & KPI Summary */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '12px 14px',
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: '700' }}>
            <span style={{ color: COLORS.green }}>
              تم: <strong>{completedCount}</strong>
            </span>
            <span style={{ color: COLORS.amber }}>
              في الطريق: <strong>{reservedCount}</strong>
            </span>
            <span style={{ color: COLORS.primary }}>
              متاح: <strong>{availableCount}</strong>
            </span>
          </div>

          <span
            style={{
              fontSize: '12px',
              fontWeight: '800',
              color: progress > 0 ? COLORS.green : COLORS.muted,
              backgroundColor: progress > 0 ? '#ECFDF5' : '#F1F5F9',
              padding: '2px 8px',
              borderRadius: '10px',
            }}
          >
            {progress}% مكتمل
          </span>
        </div>

        {/* Slim Progress Bar */}
        <div
          style={{
            height: '6px',
            backgroundColor: '#E2E8F0',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(progress, 0)}%`,
              backgroundColor: COLORS.green,
              borderRadius: '3px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Search Input with Instant Clear */}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="search"
          placeholder="ابحث باسم المكان، العنوان، أو الكود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '11px 38px 11px 36px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.border}`,
            backgroundColor: '#FFFFFF',
            fontSize: '13px',
            color: COLORS.ink,
            outline: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <SearchIcon size={16} color={COLORS.muted} />
        </div>

        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#E2E8F0',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: '#475569',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* Centers Filter (Horizontal Scroll with Counts) */}
      <div className="scroll-horizontal" style={{ gap: '6px', paddingBottom: '2px' }}>
        {centersWithCount.map((item) => (
          <Chip
            key={item.name}
            label={item.name}
            active={centerFilter === item.name}
            onClick={() => setCenterFilter(item.name)}
            badge={item.count}
          />
        ))}
      </div>

      {/* Status Segmented Filters */}
      <div className="scroll-horizontal" style={{ gap: '6px', paddingBottom: '2px' }}>
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf.key}
            type="button"
            onClick={() => setStatusFilter(sf.key)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: statusFilter === sf.key ? '800' : '600',
              border: statusFilter === sf.key ? `1.5px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
              backgroundColor: statusFilter === sf.key ? COLORS.primary : '#FFFFFF',
              color: statusFilter === sf.key ? '#FFFFFF' : COLORS.muted,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* Results Count Summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: COLORS.muted,
          fontWeight: '600',
          padding: '2px 4px',
        }}
      >
        <span>
          عرض <strong>{filteredFacilities.length}</strong> من أصل {facilities.length} منشأة
          {centerFilter !== 'الكل' ? ` في ${centerFilter}` : ''}
        </span>

        {(search || centerFilter !== 'الكل' || statusFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCenterFilter('الكل');
              setStatusFilter('all');
            }}
            style={{
              color: COLORS.primary,
              fontWeight: '700',
              fontSize: '11px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            إعادة تعيين الفلاتر
          </button>
        )}
      </div>

      {/* Facilities Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '80px' }}>
        {filteredFacilities.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: `1px solid ${COLORS.border}`,
              color: COLORS.muted,
              fontSize: '14px',
              fontWeight: '600',
              marginTop: '10px',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
            <p style={{ margin: 0 }}>لا توجد منشآت مطابقة للبحث أو الفلتر المحدد</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCenterFilter('الكل');
                setStatusFilter('all');
              }}
              style={{
                marginTop: '10px',
                padding: '6px 14px',
                backgroundColor: COLORS.primary,
                color: '#FFF',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              عرض جميع المنشآت
            </button>
          </div>
        ) : (
          filteredFacilities.map((f) => (
            <FacilityCard key={f.id} facility={f} onClick={() => onSelectFacility(f)} />
          ))
        )}
      </div>
    </div>
  );
};
