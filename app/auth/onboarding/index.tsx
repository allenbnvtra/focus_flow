// File: app/auth/user-type/index.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';

const { width } = Dimensions.get('window');

type UserType = 'individual' | 'parent' | 'guest' | null;

interface UserTypeOption {
  type: UserType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const userTypes: UserTypeOption[] = [
  {
    type: 'individual',
    title: 'INDIVIDUAL',
    description: 'I want to improve my focus and routines.',
    icon: 'person-circle',
  },
  {
    type: 'parent',
    title: 'PARENT',
    description: 'I want to help my child build focus.',
    icon: 'people-circle',
  },
  {
    type: 'guest',
    title: 'GUEST',
    description: 'I want to explore first.',
    icon: 'eye',
  },
];

const UserTypeForm = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedType, setSelectedType] = useState<UserType>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Get signup data from params
  const { name, email, password } = params as { 
    name: string; 
    email: string; 
    password: string 
  };

  const handleNext = () => {
    if (currentIndex < userTypes.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleContinue = () => {
    if (selectedType) {
      // Navigate to the onboarding flow starting with name screen
      router.push({
        pathname: '/auth/onboarding/name',
        params: { 
          email, 
          password,
          userType: selectedType
        }
      });
    }
  };

  const currentUserType = userTypes[currentIndex];
  const isSelected = selectedType === currentUserType.type;

  return (
    <Background>
      <View style={styles.container}>
        {/* Title */}
        <Text style={styles.title}>Who's using{'\n'}FocusFlow today?</Text>

        {/* Card Container */}
        <View style={styles.cardWrapper}>
          {/* Navigation Arrows */}
          {currentIndex > 0 && (
            <TouchableOpacity 
              style={[styles.navButton, styles.navButtonLeft]}
              onPress={handlePrevious}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}

          {currentIndex < userTypes.length - 1 && (
            <TouchableOpacity 
              style={[styles.navButton, styles.navButtonRight]}
              onPress={handleNext}
            >
              <Ionicons name="arrow-forward" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}

          {/* Card */}
          <TouchableOpacity 
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => setSelectedType(currentUserType.type)}
            activeOpacity={0.9}
          >
            <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
              <Ionicons 
                name={currentUserType.icon} 
                size={80} 
                color={isSelected ? Colors.primary : '#6B8E8F'} 
              />
            </View>

            <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
              {currentUserType.title}
            </Text>

            <Text style={[styles.cardDescription, isSelected && styles.cardDescriptionSelected]}>
              {currentUserType.description}
            </Text>

            {/* Selection Indicator */}
            {isSelected && (
              <View style={styles.checkmark}>
                <Ionicons name="checkmark-circle" size={32} color={Colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {userTypes.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Buttons Container */}
        <View style={styles.buttonsContainer}>
          {/* Back to Signup Button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back to Signup</Text>
          </TouchableOpacity>

          {/* Continue Button */}
          <TouchableOpacity 
            style={[styles.continueButton, !selectedType && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!selectedType}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Background>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#8FB5B6',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 40,
  },
  cardWrapper: {
    width: width - 80,
    aspectRatio: 0.75,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  navButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8FB5B6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  navButtonLeft: {
    left: -25,
  },
  navButtonRight: {
    right: -25,
  },
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8F2F2',
    borderRadius: 24,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardSelected: {
    backgroundColor: '#D4E8E8',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#C5DCDC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainerSelected: {
    backgroundColor: '#B8D8D8',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6B8E8F',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardTitleSelected: {
    color: Colors.primary,
  },
  cardDescription: {
    fontSize: 15,
    color: '#8FA5A6',
    textAlign: 'center',
    lineHeight: 22,
  },
  cardDescriptionSelected: {
    color: '#6B8E8F',
  },
  checkmark: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C5DCDC',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#8FB5B6',
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: '#8FB5B6',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  continueButtonDisabled: {
    backgroundColor: '#C5DCDC',
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
});

export default UserTypeForm;