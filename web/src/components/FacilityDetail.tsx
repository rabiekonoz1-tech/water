import React, { useState } from 'react';
import { COLORS } from '../theme';
import type { Facility, User } from '../types';
import { COMPLIANCE_ITEMS, LEVEL_COLORS, LEVEL_LABELS, OUTCOME_LABELS } from '../constants';
import {
  CarIcon,
  CheckCircleIcon,
  FileEditIcon,
  MapPinIcon,
  RotateCcwIcon,
  UnlockIcon,
} from './Icons';
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

interface Props {
  facility: Facility;
  user: User;
  onReserve: (f: Facility) => void;
  onRelease: (f: Facility) => void;
  onStartInspection: (f: Facility) => void;
  onUnlock: (f: Facility) => void;
  onClose: () => void;
  onFacilityUpdated?: (updated: Facility) => void;
  onFacilityDeleted?: (id: string) => void;
}

export const FacilityDetail: React.FC<Props> = ({
  facility,
  user,
  onReserve,
  onRelease,
  onStartInspection,
  onUnlock,
  onClose,
  onFacilityUpdated,
  onFacilityDeleted,
}) => {
  const isAvailable = facility.status === 'available';
  const isReserved = facility.status === 'reserved';
  const isCompleted = facility.status === 'completed';
  const isMyReservation = facility.reserved_by_id === user.id || user.role === 'admin';
  const isAdmin = user.role === 'admin';

  // Admin Modes
  const [showEdit, setShowEdit] = useState(false);
  const [showResetOptions, setShowResetOptions] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(facility.name);
  const [editCode, setEditCode] = useState(facility.facility_code);
  const [editAddress, setEditAddress] = useState(facility.address);
  const [editCenter, setEditCenter] = useState(facility.center || 'شبين الكوم');
  const [editDate, setEditDate] = useState(facility.target_date || '');
  const [editActivity, setEditActivity] = useState(facility.activity_type || 'أخرى');
  const [editNotes, setEditNotes] = useState(facility.plan_notes || '');

  const openMaps = () => {
    const q = encodeURIComponent(`${facility.name} ${facility.address} ${facility.center}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  const openGps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  // Admin: Save updated facility details
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      alert('اسم المنشأة مطلوب');
      return;
    }
    setLoading(true);
    try {
      const res = await api.updateFacility(user.code, facility.id, {
        name: editName.trim(),
        facility_code: editCode.trim().toUpperCase(),
        address: editAddress.trim(),
        center: editCenter.trim(),
        target_date: editDate.trim(),
        activity_type: editActivity.trim(),
        plan_notes: editNotes.trim(),
      });
      setShowEdit(false);
      if (onFacilityUpdated) onFacilityUpdated(res.facility);
      alert('تم تحديث بيانات المنشأة بنجاح');
    } catch (err: any) {
      alert('خطأ في التحديث: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: Delete facility
  const handleDelete = async () => {
    if (
      !window.confirm(
        `تحذير: هل أنت متأكد من حذف المنشأة "${facility.name}" (${facility.facility_code}) وجميع سجلاتها نهائياً من الخطة؟`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      await api.deleteFacility(user.code, facility.id);
      if (onFacilityDeleted) onFacilityDeleted(facility.id);
      onClose();
      alert('تم حذف المنشأة نهائياً من الخطة');
    } catch (err: any) {
      alert('تعذر حذف المنشأة: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: Reset facility (keep_history or wipe)
  const handleReset = async (mode: 'keep_history' | 'wipe') => {
    const confirmMsg =
      mode === 'wipe'
        ? 'هل تريد مسح المعاينة السابقة تماماً وتصفير المكان؟ (لن تظهر المعاينة القديمة في الأرشيف)'
        : 'هل تريد إعادة فتح المكان للمعاينة مع الاحتفاظ بالمعاينة السابقة في سجل الأرشيف؟';

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await api.resetFacility(user.code, facility.id, mode);
      setShowResetOptions(false);
      if (onFacilityUpdated) onFacilityUpdated(res.facility);
      alert(mode === 'wipe' ? 'تم تصفير المكان ومسح المعاينة بنجاح' : 'تمت إعادة فتح المكان مع حفظ السجل القديم بنجاح');
    } catch (err: any) {
      alert('تعذر عمل ريسيت للمكان: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Edit Modal / Form View */}
      {showEdit ? (
        <form
          onSubmit={handleSaveEdit}
          style={{
            backgroundColor: '#F8FAFC',
            borderRadius: '14px',
            padding: '14px',
            border: `1.5px solid ${COLORS.primary}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: COLORS.primary, margin: 0 }}>
              تعديل بيانات المنشأة (الأدمن)
            </h3>
            <span style={{ fontSize: '11px', color: COLORS.muted }}>كود #{facility.serial_no}</span>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
              اسم المنشأة / المكان:
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                كود المنشأة:
              </label>
              <input
                type="text"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, display: 'block', marginBottom: '4px' }}>
                المركز:
              </label>
              <select
                value={editCenter}
                onChange={(e) => setEditCenter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
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
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                backgroundColor: '#FFFFFF',
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
                value={editActivity}
                onChange={(e) => setEditActivity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
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
                تاريخ الخطة المستهدف:
              </label>
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: '#FFFFFF',
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
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: COLORS.primary,
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '800',
              }}
            >
              {loading ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </button>

            <button
              type="button"
              onClick={() => setShowEdit(false)}
              disabled={loading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#E2E8F0',
                color: '#334155',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      ) : (
        /* Normal Header View */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: COLORS.ink, textAlign: 'right', margin: 0, flex: 1 }}>
              {facility.name}
            </h2>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '800',
                backgroundColor: '#F1F5F9',
                color: '#334155',
                padding: '3px 8px',
                borderRadius: '6px',
                marginRight: '6px',
              }}
            >
              {facility.facility_code}
            </span>
          </div>

          <div style={{ fontSize: '13px', color: COLORS.muted, marginTop: '4px', textAlign: 'right' }}>
            <strong style={{ color: COLORS.ink }}>{facility.center}</strong> — {facility.address}
          </div>

          <div style={{ fontSize: '12px', color: COLORS.primary, fontWeight: '700', marginTop: '4px', textAlign: 'right' }}>
            نوع النشاط: {facility.activity_type || 'أخرى'}
            {facility.target_date ? ` • تاريخ الخطة: ${facility.target_date}` : ''}
          </div>

          {facility.plan_notes && (
            <div style={{ fontSize: '12px', color: '#64748B', backgroundColor: '#F8FAFC', padding: '6px 8px', borderRadius: '6px', marginTop: '4px' }}>
              ملاحظة الخطة: {facility.plan_notes}
            </div>
          )}
        </div>
      )}

      {facility.history && (
        <div
          style={{
            backgroundColor: LEVEL_COLORS[facility.history.worst].bg,
            color: LEVEL_COLORS[facility.history.worst].fg,
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '700',
            textAlign: 'right',
          }}
        >
          زيارات سابقة لنفس المنشأة: {facility.history.visits} • أعلى مخالفة:{' '}
          {LEVEL_LABELS[facility.history.worst]}
        </div>
      )}

      {/* Open Maps button */}
      <button
        type="button"
        onClick={openMaps}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '10px',
          backgroundColor: '#EFF6FF',
          border: `1px solid #BFDBFE`,
          borderRadius: '10px',
          color: COLORS.primary,
          fontSize: '13px',
          fontWeight: '700',
        }}
      >
        <MapPinIcon size={16} color={COLORS.primary} />
        <span>فتح العنوان في الخرائط</span>
      </button>

      {/* Available State Actions */}
      {isAvailable && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => onReserve(facility)}
            style={{
              padding: '14px',
              backgroundColor: COLORS.amber,
              color: '#FFFFFF',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '800',
              boxShadow: '0 2px 6px rgba(217,119,6,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <CarIcon size={18} color="#FFFFFF" />
            <span>حجز مؤقت (أنا في الطريق)</span>
          </button>

          <button
            type="button"
            onClick={() => onStartInspection(facility)}
            style={{
              padding: '14px',
              backgroundColor: COLORS.primary,
              color: '#FFFFFF',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '800',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <FileEditIcon size={18} color="#FFFFFF" />
            <span>بدء تسجيل المعاينة مباشرة</span>
          </button>
        </div>
      )}

      {/* Reserved State Actions */}
      {isReserved && (
        <div
          style={{
            backgroundColor: COLORS.amberSoft,
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            border: `1px solid #FDE68A`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CarIcon size={18} color={COLORS.amber} />
            <span style={{ fontSize: '13px', fontWeight: '800', color: COLORS.amber }}>
              المكان محجوز بواسطة {facility.reserved_by_name}
            </span>
          </div>

          {isMyReservation && (
            <>
              <button
                type="button"
                onClick={() => onStartInspection(facility)}
                style={{
                  padding: '12px',
                  backgroundColor: COLORS.primary,
                  color: '#FFFFFF',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <FileEditIcon size={16} color="#FFFFFF" />
                <span>وصلت للمكان — بدء المعاينة</span>
              </button>

              <button
                type="button"
                onClick={() => onRelease(facility)}
                style={{
                  padding: '10px',
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.amber,
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <RotateCcwIcon size={16} color={COLORS.amber} />
                <span>إلغاء الحجز (لن أذهب)</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Completed Inspection Details */}
      {isCompleted && facility.inspection && (
        <div
          style={{
            backgroundColor: COLORS.bg,
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              backgroundColor: COLORS.surface,
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              color: COLORS.ink,
              border: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircleIcon size={16} color={COLORS.green} />
            <span>
              {OUTCOME_LABELS[facility.inspection.visit_outcome || 'inspected']} — بواسطة{' '}
              {facility.inspection.worker_name}
            </span>
          </div>

          {(facility.inspection.visit_outcome || 'inspected') === 'inspected' && (
            <>
              {facility.inspection.samples?.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: COLORS.primary, marginBottom: '4px' }}>
                    العينات المسحوبة ({facility.inspection.samples.length}):
                  </div>
                  {facility.inspection.samples.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '12px',
                        color: COLORS.ink,
                        padding: '4px 0',
                        borderBottom: `1px dashed ${COLORS.border}`,
                      }}
                    >
                      • {s.code ? `${s.code} — ` : ''}
                      <strong>{s.name}</strong> ({s.type}) × {s.count}
                      {s.ph != null && ` • pH ${s.ph}`}
                      {s.temperature != null && ` • ${s.temperature}°م`}
                    </div>
                  ))}
                </div>
              )}

              {facility.inspection.violation_level && (
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: '800',
                    color: LEVEL_COLORS[facility.inspection.violation_level].fg,
                    backgroundColor: LEVEL_COLORS[facility.inspection.violation_level].bg,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    marginTop: '4px',
                  }}
                >
                  مستوى المخالفة: {LEVEL_LABELS[facility.inspection.violation_level]}
                </div>
              )}

              {COMPLIANCE_ITEMS.filter((c) => facility.inspection?.compliance?.[c.key]).length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: COLORS.primary, marginBottom: '4px' }}>
                    الاشتراطات:
                  </div>
                  {COMPLIANCE_ITEMS.filter((c) => facility.inspection?.compliance?.[c.key]).map((c) => {
                    const ans = facility.inspection!.compliance![c.key];
                    const isBad = ans === c.badAnswer;
                    return (
                      <div
                        key={c.key}
                        style={{
                          fontSize: '12px',
                          color: isBad ? COLORS.red : COLORS.ink,
                          fontWeight: isBad ? '700' : '500',
                          padding: '2px 0',
                        }}
                      >
                        {isBad ? '✗' : ans === 'na' ? '–' : '✓'} {c.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {facility.inspection.representative_name && (
            <div style={{ fontSize: '12px', color: COLORS.ink }}>
              ممثل المنشأة: <strong>{facility.inspection.representative_name}</strong>
              {facility.inspection.representative_phone && ` (${facility.inspection.representative_phone})`}
            </div>
          )}

          {facility.inspection.notes && (
            <div style={{ fontSize: '12px', color: COLORS.ink, backgroundColor: '#FFF', padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
              ملاحظات: {facility.inspection.notes}
            </div>
          )}

          {facility.inspection.followup_required && (
            <div style={{ fontSize: '12px', color: COLORS.amber, fontWeight: '700' }}>
              تحتاج متابعة{facility.inspection.followup_date ? ` بتاريخ ${facility.inspection.followup_date}` : ''}
            </div>
          )}

          {facility.inspection.gps_lat && facility.inspection.gps_lng && (
            <button
              type="button"
              onClick={() => openGps(facility.inspection!.gps_lat!, facility.inspection!.gps_lng!)}
              style={{
                fontSize: '12px',
                color: COLORS.primary,
                fontWeight: '700',
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '4px',
              }}
            >
              <MapPinIcon size={14} color={COLORS.primary} />
              <span>GPS: {facility.inspection.gps_lat}, {facility.inspection.gps_lng} (عرض على الخريطة)</span>
            </button>
          )}
        </div>
      )}

      {/* Admin Operations Section (Full CRUD & Reset) */}
      {isAdmin && (
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderRadius: '14px',
            padding: '12px',
            border: `1.5px solid #CBD5E1`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginTop: '4px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: '800', color: COLORS.ink, marginBottom: '2px' }}>
            🛠️ صلاحيات الإدارة للمنشأة:
          </div>

          {/* Reset Action (with Sub-options) */}
          {!isAvailable && (
            <>
              {!showResetOptions ? (
                <button
                  type="button"
                  onClick={() => setShowResetOptions(true)}
                  style={{
                    padding: '11px',
                    backgroundColor: COLORS.amberSoft,
                    border: `1.5px solid ${COLORS.amber}`,
                    color: COLORS.amber,
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <UnlockIcon size={16} color={COLORS.amber} />
                  <span>إعادة ضبط المعاينة (ريسيت)</span>
                </button>
              ) : (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '10px',
                    border: `1px solid ${COLORS.amber}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink }}>
                    اختر نوع الريسيت:
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleReset('keep_history')}
                    style={{
                      padding: '8px',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #10B981',
                      color: '#059669',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      textAlign: 'right',
                    }}
                  >
                    🔄 1. فتح للمعاينة مع حفظ السجل في الأرشيف (موصى به)
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleReset('wipe')}
                    style={{
                      padding: '8px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #EF4444',
                      color: '#DC2626',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      textAlign: 'right',
                    }}
                  >
                    🗑️ 2. تصفير شامل ومسح المعاينة السابقة تماماً
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetOptions(false)}
                    style={{
                      padding: '4px',
                      backgroundColor: 'transparent',
                      color: COLORS.muted,
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </>
          )}

          {/* Edit & Delete Buttons Row */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#FFFFFF',
                border: `1px solid ${COLORS.primary}`,
                color: COLORS.primary,
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <span>✏️ تعديل البيانات</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleDelete}
              style={{
                padding: '10px 14px',
                backgroundColor: '#FFFFFF',
                border: `1px solid ${COLORS.red}`,
                color: COLORS.red,
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <span>🗑️ حذف</span>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '10px',
          color: COLORS.muted,
          fontSize: '14px',
          fontWeight: '700',
          marginTop: '2px',
          cursor: 'pointer',
        }}
      >
        إغلاق
      </button>
    </div>
  );
};
