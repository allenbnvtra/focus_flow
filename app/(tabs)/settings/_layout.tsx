import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function SettingsLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FFFE',
      }}>
        <ActivityIndicator size="large" color="#2DD4BF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
