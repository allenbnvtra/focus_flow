// File: app/auth/onboarding/complete.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';
import { useAuth } from '../../../contexts/AuthContext';

const CompleteScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signup, updateUserProfile, isLoading } = useAuth();
  
  const [isPressed, setIsPressed] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  // Get all onboarding data
  const { email, password, userType, name, goals, frequency } = params as { 
    email: string; 
    password: string; 
    userType: string;
    name: string;
    goals: string;
    frequency: string;
  };

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = async () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    setIsPressed(false);

    // Complete the signup process
    try {
      // Parse goals if it's a JSON string
      const parsedGoals = typeof goals === 'string' ? JSON.parse(goals) : goals;
      
      // Step 1: Create account with Supabase Auth
      console.log('📝 Creating user account...');
      await signup(email, password, name);

      // Step 2: Update user profile with onboarding data
      console.log('📝 Updating user profile with onboarding data...');
      await updateUserProfile({
        user_type: userType as 'individual' | 'parent' | 'guest',
        goals: parsedGoals,
        check_in_frequency: frequency,
      });

      console.log('✅ Signup completed successfully!');

      // Navigate to dashboard
      router.replace('/dashboard');
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      Alert.alert(
        'Signup Failed', 
        error.message || 'Failed to complete signup. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <Background>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="happy-outline" size={24} color="#8FB5B6" />
          <Text style={styles.logoText}>FocusFlow</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>
            You're all set,{'\n'}{name}! <Text style={styles.star}>✨</Text>
          </Text>

          <Text style={styles.subtitle}>
            We've set up your dashboard to{'\n'}match your flow. Take a deep{'\n'}breath — <Text style={styles.bold}>you're ready to begin</Text>.
          </Text>

          {/* Hold Button */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={styles.holdButton}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={1}
              disabled={isLoading}
            >
              <View style={[styles.holdButtonInner, isPressed && styles.holdButtonInnerPressed]}>
                <Text style={styles.holdButtonText}>
                  {isLoading ? 'Creating account...' : `Hold here to${'\n'}continue`}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footerText}>
            Every calm moment counts,{'\n'}let's flow forward together.
          </Text>
        </View>

        {/* Decorative circles */}
        <View style={[styles.circle, styles.circleBottomLeft]} />
        <View style={[styles.circle, styles.circleBottomRight]} />
        <View style={[styles.circle, styles.circleCenter]} />
      </View>
    </Background>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8FB5B6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 120,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: '#8FB5B6',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
  },
  star: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0B8B9',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 60,
  },
  bold: {
    fontWeight: '700',
    color: '#8FB5B6',
  },
  holdButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
  },
  holdButtonInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(143, 181, 182, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(143, 181, 182, 0.3)',
  },
  holdButtonInnerPressed: {
    backgroundColor: 'rgba(143, 181, 182, 0.3)',
    borderColor: 'rgba(143, 181, 182, 0.5)',
  },
  holdButtonText: {
    fontSize: 16,
    color: '#8FB5B6',
    textAlign: 'center',
    lineHeight: 24,
  },
  footerText: {
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(197, 220, 220, 0.3)',
    borderRadius: 1000,
  },
  circleBottomLeft: {
    width: 280,
    height: 280,
    bottom: -100,
    left: -120,
  },
  circleBottomRight: {
    width: 220,
    height: 220,
    bottom: 100,
    right: -100,
  },
  circleCenter: {
    width: 300,
    height: 300,
    top: '45%',
    left: '50%',
    marginLeft: -150,
    marginTop: -150,
    opacity: 0.2,
  },
});

export default CompleteScreen;