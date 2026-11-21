import React from 'react';
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

interface Props {
  facility: Facility;
  user: User;
  onReserve: (f: Facility) => void;
  onRelease: (f: Facility) => void;
  onStartInspection: (f: Facility) => void;
  onUnlock: (f: Facility) => void;
  onClose: () => void;
}

export const FacilityDetail: React.FC<Props> = ({
  facility,
  user,
  onReserve,
  onRelease,
  onStartInspection,
  onUnlock,
  onClose,
}) => {
  const isAvailable = facility.status === 'available';
  const isReserved = facility.status === 'reserved';
  const isCompleted = facility.status === 'completed';
  const isMyReservation = facility.reserved_by_id === user.id || user.role === 'admin';

  const openMaps = () => {
    const q = encodeURIComponent(`${facility.name} ${facility.address} ${facility.center}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  const openGps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: COLORS.ink, textAlign: 'right' }}>
          {facility.name}
        </h2>
        <div style={{ fontSize: '13px', color: COLORS.muted, marginTop: '2px' }}>
          {facility.center} — {facility.address}
        </div>
        <div style={{ fontSize: '12px', color: COLORS.primary, fontWeight: '700', marginTop: '4px' }}>
          كود: {facility.facility_code} • {facility.activity_type || 'أخرى'}
        </div>
      </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
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
              backgroundColor: COLORS.green,
              color: '#FFFFFF',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '800',
              boxShadow: '0 2px 6px rgba(79,163,54,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <FileEditIcon size={18} color="#FFFFFF" />
            <span>بدء المعاينة مباشرة</span>
          </button>
        </div>
      )}

      {/* Reserved State Actions */}
      {isReserved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
          <div
            style={{
              backgroundColor: COLORS.amberSoft,
              color: COLORS.amber,
              padding: '10px 12px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              textAlign: 'right',
            }}
          >
            محجوز مؤقتاً بواسطة: {facility.reserved_by_name}
            {facility.reserved_at && (
              <span style={{ fontSize: '11px', display: 'block', marginTop: '3px', fontWeight: '500' }}>
                منذ{' '}
                {new Date(facility.reserved_at).toLocaleTimeString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>

          {isMyReservation && (
            <>
              <button
                type="button"
                onClick={() => onStartInspection(facility)}
                style={{
                  padding: '14px',
                  backgroundColor: COLORS.green,
                  color: '#FFFFFF',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <FileEditIcon size={18} color="#FFFFFF" />
                <span>تسجيل نتيجة المعاينة</span>
              </button>
              <button
                type="button"
                onClick={() => onRelease(facility)}
                style={{
                  padding: '12px',
                  backgroundColor: 'transparent',
                  border: `1.5px solid ${COLORS.amber}`,
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

      {/* Admin Unlock Action */}
      {user.role === 'admin' && !isAvailable && (
        <button
          type="button"
          onClick={() => onUnlock(facility)}
          style={{
            padding: '12px',
            backgroundColor: COLORS.amberSoft,
            border: `1px solid ${COLORS.amber}`,
            color: COLORS.amber,
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '700',
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <UnlockIcon size={16} color={COLORS.amber} />
          <span>فتح المكان مجدداً (الأدمن)</span>
        </button>
      )}

      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '10px',
          color: COLORS.muted,
          fontSize: '14px',
          fontWeight: '700',
          marginTop: '4px',
        }}
      >
        إغلاق
      </button>
    </div>
  );
};
