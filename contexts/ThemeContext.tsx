import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  colors: typeof LightColors;
}

const LightColors = {
  primary: '#4A9B7F',
  primaryLight: '#5DB89A',
  primaryDark: '#3A7D66',
  accent: '#7DD3C0',
  background: '#F8FFFE',
  bubbleLight: '#E8F7F4',
  bubbleMedium: '#D4EFE9',
  bubblePale: '#F0FAF8',
  textDark: '#1A3A32',
  textMedium: '#2D5249',
  textLight: '#5A7770',
  white: '#FFFFFF',
  shadow: 'rgba(74, 155, 127, 0.25)',
  surface: '#FFFFFF',
  cardBg: 'rgba(255, 255, 255, 0.96)',
  border: '#D1EAE2',
  settingsBg: 'rgba(255, 255, 255, 0.96)',
  settingsBorder: '#D1EAE2',
  iconBg: '#F0F9F6',
};

const DarkColors = {
  primary: '#5DB89A',
  primaryLight: '#7DD3C0',
  primaryDark: '#4A9B7F',
  accent: '#7DD3C0',
  background: '#0F1419',
  bubbleLight: '#1A2633',
  bubbleMedium: '#243447',
  bubblePale: '#1E2A38',
  textDark: '#E8F7F4',
  textMedium: '#B8D4CC',
  textLight: '#8AA39C',
  white: '#1A2633',
  shadow: 'rgba(0, 0, 0, 0.5)',
  surface: '#1A2633',
  cardBg: 'rgba(26, 38, 51, 0.95)',
  border: '#2A3F52',
  settingsBg: 'rgba(26, 38, 51, 0.95)',
  settingsBorder: '#2A3F52',
  iconBg: '#243447',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@focusflow_dark_mode';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const colors = isDarkMode ? DarkColors : LightColors;

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};