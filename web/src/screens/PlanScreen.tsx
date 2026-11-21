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
  { key: 'completed', label: 'تم' },
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

  const centers = useMemo(() => {
    const s = new Set<string>(['الكل']);
    facilities.forEach((f) => {
      if (f.center) s.add(f.center);
    });
    return Array.from(s);
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
          f.name.toLowerCase().includes(q) ||
          f.address.toLowerCase().includes(q) ||
          f.facility_code.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [facilities, centerFilter, statusFilter, search, user.id]);

  const completedCount = facilities.filter((f) => f.status === 'completed').length;
  const reservedCount = facilities.filter((f) => f.status === 'reserved').length;
  const progress = facilities.length ? Math.round((completedCount / facilities.length) * 100) : 0;

  return (
    <div
      className="scroll-container"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        gap: '10px',
      }}
    >
      {/* Month Selector Tabs */}
      <div className="scroll-horizontal" style={{ gap: '8px', paddingBottom: '4px' }}>
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

      {/* KPI Summary Cards */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div
          style={{
            flex: 1,
            backgroundColor: '#F0F7FB',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '12px',
            padding: '10px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS.muted }}>الإجمالي</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: COLORS.primary, marginTop: '2px' }}>
            {facilities.length}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: COLORS.amberSoft,
            border: `1px solid #FDE68A`,
            borderRadius: '12px',
            padding: '10px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS.amber }}>في الطريق</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: COLORS.amber, marginTop: '2px' }}>
            {reservedCount}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: COLORS.greenSoft,
            border: `1px solid #BBF7D0`,
            borderRadius: '12px',
            padding: '10px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS.green }}>تم</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: COLORS.green, marginTop: '2px' }}>
            {completedCount}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div
          style={{
            height: '7px',
            backgroundColor: COLORS.border,
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: COLORS.green,
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: COLORS.muted,
            fontWeight: '600',
            marginTop: '4px',
          }}
        >
          <span>نسبة الإنجاز: {progress}%</span>
          <button
            type="button"
            onClick={onRefresh}
            style={{
              color: COLORS.primary,
              fontWeight: '700',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <RefreshCwIcon size={13} color={COLORS.primary} />
            </span>
            <span>{refreshing ? 'جارٍ التحديث...' : 'تحديث'}</span>
          </button>
        </div>
      </div>

      {/* Search Input with SVG Icon */}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="search"
          placeholder="بحث باسم المكان أو العنوان أو الكود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 38px 12px 14px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.surface,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
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
            color: COLORS.muted,
          }}
        >
          <SearchIcon size={18} color={COLORS.muted} />
        </div>
      </div>

      {/* Center Filter Chips */}
      <div className="scroll-horizontal" style={{ gap: '6px', paddingBottom: '4px' }}>
        {centers.map((c) => (
          <Chip
            key={c}
            label={c}
            active={centerFilter === c}
            onClick={() => setCenterFilter(c)}
          />
        ))}
      </div>

      {/* Status Filter Chips */}
      <div className="scroll-horizontal" style={{ gap: '6px', paddingBottom: '4px' }}>
        {STATUS_FILTERS.map((sf) => (
          <Chip
            key={sf.key}
            label={sf.label}
            active={statusFilter === sf.key}
            onClick={() => setStatusFilter(sf.key)}
          />
        ))}
      </div>

      {/* Facilities List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '70px' }}>
        {filteredFacilities.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: COLORS.muted,
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            لا توجد منشآت مطابقة للفلاتر الحالية
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
