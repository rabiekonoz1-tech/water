import React from 'react';
import { COLORS } from '../theme';
import type { Facility } from '../types';
import { LEVEL_COLORS, LEVEL_LABELS, OUTCOME_LABELS } from '../constants';

interface Props {
  facility: Facility;
  onClick: () => void;
}

export const FacilityCard: React.FC<Props> = ({ facility, onClick }) => {
  const isCompleted = facility.status === 'completed';
  const isReserved = facility.status === 'reserved';

  const statusBg = isCompleted ? COLORS.greenSoft : isReserved ? COLORS.amberSoft : '#E0F2FE';
  const statusColor = isCompleted ? COLORS.green : isReserved ? COLORS.amber : COLORS.primary;
  const statusText = isCompleted
    ? `مقفول • ${facility.completed_by_name || 'تم'}`
    : isReserved
    ? `في الطريق • ${facility.reserved_by_name || 'محجوز'}`
    : 'متاح للمعاينة';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: '14px',
        padding: '14px',
        marginBottom: '10px',
        border: `1px solid ${COLORS.border}`,
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        transition: 'background-color 0.1s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: '700',
            backgroundColor: statusBg,
            color: statusColor,
            padding: '3px 8px',
            borderRadius: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          {statusText}
        </span>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: '700',
            color: COLORS.ink,
            flex: 1,
            textAlign: 'right',
            marginRight: '8px',
          }}
        >
          {facility.name}
        </h3>
      </div>

      <div style={{ fontSize: '13px', color: COLORS.muted, textAlign: 'right' }}>
        {facility.center} — {facility.address}
      </div>

      <div
        style={{
          fontSize: '11px',
          color: COLORS.primary,
          textAlign: 'right',
          marginTop: '6px',
          fontWeight: '600',
        }}
      >
        كود: {facility.facility_code} • {facility.activity_type || 'أخرى'} • تاريخ الخطة:{' '}
        {facility.target_date || '-'}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginTop: '8px',
          justifyContent: 'flex-start',
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
            }}
          >
            تحتاج متابعة
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

        {isCompleted && facility.inspection?.visit_outcome && facility.inspection.visit_outcome !== 'inspected' && (
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
    </div>
  );
};
