import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

export const BACKGROUND_TASK_NAME  = 'focusflow-background-check';
const UNDONE_TASK_CHANNEL  = 'undone-tasks';
const STREAK_CHANNEL       = 'streak-reminder';
const MOOD_CHANNEL         = 'mood-checkin';
const TIMER_CHANNEL        = 'active-timer';
const NOTIF_PERM_KEY       = 'focusflow_notif_permissions';

// Fixed ID — every update cancels+reposts this exact slot
const LIVE_TIMER_NOTIF_ID  = 'focusflow-live-timer';

// Storage keys to track if mood was already logged today
export const MOOD_MORNING_KEY   = 'focusflow_mood_morning';
export const MOOD_AFTERNOON_KEY = 'focusflow_mood_afternoon';

// ─── Notification handler ─────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isLiveTimer = notification.request.identifier === LIVE_TIMER_NOTIF_ID;
    return {
      shouldShowAlert: !isLiveTimer,   // no banner pop for timer ticks
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: !isLiveTimer,
      shouldShowList: true,            // always visible in notification center
    };
  },
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

  await Notifications.setNotificationChannelAsync(MOOD_CHANNEL, {
    name: 'Mood Check-ins',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: '#7C4DFF',
  });

  // LOW importance = silent, no heads-up, no vibration — perfect for a
  // persistent timer status bar notification
  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL, {
    name: 'Active Timer',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
    lightColor: '#4A9B7F',
    enableVibrate: false,
    showBadge: false,
  });
}

// ─── Register notification action categories ──────────────────────────────────

