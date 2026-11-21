import React, { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../theme';
import type { ConflictItem, Facility, PlanStats, User } from '../types';
import { LEVEL_COLORS, LEVEL_LABELS, type ViolationLevel } from '../constants';
import { api } from '../api';
import {
  AlertTriangleIcon,
  FileSpreadsheetIcon,
  UnlockIcon,
  UploadCloudIcon,
  UserPlusIcon,
} from '../components/Icons';

interface Props {
  user: User;
  facilities: Facility[];
  planId: string;
  onRefresh: () => void;
}

export const AdminScreen: React.FC<Props> = ({ user, facilities, planId, onRefresh }) => {
  const [monthLabel, setMonthLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [workers, setWorkers] = useState<User[]>([]);
  const [workerName, setWorkerName] = useState('');
  const [workerCode, setWorkerCode] = useState('');
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadWorkers = async () => {
    try {
      const res = await api.getWorkers(user.code);
      setWorkers(res.workers);
    } catch {
      // ignore
    }
  };

  const loadStats = useCallback(async () => {
    if (!planId) return;
    try {
      const s = await api.getStats(user.code, planId);
      setStats(s);
      setStatsError('');
    } catch {
      setStatsError('تعذر تحميل الإحصائيات');
    }
  }, [planId, user.code]);

  const loadConflicts = async () => {
    try {
      const res = await api.getConflicts(user.code);
      setConflicts(res.conflicts);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadWorkers();
    loadConflicts();
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, facilities]);

  const handleUploadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthLabel.trim()) {
      alert('اكتب اسم الشهر أولاً (مثال: ديسمبر 2026)');
      return;
    }
    if (!selectedFile) {
      alert('يرجى اختيار ملف Excel');
      return;
    }

    setUploading(true);
    try {
      const res = await api.uploadPlanExcel(user.code, monthLabel.trim(), selectedFile);
      const centers = Object.entries(res.by_center || {})
        .map(([c, n]) => `${c}: ${n}`)
        .join(' • ');
      alert(`تمت إضافة خطة "${monthLabel}" بنجاح (${res.inserted} منشأة)\n\nالمراكز: ${centers}`);
      setMonthLabel('');
      setSelectedFile(null);
      onRefresh();
    } catch (err: any) {
      alert('خطأ في الرفع: ' + (err.message || 'تعذر معالجة الملف'));
    } finally {
      setUploading(false);
    }
  };

  const handleExport = () => {
    if (!planId) return;
    const url = api.exportUrl(user.code, planId);
    window.open(url, '_blank');
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim() || !workerCode.trim()) {
      alert('أدخل اسم الموظف والكود');
      return;
    }
    try {
      await api.createWorker(user.code, workerName.trim(), workerCode.trim().toUpperCase());
      setWorkerName('');
      setWorkerCode('');
      loadWorkers();
      alert('تم إنشاء كود الموظف بنجاح');
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleToggleWorker = async (w: User) => {
    const willDisable = Boolean(w.active);
    if (!window.confirm(`${willDisable ? 'إيقاف' : 'تفعيل'} كود ${w.name} (${w.code})؟`)) {
      return;
    }
    try {
      await api.toggleWorker(user.code, w.id);
      loadWorkers();
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleUnlock = async (facilityId: string) => {
    if (!window.confirm('هل تريد إعادة فتح المنشأة للمعاينة مرة أخرى؟')) return;
    try {
      await api.unlockFacility(user.code, facilityId);
      onRefresh();
      alert('تم فتح المنشأة مجدداً');
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleResolveConflict = async (c: ConflictItem, decision: 'discard' | 'replace') => {
    try {
      await api.resolveConflict(user.code, c.id, decision);
      loadConflicts();
      onRefresh();
      alert(decision === 'replace' ? 'تم اعتماد المعاينة الثانية' : 'تم تجاهل المعاينة المكررة');
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    }
  };

  const lockedFacilities = facilities.filter((f) => f.status !== 'available');

  return (
    <div
      className="scroll-container"
      style={{
        flex: 1,
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        paddingBottom: '80px',
      }}
    >
      {/* Dashboard Section */}
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: '16px',
          padding: '16px',
          border: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h2 style={{ fontSize: '17px', fontWeight: '800', color: COLORS.ink }}>
          لوحة المتابعة {stats ? `— ${stats.plan.month_label}` : ''}
        </h2>

        {statsError && <div style={{ color: COLORS.red, fontSize: '12px' }}>{statsError}</div>}

        {stats && (
          <>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div
                style={{
                  flex: 1,
                  backgroundColor: COLORS.bg,
                  borderRadius: '12px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: '800', color: COLORS.primary }}>
                  {stats.totals.completion_rate}%
                </div>
                <div style={{ fontSize: '11px', color: COLORS.muted, fontWeight: '700', marginTop: '2px' }}>
                  نسبة الإنجاز
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  backgroundColor: COLORS.bg,
                  borderRadius: '12px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: '800', color: COLORS.ink }}>
                  {stats.total_samples}
                </div>
                <div style={{ fontSize: '11px', color: COLORS.muted, fontWeight: '700', marginTop: '2px' }}>
                  إجمالي العينات
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  backgroundColor: COLORS.bg,
                  borderRadius: '12px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: '800', color: COLORS.amber }}>
                  {stats.open_followups}
                </div>
                <div style={{ fontSize: '11px', color: COLORS.muted, fontWeight: '700', marginTop: '2px' }}>
                  متابعات مفتوحة
                </div>
              </div>
            </div>

            {/* Completion by Center */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: COLORS.primary, marginBottom: '8px' }}>
                الإنجاز حسب المركز
              </div>
              {stats.by_center.map((c) => {
                const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0;
                return (
                  <div
                    key={c.center}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: '700', minWidth: '70px', color: COLORS.ink }}>
                      {c.center}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: '8px',
                        backgroundColor: COLORS.border,
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          backgroundColor: COLORS.green,
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: COLORS.muted, minWidth: '45px', textAlign: 'left' }}>
                      {c.completed}/{c.total}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Violation Breakdown */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: COLORS.primary, marginBottom: '8px' }}>
                المخالفات المسجلة
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(Object.keys(LEVEL_LABELS) as ViolationLevel[]).map((lvl) => (
                  <div
                    key={lvl}
                    style={{
                      flex: 1,
                      backgroundColor: LEVEL_COLORS[lvl].bg,
                      borderRadius: '10px',
                      padding: '8px 4px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '18px', fontWeight: '800', color: LEVEL_COLORS[lvl].fg }}>
                      {stats.violation_levels[lvl] || 0}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: LEVEL_COLORS[lvl].fg }}>
                      {LEVEL_LABELS[lvl]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inspector Performance */}
            {stats.by_worker.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: COLORS.primary, marginBottom: '6px' }}>
                  أداء المعاينين
                </div>
                {stats.by_worker.map((w) => (
                  <div
                    key={w.worker_name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom: `1px dashed ${COLORS.border}`,
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ fontWeight: '700', color: COLORS.ink }}>{w.worker_name}</span>
                    <span style={{ color: COLORS.muted }}>
                      {w.visits} زيارة • {w.samples} عينة
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExport}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: COLORS.primary,
                color: '#FFFFFF',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              <FileSpreadsheetIcon size={18} color="#FFFFFF" />
              <span>تصدير تقرير الشهر (Excel)</span>
            </button>
          </>
        )}
      </div>

      {/* Duplicate / Conflict Inspections */}
      {conflicts.length > 0 && (
        <div
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: '16px',
            padding: '16px',
            border: `2px solid ${COLORS.amber}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangleIcon size={18} color={COLORS.amber} />
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: COLORS.amber }}>
              معاينات مكررة تحتاج مراجعة ({conflicts.length})
            </h3>
          </div>
          <div style={{ fontSize: '12px', color: COLORS.muted }}>
            موظفان عاينا نفس المكان أثناء العمل أوفلاين. بيانات الثاني محفوظة ولم تُفقد.
          </div>

          {conflicts.map((c) => (
            <div
              key={c.id}
              style={{
                backgroundColor: COLORS.bg,
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1px solid ${COLORS.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ fontWeight: '800', fontSize: '13px', color: COLORS.ink }}>
                {c.facility_name} ({c.center})
              </div>
              <div style={{ fontSize: '11px', color: COLORS.muted }}>
                الرسمية: <strong>{c.completed_by_name}</strong> • المكررة: <strong>{c.worker_name}</strong> (
                {c.samples?.length || 0} عينة)
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => handleResolveConflict(c, 'discard')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '8px',
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.muted,
                    fontSize: '11px',
                    fontWeight: '700',
                  }}
                >
                  تجاهل المكررة
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveConflict(c, 'replace')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '8px',
                    backgroundColor: COLORS.primary,
                    color: '#FFF',
                    fontSize: '11px',
                    fontWeight: '700',
                  }}
                >
                  اعتمادها بدل الأولى
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Monthly Plan Excel or PDF */}
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: '16px',
          padding: '16px',
          border: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: COLORS.ink }}>
          رفع خطة شهرية جديدة (Excel أو PDF)
        </h3>
        <form onSubmit={handleUploadExcel} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            placeholder="اسم الشهر (مثال: نوفمبر 2026)"
            value={monthLabel}
            onChange={(e) => setMonthLabel(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.bg,
            }}
          />

          <input
            type="file"
            accept=".xlsx, .xls, .pdf"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            style={{
              padding: '8px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.bg,
              fontSize: '12px',
            }}
          />

          <button
            type="submit"
            disabled={uploading}
            style={{
              padding: '12px',
              backgroundColor: COLORS.primary,
              color: '#FFFFFF',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '800',
              opacity: uploading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <UploadCloudIcon size={18} color="#FFFFFF" />
            <span>{uploading ? 'جارٍ رفع وتحليل الخطة...' : 'رفع ملف الخطة (Excel أو PDF)'}</span>
          </button>
        </form>
      </div>

      {/* Worker Codes Management */}
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: '16px',
          padding: '16px',
          border: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: COLORS.ink }}>
          إدارة أكواد الموظفين
        </h3>

        <form onSubmit={handleAddWorker} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            placeholder="اسم الموظف"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.bg,
            }}
          />
          <input
            type="text"
            placeholder="كود الدخول (مثال: W104)"
            value={workerCode}
            onChange={(e) => setWorkerCode(e.target.value.toUpperCase())}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.bg,
              textTransform: 'uppercase',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px',
              backgroundColor: COLORS.green,
              color: '#FFFFFF',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <UserPlusIcon size={16} color="#FFFFFF" />
            <span>إنشاء كود موظف</span>
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          {workers.map((w) => (
            <div
              key={w.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                backgroundColor: COLORS.bg,
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <button
                type="button"
                onClick={() => handleToggleWorker(w)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: w.active ? COLORS.redSoft : COLORS.greenSoft,
                  color: w.active ? COLORS.red : COLORS.green,
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                {w.active ? 'إيقاف' : 'تفعيل'}
              </button>

              <div style={{ flex: 1, marginRight: '10px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: w.active ? COLORS.ink : COLORS.muted,
                    textDecoration: w.active ? 'none' : 'line-through',
                  }}
                >
                  {w.name}
                </span>
              </div>

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  color: COLORS.primary,
                  backgroundColor: COLORS.surface,
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                {w.code}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Locked & Reserved Facilities */}
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: '16px',
          padding: '16px',
          border: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: COLORS.ink }}>
          الأماكن المحجوزة والمقفولة ({lockedFacilities.length})
        </h3>

        {lockedFacilities.length === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: '13px', textAlign: 'center', padding: '10px' }}>
            لا توجد أماكن مقفولة في الشهر المحدد.
          </div>
        ) : (
          lockedFacilities.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                backgroundColor: COLORS.bg,
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <button
                type="button"
                onClick={() => handleUnlock(f.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: COLORS.amberSoft,
                  color: COLORS.amber,
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <UnlockIcon size={13} color={COLORS.amber} />
                <span>إعادة فتح</span>
              </button>

              <div style={{ flex: 1, marginRight: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: COLORS.ink }}>{f.name}</div>
                <div style={{ fontSize: '11px', color: COLORS.muted }}>
                  {f.status === 'completed'
                    ? `تمت بواسطة ${f.completed_by_name || 'موظف'}`
                    : `محجوزة بواسطة ${f.reserved_by_name || 'موظف'}`}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
