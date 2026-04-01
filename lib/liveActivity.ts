import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

function getLiveActivityModule() {
  if (Platform.OS !== 'ios') return null;
  try {
    return requireNativeModule('LiveActivityModule');
  } catch {
    return null;
  }
}

const LiveActivityModule = getLiveActivityModule();

export async function startLiveActivity(taskName: string, elapsedSeconds: number): Promise<string | null> {
  if (!LiveActivityModule) return null;
  try {
    return await LiveActivityModule.startActivity(taskName, elapsedSeconds);
  } catch (e) {
    console.warn('LiveActivity startActivity failed:', e);
    return null;
  }
}

export async function updateLiveActivity(taskName: string, elapsedSeconds: number, isPaused: boolean): Promise<void> {
  if (!LiveActivityModule) return;
  try {
    await LiveActivityModule.updateActivity(taskName, elapsedSeconds, isPaused);
  } catch (e) {
    console.warn('LiveActivity updateActivity failed:', e);
  }
}

export async function stopLiveActivity(): Promise<void> {
  if (!LiveActivityModule) return;
  try {
    await LiveActivityModule.stopActivity();
  } catch (e) {
    console.warn('LiveActivity stopActivity failed:', e);
  }
}
