import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../services/api';
import { COLORS } from '../theme/colors';
import { ConflictItem, Facility, PlanStats, User } from '../types';
import { LEVEL_COLORS, LEVEL_LABELS, OUTCOME_LABELS, ViolationLevel } from '../constants/domain';

interface Props {
  user: User;
  facilities: Facility[];
  planId: string;
  onRefresh: () => void;
}

function Bar({ value, total, color = COLORS.primary }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function AdminScreen({ user, facilities, planId, onRefresh }: Props) {
  const [monthLabel, setMonthLabel] = useState('');
  const [workers, setWorkers] = useState<User[]>([]);
  const [workerName, setWorkerName] = useState('');
  const [workerCode, setWorkerCode] = useState('');
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);

  const loadWorkers = async () => {
    try {
      const res = await api.getWorkers(user.code);
      setWorkers(res.workers);
    } catch {
      // Offline mode: keep existing list
    }
  };

  const loadStats = useCallback(async () => {
    if (!planId) return;
    try {
      setStats(await api.getStats(user.code, planId));
      setStatsError('');
    } catch {
      setStatsError('تعذر تحميل الإحصائيات (تحتاج اتصالاً بالسيرفر).');
    }
  }, [planId, user.code]);

  const loadConflicts = async () => {
    try {
      setConflicts((await api.getConflicts(user.code)).conflicts);
    } catch {
      // ignore (offline)
    }
  };

  useEffect(() => {
    loadWorkers();
    loadConflicts();
  }, []);

  // Statistics follow the plan selected on the main screen and refresh whenever facilities change
  useEffect(() => {
    loadStats();
  }, [loadStats, facilities]);

  const handleUploadExcel = async () => {
    if (!monthLabel.trim()) {
      Alert.alert('تنبيه', 'اكتب اسم الشهر أولاً (مثال: ديسمبر 2026)');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const res = await api.uploadPlanExcel(user.code, monthLabel.trim(), file.uri, file.name);
      const centers = Object.entries(res.by_center || {}).map(([c, n]) => `${c}: ${n}`).join('\n');
      const prior = res.with_prior_major_violations
        ? `\n\n⚠️ ${res.with_prior_major_violations} منشأة لها مخالفة جسيمة/خطيرة في شهور سابقة.`
        : '';
      Alert.alert('تم الرفع', `تمت إضافة خطة "${monthLabel}" (${res.inserted} منشأة)\n\n${centers}${prior}`);
      setMonthLabel('');
      onRefresh();
    } catch (e: unknown) {
      Alert.alert('خطأ في الرفع', e instanceof Error ? e.message : 'تعذر رفع ملف Excel');
    }
  };

  const handleExport = async () => {
    if (!planId) return;
    try {
      await Linking.openURL(await api.exportUrl(user.code, planId));
    } catch {
      Alert.alert('خطأ', 'تعذر فتح رابط التقرير. تأكد من الاتصال بالسيرفر.');
    }
  };

  const handleAddWorker = async () => {
    if (!workerName.trim() || !workerCode.trim()) {
      Alert.alert('تنبيه', 'أدخل اسم الموظف والكود');
      return;
    }
    try {
      await api.createWorker(user.code, workerName.trim(), workerCode.trim());
      setWorkerName('');
      setWorkerCode('');
      loadWorkers();
    } catch (e: unknown) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر إضافة الموظف');
    }
  };

  const handleToggleWorker = (w: User) => {
    const willDisable = !!w.active;
    Alert.alert(willDisable ? 'إيقاف الكود' : 'تفعيل الكود', `${willDisable ? 'إيقاف' : 'تفعيل'} كود ${w.name} (${w.code})؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد',
        onPress: async () => {
          try {
            await api.toggleWorker(user.code, w.id);
            loadWorkers();
          } catch (e: unknown) {
            Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر التحديث');
          }
        },
      },
    ]);
  };

  const handleUnlock = async (facilityId: string) => {
    try {
      await api.unlockFacility(user.code, facilityId);
      onRefresh();
    } catch (e: unknown) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر فتح المنشأة');
    }
  };

  const handleResolve = (c: ConflictItem) => {
    Alert.alert('معاينة مكررة', `${c.facility_name}\nالمعاينة الرسمية: ${c.completed_by_name}\nالمكررة: ${c.worker_name}`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تجاهل المكررة',
        onPress: async () => {
          await api.resolveConflict(user.code, c.id, 'discard').catch(() => undefined);
          loadConflicts();
        },
      },
      {
        text: 'اعتمادها بدل الأولى',
        onPress: async () => {
          await api.resolveConflict(user.code, c.id, 'replace').catch(() => undefined);
          loadConflicts();
          onRefresh();
        },
      },
    ]);
  };

  const lockedFacilities = facilities.filter((f) => f.status !== 'available');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* ---------- Dashboard ---------- */}
      <View style={styles.card}>
        <Text style={styles.title}>لوحة المتابعة{stats ? ` — ${stats.plan.month_label}` : ''}</Text>
        {statsError ? <Text style={styles.empty}>{statsError}</Text> : null}
        {stats && (
          <>
            <View style={styles.kpiRow}>
              <View style={styles.kpi}><Text style={styles.kpiValue}>{stats.totals.completion_rate}%</Text><Text style={styles.kpiLabel}>الإنجاز</Text></View>
              <View style={styles.kpi}><Text style={styles.kpiValue}>{stats.total_samples}</Text><Text style={styles.kpiLabel}>إجمالي العينات</Text></View>
              <View style={styles.kpi}><Text style={[styles.kpiValue, { color: COLORS.amber }]}>{stats.open_followups}</Text><Text style={styles.kpiLabel}>متابعات مفتوحة</Text></View>
            </View>

            <Text style={styles.subTitle}>الإنجاز حسب المركز</Text>
            {stats.by_center.map((c) => (
              <View key={c.center} style={styles.statRow}>
                <Text style={styles.statNum}>{c.completed}/{c.total}</Text>
                <View style={{ flex: 1, marginHorizontal: 8 }}><Bar value={c.completed} total={c.total} color={COLORS.green} /></View>
                <Text style={styles.statName}>{c.center}</Text>
              </View>
            ))}

            <Text style={styles.subTitle}>المخالفات المسجلة</Text>
            <View style={styles.levelRow}>
              {(Object.keys(LEVEL_LABELS) as ViolationLevel[]).map((l) => (
                <View key={l} style={[styles.levelBox, { backgroundColor: LEVEL_COLORS[l].bg }]}>
                  <Text style={[styles.levelNum, { color: LEVEL_COLORS[l].fg }]}>{stats.violation_levels[l] || 0}</Text>
                  <Text style={[styles.levelLabel, { color: LEVEL_COLORS[l].fg }]}>{LEVEL_LABELS[l]}</Text>
                </View>
              ))}
            </View>

            {Object.entries(stats.outcomes).some(([k]) => k !== 'inspected') && (
              <>
                <Text style={styles.subTitle}>زيارات لم تكتمل</Text>
                {Object.entries(stats.outcomes)
                  .filter(([k]) => k !== 'inspected')
                  .map(([k, n]) => (
                    <Text key={k} style={styles.lineText}>• {OUTCOME_LABELS[k as keyof typeof OUTCOME_LABELS] || k}: {n}</Text>
                  ))}
              </>
            )}

            {stats.compliance_failures.length > 0 && (
              <>
                <Text style={styles.subTitle}>أكثر المخالفات تكراراً</Text>
                {stats.compliance_failures.slice(0, 4).map((f) => (
                  <Text key={f.key} style={styles.lineText}>• {f.label}{f.key === 'illegal_connection' ? ' (وجودها مخالفة)' : ' (غير مستوفى)'}: {f.count}</Text>
                ))}
              </>
            )}

            <Text style={styles.subTitle}>أداء المعاينين</Text>
            {stats.by_worker.length === 0 ? (
              <Text style={styles.empty}>لا توجد معاينات منفذة بعد.</Text>
            ) : (
              stats.by_worker.map((w) => (
                <View key={w.worker_name} style={styles.statRow}>
                  <Text style={styles.statNum}>{w.visits} زيارة • {w.samples} عينة</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.statName}>{w.worker_name}</Text>
                </View>
              ))
            )}

            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 12 }]} onPress={handleExport}>
              <Text style={styles.primaryBtnText}>تصدير تقرير الشهر (Excel)</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ---------- Duplicate inspections awaiting review ---------- */}
      {conflicts.length > 0 && (
        <View style={[styles.card, { borderColor: COLORS.amber }]}>
          <Text style={styles.title}>معاينات مكررة تحتاج مراجعة ({conflicts.length})</Text>
          <Text style={styles.hint}>موظفان عاينا نفس المكان أثناء العمل أوفلاين. بيانات الثاني محفوظة ولم تُفقد.</Text>
          {conflicts.map((c) => (
            <TouchableOpacity key={c.id} style={styles.rowItem} onPress={() => handleResolve(c)}>
              <Text style={styles.reviewText}>مراجعة</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.rowName}>{c.facility_name}</Text>
                <Text style={styles.rowSub}>الرسمية: {c.completed_by_name} • المكررة: {c.worker_name} ({c.samples.length} عينة)</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>رفع خطة شهرية جديدة (Excel)</Text>
        <TextInput
          style={styles.input}
          value={monthLabel}
          onChangeText={setMonthLabel}
          placeholder="اسم الشهر (مثال: ديسمبر 2026)"
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleUploadExcel}>
          <Text style={styles.primaryBtnText}>اختيار ورفع ملف Excel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>إدارة أكواد العمال</Text>
        <TextInput style={styles.input} value={workerName} onChangeText={setWorkerName} placeholder="اسم الموظف" />
        <TextInput
          style={styles.input}
          value={workerCode}
          onChangeText={setWorkerCode}
          placeholder="كود الدخول (مثال: W104)"
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAddWorker}>
          <Text style={styles.primaryBtnText}>إنشاء كود موظف</Text>
        </TouchableOpacity>

        {workers.map((w) => (
          <View key={w.id} style={styles.rowItem}>
            <TouchableOpacity
              style={w.active ? styles.unlockBtn : styles.enableBtn}
              onPress={() => handleToggleWorker(w)}
            >
              <Text style={w.active ? styles.unlockText : styles.enableText}>{w.active ? 'إيقاف' : 'تفعيل'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={[styles.rowName, !w.active && { color: COLORS.muted, textDecorationLine: 'line-through' }]}>{w.name}</Text>
            </View>
            <Text style={styles.rowCode}>{w.code}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>الأماكن المحجوزة والمقفولة ({lockedFacilities.length})</Text>
        {lockedFacilities.length === 0 ? (
          <Text style={styles.empty}>لا توجد أماكن مقفولة في الشهر المحدد.</Text>
        ) : (
          lockedFacilities.map((f) => (
            <View key={f.id} style={styles.rowItem}>
              <TouchableOpacity style={styles.unlockBtn} onPress={() => handleUnlock(f.id)}>
                <Text style={styles.unlockText}>إعادة فتح</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.rowName}>{f.name}</Text>
                <Text style={styles.rowSub}>
                  {f.status === 'completed' ? `تمت بواسطة ${f.completed_by_name}` : `محجوزة بواسطة ${f.reserved_by_name}`}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.ink, textAlign: 'right', marginBottom: 10 },
  subTitle: { fontSize: 13, fontWeight: '800', color: COLORS.primary, textAlign: 'right', marginTop: 14, marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.muted, textAlign: 'right', marginBottom: 8 },
  lineText: { fontSize: 13, color: COLORS.ink, textAlign: 'right', marginTop: 2 },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, textAlign: 'right', marginBottom: 10 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  rowName: { fontSize: 14, fontWeight: '600', color: COLORS.ink, textAlign: 'right' },
  rowSub: { fontSize: 12, color: COLORS.muted, textAlign: 'right' },
  rowCode: { backgroundColor: COLORS.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, fontWeight: '700', color: COLORS.primary },
  unlockBtn: { backgroundColor: COLORS.amberSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  unlockText: { color: COLORS.amber, fontWeight: '700', fontSize: 12 },
  enableBtn: { backgroundColor: COLORS.greenSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  enableText: { color: COLORS.green, fontWeight: '700', fontSize: 12 },
  reviewText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  empty: { color: COLORS.muted, textAlign: 'center', paddingVertical: 12 },
  kpiRow: { flexDirection: 'row-reverse', gap: 8 },
  kpi: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 12, padding: 10, alignItems: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  kpiLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: 2 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statName: { fontSize: 13, fontWeight: '600', color: COLORS.ink, minWidth: 70, textAlign: 'right' },
  statNum: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  barTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', flexDirection: 'row-reverse' },
  barFill: { height: 8, borderRadius: 4 },
  levelRow: { flexDirection: 'row-reverse', gap: 6 },
  levelBox: { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center' },
  levelNum: { fontSize: 18, fontWeight: '800' },
  levelLabel: { fontSize: 10, fontWeight: '700' },
});
