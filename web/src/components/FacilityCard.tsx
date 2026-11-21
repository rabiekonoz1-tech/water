import React from 'react';
import { COLORS } from '../theme';
import type { Facility } from '../types';
import { LEVEL_COLORS, LEVEL_LABELS, OUTCOME_LABELS } from '../constants';
import { AlertTriangleIcon, CalendarIcon, ChevronLeftIcon, MapPinIcon } from './Icons';

interface Props {
  facility: Facility;
  onClick: () => void;
}

export const FacilityCard: React.FC<Props> = ({ facility, onClick }) => {
  const isCompleted = facility.status === 'completed';
  const isReserved = facility.status === 'reserved';

  const statusBg = isCompleted ? '#ECFDF5' : isReserved ? '#FFFBEB' : '#F0F9FF';
  const statusBorder = isCompleted ? '#A7F3D0' : isReserved ? '#FDE68A' : '#BAE6FD';
  const statusColor = isCompleted ? '#059669' : isReserved ? '#D97706' : '#0284C7';
  const statusDot = isCompleted ? '#10B981' : isReserved ? '#F59E0B' : '#0EA5E9';

  const statusText = isCompleted
    ? `تمت المعاينة${facility.completed_by_name ? ` (${facility.completed_by_name})` : ''}`
    : isReserved
    ? `في الطريق${facility.reserved_by_name ? ` (${facility.reserved_by_name})` : ''}`
    : 'متاح للمعاينة';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: '16px',
        padding: '14px 16px',
        marginBottom: '10px',
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
        cursor: 'pointer',
        transition: 'transform 0.1s ease, box-shadow 0.1s ease, border-color 0.1s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = COLORS.primary;
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLORS.border;
        e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.03)';
      }}
    >
      {/* Top Header: Code Pill + Status Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: '800',
              fontFamily: 'monospace, sans-serif',
              backgroundColor: '#F1F5F9',
              color: '#334155',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              letterSpacing: '0.5px',
            }}
          >
            {facility.facility_code || `F-${facility.serial_no}`}
          </span>

          {facility.serial_no ? (
            <span style={{ fontSize: '11px', color: COLORS.muted, fontWeight: '600' }}>
              #{facility.serial_no}
            </span>
          ) : null}
        </div>

        {/* Status Pill with dot */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            fontWeight: '700',
            backgroundColor: statusBg,
            border: `1px solid ${statusBorder}`,
            color: statusColor,
            padding: '3px 9px',
            borderRadius: '20px',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: statusDot,
              display: 'inline-block',
            }}
          />
          <span>{statusText}</span>
        </div>
      </div>

      {/* Main Facility / Place Name */}
      <div style={{ marginTop: '2px' }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '800',
            color: COLORS.ink,
            margin: 0,
            lineHeight: 1.35,
            textAlign: 'right',
          }}
        >
          {facility.name}
        </h3>
      </div>

      {/* Location / Address Line with Pin */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '13px',
          color: COLORS.muted,
          textAlign: 'right',
        }}
      >
        <MapPinIcon size={15} color={COLORS.primary} style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: '700', color: COLORS.ink }}>{facility.center}</span>
        <span>•</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {facility.address || 'العنوان غير مدون'}
        </span>
      </div>

      {/* Footer Details: Activity + Date + Click Arrow */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '6px',
          borderTop: `1px dashed #F1F5F9`,
          marginTop: '2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {facility.activity_type && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                backgroundColor: '#F8FAFC',
                color: '#475569',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
              }}
            >
              {facility.activity_type}
            </span>
          )}

          {facility.target_date && (
            <span
              style={{
                fontSize: '11px',
                color: COLORS.muted,
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <CalendarIcon size={12} color={COLORS.muted} />
              <span>{facility.target_date}</span>
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            fontSize: '12px',
            fontWeight: '700',
            color: COLORS.primary,
          }}
        >
          <span>معاينة</span>
          <ChevronLeftIcon size={14} color={COLORS.primary} />
        </div>
      </div>

      {/* Alert Badges (if any: followups, prior violations) */}
      {(facility.has_followup ||
        (facility.history && facility.history.worst !== 'none') ||
        (isCompleted && facility.inspection?.violation_level && facility.inspection.violation_level !== 'none') ||
        (isCompleted && facility.inspection?.visit_outcome && facility.inspection.visit_outcome !== 'inspected')) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '2px',
          }}
        >
          {facility.has_followup && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: COLORS.amberSoft,
                color: COLORS.amber,
                fontSize: '11px',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <AlertTriangleIcon size={12} color={COLORS.amber} />
              <span>تحتاج متابعة</span>
            </span>
          )}

          {facility.history && facility.history.worst !== 'none' && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: LEVEL_COLORS[facility.history.worst].bg,
                color: LEVEL_COLORS[facility.history.worst].fg,
                fontSize: '11px',
                fontWeight: '700',
              }}
            >
              مخالفة سابقة {LEVEL_LABELS[facility.history.worst]}
            </span>
          )}

          {isCompleted &&
            facility.inspection?.visit_outcome &&
            facility.inspection.visit_outcome !== 'inspected' && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: COLORS.redSoft,
                  color: COLORS.red,
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                {OUTCOME_LABELS[facility.inspection.visit_outcome]}
              </span>
            )}

          {isCompleted &&
            facility.inspection?.visit_outcome === 'inspected' &&
            facility.inspection.violation_level &&
            facility.inspection.violation_level !== 'none' && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: LEVEL_COLORS[facility.inspection.violation_level].bg,
                  color: LEVEL_COLORS[facility.inspection.violation_level].fg,
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                مخالفة {LEVEL_LABELS[facility.inspection.violation_level]}
              </span>
            )}
        </div>
      )}
    </div>
  );
};
