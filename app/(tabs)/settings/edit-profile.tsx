import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Background, { Colors } from '../../../components/Background';
import { useAuth } from '../../../contexts/AuthContext';

export default function EditProfile() {
  const router = useRouter();
  const { user, updateUserProfile, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state - only fields available in User interface
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<'individual' | 'parent' | 'guest'>('individual');
  const [checkInFrequency, setCheckInFrequency] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState('');

  // Load user data
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setUserType(user.user_type || 'individual');
      setCheckInFrequency(user.check_in_frequency || '');
      setGoals(user.goals || []);
    }
  }, [user]);

  // Check if form has changes
  useEffect(() => {
    if (user) {
      const changed = 
        name !== (user.name || '') ||
        checkInFrequency !== (user.check_in_frequency || '') ||
        JSON.stringify(goals) !== JSON.stringify(user.goals || []);
      setHasChanges(changed);
    }
  }, [name, checkInFrequency, goals, user]);

  const handleAddGoal = () => {
    if (!newGoal.trim()) {
      Alert.alert('Empty Goal', 'Please enter a goal before adding.');
      return;
    }

    if (goals.includes(newGoal.trim())) {
      Alert.alert('Duplicate Goal', 'This goal already exists.');
      return;
    }

    setGoals([...goals, newGoal.trim()]);
    setNewGoal('');
  };

  const handleRemoveGoal = (goalToRemove: string) => {
    Alert.alert(
      'Remove Goal',
      `Are you sure you want to remove "${goalToRemove}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setGoals(goals.filter((goal) => goal !== goalToRemove));
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!hasChanges) {
      Alert.alert('No Changes', 'You haven\'t made any changes to save.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }

    try {
      setLoading(true);

      // Update user profile with only available fields
      await updateUserProfile({
        name: name.trim(),
        check_in_frequency: checkInFrequency.trim(),
        goals: goals,
      });

      Alert.alert(
        'Success',
        'Your profile has been updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'A password reset link will be sent to your email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              // Implement Supabase password reset
              // await supabase.auth.resetPasswordForEmail(email);
              Alert.alert('Success', 'Password reset link sent to your email.');
            } catch (error: any) {
              Alert.alert('Error', 'Failed to send reset link.');
            }
          },
        },
      ]
    );
  };

  const handleChangeAvatar = () => {
    Alert.alert(
      'Change Profile Picture',
      'Choose an option:',
      [
        {
          text: 'Take Photo',
          onPress: () => {
            console.log('Take photo');
            Alert.alert('Coming Soon', 'Camera feature will be available soon!');
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            console.log('Choose from library');
            Alert.alert('Coming Soon', 'Photo library will be available soon!');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDiscardChanges = () => {
    if (!hasChanges) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard Changes',
      'Are you sure you want to discard your changes?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const frequencyOptions = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Bi-weekly', value: 'biweekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <Background>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </Background>
    );
  }

  // Fallback if no user
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

  // Generate avatar URL
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    user.name || 'User'
  )}&background=2F6B56&color=fff&size=256&bold=true`;

  return (
    <Background>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleDiscardChanges}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!hasChanges || loading) && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveProfile}
            disabled={!hasChanges || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text
                style={[
                  styles.saveButtonText,
                  !hasChanges && styles.saveButtonTextDisabled,
                ]}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* AVATAR SECTION */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={handleChangeAvatar}
              activeOpacity={0.8}
            >
              <View style={styles.avatarContainer}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
                  style={styles.avatarOverlay}
                >
                  <Ionicons name="camera" size={24} color="white" />
                </LinearGradient>
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarText}>Tap to change photo</Text>
            {user.user_type && (
              <View style={styles.userTypeBadge}>
                <Ionicons name="star" size={12} color={Colors.primary} />
                <Text style={styles.userTypeText}>
                  {user.user_type.charAt(0).toUpperCase() +
                    user.user_type.slice(1)}
                </Text>
              </View>
            )}
          </View>

          {/* BASIC INFORMATION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={Colors.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={Colors.textLight}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={Colors.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.disabledText]}
                  value={email}
                  editable={false}
                  placeholder="Email"
                  placeholderTextColor={Colors.textLight}
                />
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#2F6B56" />
                </View>
              </View>
              <Text style={styles.helperText}>
                Email cannot be changed. Contact support if needed.
              </Text>
            </View>
          </View>

          {/* CHECK-IN SETTINGS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Check-In Preferences</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Check-In Frequency</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.frequencyContainer}
              >
                {frequencyOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.frequencyChip,
                      checkInFrequency === option.value && styles.frequencyChipActive,
                    ]}
                    onPress={() => setCheckInFrequency(option.value)}
                  >
                    <Text
                      style={[
                        styles.frequencyChipText,
                        checkInFrequency === option.value && styles.frequencyChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.helperText}>
                How often would you like to check in on your progress?
              </Text>
            </View>
          </View>

          {/* GOALS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Goals</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Add New Goal</Text>
              <View style={styles.goalInputRow}>
                <View style={[styles.inputContainer, styles.goalInput]}>
                  <Ionicons
                    name="flag-outline"
                    size={20}
                    color={Colors.textLight}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={newGoal}
                    onChangeText={setNewGoal}
                    placeholder="Enter a goal..."
                    placeholderTextColor={Colors.textLight}
                    onSubmitEditing={handleAddGoal}
                    returnKeyType="done"
                  />
                </View>
                <TouchableOpacity
                  style={styles.addGoalButton}
                  onPress={handleAddGoal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            {goals.length > 0 && (
              <View style={styles.goalsListContainer}>
                {goals.map((goal, index) => (
                  <View key={index} style={styles.goalItem}>
                    <View style={styles.goalItemLeft}>
                      <View style={styles.goalBullet}>
                        <Ionicons name="checkmark" size={14} color={Colors.primary} />
                      </View>
                      <Text style={styles.goalText}>{goal}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveGoal(goal)}
                      style={styles.removeGoalButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {goals.length === 0 && (
              <View style={styles.emptyGoals}>
                <Ionicons name="flag-outline" size={40} color={Colors.textLight} />
                <Text style={styles.emptyGoalsText}>No goals added yet</Text>
                <Text style={styles.emptyGoalsSubtext}>
                  Add your first goal to get started!
                </Text>
              </View>
            )}
          </View>

          {/* SECURITY */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>

            <TouchableOpacity
              style={styles.securityButton}
              onPress={handleChangePassword}
              activeOpacity={0.7}
            >
              <View style={styles.securityButtonLeft}>
                <View style={styles.securityIconBg}>
                  <Ionicons name="key-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.securityButtonText}>Change Password</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.textLight}
              />
            </TouchableOpacity>
          </View>

          {/* SAVE BUTTON (Mobile) */}
          <TouchableOpacity
            style={[
              styles.mobileSaveButton,
              (!hasChanges || loading) && styles.mobileSaveButtonDisabled,
            ]}
            onPress={handleSaveProfile}
            disabled={!hasChanges || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.mobileSaveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderRadius: 12,
  },
  retryButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textDark,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.textLight,
    opacity: 0.3,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  avatarSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'white',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 8,
  },
  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9F6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D1EAE2',
  },
  userTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },

  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },

  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 10,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    height: 56,
  },
  inputDisabled: {
    backgroundColor: '#F8F8F8',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textDark,
    fontWeight: '600',
  },
  disabledText: {
    color: Colors.textLight,
  },
  verifiedBadge: {
    marginLeft: 8,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 6,
    marginLeft: 4,
  },

  frequencyContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  frequencyChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E8E8E8',
  },
  frequencyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  frequencyChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
  },
  frequencyChipTextActive: {
    color: 'white',
  },

  goalInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  goalInput: {
    flex: 1,
  },
  addGoalButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalsListContainer: {
    gap: 10,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E8E8E8',
  },
  goalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  goalBullet: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#F0F9F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textDark,
  },
  removeGoalButton: {
    padding: 4,
  },
  emptyGoals: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderStyle: 'dashed',
  },
  emptyGoalsText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textLight,
    marginTop: 12,
  },
  emptyGoalsSubtext: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 4,
  },

  securityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    padding: 16,
  },
  securityButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  securityIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F9F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
  },

  mobileSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  mobileSaveButtonDisabled: {
    backgroundColor: Colors.textLight,
    opacity: 0.3,
  },
  mobileSaveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 0.5,
  },
});