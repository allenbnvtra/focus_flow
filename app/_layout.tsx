import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

SplashScreen.preventAutoHideAsync();

// Inner component that can access theme
function RootLayoutContent() {
  const [fontsLoaded] = useFonts({});
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

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

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </ThemeProvider>
  );
}