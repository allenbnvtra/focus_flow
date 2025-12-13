import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for both auth and navigation to be ready
    if (isLoading || !navigationState?.key) return;

    // Redirect to dashboard if already logged in
    if (isAuthenticated) {
      setTimeout(() => {
        router.replace('/dashboard');
      }, 50);
    }
  }, [isAuthenticated, isLoading, navigationState?.key]);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FFFE" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8FFFE' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{
            title: 'Welcome',
          }}
        />
        <Stack.Screen 
          name="login" 
          options={{
            title: 'Login',
          }}
        />
        <Stack.Screen 
          name="signup" 
          options={{
            title: 'Sign Up',
          }}
        />
      </Stack>
    </>
  );
}