import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  requestNotificationPermissions,
  setupNotificationChannels,
  scheduleAllDailyReminders,
  hasMoodForToday,
  markMoodLogged,
  BACKGROUND_TASK_NAME,
} from '../lib/notifications';
import { registerTimerNotificationCategory } from '../lib/timerNotification';
import MoodCheckInModal, { MoodPeriod } from '../components/MoodCheckInModal';
import ForceUpdateModal from '../components/ForceUpdateModal';
import RateUsModal, {
  incrementAppOpens,
  shouldShowRateModal,
  markRatingDone,
} from '../components/RateUsModal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MaintenanceModal from '../components/MaintenanceModal';

SplashScreen.preventAutoHideAsync();

// ─── Version helper ───────────────────────────────────────────────────────────

function isOutdated(installedVersion: string, minimumVersion: string): boolean {
  const toNums = (v: string) => v.split('.').map(Number);
  const [iMaj, iMin, iPat] = toNums(installedVersion);
  const [mMaj, mMin, mPat] = toNums(minimumVersion);
  if (iMaj !== mMaj) return iMaj < mMaj;
  if (iMin !== mMin) return iMin < mMin;
  return iPat < mPat;
}

// ─── Background task (Android only) ──────────────────────────────────────────

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const userId = session.user.id;
    const today  = new Date().toISOString().split('T')[0];

    const [profileRes, tasksRes, sessionsRes] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', userId).maybeSingle(),
      supabase.from('tasks').select('text, completed')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at',  `${today}T23:59:59`),
      supabase.from('focus_sessions').select('id')
        .eq('user_id', userId)
        .gte('completed_at', `${today}T00:00:00`),
    ]);

    const allTodayTasks   = tasksRes.data    || [];
    const incompleteTasks = allTodayTasks.filter((t: any) => !t.completed).map((t: any) => t.text);
    const morningDone     = await hasMoodForToday('morning');
    const afternoonDone   = await hasMoodForToday('afternoon');

    await scheduleAllDailyReminders({
      userName:          profileRes.data?.name || '',
      incompleteTasks,
      hasTasksToday:     allTodayTasks.length > 0,
      hasActivityToday:  (sessionsRes.data || []).length > 0,
      morningMoodDone:   morningDone,
      afternoonMoodDone: afternoonDone,
    });
  } catch (e) {
    console.error('Background task error:', e);
  }
});

// ─── Fetch data and schedule all reminders ────────────────────────────────────

async function scheduleRemindersFromSupabase() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const userId = session.user.id;
    const today  = new Date().toISOString().split('T')[0];

    const [profileRes, tasksRes, sessionsRes] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', userId).maybeSingle(),
      supabase.from('tasks').select('text, completed')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at',  `${today}T23:59:59`),
      supabase.from('focus_sessions').select('id')
        .eq('user_id', userId)
        .gte('completed_at', `${today}T00:00:00`),
    ]);

    const allTodayTasks   = tasksRes.data    || [];
    const incompleteTasks = allTodayTasks.filter((t: any) => !t.completed).map((t: any) => t.text);
    const morningDone     = await hasMoodForToday('morning');
    const afternoonDone   = await hasMoodForToday('afternoon');

    await scheduleAllDailyReminders({
      userName:          profileRes.data?.name || '',
      incompleteTasks,
      hasTasksToday:     allTodayTasks.length > 0,
      hasActivityToday:  (sessionsRes.data || []).length > 0,
      morningMoodDone:   morningDone,
      afternoonMoodDone: afternoonDone,
    });
  } catch (e) {
    console.error('Failed to schedule reminders on app open:', e);
  }
}

// ─── Determine if mood modal should show on app open ─────────────────────────

