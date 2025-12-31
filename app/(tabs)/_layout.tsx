import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Colors = {
  primary: '#00DF9A',
  surface: '#121212',
  textInactive: '#666666',
  indicator: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.1)',
};

type IconName = keyof typeof Ionicons.glyphMap;

const TabBarIcon = ({ name, focused }: { name: IconName; focused: boolean }) => {
  return (
    <View style={styles.iconContainer}>
      {focused && <View style={styles.activePill} />}
      <Ionicons 
        name={name} 
        size={24} 
        color={focused ? Colors.primary : Colors.textInactive} 
      />
    </View>
  );
};

export default function TabsLayout() {
  const pathname = usePathname();
  
  // Hide tab bar when in memory game
  const shouldHideTabBar = pathname.includes('games/memory') || pathname.includes('settings/edit-profile') || pathname.includes('dashboard/insight');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarLabelPosition: 'beside-icon',
        tabBarStyle: shouldHideTabBar ? { display: 'none' } : styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIconStyle,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={focused ? "grid" : "grid-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="focus-tracker"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={focused ? "stats-chart" : "stats-chart-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="learning-hub"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={focused ? "play-circle" : "play-circle-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reflection"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={focused ? "person" : "person-outline"} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 24,
    left: 20,
    right: 20,
    height: 64,
    marginHorizontal: 3,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 0,
  },
  tabItem: {
    height: 64, 
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconStyle: {
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    height: '100%',
    width: '100%',
  },
  activePill: {
    position: 'absolute',
    width: 44,
    height: 44,
    backgroundColor: Colors.indicator,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
});