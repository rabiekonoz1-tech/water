import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  I18nManager,
  Image,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { initLocalDb, getSyncQueue } from './src/db/localDb';
import {
  describeSyncReport,
  flushSyncQueue,
  loadPlanDataOfflineFirst,
  loadPlansOfflineFirst,
  releaseFacilityOfflineFirst,
  reserveFacilityOfflineFirst,
} from './src/services/syncEngine';
import { api } from './src/services/api';
import { COLORS } from './src/theme/colors';
import { ActivityItem, Facility, MonthlyPlan, User } from './src/types';
import LoginScreen from './src/screens/LoginScreen';
import InspectionFormScreen from './src/screens/InspectionFormScreen';
import AdminScreen from './src/screens/AdminScreen';
import FollowupsScreen from './src/screens/FollowupsScreen';
import { COMPLIANCE_ITEMS, LEVEL_COLORS, LEVEL_LABELS, OUTCOME_LABELS } from './src/constants/domain';

type StatusFilter = 'all' | 'available' | 'reserved' | 'completed' | 'mine';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'available', label: 'متاح' },
  { key: 'reserved', label: 'في الطريق' },
  { key: 'completed', label: 'تم' },
  { key: 'mine', label: 'خاصتي' },
];

I18nManager.allowRTL(true);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<'plan' | 'feed' | 'followups' | 'admin'>('plan');
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [activeFacility, setActiveFacility] = useState<Facility | null>(null);
  const [inspectingFacility, setInspectingFacility] = useState<Facility | null>(null);

  useEffect(() => {
    initLocalDb();
  }, []);

  const refreshAll = async (currentUser: User, planIdOverride?: string) => {
    // Push pending offline work first and tell the user about anything that conflicted or was rejected
    const report = await flushSyncQueue(currentUser.code);
    if (report.conflicts.length > 0 || report.rejected.length > 0) {
      Alert.alert('نتيجة المزامنة', describeSyncReport(report) || '');
    }
    const { plans: loadedPlans, offline: isOff } = await loadPlansOfflineFirst(currentUser.code);
    setPlans(loadedPlans);
    setOffline(isOff);
    const targetPlanId = planIdOverride || selectedPlanId || loadedPlans[0]?.id || '';
    setSelectedPlanId(targetPlanId);

    if (targetPlanId) {
      const data = await loadPlanDataOfflineFirst(currentUser.code, targetPlanId);
      setFacilities(data.facilities);
      setFeed(data.feed);
      setOffline(data.offline);
    }
    const q = await getSyncQueue();
    setPendingSync(q.length);
  };

  useEffect(() => {
    if (!user) return;
    refreshAll(user);
    const unsub = NetInfo.addEventListener(async (state) => {
      if (state.isConnected) {
        refreshAll(user);
      } else {
        setOffline(true);
      }
    });
    return () => unsub();
  }, [user]);

  const centers = useMemo(() => {
    const set = new Set<string>(['الكل']);
    facilities.forEach((f) => set.add(f.center));
    return Array.from(set);
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (centerFilter !== 'الكل' && f.center !== centerFilter) return false;
      if (statusFilter === 'mine') {
        if (f.reserved_by_id !== user?.id && f.completed_by_id !== user?.id) return false;
      } else if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          f.address.toLowerCase().includes(q) ||
          f.facility_code.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [facilities, centerFilter, statusFilter, search, user]);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  if (inspectingFacility) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <InspectionFormScreen
          user={user}
          facility={inspectingFacility}
          onDone={(updated, queued) => {
            setFacilities((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
            setInspectingFacility(null);
            setActiveFacility(null);
            if (queued) {
              Alert.alert('تم الحفظ أوفلاين', 'سيتم مزامنة المعاينة تلقائياً عند عودة الإنترنت.');
            }
            refreshAll(user, selectedPlanId);
          }}
          onCancel={() => setInspectingFacility(null)}
        />
      </SafeAreaView>
    );
  }

  const handleReserve = async (f: Facility) => {
    try {
      const { facility: updated, queued } = await reserveFacilityOfflineFirst(user, f);
      setFacilities((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setActiveFacility(updated);
      if (queued) {
        Alert.alert('تم الحجز أوفلاين', 'تم تسجيل الحجز المؤقت محلياً وسيتم المزامنة عند توفر الإنترنت.');
      }
    } catch (e: unknown) {
      // e.g. a colleague reserved it a moment ago
      Alert.alert('تعذر الحجز', e instanceof Error ? e.message : 'حدث خطأ');
      setActiveFacility(null);
    }
    refreshAll(user, selectedPlanId);
  };

  const handleRelease = async (f: Facility) => {
    try {
      const { facility: updated } = await releaseFacilityOfflineFirst(user, f);
      setFacilities((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setActiveFacility(updated);
    } catch (e: unknown) {
      Alert.alert('تعذر إلغاء الحجز', e instanceof Error ? e.message : 'حدث خطأ');
    }
    refreshAll(user, selectedPlanId);
  };

  const onPullRefresh = async () => {
    setRefreshing(true);
    await refreshAll(user, selectedPlanId);
    setRefreshing(false);
  };

  const openMaps = (f: Facility) =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.name} ${f.address}`)}`);

  const completedCount = facilities.filter((f) => f.status === 'completed').length;
  const reservedCount = facilities.filter((f) => f.status === 'reserved').length;
  const progress = facilities.length ? Math.round((completedCount / facilities.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => setUser(null)}>
          <Text style={styles.logout}>خروج</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.brandTitle}>معاينات مياه المنوفية</Text>
          <Text style={styles.brandSub}>{user.name} ({user.code})</Text>
        </View>
        <Image source={require('./assets/logo.jpg')} style={styles.topLogo} />
      </View>

      {(offline || pendingSync > 0) && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>
            {offline ? 'وضع أوفلاين — يتم الحفظ محلياً' : `جارٍ مزامنة ${pendingSync} عملية معلقة...`}
          </Text>
        </View>
      )}

      {tab === 'plan' && (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthRow}>
            {plans.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, selectedPlanId === p.id && styles.chipActive]}
                onPress={() => refreshAll(user, p.id)}
              >
                <Text style={[styles.chipText, selectedPlanId === p.id && styles.chipTextActive]}>{p.month_label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryBox, { backgroundColor: '#F0F7FB', borderColor: COLORS.border }]}>
              <Text style={styles.summaryLabel}>الإجمالي</Text>
              <Text style={[styles.summaryValue, { color: COLORS.primary }]}>{facilities.length}</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: COLORS.amberSoft, borderColor: '#F3DFA0' }]}>
              <Text style={[styles.summaryLabel, { color: COLORS.amber }]}>في الطريق</Text>
              <Text style={[styles.summaryValue, { color: COLORS.amber }]}>{reservedCount}</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: COLORS.greenSoft, borderColor: '#CDE6C6' }]}>
              <Text style={[styles.summaryLabel, { color: COLORS.green }]}>تم</Text>
              <Text style={[styles.summaryValue, { color: COLORS.green }]}>{completedCount}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>نسبة الإنجاز {progress}%</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="بحث باسم المكان أو العنوان أو الكود..."
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.centerRow}>
            {centers.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, centerFilter === c && styles.chipActive]}
                onPress={() => setCenterFilter(c)}
              >
                <Text style={[styles.chipText, centerFilter === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.centerRow}>
            {STATUS_FILTERS.map((sf) => (
              <TouchableOpacity
                key={sf.key}
                style={[styles.chip, statusFilter === sf.key && styles.chipActive]}
                onPress={() => setStatusFilter(sf.key)}
              >
                <Text style={[styles.chipText, statusFilter === sf.key && styles.chipTextActive]}>{sf.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredFacilities}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />}
            ListEmptyComponent={<Text style={styles.emptyText}>لا توجد منشآت مطابقة للفلاتر الحالية</Text>}
            contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.facilityCard} onPress={() => setActiveFacility(item)}>
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'completed'
                        ? { backgroundColor: COLORS.greenSoft }
                        : item.status === 'reserved'
                        ? { backgroundColor: COLORS.amberSoft }
                        : { backgroundColor: '#E0F2FE' },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color:
                          item.status === 'completed'
                            ? COLORS.green
                            : item.status === 'reserved'
                            ? COLORS.amber
                            : COLORS.primary,
                      }}
                    >
                      {item.status === 'completed'
                        ? `مقفول • ${item.completed_by_name}`
                        : item.status === 'reserved'
                        ? `في الطريق • ${item.reserved_by_name}`
                        : 'متاح للمعاينة'}
                    </Text>
                  </View>
                  <Text style={styles.facilityName}>{item.name}</Text>
                </View>
                <Text style={styles.facilityAddr}>{item.center} — {item.address}</Text>
                <Text style={styles.facilityMeta}>
                  كود: {item.facility_code} • {item.activity_type || 'أخرى'} • تاريخ الخطة: {item.target_date || '-'}
                </Text>
                <View style={styles.badgeRow}>
                  {item.has_followup && (
                    <View style={[styles.badge, { backgroundColor: COLORS.amberSoft }]}>
                      <Text style={[styles.badgeText, { color: COLORS.amber }]}>تحتاج متابعة</Text>
                    </View>
                  )}
                  {item.history && item.history.worst !== 'none' && (
                    <View style={[styles.badge, { backgroundColor: LEVEL_COLORS[item.history.worst].bg }]}>
                      <Text style={[styles.badgeText, { color: LEVEL_COLORS[item.history.worst].fg }]}>
                        مخالفة سابقة {LEVEL_LABELS[item.history.worst]}
                      </Text>
                    </View>
                  )}
                  {item.status === 'completed' && item.inspection?.visit_outcome && item.inspection.visit_outcome !== 'inspected' && (
                    <View style={[styles.badge, { backgroundColor: COLORS.redSoft }]}>
                      <Text style={[styles.badgeText, { color: COLORS.red }]}>{OUTCOME_LABELS[item.inspection.visit_outcome]}</Text>
                    </View>
                  )}
                  {item.status === 'completed' && item.inspection?.visit_outcome === 'inspected' && item.inspection.violation_level && item.inspection.violation_level !== 'none' && (
                    <View style={[styles.badge, { backgroundColor: LEVEL_COLORS[item.inspection.violation_level].bg }]}>
                      <Text style={[styles.badgeText, { color: LEVEL_COLORS[item.inspection.violation_level].fg }]}>
                        مخالفة {LEVEL_LABELS[item.inspection.violation_level]}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {tab === 'feed' && (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />}
          contentContainerStyle={{ padding: 14, paddingBottom: 90 }}
          renderItem={({ item }) => (
            <View style={styles.feedBubble}>
              <Text style={styles.feedAuthor}>
                {{ reserved: '🚗', released: '↩️', expired: '⏱️', completed: '✅', unlocked: '🔓', plan_uploaded: '📋' }[item.action] || ''} {item.worker_name}
              </Text>
              <Text style={styles.feedSummary}>{item.summary}</Text>
              <Text style={styles.feedTime}>{new Date(item.created_at).toLocaleString('ar-EG')}</Text>
            </View>
          )}
        />
      )}

      {tab === 'admin' && user.role === 'admin' && (
        <AdminScreen
          user={user}
          facilities={facilities}
          planId={selectedPlanId}
          onRefresh={() => refreshAll(user, selectedPlanId)}
        />
      )}

      {tab === 'followups' && <FollowupsScreen user={user} />}

      {activeFacility && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{activeFacility.name}</Text>
              <Text style={styles.facilityAddr}>{activeFacility.center} — {activeFacility.address}</Text>
              <Text style={styles.facilityMeta}>كود: {activeFacility.facility_code} • {activeFacility.activity_type || 'أخرى'}</Text>

              {activeFacility.history && (
                <Text style={[styles.infoBox, { marginTop: 8, backgroundColor: LEVEL_COLORS[activeFacility.history.worst].bg, color: LEVEL_COLORS[activeFacility.history.worst].fg }]}>
                  زيارات سابقة لنفس المنشأة: {activeFacility.history.visits} • أعلى مخالفة: {LEVEL_LABELS[activeFacility.history.worst]}
                </Text>
              )}

              <TouchableOpacity style={styles.mapLink} onPress={() => openMaps(activeFacility)}>
                <Text style={styles.mapLinkText}>فتح العنوان في الخرائط</Text>
              </TouchableOpacity>

              {activeFacility.status === 'available' && (
                <View style={{ marginTop: 10, gap: 10 }}>
                  <TouchableOpacity style={styles.amberBtn} onPress={() => handleReserve(activeFacility)}>
                    <Text style={styles.btnText}>حجز مؤقت (أنا في الطريق)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.greenBtn} onPress={() => setInspectingFacility(activeFacility)}>
                    <Text style={styles.btnText}>بدء المعاينة مباشرة</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeFacility.status === 'reserved' && (
                <View style={{ marginTop: 10, gap: 10 }}>
                  <Text style={styles.infoBox}>
                    محجوز مؤقتاً بواسطة: {activeFacility.reserved_by_name}
                    {activeFacility.reserved_at ? ` (منذ ${new Date(activeFacility.reserved_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })})` : ''}
                  </Text>
                  {(activeFacility.reserved_by_id === user.id || user.role === 'admin') && (
                    <>
                      <TouchableOpacity style={styles.greenBtn} onPress={() => setInspectingFacility(activeFacility)}>
                        <Text style={styles.btnText}>تسجيل نتيجة المعاينة</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.outlineBtn} onPress={() => handleRelease(activeFacility)}>
                        <Text style={styles.outlineBtnText}>إلغاء الحجز (لن أذهب)</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {activeFacility.status === 'completed' && activeFacility.inspection && (
                <View style={styles.inspDetails}>
                  <Text style={styles.infoBox}>
                    {OUTCOME_LABELS[activeFacility.inspection.visit_outcome || 'inspected']} — بواسطة {activeFacility.inspection.worker_name}
                  </Text>
                  {(activeFacility.inspection.visit_outcome || 'inspected') === 'inspected' && (
                    <>
                      {activeFacility.inspection.samples.map((s, idx) => (
                        <Text key={idx} style={styles.sampleLine}>
                          • {s.code ? `${s.code} — ` : ''}{s.name} ({s.type}) × {s.count}
                          {s.ph != null ? ` • pH ${s.ph}` : ''}{s.temperature != null ? ` • ${s.temperature}°م` : ''}
                        </Text>
                      ))}
                      {activeFacility.inspection.violation_level && (
                        <Text style={[styles.sampleLine, { fontWeight: '800', color: LEVEL_COLORS[activeFacility.inspection.violation_level].fg }]}>
                          مستوى المخالفة: {LEVEL_LABELS[activeFacility.inspection.violation_level]}
                        </Text>
                      )}
                      {COMPLIANCE_ITEMS.filter((c) => activeFacility.inspection?.compliance?.[c.key]).map((c) => {
                        const ans = activeFacility.inspection!.compliance![c.key];
                        return (
                          <Text key={c.key} style={[styles.sampleLine, ans === c.badAnswer && { color: COLORS.red, fontWeight: '700' }]}>
                            {ans === c.badAnswer ? '✗' : ans === 'na' ? '–' : '✓'} {c.label}
                          </Text>
                        );
                      })}
                    </>
                  )}
                  {!!activeFacility.inspection.representative_name && (
                    <Text style={styles.sampleLine}>
                      ممثل المنشأة: {activeFacility.inspection.representative_name}
                      {activeFacility.inspection.representative_phone ? ` (${activeFacility.inspection.representative_phone})` : ''}
                    </Text>
                  )}
                  {!!activeFacility.inspection.notes && <Text style={styles.sampleLine}>ملاحظات: {activeFacility.inspection.notes}</Text>}
                  {activeFacility.inspection.followup_required && (
                    <Text style={[styles.sampleLine, { color: COLORS.amber, fontWeight: '700' }]}>
                      تحتاج متابعة{activeFacility.inspection.followup_date ? ` بتاريخ ${activeFacility.inspection.followup_date}` : ''}
                    </Text>
                  )}
                  {!!activeFacility.inspection.gps_lat && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${activeFacility.inspection!.gps_lat},${activeFacility.inspection!.gps_lng}`)}
                    >
                      <Text style={[styles.sampleLine, { color: COLORS.primary }]}>
                        GPS: {activeFacility.inspection.gps_lat}, {activeFacility.inspection.gps_lng} (فتح في الخرائط)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {user.role === 'admin' && activeFacility.status !== 'available' && (
                <TouchableOpacity
                  style={[styles.amberBtn, { marginTop: 10 }]}
                  onPress={() => {
                    Alert.alert(
                      'إعادة فتح المكان',
                      activeFacility.status === 'completed'
                        ? 'سيتم أرشفة المعاينة الحالية وفتح المكان لمعاينة جديدة. هل تريد المتابعة؟'
                        : 'سيتم إلغاء الحجز المؤقت. هل تريد المتابعة؟',
                      [
                        { text: 'إلغاء', style: 'cancel' },
                        {
                          text: 'فتح',
                          onPress: async () => {
                            try {
                              await api.unlockFacility(user.code, activeFacility.id);
                              setActiveFacility(null);
                              refreshAll(user, selectedPlanId);
                            } catch (e: unknown) {
                              Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر فتح المكان');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.btnText}>فتح المكان مجدداً (الأدمن)</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={() => setActiveFacility(null)}>
                <Text style={{ color: COLORS.muted, fontWeight: '700' }}>إغلاق</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setTab('plan')}>
          <Text style={[styles.navText, tab === 'plan' && styles.navActive]}>الخطة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setTab('feed')}>
          <Text style={[styles.navText, tab === 'feed' && styles.navActive]}>نشاط الفريق</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setTab('followups')}>
          <Text style={[styles.navText, tab === 'followups' && styles.navActive]}>المتابعات</Text>
        </TouchableOpacity>
        {user.role === 'admin' && (
          <TouchableOpacity style={styles.navItem} onPress={() => setTab('admin')}>
            <Text style={[styles.navText, tab === 'admin' && styles.navActive]}>الإدارة</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topLogo: { width: 42, height: 42, borderRadius: 21 },
  brandTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  brandSub: { fontSize: 12, color: COLORS.muted },
  logout: { color: COLORS.red, fontWeight: '700', fontSize: 13 },
  offlineBar: { backgroundColor: COLORS.amberSoft, padding: 8, alignItems: 'center' },
  offlineText: { color: COLORS.amber, fontWeight: '700', fontSize: 12 },
  monthRow: { maxHeight: 46, paddingHorizontal: 10, paddingTop: 8 },
  centerRow: { maxHeight: 46, paddingHorizontal: 10, marginBottom: 4 },
  chip: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, height: 34, justifyContent: 'center' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.ink, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingTop: 6 },
  summaryBox: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  summaryValue: { fontSize: 15, fontWeight: '800' },
  searchInput: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10, textAlign: 'right' },
  facilityCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  facilityName: { fontSize: 15, fontWeight: '700', color: COLORS.ink, flex: 1, textAlign: 'right', marginLeft: 8 },
  facilityAddr: { fontSize: 13, color: COLORS.muted, textAlign: 'right' },
  facilityMeta: { fontSize: 11, color: COLORS.primary, textAlign: 'right', marginTop: 6, fontWeight: '600' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  feedBubble: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  feedAuthor: { fontSize: 13, fontWeight: '700', color: COLORS.primary, textAlign: 'right' },
  feedSummary: { fontSize: 14, color: COLORS.ink, textAlign: 'right', marginTop: 4 },
  feedTime: { fontSize: 11, color: COLORS.muted, textAlign: 'left', marginTop: 6 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row-reverse', backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 12 },
  navItem: { flex: 1, alignItems: 'center' },
  navText: { fontSize: 14, color: COLORS.muted, fontWeight: '600' },
  navActive: { color: COLORS.primary, fontWeight: '800' },
  modalBackdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15,41,58,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, textAlign: 'right', marginBottom: 4 },
  amberBtn: { backgroundColor: COLORS.amber, borderRadius: 12, padding: 14, alignItems: 'center' },
  greenBtn: { backgroundColor: COLORS.green, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  infoBox: { backgroundColor: COLORS.bg, padding: 10, borderRadius: 10, textAlign: 'right', color: COLORS.ink, fontWeight: '600', marginBottom: 6 },
  inspDetails: { marginTop: 12, backgroundColor: COLORS.bg, padding: 12, borderRadius: 12 },
  sampleLine: { fontSize: 13, color: COLORS.ink, textAlign: 'right', marginTop: 4 },
  closeBtn: { alignItems: 'center', marginTop: 14, padding: 8 },
  progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginHorizontal: 12, marginTop: 8, overflow: 'hidden', flexDirection: 'row-reverse' },
  progressFill: { height: 6, backgroundColor: COLORS.green, borderRadius: 3 },
  progressText: { fontSize: 11, color: COLORS.muted, textAlign: 'right', marginHorizontal: 14, marginTop: 3 },
  emptyText: { textAlign: 'center', color: COLORS.muted, paddingVertical: 30 },
  badgeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  mapLink: { marginTop: 8, alignSelf: 'flex-end' },
  mapLinkText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  outlineBtn: { borderWidth: 1.5, borderColor: COLORS.amber, borderRadius: 12, padding: 12, alignItems: 'center' },
  outlineBtnText: { color: COLORS.amber, fontWeight: '700' },
});
