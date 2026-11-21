import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { COLORS } from '../theme/colors';
import { Facility, SampleItem, User } from '../types';
import { completeInspectionOfflineFirst } from '../services/syncEngine';
import {
  COMPLIANCE_ITEMS,
  ComplianceAnswer,
  LEVEL_COLORS,
  LEVEL_LABELS,
  OUTCOME_LABELS,
  SAMPLE_TYPE_PRESETS,
  ViolationLevel,
  VisitOutcome,
  suggestViolationLevel,
} from '../constants/domain';

interface Props {
  user: User;
  facility: Facility;
  onDone: (updated: Facility, queued: boolean) => void;
  onCancel: () => void;
}

function Chip({ label, active, onPress, tone }: { label: string; active: boolean; onPress: () => void; tone?: { bg: string; fg: string } }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: tone?.fg ?? COLORS.primary, borderColor: tone?.fg ?? COLORS.primary }]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const draftKey = (facilityId: string) => `inspection_draft_${facilityId}`;

export default function InspectionFormScreen({ user, facility, onDone, onCancel }: Props) {
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
  const sigRef = useRef<SignatureViewRef>(null);

  // ---- Draft autosave: a half-filled form must survive the app being closed in the field ----
  useEffect(() => {
    AsyncStorage.getItem(draftKey(facility.id))
      .then((raw) => {
        if (!raw) return;
        const d = JSON.parse(raw);
        setOutcome(d.outcome ?? 'inspected');
        setSamples(d.samples?.length ? d.samples : [newSample(1)]);
        setCompliance(d.compliance ?? {});
        setLevel(d.level ?? 'none');
        setLevelTouched(!!d.levelTouched);
        setRepName(d.repName ?? '');
        setRepPhone(d.repPhone ?? '');
        setFollowup(!!d.followup);
        setFollowupDate(d.followupDate ?? '');
        setNotes(d.notes ?? '');
        setGps(d.gps ?? null);
        setSignature(d.signature ?? '');
      })
      .catch(() => undefined)
      .finally(() => setDraftLoaded(true));
    // Silently try GPS once so the inspector doesn't have to remember to press the button
    captureGps(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(
        draftKey(facility.id),
        JSON.stringify({ outcome, samples, compliance, level, levelTouched, repName, repPhone, followup, followupDate, notes, gps, signature })
      ).catch(() => undefined);
    }, 600);
    return () => clearTimeout(t);
  }, [draftLoaded, outcome, samples, compliance, level, levelTouched, repName, repPhone, followup, followupDate, notes, gps, signature]);

  // Suggest a violation level from the checklist until the inspector sets one manually
  useEffect(() => {
    if (!levelTouched) setLevel(suggestViolationLevel(compliance));
  }, [compliance, levelTouched]);

  const addSampleRow = () => setSamples((prev) => [...prev, newSample(prev.length + 1)]);
  const updateSample = (id: string, patch: Partial<SampleItem>) =>
    setSamples((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSample = (id: string) => {
    if (samples.length === 1) return;
    setSamples((prev) => prev.filter((s) => s.id !== id));
  };
  const parseDecimal = (v: string): number | null => {
    if (!v.trim()) return null;
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const captureGps = async (silent = false) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) Alert.alert('تنبيه', 'يرجى السماح بصلاحية الموقع GPS');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGps({
        lat: Number(loc.coords.latitude.toFixed(6)),
        lng: Number(loc.coords.longitude.toFixed(6)),
        accuracy: Math.round(loc.coords.accuracy || 0),
      });
    } catch {
      if (!silent) Alert.alert('تنبيه', 'تعذر التقاط الموقع، حاول مرة أخرى في مكان مفتوح');
    }
  };

  const isInspected = outcome === 'inspected';

  const handleSubmit = async () => {
    const validSamples = isInspected ? samples.filter((s) => s.name.trim() && s.type.trim() && Number(s.count) > 0) : [];
    if (isInspected && validSamples.length === 0) {
      Alert.alert('تنبيه', 'أضف عينة واحدة على الأقل (الاسم + النوع + العدد)');
      return;
    }
    if (isInspected && validSamples.some((s) => s.ph != null && (s.ph < 0 || s.ph > 14))) {
      Alert.alert('تنبيه', 'قيمة pH يجب أن تكون بين 0 و 14');
      return;
    }
    if (!isInspected && !notes.trim()) {
      Alert.alert('تنبيه', 'اكتب سبب عدم إتمام المعاينة في الملاحظات');
      return;
    }
    if (isInspected && !signature) {
      Alert.alert('تنبيه', 'يرجى تسجيل التوقيع قبل إنهاء المعاينة');
      return;
    }
    if (followup && followupDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(followupDate.trim())) {
      Alert.alert('تنبيه', 'اكتب تاريخ المتابعة بصيغة 2026-12-15');
      return;
    }
    setSubmitting(true);
    try {
      const { facility: updated, queued } = await completeInspectionOfflineFirst(user, facility, {
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
      });
      await AsyncStorage.removeItem(draftKey(facility.id));
      onDone(updated, queued);
    } catch (e: unknown) {
      // Server reachable but refused (e.g. a colleague already closed this place). Data stays in the form + draft.
      Alert.alert('تعذر الحفظ', e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  if (showSigPad) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <Text style={styles.sigTitle}>وقّع داخل الإطار</Text>
        <SignatureScreen
          ref={sigRef}
          onOK={(img) => {
            setSignature(img);
            setShowSigPad(false);
          }}
          descriptionText="التوقيع"
          clearText="مسح"
          confirmText="حفظ التوقيع"
        />
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSigPad(false)}>
          <Text style={styles.cancelBtnText}>رجوع</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.headerCard}>
        <Text style={styles.facilityTitle}>{facility.name}</Text>
        <Text style={styles.facilitySub}>{facility.center} • {facility.address}</Text>
        <Text style={styles.codeBadge}>كود المنشأة: {facility.facility_code}{facility.activity_type ? ` • ${facility.activity_type}` : ''}</Text>
        {facility.history && (
          <View style={[styles.historyBox, { backgroundColor: LEVEL_COLORS[facility.history.worst].bg }]}>
            <Text style={{ color: LEVEL_COLORS[facility.history.worst].fg, fontWeight: '700', textAlign: 'right', fontSize: 12 }}>
              زيارات سابقة: {facility.history.visits} • أعلى مخالفة سابقة: {LEVEL_LABELS[facility.history.worst]}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>نتيجة الزيارة</Text>
        <View style={styles.chipWrap}>
          {(Object.keys(OUTCOME_LABELS) as VisitOutcome[]).map((o) => (
            <Chip key={o} label={OUTCOME_LABELS[o]} active={outcome === o} onPress={() => setOutcome(o)} />
          ))}
        </View>
        {!isInspected && <Text style={styles.hint}>اكتب السبب في الملاحظات بالأسفل. سيتم قفل المكان كزيارة غير مكتملة ويمكن للأدمن إعادة فتحه.</Text>}
      </View>

      {isInspected && (
        <>
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>العينات المسحوبة</Text>
              <TouchableOpacity style={styles.addBtn} onPress={addSampleRow}>
                <Text style={styles.addBtnText}>+ إضافة عينة</Text>
              </TouchableOpacity>
            </View>

            {samples.map((s, idx) => (
              <View key={s.id} style={styles.sampleCard}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sampleIdx}>عينة #{idx + 1} • {s.code}</Text>
                  {samples.length > 1 && (
                    <TouchableOpacity onPress={() => removeSample(s.id)}>
                      <Text style={{ color: COLORS.red, fontWeight: '600' }}>حذف</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput style={styles.input} placeholder="اسم العينة (مثال: صرف مطبخ رئيسي)" value={s.name} onChangeText={(v) => updateSample(s.id, { name: v })} />
                <View style={styles.chipWrap}>
                  {SAMPLE_TYPE_PRESETS.map((t) => (
                    <Chip key={t} label={t} active={s.type === t} onPress={() => updateSample(s.id, { type: t })} />
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="نوع العينة (اختر من الأعلى أو اكتب)" value={s.type} onChangeText={(v) => updateSample(s.id, { type: v })} />
                <View style={styles.triple}>
                  <TextInput
                    style={[styles.input, styles.tripleItem]}
                    placeholder="العدد"
                    keyboardType="numeric"
                    value={String(s.count)}
                    onChangeText={(v) => updateSample(s.id, { count: parseInt(v, 10) || 0 })}
                  />
                  <TextInput
                    style={[styles.input, styles.tripleItem]}
                    placeholder="pH"
                    keyboardType="decimal-pad"
                    value={s.ph == null ? '' : String(s.ph)}
                    onChangeText={(v) => updateSample(s.id, { ph: parseDecimal(v) })}
                  />
                  <TextInput
                    style={[styles.input, styles.tripleItem]}
                    placeholder="الحرارة °م"
                    keyboardType="decimal-pad"
                    value={s.temperature == null ? '' : String(s.temperature)}
                    onChangeText={(v) => updateSample(s.id, { temperature: parseDecimal(v) })}
                  />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>قائمة الاشتراطات</Text>
            {COMPLIANCE_ITEMS.map((item) => (
              <View key={item.key} style={styles.checkRow}>
                <View style={styles.answerRow}>
                  {([['yes', 'نعم'], ['no', 'لا'], ['na', 'لا ينطبق']] as [ComplianceAnswer, string][]).map(([a, label]) => {
                    const active = compliance[item.key] === a;
                    const bad = a === item.badAnswer;
                    return (
                      <TouchableOpacity
                        key={a}
                        onPress={() => setCompliance((prev) => ({ ...prev, [item.key]: a }))}
                        style={[
                          styles.answerBtn,
                          active && { backgroundColor: bad ? COLORS.red : a === 'na' ? COLORS.muted : COLORS.green, borderColor: 'transparent' },
                        ]}
                      >
                        <Text style={[styles.answerText, active && { color: '#fff' }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.checkLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مستوى المخالفة {levelTouched ? '' : '(مقترح تلقائياً)'}</Text>
            <View style={styles.chipWrap}>
              {(Object.keys(LEVEL_LABELS) as ViolationLevel[]).map((l) => (
                <Chip
                  key={l}
                  label={LEVEL_LABELS[l]}
                  active={level === l}
                  tone={LEVEL_COLORS[l]}
                  onPress={() => {
                    setLevel(l);
                    setLevelTouched(true);
                  }}
                />
              ))}
            </View>
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ممثل المنشأة (الحاضر وقت المعاينة)</Text>
        <TextInput style={styles.input} placeholder="الاسم" value={repName} onChangeText={setRepName} />
        <TextInput style={styles.input} placeholder="رقم الهاتف" keyboardType="phone-pad" value={repPhone} onChangeText={setRepPhone} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ملاحظات {isInspected ? 'المعاينة' : '(سبب عدم إتمام الزيارة — مطلوب)'}</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          multiline
          placeholder="اكتب أي ملاحظات ميدانية..."
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Switch value={followup} onValueChange={setFollowup} />
          <Text style={styles.sectionTitleInline}>تحتاج المنشأة لمتابعة / زيارة لاحقة</Text>
        </View>
        {followup && (
          <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="تاريخ المتابعة (اختياري) مثل 2026-12-15" value={followupDate} onChangeText={setFollowupDate} />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الموقع الجغرافي (GPS)</Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => captureGps(false)}>
          <Text style={styles.outlineBtnText}>
            {gps ? `تم الالتقاط: ${gps.lat}, ${gps.lng} (±${gps.accuracy ?? '?'}م) — اضغط للتحديث` : 'التقاط الموقع الحالي GPS'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التوقيع {isInspected ? '' : '(اختياري)'}</Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowSigPad(true)}>
          <Text style={styles.outlineBtnText}>{signature ? 'تم حفظ التوقيع (اضغط للتعديل)' : 'إضافة التوقيع'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitBtnText}>{submitting ? 'جارٍ الحفظ...' : 'تأكيد "تم" وقفل المكان'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>رجوع (المسودة تُحفظ تلقائياً)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  headerCard: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  facilityTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, textAlign: 'right' },
  facilitySub: { fontSize: 13, color: COLORS.muted, textAlign: 'right', marginTop: 4 },
  codeBadge: { fontSize: 12, color: COLORS.primary, fontWeight: '700', textAlign: 'right', marginTop: 6 },
  historyBox: { marginTop: 10, padding: 8, borderRadius: 10 },
  hint: { fontSize: 12, color: COLORS.muted, textAlign: 'right', marginTop: 8 },
  section: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  sectionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink, textAlign: 'right', marginBottom: 8 },
  sectionTitleInline: { fontSize: 14, fontWeight: '700', color: COLORS.ink, textAlign: 'right', flex: 1 },
  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sampleCard: { backgroundColor: COLORS.bg, padding: 10, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  sampleIdx: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, textAlign: 'right', marginBottom: 8 },
  triple: { flexDirection: 'row-reverse', gap: 8 },
  tripleItem: { flex: 1 },
  chipWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 12, color: COLORS.ink, fontWeight: '600' },
  checkRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  checkLabel: { flex: 1, fontSize: 13, color: COLORS.ink, textAlign: 'right', fontWeight: '600', marginLeft: 8 },
  answerRow: { flexDirection: 'row-reverse', gap: 4 },
  answerBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#fff' },
  answerText: { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  outlineBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  outlineBtnText: { color: COLORS.primary, fontWeight: '700', textAlign: 'center' },
  submitBtn: { backgroundColor: COLORS.green, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 6 },
  cancelBtnText: { color: COLORS.muted, fontWeight: '600' },
  sigTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', padding: 16, color: COLORS.ink },
});
