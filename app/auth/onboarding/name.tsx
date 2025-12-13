// File: app/auth/onboarding/name.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';

const NameScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [name, setName] = useState('');

  // Get data from previous screen
  const { email, password, userType } = params as { 
    email: string; 
    password: string; 
    userType: string;
  };

  const handleContinue = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name or nickname');
      return;
    }

    router.push({
      pathname: '/auth/onboarding/goals',
      params: { 
        email, 
        password, 
        userType,
        name: name.trim()
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
          <Text style={styles.title}>What should we{'\n'}call you?</Text>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Enter your name or nickname"
              placeholderTextColor="#B8D0D1"
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>

          <Text style={styles.helperText}>
            We'll use this to personalize{'\n'}your daily greetings.
          </Text>

          <TouchableOpacity 
            style={[styles.continueButton, !name.trim() && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!name.trim()}
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

        <View style={[styles.circle, styles.circleBottomLeft]} />
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
  inputWrapper: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 18,
    marginBottom: 20,
    shadowColor: '#8FB5B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    fontSize: 16,
    color: '#6B8E8F',
    textAlign: 'center',
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
});

export default NameScreen;