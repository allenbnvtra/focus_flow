import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TIMER_CHANNEL } from './notifications';

const TIMER_NOTIF_ID = 'focusflow-active-timer';

// ─── Register interactive action buttons ─────────────────────────────────────
// Call once at app startup (e.g., in App.tsx)

export async function registerTimerNotificationCategory() {
  await Notifications.setNotificationCategoryAsync('timer-controls', [
    {
      identifier: 'PAUSE_RESUME',
      buttonTitle: '⏸ Pause',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'STOP_SESSION',
      buttonTitle: '⏹ Stop',
      options: {
        opensAppToForeground: true,
        isDestructive: true,
      },
    },
  ]);
}

// ─── Show / update the persistent timer notification ──────────────────────────

export async function showTimerNotification({
  taskName,
  elapsedSeconds,
  isPaused,
}: {
  taskName: string;
  elapsedSeconds: number;
  isPaused: boolean;
}) {
  const h = Math.floor(elapsedSeconds / 3600);
  const m = Math.floor((elapsedSeconds % 3600) / 60);
  const s = elapsedSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  const statusIcon = isPaused ? '⏸' : '▶';

  // Update the category button label based on current state
  await Notifications.setNotificationCategoryAsync('timer-controls', [
    {
      identifier: 'PAUSE_RESUME',
      buttonTitle: isPaused ? '▶ Resume' : '⏸ Pause',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'STOP_SESSION',
      buttonTitle: '⏹ Stop',
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);

  await Notifications.scheduleNotificationAsync({
    identifier: TIMER_NOTIF_ID,
    content: {
      title: `${statusIcon} FocusFlow — ${timeStr}`,
      body: taskName,
      sticky: true,          // Android: keeps it in the tray
      autoDismiss: false,
      categoryIdentifier: 'timer-controls',
      data: { type: 'timer', isPaused, elapsedSeconds },
      ...(Platform.OS === 'android' && {
        channelId: TIMER_CHANNEL,
        color: '#4A9B7F',
        priority: 'low',     // Silent but visible
        ongoing: true,       // Can't be swiped away on Android
      }),
    },
    trigger: null, // Show immediately
  });
}

// ─── Dismiss timer notification ───────────────────────────────────────────────

export async function dismissTimerNotification() {
  await Notifications.dismissNotificationAsync(TIMER_NOTIF_ID);
}