export async function registerTimerNotificationCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('focusflow-timer-running', [
      {
        identifier: 'pause',
        buttonTitle: '⏸ Pause',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'stop',
        buttonTitle: '⏹ Stop',
        options: { opensAppToForeground: true },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('focusflow-timer-paused', [
      {
        identifier: 'resume',
        buttonTitle: '▶ Resume',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'stop',
        buttonTitle: '⏹ Stop',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (e) {
    console.error('Failed to register timer notification categories:', e);
  }
}

// ─── Live Timer Notification ──────────────────────────────────────────────────

const pad = (n: number) => n.toString().padStart(2, '0');

function formatElapsedForNotif(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
}

/**
 * Posts or replaces the live timer notification.
 *
 * Strategy: dismiss → cancel → re-post with the same identifier.
 * This is the correct expo-notifications pattern for "updating" a notification.
 * The OS deduplicates on identifier so only one notification ever exists.
 *
 * Throttle calls to every 5s from the component — the OS will handle it fine.
 */
export async function updateTimerNotification(
  taskName: string,
  elapsedSeconds: number,
  isPaused: boolean,
): Promise<void> {
  try {
    const timeStr     = formatElapsedForNotif(elapsedSeconds);
    const statusIcon  = isPaused ? '⏸' : '⏱';
    const statusLabel = isPaused ? 'Paused' : 'Focusing';
    const category    = isPaused ? 'focusflow-timer-paused' : 'focusflow-timer-running';

    // Dismiss the delivered notification (removes it from tray momentarily)
    // then cancel any scheduled duplicate, then re-post immediately.
    // This is the only reliable replace pattern in expo-notifications.
    try { await Notifications.dismissNotificationAsync(LIVE_TIMER_NOTIF_ID); } catch (_) {}
    try { await Notifications.cancelScheduledNotificationAsync(LIVE_TIMER_NOTIF_ID); } catch (_) {}

    const content: Notifications.NotificationContentInput = {
      title: `${statusIcon} ${timeStr} — ${statusLabel}`,
      body: taskName,
      categoryIdentifier: category,
      data: { type: 'live-timer', elapsedSeconds, isPaused, taskName },
    };

    // Android: attach channel
    if (Platform.OS === 'android') {
      (content as any).channelId = TIMER_CHANNEL;
      (content as any).priority  = Notifications.AndroidNotificationPriority.LOW;
      (content as any).color     = '#4A9B7F';
    }

    // iOS: passive = goes silently to notification center, no banner/sound
    if (Platform.OS === 'ios') {
      (content as any).interruptionLevel = 'passive';
    }

    await Notifications.scheduleNotificationAsync({
      identifier: LIVE_TIMER_NOTIF_ID,
      content,
      trigger: null,
    });
  } catch (e) {
    console.error('Failed to update timer notification:', e);
  }
}

/**
 * Fully removes the timer notification.
 * Call on session stop, complete, or discard.
 */
export async function clearTimerNotification(): Promise<void> {
  try { await Notifications.dismissNotificationAsync(LIVE_TIMER_NOTIF_ID); } catch (_) {}
  try { await Notifications.cancelScheduledNotificationAsync(LIVE_TIMER_NOTIF_ID); } catch (_) {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (fireTime <= now) return;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireTime,
    },
  });
}

// ─── Check if mood already logged today ───────────────────────────────────────

export async function hasMoodForToday(period: 'morning' | 'afternoon'): Promise<boolean> {
  try {
    const key   = period === 'morning' ? MOOD_MORNING_KEY : MOOD_AFTERNOON_KEY;
    const raw   = await AsyncStorage.getItem(key);
    if (!raw) return false;
    const { date } = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    return date === today;
  } catch {
    return false;
  }
}

export async function markMoodLogged(period: 'morning' | 'afternoon') {
  const key   = period === 'morning' ? MOOD_MORNING_KEY : MOOD_AFTERNOON_KEY;
  const today = new Date().toISOString().split('T')[0];
  await AsyncStorage.setItem(key, JSON.stringify({ date: today }));
}

// ─── Schedule mood check-in notifications ─────────────────────────────────────

export async function scheduleMoodCheckInNotifications(
  userName: string,
  morningDone: boolean,
  afternoonDone: boolean,
) {
  await cancelNotificationsWithTag('mood-morning');
  await cancelNotificationsWithTag('mood-afternoon');

  const name = userName || 'there';

  if (!morningDone) {
    await scheduleIfFuture(
      `mood-morning-${Date.now()}`,
      {
        title: `☀️ Good morning, ${name}!`,
        body: "How are you feeling today? Log your morning mood to track your wellbeing 😊",
        data: { type: 'mood-checkin', period: 'morning' },
        ...(Platform.OS === 'android' && { channelId: MOOD_CHANNEL }),
      },
      9, 0,
    );
  }

  if (!afternoonDone) {
    await scheduleIfFuture(
      `mood-afternoon-${Date.now()}`,
      {
        title: `🌤 Afternoon check-in, ${name}!`,
        body: "How's your energy this afternoon? Take a second to log your mood 🧠",
        data: { type: 'mood-checkin', period: 'afternoon' },
        ...(Platform.OS === 'android' && { channelId: MOOD_CHANNEL }),
      },
      14, 0,
    );
  }
}

// ─── Schedule all daily reminders ─────────────────────────────────────────────

export async function scheduleAllDailyReminders({
  userName,
  incompleteTasks,
  hasTasksToday,
  hasActivityToday,
  morningMoodDone,
  afternoonMoodDone,
}: {
  userName: string;
  incompleteTasks: string[];
  hasTasksToday: boolean;
  hasActivityToday: boolean;
  morningMoodDone: boolean;
  afternoonMoodDone: boolean;
}) {
  await cancelNotificationsWithTag('daily-7am');
  await cancelNotificationsWithTag('daily-12pm');
  await cancelNotificationsWithTag('daily-5pm');
  await cancelNotificationsWithTag('daily-8pm');
  await cancelNotificationsWithTag('streak-reminder');

  const name         = userName || 'there';
  const pendingCount = incompleteTasks.length;
  const preview      = incompleteTasks.slice(0, 2).join(', ');
  const extraCount   = incompleteTasks.length > 2 ? ` +${incompleteTasks.length - 2} more` : '';

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

  if (!hasActivityToday) {
    await scheduleIfFuture(
      `streak-reminder-${Date.now()}`,
      {
        title: '🔥 Keep your streak alive!',
        body: `${name}, you haven't logged a focus session yet today. Even one short session keeps your streak going!`,
        data: { type: 'streak-reminder' },
        ...(Platform.OS === 'android' && { channelId: STREAK_CHANNEL }),
      },
      21, 0,
    );
  }

  await scheduleMoodCheckInNotifications(name, morningMoodDone, afternoonMoodDone);
}

// ─── Legacy exports ───────────────────────────────────────────────────────────

export async function scheduleUndoneTaskReminder(_incompleteTasks: string[]) {
  // No-op — handled by scheduleAllDailyReminders
}

export async function scheduleStreakReminder(hasActivityToday: boolean) {
  await cancelNotificationsWithTag('streak-reminder');
  if (hasActivityToday) return;

  const now      = new Date();
  const reminder = getTodayAt(21, 0);
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