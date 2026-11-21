import React, { useEffect, useState } from 'react';
import { COLORS } from '../theme';
import type { User } from '../types';
import { api, getServerUrl, setServerUrl } from '../api';
import { clearAllCookies, getCookie, removeCookie, setCookie } from '../utils/cookies';
import { Trash2Icon } from '../components/Icons';

const REMEMBER_CODE_KEY = 'menoufia_remembered_code';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [serverUrl, setServerUrlState] = useState(getServerUrl());
  const [showServer, setShowServer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      // 1. Check Cookie first (Mobile / Browser Cookies)
      const cookieCode = getCookie(REMEMBER_CODE_KEY);
      if (cookieCode) {
        setCode(cookieCode);
        setRememberMe(true);
        return;
      }

      // 2. Fallback to localStorage if cookie not found
      const saved = localStorage.getItem(REMEMBER_CODE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt && parsed.code) {
          setCode(parsed.code);
          setRememberMe(true);
          // Sync back to cookie for 7 days
          setCookie(REMEMBER_CODE_KEY, parsed.code, 7);
        } else {
          localStorage.removeItem(REMEMBER_CODE_KEY);
          removeCookie(REMEMBER_CODE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(REMEMBER_CODE_KEY);
      removeCookie(REMEMBER_CODE_KEY);
    }
  }, []);

  const handleClearCookies = () => {
    if (window.confirm('هل تريد مسح جميع ملفات تعريف الارتباط (الكوكيز) وبيانات الدخول المحفوظة؟')) {
      clearAllCookies();
      setCode('');
      setRememberMe(false);
      setError('');
      alert('تم مسح جميع الكوكيز والبيانات المحفوظة بنجاح');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('أدخل كود الموظف أو الأدمن');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (serverUrl.trim()) {
        setServerUrl(serverUrl.trim());
      }
      const cleanCode = code.trim().toUpperCase();
      const res = await api.login(cleanCode);

      // Save or remove remembered code in both Cookie & LocalStorage
      try {
        if (rememberMe) {
          // Set Cookie for 7 days
          setCookie(REMEMBER_CODE_KEY, cleanCode, 7);
          localStorage.setItem(
            REMEMBER_CODE_KEY,
            JSON.stringify({
              code: cleanCode,
              expiresAt: Date.now() + ONE_WEEK_MS,
            })
          );
        } else {
          removeCookie(REMEMBER_CODE_KEY);
          localStorage.removeItem(REMEMBER_CODE_KEY);
        }
      } catch {
        // ignore storage errors
      }

      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || 'الكود غير مسجل أو تعذر الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: COLORS.bg,
      }}
    >
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: '24px',
          padding: '28px 20px',
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <img
          src="/logo.jpg"
          alt="شعار الشركة"
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50px',
            objectFit: 'cover',
            border: `2px solid ${COLORS.border}`,
            marginBottom: '16px',
          }}
        />

        <h1 style={{ fontSize: '22px', fontWeight: '800', color: COLORS.ink, textAlign: 'center' }}>
          معاينات المنشآت
        </h1>
        <p style={{ fontSize: '13px', color: COLORS.muted, textAlign: 'center', marginTop: '4px', marginBottom: '24px' }}>
          شركة مياه الشرب والصرف الصحي بالمنوفية
        </p>

        {error && (
          <div
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: COLORS.redSoft,
              color: COLORS.red,
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: COLORS.ink, marginBottom: '6px', textAlign: 'right' }}>
            كود الدخول
          </label>
          <input
            type="text"
            placeholder="مثال: ADMIN-2026 أو W101"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: `1.5px solid ${COLORS.border}`,
              backgroundColor: COLORS.bg,
              textAlign: 'center',
              fontSize: '18px',
              fontWeight: '800',
              color: COLORS.ink,
              letterSpacing: '1px',
              marginBottom: '12px',
            }}
          />

          <div
            onClick={() => setRememberMe((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '10px',
              marginBottom: '18px',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '2px 4px',
            }}
          >
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                accentColor: COLORS.primary,
                cursor: 'pointer',
              }}
            />
            <label
              htmlFor="rememberMe"
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: COLORS.ink,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>تذكرني</span>
              <span style={{ fontSize: '12px', color: COLORS.muted, fontWeight: '500' }}>
                (حفظ الكود لمدة أسبوع)
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: COLORS.primary,
              color: '#FFFFFF',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '800',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 3px 8px rgba(0, 107, 159, 0.3)',
            }}
          >
            {loading ? 'جارٍ تسجيل الدخول...' : 'دخول'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setShowServer((v) => !v)}
          style={{
            marginTop: '16px',
            color: COLORS.primary,
            fontSize: '13px',
            fontWeight: '700',
          }}
        >
          {showServer ? 'إخفاء إعدادات السيرفر' : 'إعدادات عنوان السيرفر (API)'}
        </button>

        {showServer && (
          <div
            style={{
              width: '100%',
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: `1px solid ${COLORS.border}`,
            }}
          >
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: COLORS.ink, marginBottom: '6px', textAlign: 'right' }}>
              عنوان السيرفر
            </label>
            <input
              type="text"
              placeholder="http://localhost:4000"
              value={serverUrl}
              onChange={(e) => setServerUrlState(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                backgroundColor: COLORS.bg,
                direction: 'ltr',
                textAlign: 'left',
                fontSize: '13px',
              }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleClearCookies}
          style={{
            marginTop: '20px',
            color: COLORS.muted,
            fontSize: '12px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '6px',
          }}
        >
          <Trash2Icon size={14} color={COLORS.muted} />
          <span>مسح ملفات تعريف الارتباط (الكوكيز) وسجل البيانات</span>
        </button>
      </div>
    </div>
  );
};
