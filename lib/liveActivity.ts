import { NativeModules, Platform } from 'react-native';

const { LiveActivityModule } = NativeModules;

/**
 * Start a Live Activity. Call this when the user presses ▶ on a task.
 * Returns the activity ID string, or null on Android/unsupported devices.
 */
export async function startLiveActivity(
  taskName: string,
  elapsedSeconds: number,
): Promise<string | null> {
  if (Platform.OS !== 'ios' || !LiveActivityModule) return null;
  try {
    return await LiveActivityModule.startActivity(taskName, elapsedSeconds);
  } catch (e) {
    console.warn('LiveActivity startActivity failed:', e);
    return null;
  }
}

/**
 * Update the Live Activity. Call this every ~10s and on pause/resume.
 */
export async function updateLiveActivity(
  taskName: string,
  elapsedSeconds: number,
  isPaused: boolean,
): Promise<void> {
  if (Platform.OS !== 'ios' || !LiveActivityModule) return;
  try {
    await LiveActivityModule.updateActivity(taskName, elapsedSeconds, isPaused);
  } catch (e) {
    console.warn('LiveActivity updateActivity failed:', e);
  }
}

/**
 * Stop and dismiss the Live Activity. Call this when the session ends.
 */
export async function stopLiveActivity(): Promise<void> {
  if (Platform.OS !== 'ios' || !LiveActivityModule) return;
  try {
    await LiveActivityModule.stopActivity();
  } catch (e) {
    console.warn('LiveActivity stopActivity failed:', e);
  }
}