import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { COLORS } from '../theme/colors';
import { FollowupItem, User } from '../types';
import { LEVEL_COLORS, LEVEL_LABELS } from '../constants/domain';

interface Props {
  user: User;
}

// Facilities that need a return visit (across all months), most urgent first.
export default function FollowupsScreen({ user }: Props) {
  const [items, setItems] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFollowups(user.code);
      setItems(res.followups);
    } catch {
      setError('تعذر تحميل المتابعات — هذه الشاشة تحتاج اتصالاً بالسيرفر.');
    } finally {
      setLoading(false);
    }
  }, [user.code]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  const markDone = (item: FollowupItem) => {
    Alert.alert('إنهاء المتابعة', `تأكيد أن متابعة "${item.facility_name}" تمت؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تمت',
        onPress: async () => {
          try {
            await api.markFollowupDone(user.code, item.id);
            load();
          } catch (e: unknown) {
            Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر التحديث');
          }
        },
      },
    ]);
  };

  const openMaps = (item: FollowupItem) =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.facility_name} ${item.address}`)}`);

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={{ padding: 14, paddingBottom: 90 }}
      ListEmptyComponent={<Text style={styles.empty}>{error || 'لا توجد منشآت تحتاج متابعة حالياً 👌'}</Text>}
      renderItem={({ item }) => {
        const overdue = !!item.followup_date && item.followup_date < today;
        const tone = LEVEL_COLORS[item.violation_level] || LEVEL_COLORS.none;
        return (
          <View style={[styles.card, overdue && { borderColor: COLORS.red }]}>
            <View style={styles.row}>
              <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                <Text style={{ color: tone.fg, fontWeight: '700', fontSize: 11 }}>{LEVEL_LABELS[item.violation_level]}</Text>
              </View>
              <Text style={styles.name}>{item.facility_name}</Text>
            </View>
            <Text style={styles.sub}>{item.center} — {item.address}</Text>
            <Text style={[styles.meta, overdue && { color: COLORS.red }]}>
              {item.followup_date ? `موعد المتابعة: ${item.followup_date}${overdue ? ' (متأخرة)' : ''}` : 'بدون موعد محدد'} • المعاين: {item.worker_name}
            </Text>
            {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.doneBtn} onPress={() => markDone(item)}>
                <Text style={styles.doneText}>تمت المتابعة</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mapBtn} onPress={() => openMaps(item)}>
                <Text style={styles.mapText}>الاتجاهات</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.ink, flex: 1, textAlign: 'right', marginLeft: 8 },
  sub: { fontSize: 13, color: COLORS.muted, textAlign: 'right' },
  meta: { fontSize: 12, color: COLORS.primary, textAlign: 'right', marginTop: 6, fontWeight: '600' },
  notes: { fontSize: 12, color: COLORS.ink, textAlign: 'right', marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  actions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  doneBtn: { backgroundColor: COLORS.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  doneText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  mapBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  mapText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', color: COLORS.muted, paddingVertical: 40 },
});
