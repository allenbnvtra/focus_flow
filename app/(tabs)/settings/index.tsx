import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Background, { Colors } from '../../../components/Background';
import { useAuth } from '../../../contexts/AuthContext';

interface SettingItemProps {
  icon: string;
  label: string;
  value?: boolean;
  onValueChange?: (val: boolean) => void;
  onPress?: () => void;
  type: 'toggle' | 'link';
  isLast?: boolean;
}

const SettingItem = ({ icon, label, value, onValueChange, onPress, type, isLast }: SettingItemProps) => (
  <TouchableOpacity 
    style={[styles.settingItem, isLast && { borderBottomWidth: 0 }]}
    disabled={type === 'toggle'}
    onPress={onPress}
    activeOpacity={0.7}
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
  const router = useRouter();
  const { user, logout, isLoading: authLoading, updateUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [highContrast, setHighContrast] = useState(false);

  // Load user preferences from user object if they exist
  useEffect(() => {
    if (user) {
      // You can add preference fields to your users table if needed
      // For now, these will just be local state
      console.log('User loaded:', user);
    }
  }, [user]);

  // Update preferences in database
  const updatePreferences = async (preferences: { darkMode?: boolean; notifications?: boolean; highContrast?: boolean }) => {
    try {
      // If you want to persist preferences, add a preferences JSON column to your users table
      // await updateUserProfile({ preferences: { darkMode, notifications, highContrast, ...preferences } });
      console.log('Preferences updated:', preferences);
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      Alert.alert('Error', 'Failed to save preference');
    }
  };

  const handleDarkModeToggle = async (value: boolean) => {
    setDarkMode(value);
    await updatePreferences({ darkMode: value });
    Alert.alert(
      'Dark Mode',
      value ? 'Dark mode enabled. This will be applied across the app.' : 'Dark mode disabled.',
      [{ text: 'OK' }]
    );
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotifications(value);
    await updatePreferences({ notifications: value });
    Alert.alert(
      value ? 'Notifications Enabled' : 'Notifications Disabled',
      value 
        ? 'You will receive reminders and updates about your tasks and focus sessions.' 
        : 'You will no longer receive push notifications.',
      [{ text: 'OK' }]
    );
  };

  const handleHighContrastToggle = async (value: boolean) => {
    setHighContrast(value);
    await updatePreferences({ highContrast: value });
    Alert.alert(
      'High Contrast',
      value ? 'High contrast mode enabled for better visibility.' : 'High contrast mode disabled.',
      [{ text: 'OK' }]
    );
  };

  const handleMenu = () => {
    Alert.alert('Menu', 'Menu options coming soon!', [{ text: 'OK' }]);
  };

  const handleEditProfile = () => {
    Alert.alert(
      'Edit Profile',
      'Update your profile information and preferences.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => {
            router.push('/settings/edit-profile');
          }
        }
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'Your privacy is important to us. We collect and use your data to provide personalized productivity insights.\n\n• Data is encrypted and secure\n• We never share your information\n• You can delete your data anytime',
      [{ text: 'Close' }]
    );
  };

  const handleAccountSecurity = () => {
    Alert.alert(
      'Account Security',
      'Manage your account security settings:',
      [
        { 
          text: 'Change Password', 
          onPress: () => {
            // Implement password reset flow
            Alert.alert(
              'Change Password',
              'A password reset link will be sent to your email.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Send Link',
                  onPress: () => {
                    // Implement Supabase password reset
                    console.log('Send password reset email');
                    Alert.alert('Success', 'Password reset link sent to your email.');
                  }
                }
              ]
            );
          }
        },
        { 
          text: 'Enable 2FA', 
          onPress: () => {
            Alert.alert('Coming Soon', 'Two-factor authentication will be available in a future update.');
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleHelpSupport = () => {
    Alert.alert(
      'Help & Support',
      'Need assistance? We\'re here to help!',
      [
        { 
          text: 'Email Support', 
          onPress: () => {
            Alert.alert('Email Support', 'Contact us at:\nsupport@focusflow.app');
          }
        },
        { 
          text: 'FAQ', 
          onPress: () => {
            Alert.alert('FAQ', 'Frequently asked questions coming soon!');
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleAbout = () => {
    const memberSince = user?.created_at 
      ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Recently';

    Alert.alert(
      'About FocusFlow',
      `FocusFlow v2.1.0\n\nYour personal productivity companion for deep work and focused achievement.\n\nMember since: ${memberSince}\n\n© 2024 FocusFlow Inc.\nAll rights reserved.`,
      [{ text: 'OK' }]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your data will be synced when you return.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await logout();
              router.replace('/auth/login');
              console.log('✅ User signed out successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Show loading state while auth is initializing
  if (authLoading || loading) {
    return (
      <Background>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your settings...</Text>
        </View>
      </Background>
    );
  }

  // Fallback if no user (shouldn't happen in protected route)
  if (!user) {
    return (
      <Background>
        <View style={[styles.container, styles.centerContent]}>
          <Text style={styles.errorText}>No user data available</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => router.replace('/auth/login')}
          >
            <Text style={styles.retryButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </Background>
    );
  }

  // Generate avatar URL with user's name
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2F6B56&color=fff&size=128&bold=true`;

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
            <TouchableOpacity style={styles.iconButton} onPress={handleMenu}>
              <Ionicons name="menu-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.pageTitle}>Settings</Text>

          {/* USER PROFILE CARD */}
          <TouchableOpacity onPress={handleEditProfile} activeOpacity={0.9}>
            <LinearGradient
              colors={['#2F6B56', '#3D7A63', '#4A9B7F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCard}
            >
              <View style={styles.profileInfo}>
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={styles.avatar} 
                />
                <View>
                  <Text style={styles.userName}>{user.name || 'User'}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  {user.user_type && (
                    <View style={styles.userTypeBadge}>
                      <Text style={styles.userTypeText}>
                        {user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.editBadge}>
                <Ionicons name="pencil" size={14} color={Colors.primary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* DISPLAY & EXPERIENCE */}
          <Text style={styles.sectionTitle}>Display & Experience</Text>
          <View style={styles.settingsGroup}>
            <SettingItem 
              icon="moon-outline" 
              label="Dark Mode" 
              type="toggle" 
              value={darkMode} 
              onValueChange={handleDarkModeToggle} 
            />
            <SettingItem 
              icon="eye-outline" 
              label="High Contrast" 
              type="toggle" 
              value={highContrast} 
              onValueChange={handleHighContrastToggle} 
              isLast 
            />
          </View>

          {/* PRIVACY & SECURITY */}
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <View style={styles.settingsGroup}>
            <SettingItem 
              icon="notifications-outline" 
              label="Notifications" 
              type="toggle" 
              value={notifications} 
              onValueChange={handleNotificationsToggle} 
            />
            <SettingItem 
              icon="lock-closed-outline" 
              label="Privacy Policy" 
              type="link"
              onPress={handlePrivacyPolicy}
            />
            <SettingItem 
              icon="shield-checkmark-outline" 
              label="Account Security" 
              type="link"
              onPress={handleAccountSecurity}
              isLast 
            />
          </View>

          {/* OTHER */}
          <Text style={styles.sectionTitle}>Other</Text>
          <View style={styles.settingsGroup}>
            <SettingItem 
              icon="help-circle-outline" 
              label="Help & Support" 
              type="link"
              onPress={handleHelpSupport}
            />
            <SettingItem 
              icon="information-circle-outline" 
              label="About FocusFlow" 
              type="link"
              onPress={handleAbout}
              isLast 
            />
          </View>

          {/* SIGN OUT BUTTON */}
          <TouchableOpacity 
            style={styles.logoutBtn} 
            activeOpacity={0.8}
            onPress={handleSignOut}
            disabled={loading}
          >
            <Ionicons name="log-out" size={20} color="white" />
            <Text style={styles.logoutText}>
              {loading ? 'Signing Out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: Colors.textLight },
  errorText: { fontSize: 18, color: Colors.textLight, marginBottom: 20 },
  retryButton: { 
    backgroundColor: Colors.primary, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 12 
  },
  retryButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
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
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  userTypeBadge: { 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12, 
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  userTypeText: { fontSize: 11, fontWeight: '700', color: 'white', letterSpacing: 0.5 },
  editBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  settingsGroup: { 
    backgroundColor: 'rgba(255, 255, 255, 0.96)', 
    borderRadius: 24, 
    marginBottom: 25,
    borderWidth: 2, 
    borderColor: '#D1EAE2',
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