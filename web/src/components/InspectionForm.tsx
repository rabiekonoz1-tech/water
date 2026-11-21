import React, { useEffect, useState } from 'react';
import { COLORS } from '../theme';
import type { Facility, SampleItem, User } from '../types';
import {
  COMPLIANCE_ITEMS,
  type ComplianceAnswer,
  LEVEL_COLORS,
  LEVEL_LABELS,
  OUTCOME_LABELS,
  SAMPLE_TYPE_PRESETS,
  type ViolationLevel,
  type VisitOutcome,
  suggestViolationLevel,
} from '../constants';
import { Chip } from './Chip';
import { SignaturePad } from './SignaturePad';
import { api } from '../api';
import { CheckCircleIcon, CrosshairIcon, PenToolIcon } from './Icons';

interface Props {
  user: User;
  facility: Facility;
  onDone: (updated: Facility) => void;
  onCancel: () => void;
}

const draftKey = (facilityId: string) => `inspection_draft_${facilityId}`;

export const InspectionForm: React.FC<Props> = ({ user, facility, onDone, onCancel }) => {
  const newSample = (n: number): SampleItem => ({
    id: String(Date.now() + Math.random()),
    code: `${facility.facility_code}-S${n}`,
    name: '',
    type: '',
    count: 1,
    ph: null,
    temperature: null,
  });

  const [outcome, setOutcome] = useState<VisitOutcome>('inspected');
  const [samples, setSamples] = useState<SampleItem[]>([newSample(1)]);
  const [compliance, setCompliance] = useState<Record<string, ComplianceAnswer>>({});
  const [level, setLevel] = useState<ViolationLevel>('none');
  const [levelTouched, setLevelTouched] = useState(false);
  const [repName, setRepName] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [followup, setFollowup] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [signature, setSignature] = useState('');
  const [showSigPad, setShowSigPad] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Load draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(facility.id));
      if (raw) {
        const d = JSON.parse(raw);
        if (d.outcome) setOutcome(d.outcome);
        if (d.samples?.length) setSamples(d.samples);
        if (d.compliance) setCompliance(d.compliance);
        if (d.level) setLevel(d.level);
        if (d.levelTouched) setLevelTouched(d.levelTouched);
        if (d.repName) setRepName(d.repName);
        if (d.repPhone) setRepPhone(d.repPhone);
        if (d.followup !== undefined) setFollowup(d.followup);
        if (d.followupDate) setFollowupDate(d.followupDate);
        if (d.notes) setNotes(d.notes);
        if (d.gps) setGps(d.gps);
        if (d.signature) setSignature(d.signature);
      }
    } catch {
      // ignore
    } finally {
      setDraftLoaded(true);
    }

    captureGps(true);
  }, [facility.id]);

  // Save draft debounce
  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey(facility.id),
          JSON.stringify({
            outcome,
            samples,
            compliance,
            level,
            levelTouched,
            repName,
            repPhone,
            followup,
            followupDate,
            notes,
            gps,
            signature,
          })
        );
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [draftLoaded, facility.id, outcome, samples, compliance, level, levelTouched, repName, repPhone, followup, followupDate, notes, gps, signature]);

  // Suggest violation level automatically
  useEffect(() => {
    if (!levelTouched) {
      setLevel(suggestViolationLevel(compliance));
    }
  }, [compliance, levelTouched]);

  const addSampleRow = () => {
    setSamples((prev) => [...prev, newSample(prev.length + 1)]);
  };

  const updateSample = (id: string, patch: Partial<SampleItem>) => {
    setSamples((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSample = (id: string) => {
    if (samples.length === 1) return;
    setSamples((prev) => prev.filter((s) => s.id !== id));
  };

  const captureGps = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) alert('متصفحك لا يدعم تحديد الموقع GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 0),
        });
      },
      () => {
        if (!silent) alert('تعذر التقاط الموقع. تأكد من تفعيل صلاحية الموقع (GPS) للمتصفح.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const isInspected = outcome === 'inspected';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSamples = isInspected
      ? samples.filter((s) => s.name.trim() && s.type.trim() && Number(s.count) > 0)
      : [];

    if (isInspected && validSamples.length === 0) {
      alert('أضف عينة واحدة على الأقل (الاسم + النوع + العدد)');
      return;
    }
    if (isInspected && validSamples.some((s) => s.ph != null && (s.ph < 0 || s.ph > 14))) {
      alert('قيمة pH يجب أن تكون بين 0 و 14');
      return;
    }
    if (!isInspected && !notes.trim()) {
      alert('اكتب سبب عدم إتمام المعاينة في الملاحظات');
      return;
    }
    if (isInspected && !signature) {
      alert('يرجى تسجيل التوقيع قبل إنهاء المعاينة');
      return;
    }
    if (followup && followupDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(followupDate.trim())) {
      alert('اكتب تاريخ المتابعة بصيغة YYYY-MM-DD (مثال: 2026-12-15)');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        visit_outcome: outcome,
        samples: validSamples,
        compliance: isInspected ? compliance : {},
        violation_level: isInspected ? level : 'none',
        representative_name: repName.trim(),
        representative_phone: repPhone.trim(),
        followup_required: followup,
        followup_date: followup ? followupDate.trim() : '',
        notes: notes.trim(),
        gps_lat: gps?.lat ?? null,
        gps_lng: gps?.lng ?? null,
        gps_accuracy: gps?.accuracy ?? null,
        signature_base64: signature,
      };

      const res = await api.completeFacility(user.code, facility.id, payload);
      try {
        localStorage.removeItem(draftKey(facility.id));
      } catch {
        // ignore
      }
      onDone(res.facility);
    } catch (err: any) {
      alert('تعذر الحفظ: ' + (err.message || 'حدث خطأ في الاتصال'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: COLORS.surface,
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            fontSize: '14px',
            color: COLORS.muted,
            fontWeight: '700',
            padding: '6px 12px',
          }}
        >
          رجوع
        </button>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: COLORS.ink }}>
          نموذج المعاينة الميدانية
        </h2>
        <div style={{ width: '40px' }} />
      </div>

      {/* Scrollable Form Body */}
      <form
        onSubmit={handleSubmit}
        className="scroll-container"
        style={{
          flex: 1,
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingBottom: '40px',
        }}
      >
        {/* Facility Card */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            padding: '14px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: COLORS.ink }}>{facility.name}</h3>
          <div style={{ fontSize: '13px', color: COLORS.muted, marginTop: '2px' }}>
            {facility.center} • {facility.address}
          </div>
          <div style={{ fontSize: '12px', color: COLORS.primary, fontWeight: '700', marginTop: '4px' }}>
            كود المنشأة: {facility.facility_code}
            {facility.activity_type ? ` • ${facility.activity_type}` : ''}
          </div>
        </div>

        {/* Visit Outcome */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            padding: '14px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS.ink, marginBottom: '8px' }}>
            نتيجة الزيارة
          </div>
          <div className="scroll-horizontal" style={{ gap: '6px', paddingBottom: '4px' }}>
            {(Object.keys(OUTCOME_LABELS) as VisitOutcome[]).map((o) => (
              <Chip
                key={o}
                label={OUTCOME_LABELS[o]}
                active={outcome === o}
                onClick={() => setOutcome(o)}
              />
            ))}
          </div>
          {!isInspected && (
            <div style={{ fontSize: '12px', color: COLORS.muted, marginTop: '8px' }}>
              اكتب سبب عدم إتمام المعاينة في الملاحظات بالأسفل. سيتم قفل المكان كزيارة غير مكتملة ويمكن للأدمن إعادة فتحه.
            </div>
          )}
        </div>

        {/* Samples Section */}
        {isInspected && (
          <div
            style={{
              backgroundColor: COLORS.surface,
              padding: '14px',
              borderRadius: '14px',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS.ink }}>
                العينات المسحوبة
              </div>
              <button
                type="button"
                onClick={addSampleRow}
                style={{
                  backgroundColor: COLORS.primary,
                  color: '#FFFFFF',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                }}
              >
                + إضافة عينة
              </button>
            </div>

            {samples.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  backgroundColor: COLORS.bg,
                  padding: '12px',
                  borderRadius: '12px',
                  border: `1px solid ${COLORS.border}`,
                  marginBottom: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: '800', color: COLORS.primary }}>
                    عينة #{idx + 1} • {s.code}
                  </span>
                  {samples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSample(s.id)}
                      style={{ color: COLORS.red, fontSize: '12px', fontWeight: '700' }}
                    >
                      حذف
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="اسم العينة (مثال: صرف مطبخ رئيسي)"
                  value={s.name}
                  onChange={(e) => updateSample(s.id, { name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${COLORS.border}`,
                    marginBottom: '8px',
                    backgroundColor: '#FFF',
                  }}
                />

                <div className="scroll-horizontal" style={{ gap: '6px', marginBottom: '8px', paddingBottom: '2px' }}>
                  {SAMPLE_TYPE_PRESETS.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      active={s.type === t}
                      onClick={() => updateSample(s.id, { type: t })}
                    />
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="نوع العينة (اختر من الأعلى أو اكتب يدوياً)"
                  value={s.type}
                  onChange={(e) => updateSample(s.id, { type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${COLORS.border}`,
                    marginBottom: '8px',
                    backgroundColor: '#FFF',
                  }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    placeholder="العدد"
                    value={s.count || ''}
                    onChange={(e) => updateSample(s.id, { count: parseInt(e.target.value, 10) || 0 })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: `1px solid ${COLORS.border}`,
                      backgroundColor: '#FFF',
                      textAlign: 'center',
                    }}
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    placeholder="pH"
                    value={s.ph == null ? '' : s.ph}
                    onChange={(e) =>
                      updateSample(s.id, { ph: e.target.value ? parseFloat(e.target.value) : null })
                    }
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: `1px solid ${COLORS.border}`,
                      backgroundColor: '#FFF',
                      textAlign: 'center',
                    }}
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="الحرارة °م"
                    value={s.temperature == null ? '' : s.temperature}
                    onChange={(e) =>
                      updateSample(s.id, { temperature: e.target.value ? parseFloat(e.target.value) : null })
                    }
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: `1px solid ${COLORS.border}`,
                      backgroundColor: '#FFF',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Compliance Section */}
        {isInspected && (
          <div
            style={{
              backgroundColor: COLORS.surface,
              padding: '14px',
              borderRadius: '14px',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS.ink, marginBottom: '8px' }}>
              قائمة الاشتراطات
            </div>
            {COMPLIANCE_ITEMS.map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderTop: `1px solid ${COLORS.border}`,
                  gap: '8px',
                }}
              >
                <div style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: COLORS.ink }}>
                  {item.label}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {([
                    ['yes', 'نعم'],
                    ['no', 'لا'],
                    ['na', 'لا ينطبق'],
                  ] as [ComplianceAnswer, string][]).map(([ans, label]) => {
                    const active = compliance[item.key] === ans;
                    const isBad = ans === item.badAnswer;
                    const bg = active ? (isBad ? COLORS.red : ans === 'na' ? COLORS.muted : COLORS.green) : '#FFF';
                    const color = active ? '#FFF' : COLORS.muted;
                    return (
                      <button
                        key={ans}
                        type="button"
                        onClick={() => setCompliance((prev) => ({ ...prev, [item.key]: ans }))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${active ? 'transparent' : COLORS.border}`,
                          backgroundColor: bg,
                          color: color,
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Violation Level */}
        {isInspected && (
          <div
            style={{
              backgroundColor: COLORS.surface,
              padding: '14px',
              borderRadius: '14px',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS.ink, marginBottom: '8px' }}>
              مستوى المخالفة {levelTouched ? '' : '(مقترح تلقائياً)'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(Object.keys(LEVEL_LABELS) as ViolationLevel[]).map((l) => (
                <Chip
                  key={l}
                  label={LEVEL_LABELS[l]}
                  active={level === l}
                  tone={LEVEL_COLORS[l]}
                  onClick={() => {
                    setLevel(l);
                    setLevelTouched(true);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Facility Representative */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            padding: '14px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS.ink, marginBottom: '8px' }}>
            ممثل المنشأة (الحاضر وقت المعاينة)
          </div>
          <input
            type="text"
            placeholder="الاسم"
            value={repName}
            onChange={(e) => setRepName(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${COLORS.border}`,
              marginBottom: '8px',
            }}
          />
          <input
            type="tel"
            placeholder="رقم الهاتف"
            value={repPhone}
            onChange={(e) => setRepPhone(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${COLORS.border}`,
            }}
          />
        </div>

        {/* Notes */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            padding: '14px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS.ink, marginBottom: '8px' }}>
            ملاحظات {isInspected ? 'المعاينة' : '(سبب عدم إتمام الزيارة — مطلوب)'}
          </div>
          <textarea
            rows={3}
            placeholder="اكتب أي ملاحظات ميدانية..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${COLORS.border}`,
              resize: 'vertical',
            }}
          />
        </div>

        {/* Followup Toggle */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            padding: '14px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '700', color: COLORS.ink }}>
              تحتاج المنشأة لمتابعة / زيارة لاحقة
            </span>
            <input
              type="checkbox"
              checked={followup}
              onChange={(e) => setFollowup(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </label>
          {followup && (
            <input
              type="date"
              placeholder="تاريخ المتابعة"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                marginTop: '10px',
              }}
            />
          )}
        </div>

        {/* GPS Location Capture */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            padding: '14px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS.ink, marginBottom: '8px' }}>
            الموقع الجغرافي (GPS)
          </div>
          <button
            type="button"
            onClick={() => captureGps(false)}
            style={{
              width: '100%',
              padding: '12px',
              border: `1.5px solid ${COLORS.primary}`,
              borderRadius: '10px',
              color: COLORS.primary,
              fontWeight: '700',
              fontSize: '13px',
              backgroundColor: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <CrosshairIcon size={16} color={COLORS.primary} />
            <span>
              {gps
                ? `تم الالتقاط: ${gps.lat}, ${gps.lng} (دقة ±${gps.accuracy ?? '?'}م) — اضغط للتحديث`
                : 'التقاط الموقع الحالي GPS'}
            </span>
          </button>
        </div>

        {/* Signature Pad Trigger */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            padding: '14px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS.ink, marginBottom: '8px' }}>
            التوقيع {isInspected ? '' : '(اختياري)'}
          </div>
          <button
            type="button"
            onClick={() => setShowSigPad(true)}
            style={{
              width: '100%',
              padding: '12px',
              border: `1.5px solid ${signature ? COLORS.green : COLORS.primary}`,
              borderRadius: '10px',
              color: signature ? COLORS.green : COLORS.primary,
              fontWeight: '700',
              fontSize: '13px',
              backgroundColor: signature ? COLORS.greenSoft : '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <PenToolIcon size={16} color={signature ? COLORS.green : COLORS.primary} />
            <span>{signature ? 'تم حفظ التوقيع (اضغط للتعديل)' : 'إضافة التوقيع الإلكتروني'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: COLORS.green,
              color: '#FFFFFF',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: '800',
              opacity: submitting ? 0.6 : 1,
              boxShadow: '0 3px 8px rgba(79,163,54,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <CheckCircleIcon size={20} color="#FFFFFF" />
            <span>{submitting ? 'جارٍ الحفظ...' : 'تأكيد "تم" وقفل المكان'}</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '12px',
              color: COLORS.muted,
              fontSize: '14px',
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            رجوع (المسودة تُحفظ تلقائياً)
          </button>
        </div>
      </form>

      {/* Signature Modal */}
      {showSigPad && (
        <SignaturePad
          initialSignature={signature}
          onSave={(img) => {
            setSignature(img);
            setShowSigPad(false);
          }}
          onClose={() => setShowSigPad(false)}
        />
      )}
    </div>
  );
};
