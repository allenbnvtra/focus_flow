// File: app/auth/onboarding/goals.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';

const FOCUS_GOALS = [
  'Improve my focus',
  'Manage my time better',
  'Build mindfulness habits',
  'Regulate my emotions',
  'Organize my studies or tasks'
];

const GoalsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Get data from previous screens
  const { email, password, userType, name } = params as { 
    email: string; 
    password: string; 
    userType: string;
    name: string;
  };

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter(g => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const handleContinue = () => {
    if (selectedGoals.length === 0) {
      Alert.alert('Select Goals', 'Please choose at least one goal to continue');
      return;
    }

    router.push({
      pathname: '/auth/onboarding/frequency',
      params: { 
        email, 
        password, 
        userType,
        name,
        goals: JSON.stringify(selectedGoals)
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
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>What do you want{'\n'}to focus on most?</Text>

          <View style={styles.goalsContainer}>
            {FOCUS_GOALS.map((goal, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.goalOption,
                  selectedGoals.includes(goal) && styles.goalOptionSelected
                ]}
                onPress={() => toggleGoal(goal)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.goalText,
                  selectedGoals.includes(goal) && styles.goalTextSelected
                ]}>
                  {goal}
                </Text>
                {selectedGoals.includes(goal) && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={24} color="#6B8E8F" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.helperText}>
            Choose one or more goals that fit you right{'\n'}now. You can always change these later.
          </Text>

          <TouchableOpacity 
            style={[styles.continueButton, selectedGoals.length === 0 && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={selectedGoals.length === 0}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back-circle" size={56} color="#8FB5B6" />
        </TouchableOpacity>

        <View style={[styles.circle, styles.circleBottomLeft]} />
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 60,
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
  goalsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 30,
  },
  goalOption: {
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
  goalOptionSelected: {
    backgroundColor: '#C5DCDC',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  goalText: {
    fontSize: 16,
    color: '#A0B8B9',
    fontWeight: '500',
    textAlign: 'center',
  },
  goalTextSelected: {
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
  circleBottomLeft: {
    width: 280,
    height: 280,
    bottom: -100,
    left: -120,
  },
});

export default GoalsScreen;