// File: app/auth/onboarding/frequency.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';

const CHECK_IN_FREQUENCIES = [
  'Once a day',
  'Twice a day',
  'Only when I open the app'
];

const FrequencyScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedFrequency, setSelectedFrequency] = useState<string>('');

  // Get data from previous screens
  const { email, password, userType, name, goals } = params as { 
    email: string; 
    password: string; 
    userType: string;
    name: string;
    goals: string;
  };

  const handleContinue = () => {
    if (!selectedFrequency) {
      Alert.alert('Select Frequency', 'Please choose a check-in frequency');
      return;
    }

    router.push({
      pathname: '/auth/onboarding/complete',
      params: { 
        email, 
        password, 
        userType,
        name,
        goals,
        frequency: selectedFrequency
      }
    });
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
            How often would you{'\n'}like FocusFlow to{'\n'}check in with you?
          </Text>

          <View style={styles.frequencyContainer}>
            {CHECK_IN_FREQUENCIES.map((frequency, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.frequencyOption,
                  selectedFrequency === frequency && styles.frequencyOptionSelected
                ]}
                onPress={() => setSelectedFrequency(frequency)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.frequencyText,
                  selectedFrequency === frequency && styles.frequencyTextSelected
                ]}>
                  {frequency}
                </Text>
                {selectedFrequency === frequency && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={24} color="#6B8E8F" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.helperText}>
            We'll use this to set gentle reminders and{'\n'}reflection prompts — nothing overwhelming.
          </Text>

          <TouchableOpacity 
            style={[styles.continueButton, !selectedFrequency && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!selectedFrequency}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>

        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back-circle" size={56} color="#8FB5B6" />
        </TouchableOpacity>

        <View style={[styles.circle, styles.circleBottomRight]} />
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
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: '#8FB5B6',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 40,
  },
  frequencyContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 30,
  },
  frequencyOption: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#8FB5B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  frequencyOptionSelected: {
    backgroundColor: '#C5DCDC',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  frequencyText: {
    fontSize: 16,
    color: '#A0B8B9',
    fontWeight: '500',
    textAlign: 'center',
  },
  frequencyTextSelected: {
    color: '#6B8E8F',
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    right: 20,
    top: '70%',
  },
  helperText: {
    fontSize: 14,
    color: '#B8D0D1',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#8FB5B6',
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 25,
    shadowColor: '#8FB5B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#D4E8E8',
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButton: {
    position: 'absolute',
    bottom: 40,
    right: 24,
  },
  // Decorative circles
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(197, 220, 220, 0.3)',
    borderRadius: 1000,
  },
  circleTopLeft: {
    width: 250,
    height: 250,
    top: -80,
    left: -100,
  },
  circleTopRight: {
    width: 200,
    height: 200,
    top: 80,
    right: -80,
  },
  circleBottomRight: {
    width: 220,
    height: 220,
    bottom: 100,
    right: -100,
  },
});

export default FrequencyScreen;