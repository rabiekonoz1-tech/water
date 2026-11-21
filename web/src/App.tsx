import { useCallback, useEffect, useState } from 'react';
import type { ActivityItem, Facility, MonthlyPlan, User } from './types';
import { api } from './api';
import { TopBar } from './components/TopBar';
import { BottomNav, type TabType } from './components/BottomNav';
import { BottomSheet } from './components/BottomSheet';
import { FacilityDetail } from './components/FacilityDetail';
import { InspectionForm } from './components/InspectionForm';
import { LoginScreen } from './screens/LoginScreen';
import { PlanScreen } from './screens/PlanScreen';
import { FeedScreen } from './screens/FeedScreen';
import { FollowupsScreen } from './screens/FollowupsScreen';
import { AdminScreen } from './screens/AdminScreen';
import { clearAllCookies, getCookie, removeCookie, setCookie } from './utils/cookies';

const USER_COOKIE_KEY = 'menoufia_user';
const USER_STORAGE_KEY = 'menoufia_user';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      // 1. Check Cookie first (Primary session bearer for mobile and browser)
      const cookieUser = getCookie(USER_COOKIE_KEY);
      if (cookieUser) {
        return JSON.parse(cookieUser);
      }

      // If cookie was cleared from mobile settings, clear localStorage to remain synced
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved && !document.cookie.includes(USER_COOKIE_KEY)) {
        // If there were any cookies previously or it's a first load
        localStorage.removeItem(USER_STORAGE_KEY);
        return null;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [tab, setTab] = useState<TabType>('plan');
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [activeFacility, setActiveFacility] = useState<Facility | null>(null);
  const [inspectingFacility, setInspectingFacility] = useState<Facility | null>(null);
  const [followupCount, setFollowupCount] = useState(0);

  // Handle PWA BeforeInstallPrompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    try {
      setCookie(USER_COOKIE_KEY, JSON.stringify(u), 30);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      removeCookie(USER_COOKIE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const refreshAll = useCallback(
    async (currentUser: User, planIdOverride?: string) => {
      setRefreshing(true);
      try {
        const { plans: loadedPlans } = await api.getPlans(currentUser.code);
        setPlans(loadedPlans);
        const targetPlanId = planIdOverride || selectedPlanId || loadedPlans[0]?.id || '';
        setSelectedPlanId(targetPlanId);

        if (targetPlanId) {
          const [facRes, feedRes] = await Promise.all([
            api.getFacilities(currentUser.code, targetPlanId),
            api.getFeed(currentUser.code, targetPlanId),
          ]);
          setFacilities(facRes.facilities);
          setFeed(feedRes.feed);
        }
      } catch (err: any) {
        console.error('Refresh error:', err);
      } finally {
        setRefreshing(false);
      }
    },
    [selectedPlanId]
  );

  useEffect(() => {
    if (user) {
      refreshAll(user);
    }
  }, [user]);

  // Handle actions
  const handleReserve = async (f: Facility) => {
    if (!user) return;
    try {
      const res = await api.reserveFacility(user.code, f.id);
      setFacilities((prev) => prev.map((item) => (item.id === res.facility.id ? res.facility : item)));
      setActiveFacility(res.facility);
      refreshAll(user, selectedPlanId);
    } catch (err: any) {
      alert('تعذر الحجز: ' + err.message);
    }
  };

  const handleRelease = async (f: Facility) => {
    if (!user) return;
    try {
      const res = await api.releaseFacility(user.code, f.id);
      setFacilities((prev) => prev.map((item) => (item.id === res.facility.id ? res.facility : item)));
      setActiveFacility(res.facility);
      refreshAll(user, selectedPlanId);
    } catch (err: any) {
      alert('تعذر إلغاء الحجز: ' + err.message);
    }
  };

  const handleUnlock = async (f: Facility) => {
    if (!user) return;
    try {
      const res = await api.unlockFacility(user.code, f.id);
      setFacilities((prev) => prev.map((item) => (item.id === res.facility.id ? res.facility : item)));
      setActiveFacility(null);
      refreshAll(user, selectedPlanId);
    } catch (err: any) {
      alert('تعذر فتح المكان: ' + err.message);
    }
  };

  const handleOpenFacilityById = async (facilityId: string) => {
    if (!user) return;
    const existing = facilities.find((f) => f.id === facilityId);
    if (existing && existing.inspection) {
      setActiveFacility(existing);
      return;
    }
    try {
      const { facility } = await api.getFacility(user.code, facilityId);
      setActiveFacility(facility);
    } catch (err: any) {
      if (existing) {
        setActiveFacility(existing);
      } else {
        alert('تعذر تحميل تفاصيل المنشأة: ' + (err.message || 'غير موجودة'));
      }
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Top Mobile Bar */}
      <TopBar
        user={user}
        onLogout={handleLogout}
        deferredPrompt={deferredPrompt}
        onInstall={handleInstallPwa}
      />

      {/* Offline Alert Strip */}
      {!isOnline && (
        <div
          style={{
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            fontSize: '12px',
            fontWeight: '700',
            padding: '6px 12px',
            textAlign: 'center',
            borderBottom: '1px solid #FDE68A',
          }}
        >
          ⚠️ أنت الآن في وضع عدم الاتصال (Offline)
        </div>
      )}

      {/* Main Screens */}
      {tab === 'plan' && (
        <PlanScreen
          user={user}
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={(id) => {
            setSelectedPlanId(id);
            refreshAll(user, id);
          }}
          facilities={facilities}
          onSelectFacility={(f) => setActiveFacility(f)}
          onRefresh={() => refreshAll(user, selectedPlanId)}
          refreshing={refreshing}
        />
      )}

      {tab === 'feed' && (
        <FeedScreen
          feed={feed}
          onRefresh={() => refreshAll(user, selectedPlanId)}
          refreshing={refreshing}
          onSelectFacilityId={handleOpenFacilityById}
        />
      )}

      {tab === 'followups' && (
        <FollowupsScreen user={user} onFollowupCountChange={setFollowupCount} />
      )}

      {tab === 'admin' && user.role === 'admin' && (
        <AdminScreen
          user={user}
          facilities={facilities}
          planId={selectedPlanId}
          onRefresh={() => refreshAll(user, selectedPlanId)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={tab}
        onChangeTab={setTab}
        userRole={user.role}
        followupCount={followupCount}
      />

      {/* Bottom Sheet Modal for Facility Detail */}
      <BottomSheet isOpen={Boolean(activeFacility)} onClose={() => setActiveFacility(null)}>
        {activeFacility && (
          <FacilityDetail
            facility={activeFacility}
            user={user}
            onReserve={handleReserve}
            onRelease={handleRelease}
            onStartInspection={(f) => {
              setActiveFacility(null);
              setInspectingFacility(f);
            }}
            onUnlock={handleUnlock}
            onClose={() => setActiveFacility(null)}
            onFacilityUpdated={(updated) => {
              setFacilities((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
              setActiveFacility(updated);
              refreshAll(user, selectedPlanId);
            }}
            onFacilityDeleted={(deletedId) => {
              setFacilities((prev) => prev.filter((f) => f.id !== deletedId));
              setActiveFacility(null);
              refreshAll(user, selectedPlanId);
            }}
          />
        )}
      </BottomSheet>

      {/* Full Screen Inspection Form */}
      {inspectingFacility && (
        <InspectionForm
          user={user}
          facility={inspectingFacility}
          onDone={(updated) => {
            setFacilities((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
            setInspectingFacility(null);
            refreshAll(user, selectedPlanId);
          }}
          onCancel={() => setInspectingFacility(null)}
        />
      )}
    </div>
  );
}