function getCurrentPeriod(): MoodPeriod | null {
  const hour = new Date().getHours();
  if (hour >= 6  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return null;
}

// ─── Inner layout ─────────────────────────────────────────────────────────────

function RootLayoutContent() {
  const [fontsLoaded] = useFonts({});
  const { colors, isDarkMode } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Mood modal state
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [moodPeriod, setMoodPeriod]             = useState<MoodPeriod>('morning');

  // Force update state
  const [updateRequired, setUpdateRequired] = useState(false);
  const [latestVersion, setLatestVersion]   = useState('');
  const currentVersion: string =
    Constants.expoConfig?.version ??
    (Constants.manifest as any)?.version ??
    '0.0.0';

  // ── Rate us state ─────────────────────────────────────────────────────────
  const [rateModalVisible, setRateModalVisible] = useState(false);

  // ── Maintenance state ──
  const [isMaintenance, setIsMaintenance]           = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceEta, setMaintenanceEta]         = useState('');

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // ── Check minimum version on mount ───────────────────────────────────────
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const configKey = Platform.OS === 'ios' ? 'min_ios_version' : 'min_android_version';
        const { data } = await supabase
          .from('app_config')
          .select('key, value')
          .in('key', [
            configKey,
            'is_maintenance',
            'maintenance_message',
            'maintenance_estimated_time',
          ]);

        if (!data) return;

        const get = (key: string) => data.find(r => r.key === key)?.value ?? '';

        // Maintenance check
        if (get('is_maintenance') === 'true') {
          setIsMaintenance(true);
          setMaintenanceMessage(get('maintenance_message'));
          setMaintenanceEta(get('maintenance_estimated_time'));
        }

        // Force update check
        const minVersion = get(configKey);
        if (!minVersion) return;
        setLatestVersion(minVersion);
        if (isOutdated(currentVersion, minVersion)) {
          setUpdateRequired(true);
        }
      } catch (e) {
        console.warn('Config check failed:', e);
      }
    };

    checkVersion();
  }, []);

  // ── Increment open count & decide whether to show rate modal ─────────────
  // Only runs once the user is authenticated so anonymous opens don't count.
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const checkRatePrompt = async () => {
      const { data } = await supabase
        .from('users')
        .select('has_rated')
        .eq('id', user.id)
        .single();

      if (data?.has_rated) return;

      const opens = await incrementAppOpens();
      const show = await shouldShowRateModal();
      if (!show) return;

      setTimeout(() => setRateModalVisible(true), 2500);
    };

    checkRatePrompt();
  }, [isAuthenticated, user]);

  // ── Show mood modal if it's morning/afternoon and not yet logged ──────────
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const checkAndShowMoodModal = async () => {
      const period = getCurrentPeriod();
      if (!period) return;

      const alreadyLogged = await hasMoodForToday(period);
      if (alreadyLogged) return;

      setTimeout(() => {
        setMoodPeriod(period);
        setMoodModalVisible(true);
      }, 1500);
    };

    checkAndShowMoodModal();
  }, [isAuthenticated, user]);

  useEffect(() => {
    (async () => {
      await setupNotificationChannels();
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      await registerTimerNotificationCategory();
      await scheduleRemindersFromSupabase();

      if (Platform.OS === 'android') {
        try {
          const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
          if (!isRegistered) {
            await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
              minimumInterval: 15 * 60,
            });
          }
        } catch (e) {
          console.warn('Background task registration skipped:', e);
        }
      }
    })();

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data as any;

        if (data?.type === 'mood-checkin') {
          const period = data.period as MoodPeriod;
          const alreadyLogged = await hasMoodForToday(period);
          if (!alreadyLogged) {
            setMoodPeriod(period);
            setMoodModalVisible(true);
          }
          return;
        }

        if (data?.type === 'daily-reminder' || data?.type === 'undone-tasks') {
          router.push('/(tabs)/focus-tracker');
          return;
        }

        if (data?.type === 'streak-reminder') {
          router.push('/(tabs)/focus-tracker');
          return;
        }
      }
    );

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  const handleMoodSubmit = async (mood: { emoji: string; label: string; value: number }) => {
    try {
      if (!user?.id) return;

      const today = new Date().toISOString().split('T')[0];

      await supabase.from('daily_moods').upsert({
        user_id:    user.id,
        mood_value: mood.value,
        mood_date:  today,
        notes:      `${moodPeriod} check-in: ${mood.emoji} ${mood.label}`,
      }, { onConflict: 'user_id,mood_date' });

      await markMoodLogged(moodPeriod);
      setMoodModalVisible(false);
      await scheduleRemindersFromSupabase();
    } catch (e) {
      console.error('Failed to save mood:', e);
      setMoodModalVisible(false);
    }
  };

  if (!fontsLoaded) return null;

  // Convenience: is any blocking modal open?
  const anyModalOpen = updateRequired || isMaintenance || rateModalVisible;

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      />

      {/* Force update — cannot be dismissed */}
      <ForceUpdateModal
        visible={updateRequired}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
      />

      <MaintenanceModal
        visible={isMaintenance && !updateRequired}
        message={maintenanceMessage}
        estimatedTime={maintenanceEta}
      />

      {/* Rate us — only when no force-update is pending */}
      <RateUsModal
        visible={rateModalVisible && !updateRequired}
        onDismiss={() => setRateModalVisible(false)}
        userId={user?.id} 
      />

      {/* Mood check-in — only when no other modal is blocking */}
      <MoodCheckInModal
        visible={moodModalVisible && !anyModalOpen}
        period={moodPeriod}
        userName={user?.name || ''}
        onSubmit={handleMoodSubmit}
        onDismiss={() => setMoodModalVisible(false)}
      />
    </>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutContent />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}