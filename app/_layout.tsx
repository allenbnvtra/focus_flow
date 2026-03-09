import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { router } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  requestNotificationPermissions,
  setupNotificationChannels,
  scheduleAllDailyReminders,
  BACKGROUND_TASK_NAME,
} from '../lib/notifications';
import { registerTimerNotificationCategory } from '../lib/timerNotification';

SplashScreen.preventAutoHideAsync();

// ─── Background task (Android only) ──────────────────────────────────────────

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const userId = session.user.id;
    const today  = new Date().toISOString().split('T')[0];

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .maybeSingle();

    const { data: tasks } = await supabase
      .from('tasks').select('text, completed')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at',  `${today}T23:59:59`);

    const { data: sessions } = await supabase
      .from('focus_sessions').select('id')
      .eq('user_id', userId)
      .gte('completed_at', `${today}T00:00:00`);

    const allTodayTasks    = tasks    || [];
    const incompleteTasks  = allTodayTasks.filter((t: any) => !t.completed).map((t: any) => t.text);
    const hasTasksToday    = allTodayTasks.length > 0;
    const hasActivityToday = (sessions || []).length > 0;

    await scheduleAllDailyReminders({
      userName: profile?.name || '',
      incompleteTasks,
      hasTasksToday,
      hasActivityToday,
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

    const allTodayTasks    = tasksRes.data    || [];
    const incompleteTasks  = allTodayTasks.filter((t: any) => !t.completed).map((t: any) => t.text);
    const hasTasksToday    = allTodayTasks.length > 0;
    const hasActivityToday = (sessionsRes.data || []).length > 0;

    await scheduleAllDailyReminders({
      userName: profileRes.data?.name || '',
      incompleteTasks,
      hasTasksToday,
      hasActivityToday,
    });
  } catch (e) {
    console.error('Failed to schedule reminders on app open:', e);
  }
}

// ─── Inner layout ─────────────────────────────────────────────────────────────

function RootLayoutContent() {
  const [fontsLoaded] = useFonts({});
  const { colors, isDarkMode } = useTheme();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    (async () => {
      await setupNotificationChannels();
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      await registerTimerNotificationCategory();

      // Schedule all daily reminders on every app open
      await scheduleRemindersFromSupabase();

      // Background task: Android only
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
        if (
          data?.type === 'daily-reminder' ||
          data?.type === 'undone-tasks'   ||
          data?.type === 'streak-reminder'
        ) {
          router.push('/(tabs)/focus-tracker');
        }
      }
    );

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

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
    </>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </ThemeProvider>
  );
}