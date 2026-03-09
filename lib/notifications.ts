import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

export const BACKGROUND_TASK_NAME = 'focusflow-background-check';
const UNDONE_TASK_CHANNEL = 'undone-tasks';
const STREAK_CHANNEL      = 'streak-reminder';
const TIMER_CHANNEL       = 'active-timer';
const NOTIF_PERM_KEY      = 'focusflow_notif_permissions';

// ─── Notification handler ─────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Request permissions ──────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: false,
    },
  });

  await AsyncStorage.setItem(NOTIF_PERM_KEY, status);
  return status === 'granted';
}

// ─── Create Android channels ──────────────────────────────────────────────────

export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(UNDONE_TASK_CHANNEL, {
    name: 'Task Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4A9B7F',
  });

  await Notifications.setNotificationChannelAsync(STREAK_CHANNEL, {
    name: 'Streak Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500],
    lightColor: '#FF9800',
  });

  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL, {
    name: 'Active Timer',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
    lightColor: '#4A9B7F',
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function cancelNotificationsWithTag(tag: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.identifier.startsWith(tag)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

async function scheduleIfFuture(
  identifier: string,
  content: Notifications.NotificationContentInput,
  hour: number,
  minute = 0,
) {
  const now      = new Date();
  const fireTime = getTodayAt(hour, minute);
  if (fireTime <= now) return; // already passed today — skip

  await Notifications.scheduleNotificationAsync({
    identifier,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireTime,
    },
  });

  console.log(`✅ Scheduled [${identifier}] at ${fireTime.toLocaleTimeString()}`);
}

// ─── Schedule all daily reminders ────────────────────────────────────────────
//
//  7:00 AM  — Morning greeting + set your tasks for the day
// 12:00 PM  — Midday check-in (pending tasks or no tasks set yet)
//  5:00 PM  — Afternoon nudge
//  8:00 PM  — Evening wind-down reminder
// 10:17 PM  — Streak reminder (if no focus activity today)
//              Change to 9 PM (21, 0) in production
//
// Call this on every app open with fresh data from Supabase.

export async function scheduleAllDailyReminders({
  userName,
  incompleteTasks,
  hasTasksToday,
  hasActivityToday,
}: {
  userName: string;
  incompleteTasks: string[];
  hasTasksToday: boolean;
  hasActivityToday: boolean;
}) {
  // Cancel all existing daily reminders before rescheduling
  await cancelNotificationsWithTag('daily-7am');
  await cancelNotificationsWithTag('daily-12pm');
  await cancelNotificationsWithTag('daily-5pm');
  await cancelNotificationsWithTag('daily-8pm');
  await cancelNotificationsWithTag('streak-reminder');

  const name        = userName || 'there';
  const pendingCount = incompleteTasks.length;
  const preview     = incompleteTasks.slice(0, 2).join(', ');
  const extraCount  = incompleteTasks.length > 2 ? ` +${incompleteTasks.length - 2} more` : '';

  // ── 7:00 AM — Morning greeting ────────────────────────────────────────────
  await scheduleIfFuture(
    `daily-7am-${Date.now()}`,
    {
      title: `☀️ Good morning, ${name}!`,
      body: hasTasksToday
        ? `You have ${pendingCount > 0 ? `${pendingCount} task${pendingCount !== 1 ? 's' : ''} waiting` : 'tasks set for today'}. Let's make it a great day! 💪`
        : "You haven't set any tasks yet today. Start your day with a plan — even one goal makes a difference! 🎯",
      data: { type: 'daily-reminder' },
      ...(Platform.OS === 'android' && { channelId: UNDONE_TASK_CHANNEL }),
    },
    7, 0,
  );

  // ── 12:00 PM — Midday check-in ────────────────────────────────────────────
  await scheduleIfFuture(
    `daily-12pm-${Date.now()}`,
    {
      title: `🌤 Good afternoon, ${name}!`,
      body: !hasTasksToday
        ? "Still no tasks set for today? It's not too late — add one thing to focus on this afternoon! ✍️"
        : pendingCount > 0
        ? `You still have ${pendingCount} task${pendingCount !== 1 ? 's' : ''} pending: ${preview}${extraCount}. Halfway through the day — keep going! 💡`
        : "You've finished all your tasks for today! Amazing work 🎉 Want to add more goals for the afternoon?",
      data: { type: 'daily-reminder' },
      ...(Platform.OS === 'android' && { channelId: UNDONE_TASK_CHANNEL }),
    },
    12, 0,
  );

  // ── 5:00 PM — Afternoon nudge ─────────────────────────────────────────────
  await scheduleIfFuture(
    `daily-5pm-${Date.now()}`,
    {
      title: `🌇 Hey ${name}, afternoon check-in!`,
      body: !hasTasksToday
        ? "The day isn't over yet! Set a quick task and get one thing done before tonight. You've got this! 🚀"
        : pendingCount > 0
        ? `${pendingCount} task${pendingCount !== 1 ? 's' : ''} still pending: ${preview}${extraCount}. A focused session now could clear them all! ⚡`
        : "All tasks done! 🏆 Great discipline today. Your streak is looking strong 🔥",
      data: { type: 'daily-reminder' },
      ...(Platform.OS === 'android' && { channelId: UNDONE_TASK_CHANNEL }),
    },
    17, 0,
  );

  // ── 8:00 PM — Evening wind-down ───────────────────────────────────────────
  await scheduleIfFuture(
    `daily-8pm-${Date.now()}`,
    {
      title: `🌙 Evening reminder, ${name}`,
      body: !hasTasksToday
        ? "No tasks logged today. That's okay — tomorrow is a fresh start! Open FocusFlow and plan your goals for tomorrow 📋"
        : pendingCount > 0
        ? `Still ${pendingCount} unfinished task${pendingCount !== 1 ? 's' : ''}: ${preview}${extraCount}. One last push before the day ends! 🌙`
        : "You crushed it today! 🎉 All tasks complete. Rest well — tomorrow's goals are waiting for you 💤",
      data: { type: 'daily-reminder' },
      ...(Platform.OS === 'android' && { channelId: UNDONE_TASK_CHANNEL }),
    },
    20, 0,
  );

  // ── 10:17 PM — Streak reminder (only if no focus activity today) ──────────
  // Change to (21, 0) for 9 PM in production
  if (!hasActivityToday) {
    await scheduleIfFuture(
      `streak-reminder-${Date.now()}`,
      {
        title: '🔥 Keep your streak alive!',
        body: `${name}, you haven't logged a focus session yet today. Even one short session keeps your streak going!`,
        data: { type: 'streak-reminder' },
        ...(Platform.OS === 'android' && { channelId: STREAK_CHANNEL }),
      },
      22, 17, // ← change to 21, 0 for 9 PM in production
    );
  }
}

// ─── Legacy exports (still used by focus-tracker.tsx useEffects) ──────────────
// These now just re-call scheduleAllDailyReminders with minimal data so the
// focus-tracker hooks continue working without needing to be changed.

export async function scheduleUndoneTaskReminder(incompleteTasks: string[]) {
  // Handled by scheduleAllDailyReminders — this is a no-op kept for compatibility
  // The full scheduling happens on app open in _layout.tsx
}

export async function scheduleStreakReminder(hasActivityToday: boolean) {
  // Handled by scheduleAllDailyReminders — this is a no-op kept for compatibility
  await cancelNotificationsWithTag('streak-reminder');
  if (hasActivityToday) return;

  const now      = new Date();
  const reminder = getTodayAt(22, 17); // change to 21, 0 in production
  if (reminder <= now) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `streak-reminder-${Date.now()}`,
    content: {
      title: '🔥 Keep your streak alive!',
      body: "You haven't focused yet today. Even one session keeps your streak going!",
      data: { type: 'streak-reminder' },
      ...(Platform.OS === 'android' && { channelId: STREAK_CHANNEL }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminder,
    },
  });
}

export { TIMER_CHANNEL };