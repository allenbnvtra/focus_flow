import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';

interface SettingItemProps {
  icon: string;
  label: string;
  value?: boolean;
  onValueChange?: (val: boolean) => void;
  type: 'toggle' | 'link';
  isLast?: boolean;
}

// Sub-component for individual setting rows
const SettingItem = ({ icon, label, value, onValueChange, type, isLast }: SettingItemProps) => (
  <TouchableOpacity 
    style={[styles.settingItem, isLast && { borderBottomWidth: 0 }]}
    disabled={type === 'toggle'}
  >
    <View style={styles.settingLeft}>
      <View style={styles.iconBg}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    {type === 'toggle' ? (
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D1D1', true: Colors.accent }}
        thumbColor={value ? Colors.primary : '#F4F4F4'}
      />
    ) : (
      <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
    )}
  </TouchableOpacity>
);

export default function Settings() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [highContrast, setHighContrast] = useState(false);

  return (
    <Background>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                style={styles.logoIcon}
              >
                <Ionicons name="flash" size={24} color={Colors.white} />
              </LinearGradient>
              <Text style={styles.logoText}>FocusFlow</Text>
            </View>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="menu-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.pageTitle}>Settings</Text>

          {/* USER PROFILE SUMMARY CARD */}
          <LinearGradient
            colors={['#2F6B56', '#3D7A63', '#4A9B7F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.profileInfo}>
              <Image 
                source={{ uri: 'https://i.pravatar.cc/150?u=focus' }} 
                style={styles.avatar} 
              />
              <View>
                <Text style={styles.userName}>Alex Rivers</Text>
                <Text style={styles.userEmail}>alex.focus@flow.com</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editBadge}>
              <Ionicons name="pencil" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </LinearGradient>

          {/* GROUP 1: DISPLAY */}
          <Text style={styles.sectionTitle}>Display & Experience</Text>
          <View style={styles.settingsGroup}>
            <SettingItem 
              icon="moon-outline" 
              label="Dark Mode" 
              type="toggle" 
              value={darkMode} 
              onValueChange={setDarkMode} 
            />
            <SettingItem 
              icon="eye-outline" 
              label="High Contrast" 
              type="toggle" 
              value={highContrast} 
              onValueChange={setHighContrast} 
              isLast 
            />
          </View>

          {/* GROUP 2: ACCESSIBILITY & PRIVACY */}
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <View style={styles.settingsGroup}>
            <SettingItem icon="notifications-outline" label="Notifications" type="toggle" value={notifications} onValueChange={setNotifications} />
            <SettingItem icon="lock-closed-outline" label="Privacy Policy" type="link" />
            <SettingItem icon="shield-checkmark-outline" label="Account Security" type="link" isLast />
          </View>

          {/* GROUP 3: APP INFO */}
          <Text style={styles.sectionTitle}>Other</Text>
          <View style={styles.settingsGroup}>
            <SettingItem icon="help-circle-outline" label="Help & Support" type="link" />
            <SettingItem icon="information-circle-outline" label="About FocusFlow" type="link" isLast />
          </View>

          {/* DARK RED SIGN OUT BUTTON */}
          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8}>
            <Ionicons name="log-out" size={20} color="white" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 10, },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: '700', color: Colors.primary, letterSpacing: -0.5 },
  iconButton: { 
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'white', 
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E8E8E8' 
  },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.textDark, marginVertical: 15 },
  
  // PROFILE CARD
  profileCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 10,
    shadowColor: '#1A3A32',
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  profileInfo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'white' },
  userName: { fontSize: 22, fontWeight: '800', color: 'white' },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  editBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },

  // SETTINGS GROUP
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  settingsGroup: { 
    backgroundColor: 'rgba(255, 255, 255, 0.96)', 
    borderRadius: 24, 
    marginBottom: 25,
    borderWidth: 2, 
    borderColor: '#D1EAE2', // THE VISIBLE LIGHT TEAL BORDER
    overflow: 'hidden',
  },
  settingItem: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    padding: 18, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' 
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBg: { 
    width: 38, height: 38, borderRadius: 12, 
    backgroundColor: '#F0F9F6', alignItems: 'center', justifyContent: 'center' 
  },
  settingLabel: { fontSize: 16, fontWeight: '600', color: Colors.textDark },

  logoutBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12, 
    padding: 18, 
    borderRadius: 22, 
    backgroundColor: '#A62D2D',
    marginTop: 10,
    marginBottom: 0,
    shadowColor: '#A62D2D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  logoutText: { fontSize: 16, fontWeight: '800', color: 'white', letterSpacing: 0.5 },
});