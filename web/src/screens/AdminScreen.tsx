import React, { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../theme';
import type { ConflictItem, Facility, PlanStats, User } from '../types';
import { LEVEL_COLORS, LEVEL_LABELS, type ViolationLevel } from '../constants';
import { api } from '../api';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  FileSpreadsheetIcon,
  RefreshCwIcon,
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

  // Upload Progress & Robust Error States
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing' | 'ocr' | 'saving' | 'done' | 'error'>('idle');
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadSeconds, setUploadSeconds] = useState(0);
  const [uploadError, setUploadError] = useState<{ title: string; message: string; tip?: string } | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{
    inserted: number;
    month: string;
    by_center: Record<string, number>;
    with_prior_major_violations?: number;
  } | null>(null);

  // Timer effect during active upload / processing
  useEffect(() => {
    let interval: any = null;
    if (uploading) {
      interval = setInterval(() => {
        setUploadSeconds((s) => s + 1);
      }, 1000);
    } else {
      setUploadSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [uploading]);

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

  const handleUploadPlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    // 1. Validation: Month Label
    if (!monthLabel.trim()) {
      setUploadError({
        title: 'اسم الشهر مطلوب',
        message: 'يرجى كتابة اسم الشهر أولاً قبل رفع الخطة.',
        tip: 'مثال: "نوفمبر 2026" أو "خطة ديسمبر 2026".',
      });
      return;
    }

    // 2. Validation: File Selection
    if (!selectedFile) {
      setUploadError({
        title: 'لم يتم اختيار ملف',
        message: 'يرجى اختيار ملف الخطة (Excel أو PDF) من جهازك.',
        tip: 'الملفات المدعومة هي .xlsx و .xls و .pdf.',
      });
      return;
    }

    // 3. Validation: File Size limit (35MB)
    const maxBytes = 35 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setUploadError({
        title: 'حجم الملف يتجاوز الحد الأقصى',
        message: `حجم الملف المحدد هو ${(selectedFile.size / (1024 * 1024)).toFixed(1)} ميجابايت، بينما الحد الأقصى المسموح به هو 35 ميجابايت.`,
        tip: 'إذا كان الملف مصوراً بـ CamScanner، يمكنك تقليل دقة المسح الضوئي أو ضغط الـ PDF.',
      });
      return;
    }

    // 4. Validation: File Extension
    const lowerName = selectedFile.name.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf');
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
    if (!isPdf && !isExcel) {
      setUploadError({
        title: 'نوع الملف غير مدعوم',
        message: `الملف "${selectedFile.name}" ليس ملف Excel أو PDF صالح.`,
        tip: 'يرجى رفع ملف بصيغة .xlsx أو .xls أو .pdf.',
      });
      return;
    }

    setUploading(true);
    setUploadPercent(0);
    setUploadStage('uploading');
    setUploadStatusText('جارٍ نقل الملف إلى السيرفر...');

    try {
      const res = await api.uploadPlanExcel(
        user.code,
        monthLabel.trim(),
        selectedFile,
        (pct) => {
          setUploadPercent(pct);
          if (pct >= 100) {
            setUploadStage(isPdf ? 'ocr' : 'processing');
            setUploadStatusText(
              isPdf
                ? 'تم الرفع بنجاح! جارٍ فحص صفحات الـ PDF وتشغيل المسح الضوئي (OCR)...'
                : 'تم الرفع بنجاح! جارٍ قراءة أعمدة ومطابقة بيانات المنشآت...'
            );
          }
        }
      );

      setUploadStage('done');
      setUploadPercent(100);
      setUploadStatusText('تمت إضافة الخطة بنجاح!');
      setUploadSuccess({
        inserted: res.inserted,
        month: monthLabel.trim(),
        by_center: res.by_center || {},
        with_prior_major_violations: res.with_prior_major_violations || 0,
      });

      setMonthLabel('');
      setSelectedFile(null);
      onRefresh();
    } catch (err: any) {
      setUploadStage('error');
      const msg = err.message || '';
      let title = 'فشل معالجة الملف';
      let tip = 'تأكد من وضوح الملف أو ارفع ملف الإكسيل الأصلي.';

      if (err.status === 409 || msg.includes('توجد خطة بنفس الاسم')) {
        title = 'الخطة مسجلة مسبقاً';
        tip = `قم بتغيير اسم الشهر (مثال: "${monthLabel.trim()} - محدث") لتجنب التكرار.`;
      } else if (err.status === 400 || msg.includes('لم يتم العثور')) {
        title = 'تعذر التعرّف على أعمدة المنشآت';
        tip = 'تأكد أن الجدول يحتوي على: (التسلسل، مسمى المنشأة الصناعية، العنوان، كود المنشأة، تاريخ الانجاز).';
      } else if (err.status === 408 || msg.includes('مهلة')) {
        title = 'انتهت مهلة المسح الضوئي';
        tip = 'الملف كبير جداً أو يحتوي على عدد كبير من الصور، حاول تقسيم الصفحات أو رفع ملف الإكسيل.';
      } else if (err.status === 0 || msg.includes('فشل الاتصال')) {
        title = 'انقطع الاتصال بالسيرفر';
        tip = 'تأكد أن السيرفر يعمل على منفذ 4000 ومتصل بالشبكة.';
      }

      setUploadError({
        title,
        message: msg || 'حدث خطأ غير متوقع أثناء معالجة الملف.',
        tip,
      });
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

      {/* Upload Monthly Plan Excel or PDF with Progress & Error Handling */}
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: '16px',
          padding: '16px',
          border: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: COLORS.ink }}>
            رفع خطة شهرية جديدة (Excel أو PDF)
          </h3>
          <span style={{ fontSize: '11px', color: COLORS.muted, fontWeight: '600' }}>
            الحد الأقصى: 35 ميجابايت
          </span>
        </div>

        {/* Active Progress & Multi-Stage Indicator */}
        {uploading && (
          <div
            style={{
              backgroundColor: '#F0F9FF',
              border: `1.5px solid ${COLORS.primary}`,
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    animation: 'spin 1s linear infinite',
                  }}
                >
                  <RefreshCwIcon size={18} color={COLORS.primary} />
                </span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: COLORS.primary }}>
                  {uploadStatusText}
                </span>
              </div>

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  color: COLORS.primary,
                  backgroundColor: '#E0F2FE',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  direction: 'ltr',
                }}
              >
                {String(Math.floor(uploadSeconds / 60)).padStart(2, '0')}:
                {String(uploadSeconds % 60).padStart(2, '0')}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div
              style={{
                height: '10px',
                backgroundColor: '#E0F2FE',
                borderRadius: '5px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: uploadStage === 'uploading' ? `${Math.max(5, uploadPercent)}%` : '100%',
                  backgroundColor: COLORS.primary,
                  borderRadius: '5px',
                  transition: 'width 0.4s ease',
                  opacity: uploadStage !== 'uploading' ? 0.85 : 1,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: COLORS.muted,
                fontWeight: '600',
              }}
            >
              <span>
                {uploadStage === 'uploading'
                  ? `مرحلة 1 من 2: نقل الملف للسيرفر (${uploadPercent}%)`
                  : 'مرحلة 2 من 2: معالجة OCR واستخراج المنشآت...'}
              </span>
              <span>
                {uploadStage === 'uploading' ? 'يرجى الانتظار...' : 'قد يستغرق 10-30 ثانية للصفحات المصورة'}
              </span>
            </div>
          </div>
        )}

        {/* Robust Error Card */}
        {uploadError && (
          <div
            style={{
              backgroundColor: COLORS.redSoft,
              border: `1.5px solid ${COLORS.red}`,
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangleIcon size={20} color={COLORS.red} />
              <strong style={{ fontSize: '14px', color: COLORS.red }}>{uploadError.title}</strong>
            </div>

            <p style={{ fontSize: '13px', color: COLORS.ink, margin: 0, lineHeight: 1.4 }}>
              {uploadError.message}
            </p>

            {uploadError.tip && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: COLORS.amber,
                  fontWeight: '700',
                  border: `1px solid #FDE68A`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>💡</span>
                <span>{uploadError.tip}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => handleUploadPlan()}
                style={{
                  padding: '7px 14px',
                  backgroundColor: COLORS.red,
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                }}
              >
                إعادة المحاولة
              </button>

              <button
                type="button"
                onClick={() => setUploadError(null)}
                style={{
                  padding: '7px 14px',
                  backgroundColor: 'transparent',
                  color: COLORS.muted,
                  fontSize: '12px',
                  fontWeight: '700',
                }}
              >
                إغلاق التنبيه
              </button>
            </div>
          </div>
        )}

        {/* Success Card */}
        {uploadSuccess && (
          <div
            style={{
              backgroundColor: COLORS.greenSoft,
              border: `1.5px solid ${COLORS.green}`,
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircleIcon size={20} color={COLORS.green} />
              <strong style={{ fontSize: '15px', color: COLORS.green }}>
                تم استيراد خطة "{uploadSuccess.month}" بنجاح!
              </strong>
            </div>

            <div style={{ fontSize: '13px', color: COLORS.ink }}>
              تم استخراج وحفظ <strong>{uploadSuccess.inserted} منشأة</strong> بنجاح وتوزيعها على المراكز:
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(uploadSuccess.by_center).map(([center, count]) => (
                <span
                  key={center}
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '3px 9px',
                    borderRadius: '8px',
                    border: `1px solid ${COLORS.border}`,
                    fontSize: '11px',
                    fontWeight: '700',
                    color: COLORS.primary,
                  }}
                >
                  {center}: {count}
                </span>
              ))}
            </div>

            {uploadSuccess.with_prior_major_violations ? (
              <div
                style={{
                  fontSize: '12px',
                  color: COLORS.amber,
                  fontWeight: '700',
                  backgroundColor: '#FFFBEB',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  marginTop: '2px',
                }}
              >
                ⚠️ تنبيه: {uploadSuccess.with_prior_major_violations} منشأة لها مخالفات جسيمة سابقة.
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setUploadSuccess(null)}
              style={{
                alignSelf: 'flex-start',
                padding: '6px 12px',
                backgroundColor: COLORS.green,
                color: '#FFF',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                marginTop: '4px',
              }}
            >
              تم ومتابعة الخطة
            </button>
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleUploadPlan} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink }}>
            اسم الخطة والشهر:
          </label>
          <input
            type="text"
            placeholder="مثال: نوفمبر 2026 أو خطة طوارئ ديسمبر"
            value={monthLabel}
            onChange={(e) => setMonthLabel(e.target.value)}
            disabled={uploading}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              backgroundColor: uploading ? '#F1F5F9' : COLORS.bg,
              opacity: uploading ? 0.7 : 1,
            }}
          />

          <label style={{ fontSize: '12px', fontWeight: '700', color: COLORS.ink, marginTop: '2px' }}>
            ملف الخطة (Excel أو PDF مصور / إلكتروني):
          </label>
          <input
            type="file"
            accept=".xlsx, .xls, .pdf"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            disabled={uploading}
            style={{
              padding: '8px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              backgroundColor: uploading ? '#F1F5F9' : COLORS.bg,
              fontSize: '12px',
              opacity: uploading ? 0.7 : 1,
            }}
          />

          {selectedFile && (
            <div style={{ fontSize: '11px', color: COLORS.muted }}>
              الملف المحدد: <strong>{selectedFile.name}</strong> (
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} ميجابايت)
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            style={{
              padding: '13px',
              backgroundColor: uploading ? COLORS.muted : COLORS.primary,
              color: '#FFFFFF',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '800',
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px',
              boxShadow: uploading ? 'none' : '0 2px 6px rgba(0, 107, 159, 0.25)',
            }}
          >
            <UploadCloudIcon size={18} color="#FFFFFF" />
            <span>{uploading ? 'جارٍ الرفع والمعالجة...' : 'بدء رفع ومعالجة الخطة'}</span>
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
