import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function DashboardLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for both auth and navigation to be ready
    if (isLoading || !navigationState?.key) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      setTimeout(() => {
        router.replace('/auth/login');
      }, 50);
    }
  }, [isAuthenticated, isLoading, navigationState?.key]);

  // Show loading while checking auth or navigation
  if (isLoading || !navigationState?.key) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#F8FFFE' 
      }}>
        <ActivityIndicator size="large" color="#2DD4BF" />
      </View>
    );
  }

  // Don't render dashboard if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F8FFFE' },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}