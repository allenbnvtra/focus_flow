import AsyncStorage from '@react-native-async-storage/async-storage';

export async function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): Promise<string> {
  console.log('🔗 redirectSystemPath called with path:', JSON.stringify(path));

  // Strip the scheme if present: "focusflow://pause" → "pause"
  // Also handles "/pause", "//pause", etc.
  const withoutScheme = path.replace(/^[a-z][a-z0-9+\-.]*:\/\//i, '');
  const clean = withoutScheme.replace(/^\/+/, '');

  console.log('🔗 clean path:', JSON.stringify(clean));

  const actionMap: Record<string, string> = {
    'pause': 'pause',
    'resume': 'resume',
    'stop': 'stop',
    'timer/pause': 'pause',
    'timer/resume': 'resume',
    'timer/stop': 'stop',
  };

  const action = actionMap[clean];

  if (action) {
    await AsyncStorage.setItem('focusflow_notif_action', action);
    return '/(tabs)/focus-tracker';
  }

  if (clean === 'focus-tracker' || clean === '') {
    return '/(tabs)/focus-tracker';
  }

  return path;
}