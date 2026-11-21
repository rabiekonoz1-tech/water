import React, { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../theme';
import type { FollowupItem, User } from '../types';
import { LEVEL_COLORS, LEVEL_LABELS } from '../constants';
import { api } from '../api';
import { AlertTriangleIcon, CheckCircleIcon, MapPinIcon, RefreshCwIcon } from '../components/Icons';

interface Props {
  user: User;
  onFollowupCountChange?: (cnt: number) => void;
}

export const FollowupsScreen: React.FC<Props> = ({ user, onFollowupCountChange }) => {
  const [items, setItems] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFollowups(user.code);
      setItems(res.followups);
      onFollowupCountChange?.(res.followups.length);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل المتابعات');
    } finally {
      setLoading(false);
    }
  }, [user.code, onFollowupCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  const markDone = async (item: FollowupItem) => {
    if (!window.confirm(`تأكيد أن متابعة المنشأة "${item.facility_name}" قد تمت؟`)) {
      return;
    }
    try {
      await api.markFollowupDone(user.code, item.id);
      load();
    } catch (err: any) {
      alert('تعذر التحديث: ' + err.message);
    }
  };

  const dismissFollowup = async (item: FollowupItem) => {
    if (!window.confirm(`هل تريد إزالة المنشأة "${item.facility_name}" من قائمة المتابعات؟`)) {
      return;
    }
    try {
      await api.dismissFollowup(user.code, item.id);
      load();
      alert('تمت إزالة المتابعة بنجاح');
    } catch (err: any) {
      alert('تعذر الإلغاء: ' + err.message);
    }
  };

  const openMaps = (item: FollowupItem) => {
    const q = encodeURIComponent(`${item.facility_name} ${item.address} ${item.center}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

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
          منشآت تتطلب زيارة متابعة ({items.length})
        </h2>
        <button
          type="button"
          onClick={load}
          style={{
            color: COLORS.primary,
            fontWeight: '700',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ display: 'inline-flex', animation: loading ? 'spin 1s linear infinite' : 'none' }}>
            <RefreshCwIcon size={13} color={COLORS.primary} />
          </span>
          <span>{loading ? 'جارٍ التحميل...' : 'تحديث'}</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: COLORS.redSoft,
            color: COLORS.red,
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {items.length === 0 && !loading && (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            color: COLORS.muted,
            fontSize: '14px',
          }}
        >
          لا توجد منشآت تحتاج متابعة حالياً
        </div>
      )}

      {items.map((item) => {
        const overdue = Boolean(item.followup_date && item.followup_date < today);
        const tone = LEVEL_COLORS[item.violation_level] || LEVEL_COLORS.none;

        return (
          <div
            key={item.id}
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: '14px',
              padding: '14px',
              border: `1px solid ${overdue ? COLORS.red : COLORS.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
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
                  fontWeight: '800',
                  backgroundColor: tone.bg,
                  color: tone.fg,
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                {LEVEL_LABELS[item.violation_level]}
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: COLORS.ink }}>
                {item.facility_name}
              </h3>
            </div>

            <div style={{ fontSize: '13px', color: COLORS.muted }}>
              {item.center} — {item.address}
            </div>

            <div
              style={{
                fontSize: '12px',
                color: overdue ? COLORS.red : COLORS.primary,
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {overdue && <AlertTriangleIcon size={14} color={COLORS.red} />}
              <span>
                {item.followup_date
                  ? `موعد المتابعة: ${item.followup_date} ${overdue ? '(متأخرة)' : ''}`
                  : 'بدون موعد محدد'}
                {' • المعاين: '}
                {item.worker_name}
              </span>
            </div>

            {item.notes && (
              <div
                style={{
                  fontSize: '12px',
                  color: COLORS.ink,
                  backgroundColor: COLORS.bg,
                  padding: '8px',
                  borderRadius: '8px',
                  marginTop: '2px',
                }}
              >
                ملاحظات: {item.notes}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => markDone(item)}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  backgroundColor: COLORS.green,
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircleIcon size={16} color="#FFFFFF" />
                <span>تمت المتابعة</span>
              </button>

              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => dismissFollowup(item)}
                  style={{
                    padding: '9px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: COLORS.red,
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '700',
                  }}
                >
                  إلغاء المتابعة
                </button>
              )}

              <button
                type="button"
                onClick={() => openMaps(item)}
                style={{
                  padding: '9px 14px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${COLORS.primary}`,
                  color: COLORS.primary,
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <MapPinIcon size={15} color={COLORS.primary} />
                <span>الاتجاهات</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
