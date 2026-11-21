import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getServerUrl, setServerUrl } from '../services/api';
import { COLORS } from '../theme/colors';
import { User } from '../types';

const REMEMBER_CODE_KEY = 'menoufia_remembered_code';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  onLogin: (user: User) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [serverUrl, setServerUrlState] = useState('');
  const [showServer, setShowServer] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getServerUrl().then(setServerUrlState);
    AsyncStorage.getItem(REMEMBER_CODE_KEY)
      .then((saved) => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.expiresAt && Date.now() < parsed.expiresAt && parsed.code) {
              setCode(parsed.code);
              setRememberMe(true);
            } else {
              AsyncStorage.removeItem(REMEMBER_CODE_KEY);
            }
          } catch {
            AsyncStorage.removeItem(REMEMBER_CODE_KEY);
          }
        }
      })
      .catch(() => { });
  }, []);

  const handleLogin = async () => {
    if (!code.trim()) {
      Alert.alert('تنبيه', 'أدخل كود الموظف أو الأدمن');
      return;
    }
    setLoading(true);
    try {
      if (serverUrl.trim()) {
        await setServerUrl(serverUrl.trim());
      }
      const cleanCode = code.trim().toUpperCase();
      const { user } = await api.login(cleanCode);

      // Save or remove remembered code based on checkbox
      try {
        if (rememberMe) {
          await AsyncStorage.setItem(
            REMEMBER_CODE_KEY,
            JSON.stringify({
              code: cleanCode,
              expiresAt: Date.now() + ONE_WEEK_MS,
            })
          );
        } else {
          await AsyncStorage.removeItem(REMEMBER_CODE_KEY);
        }
      } catch {
        // ignore storage errors
      }

      onLogin(user);
    } catch (e: unknown) {
      Alert.alert('تعذر الدخول', e instanceof Error ? e.message : 'تحقق من الكود وعنوان السيرفر المحلي');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Image source={require('../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>معاينات المنشآت</Text>
        <Text style={styles.subtitle}>شركة مياه الشرب والصرف الصحي بالمنوفية</Text>

        <Text style={styles.label}>كود الدخول</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="أدخل كود الموظف أو الأدمن"
          autoCapitalize="characters"
          textAlign="center"
        />

        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberMe((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>تذكرني</Text>
          <Text style={styles.rememberSubText}>(حفظ الكود لمدة أسبوع)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>دخول</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowServer((v) => !v)} style={styles.linkBtn}>
          <Text style={styles.linkText}>{showServer ? 'إخفاء إعدادات السيرفر المحلي' : 'إعدادات السيرفر المحلي (IP)'}</Text>
        </TouchableOpacity>

        {showServer && (
          <View style={styles.serverBox}>
            <Text style={styles.label}>عنوان السيرفر المحلي</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrlState}
              placeholder="http://192.168.1.10:4000"
              autoCapitalize="none"
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  logo: { width: 110, height: 110, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.ink, textAlign: 'center' },
  subtitle: { fontSize: 13, color: COLORS.muted, textAlign: 'center', marginBottom: 22, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.ink, marginBottom: 6, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: COLORS.bg,
    marginBottom: 14,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
    gap: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  rememberSubText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { marginTop: 14, alignItems: 'center' },
  linkText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  serverBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
});
