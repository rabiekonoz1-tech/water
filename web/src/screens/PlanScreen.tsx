import React, { useMemo, useState } from 'react';
import { COLORS } from '../theme';
import type { Facility, MonthlyPlan, User } from '../types';
import { Chip } from '../components/Chip';
import { FacilityCard } from '../components/FacilityCard';
import { RefreshCwIcon, SearchIcon } from '../components/Icons';
import { api } from '../api';

const MENOUFIA_CENTERS = [
  'شبين الكوم',
  'قويسنا',
  'بركة السبع',
  'الشهداء',
  'منوف',
  'الباجور',
  'سرس الليان',
  'أشمون',
  'تلا',
  'السادات',
  'أخرى',
];

const ACTIVITY_TYPES = ['مطعم/مطبخ', 'مغسلة', 'مصنع', 'محطة/خدمات', 'مزرعة/مجزر', 'أخرى'];

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
  const isAdmin = user.role === 'admin';

  // Admin: Add Facility Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCode, setAddCode] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addCenter, setAddCenter] = useState('شبين الكوم');
  const [addDate, setAddDate] = useState('');
  const [addActivity, setAddActivity] = useState('أخرى');
  const [addNotes, setAddNotes] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Admin: Bulk Reset Modal State
  const [showBulkResetModal, setShowBulkResetModal] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<'completed' | 'reserved' | 'all'>('completed');
  const [bulkMode, setBulkMode] = useState<'keep_history' | 'wipe'>('keep_history');
  const [submittingBulk, setSubmittingBulk] = useState(false);

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

  // Admin: Create Facility Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      alert('اسم المنشأة مطلوب');
      return;
    }
    setSubmittingAdd(true);
    try {
      await api.createFacility(user.code, selectedPlanId, {
        name: addName.trim(),
        facility_code: addCode.trim().toUpperCase(),
        address: addAddress.trim(),
        center: addCenter.trim(),
        target_date: addDate.trim(),
        activity_type: addActivity.trim(),
        plan_notes: addNotes.trim(),
      });
      setShowAddModal(false);
      setAddName('');
      setAddCode('');
      setAddAddress('');
      setAddDate('');
      setAddNotes('');
      onRefresh();
      alert('تمت إضافة المنشأة الجديدة بنجاح إلى الخطة!');
    } catch (err: any) {
      alert('خطأ في الإضافة: ' + err.message);
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Admin: Bulk Reset Submit
  const handleBulkResetSubmit = async () => {
    const targetLabel =
      bulkTarget === 'completed'
        ? 'المنشآت المكتملة'
        : bulkTarget === 'reserved'
        ? 'المنشآت المحجوزة'
        : 'جميع منشآت الخطة';

    const modeLabel =
      bulkMode === 'keep_history' ? 'مع الاحتفاظ بالسجل التاريخي' : 'مع مسح وتصفير السجل تماماً';

    if (!window.confirm(`هل أنت متأكد من إعادة فتح ${targetLabel} (${modeLabel})؟`)) {
      return;
    }

    setSubmittingBulk(true);
    try {
      const res = await api.bulkResetPlan(user.code, selectedPlanId, bulkTarget, bulkMode);
      setShowBulkResetModal(false);
      onRefresh();
      alert(res.message || `تمت إعادة فتح المنشآت بنجاح (${res.count} منشأة)`);
    } catch (err: any) {
      alert('تعذر عمل ريسيت: ' + err.message);
    } finally {
      setSubmittingBulk(false);
    }
  };

  return (
    <div
      className="scroll-container"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 14px',
        gap: '12px',
        backgroundColor: '#F8FAFC',
      }}
    >
      {/* Plan Header & Switcher */}
      {plans.length > 1 ? (
        <div
          className="scroll-horizontal"
          style={{
            gap: '6px',
            padding: '4px 0',
            flexShrink: 0,
            minHeight: '44px',
            alignItems: 'center',
          }}
        >
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
            padding: '2px 4px',
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '8px',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: COLORS.primary,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <span>＋ إضافة مكان</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBulkResetModal(true)}
                  title="إعادة فتح الأماكن (ريسيت الخطة)"
                  style={{
                    padding: '6px 10px',
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    color: '#B45309',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <span>🔄 ريسيت للخطة</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onRefresh}
              style={{
                padding: '6px 10px',
                backgroundColor: '#FFFFFF',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '10px',
                color: COLORS.primary,
                fontWeight: '700',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                cursor: 'pointer',
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
              <span>{refreshing ? '...' : 'تحديث'}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Progress & KPI Summary Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '12px 14px',
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
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

        {/* Progress Bar */}
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

      {/* Search & Filter Section (Clean, Distinct Card) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '12px',
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="search"
            placeholder="ابحث باسم المكان، العنوان، أو الكود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 38px 10px 36px',
              borderRadius: '12px',
              border: `1px solid ${COLORS.border}`,
              backgroundColor: '#F8FAFC',
              fontSize: '13px',
              color: COLORS.ink,
              outline: 'none',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
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
                background: '#CBD5E1',
                border: 'none',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#334155',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Centers Horizontal Scroll Row */}
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: COLORS.muted,
              marginBottom: '5px',
            }}
          >
            المراكز والمدن:
          </div>
          <div
            className="scroll-horizontal"
            style={{
              gap: '6px',
              padding: '2px 0 4px 0',
              flexShrink: 0,
              minHeight: '38px',
              alignItems: 'center',
            }}
          >
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
        </div>

        {/* Status Horizontal Scroll Row */}
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: COLORS.muted,
              marginBottom: '5px',
            }}
          >
            حالة المعاينة:
          </div>
          <div
            className="scroll-horizontal"
            style={{
              gap: '6px',
              padding: '2px 0 4px 0',
              flexShrink: 0,
              minHeight: '38px',
              alignItems: 'center',
            }}
          >
            {STATUS_FILTERS.map((sf) => {
              const isActive = statusFilter === sf.key;
              return (
                <button
                  key={sf.key}
                  type="button"
                  onClick={() => setStatusFilter(sf.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: isActive ? '800' : '600',
                    border: isActive ? `1.5px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                    backgroundColor: isActive ? COLORS.primary : '#F8FAFC',
                    color: isActive ? '#FFFFFF' : '#475569',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {sf.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Count Summary & Reset Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: COLORS.muted,
          fontWeight: '600',
          padding: '2px 4px',
          flexShrink: 0,
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
              marginTop: '6px',
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
                padding: '7px 16px',
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

      {/* Admin: Add Facility Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '18px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: COLORS.ink, margin: 0 }}>
                ＋ إضافة منشأة جديدة للخطة
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: COLORS.muted,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                  مسمى المنشأة الصناعية: *
                </label>
                <input
                  type="text"
                  placeholder="مثال: مصنع الأمل للألبان، مغسلة الصفا..."
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${COLORS.border}`,
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                    كود المنشأة (اختياري):
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: SH155 أو QA30"
                    value={addCode}
                    onChange={(e) => setAddCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${COLORS.border}`,
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                    المركز: *
                  </label>
                  <select
                    value={addCenter}
                    onChange={(e) => setAddCenter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${COLORS.border}`,
                      backgroundColor: '#FFFFFF',
                      fontSize: '13px',
                    }}
                  >
                    {MENOUFIA_CENTERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                  العنوان التفصيلي:
                </label>
                <input
                  type="text"
                  placeholder="مثال: شبين الكوم - بجوار المستشفى العام"
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${COLORS.border}`,
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                    نوع النشاط:
                  </label>
                  <select
                    value={addActivity}
                    onChange={(e) => setAddActivity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${COLORS.border}`,
                      backgroundColor: '#FFFFFF',
                      fontSize: '13px',
                    }}
                  >
                    {ACTIVITY_TYPES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                    تاريخ المعاينة المستهدف:
                  </label>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${COLORS.border}`,
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                  ملاحظات الخطة:
                </label>
                <input
                  type="text"
                  placeholder="أي تعليمات أو ملاحظات للمفتش"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${COLORS.border}`,
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  style={{
                    flex: 1,
                    padding: '11px',
                    backgroundColor: COLORS.primary,
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: submittingAdd ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submittingAdd ? 'جارٍ الحفظ...' : 'إضافة المنشأة للخطة'}
                </button>

                <button
                  type="button"
                  disabled={submittingAdd}
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '11px 16px',
                    backgroundColor: '#E2E8F0',
                    color: '#334155',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin: Bulk Reset Modal */}
      {showBulkResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '18px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: COLORS.amber, margin: 0 }}>
                🔄 إعادة فتح / ريسيت للخطة (الأدمن)
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkResetModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: COLORS.muted,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: COLORS.ink, margin: 0, lineHeight: 1.4 }}>
              يمكنك إعادة فتح المنشآت التي تمت معاينتها أو المحجوزة لتصبح متاحة للمعاينة من جديد.
            </p>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                أي المنشآت تريد إعادة فتحها؟
              </label>
              <select
                value={bulkTarget}
                onChange={(e) => setBulkTarget(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                }}
              >
                <option value="completed">المنشآت المكتملة فقط ({completedCount} منشأة)</option>
                <option value="reserved">المنشآت المحجوزة في الطريق فقط ({reservedCount} منشأة)</option>
                <option value="all">كافة المنشآت المقفولة والمحجوزة</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                نوع الريسيت:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    borderRadius: '8px',
                    border: `1px solid ${bulkMode === 'keep_history' ? COLORS.primary : COLORS.border}`,
                    backgroundColor: bulkMode === 'keep_history' ? '#F0F9FF' : '#FFFFFF',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="bulkMode"
                    value="keep_history"
                    checked={bulkMode === 'keep_history'}
                    onChange={() => setBulkMode('keep_history')}
                  />
                  <span>
                    <strong>حفظ السجل القديم في الأرشيف (موصى به):</strong> يفتح المنشآت لمعاينة جديدة مع بقاء المعاينات السابقة في السجل.
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    borderRadius: '8px',
                    border: `1px solid ${bulkMode === 'wipe' ? COLORS.red : COLORS.border}`,
                    backgroundColor: bulkMode === 'wipe' ? '#FEF2F2' : '#FFFFFF',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="bulkMode"
                    value="wipe"
                    checked={bulkMode === 'wipe'}
                    onChange={() => setBulkMode('wipe')}
                  />
                  <span style={{ color: COLORS.red }}>
                    <strong>مسح وتصفير شامل:</strong> يحذف المعاينات السابقة لهذه المنشآت نهائياً كأنها لم تُعاين قط.
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                disabled={submittingBulk}
                onClick={handleBulkResetSubmit}
                style={{
                  flex: 1,
                  padding: '11px',
                  backgroundColor: COLORS.amber,
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: submittingBulk ? 'not-allowed' : 'pointer',
                }}
              >
                {submittingBulk ? 'جارٍ إعادة الفتح...' : 'تأكيد وإعادة الفتح'}
              </button>

              <button
                type="button"
                disabled={submittingBulk}
                onClick={() => setShowBulkResetModal(false)}
                style={{
                  padding: '11px 16px',
                  backgroundColor: '#E2E8F0',
                  color: '#334155',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
