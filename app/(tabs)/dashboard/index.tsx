import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import Background from '../../../components/Background';

const { width } = Dimensions.get('window');

const Colors = {
  primary: '#4A9B7F',
  primaryLight: '#5DB89A',
  primaryDark: '#2F6B56',
  accent: '#7DD3C0',
  background: '#F5F5F5',
  cardDark1: '#2F6B56',
  cardDark2: '#3D7A63',
  cardDark3: '#4A9B7F',
  cardLight1: '#7DD3C0',
  cardLight2: '#9DD4BD',
  cardLight3: '#C5E8DC',
  textDark: '#1A3A32',
  textMedium: '#2D5249',
  textLight: '#5A7770',
  white: '#FFFFFF',
  lightGray: '#E8E8E8',
  glassHighlight: 'rgba(255, 255, 255, 0.4)',
};

interface DashboardCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gradientType?: 'dark' | 'light' | 'white';
}

const DashboardCard: React.FC<DashboardCardProps> = ({ children, style, gradientType = 'white' }) => {
  const getGradientColors = (): readonly [string, string, ...string[]] => {
    switch (gradientType) {
      case 'dark':
        return [Colors.cardDark1, Colors.cardDark2, Colors.cardDark3] as const;
      case 'light':
        return [Colors.cardLight1, Colors.cardLight2, Colors.cardLight3] as const;
      default:
        return [Colors.white, Colors.white] as const;
    }
  };

  const gradientColors = getGradientColors();
  const shadowColor = gradientType === 'dark' ? Colors.cardDark1 : gradientType === 'light' ? Colors.cardLight1 : Colors.primary;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={gradientType !== 'white' ? [0, 0.5, 1] : undefined}
      style={[
        styles.card,
        {
          shadowColor: shadowColor,
          shadowOpacity: gradientType === 'dark' ? 0.35 : gradientType === 'light' ? 0.25 : 0.12,
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
};

export default function Dashboard() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState('screen1');

  if (!isAuthenticated && !isLoading) {
    return <Redirect href="/auth/login" />;
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const userName = user?.name || "User";
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };
  const timeOfDay = getTimeOfDay();

  const focusGoal = "Complete one study session without phone distractions.";
  const focusStreak = 4;
  const totalStreakDays = 7;

  const todayProgress = 50;
  const completedTasks = 4;
  const totalTasks = 8;
  const moodTrend = "improving";
  const dailyAffirmation = "My mind can slow down — I am in control of my attention.";

  return (
    <Background>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoIcon}
              >
                <Ionicons name="flash" size={24} color={Colors.white} />
              </LinearGradient>
              <Text style={styles.logoText}>FocusFlow</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="settings-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
                <Ionicons name="exit-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.greetingSection}>
            <Text style={styles.userName}>{userName}!</Text>
            <Text style={styles.greeting}>Good {timeOfDay}</Text>
            <Text style={styles.subGreeting}>Ready to focus today?</Text>
          </View>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, currentScreen === 'screen1' && styles.toggleButtonActive]}
              onPress={() => setCurrentScreen('screen1')}
            >
              <View style={styles.toggleContent}>
                <Ionicons 
                  name="trophy-outline" 
                  size={20} 
                  color={currentScreen === 'screen1' ? Colors.white : Colors.textLight} 
                />
                <Text style={[styles.toggleText, currentScreen === 'screen1' && styles.toggleTextActive]}>
                  Goals
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, currentScreen === 'screen2' && styles.toggleButtonActive]}
              onPress={() => setCurrentScreen('screen2')}
            >
              <View style={styles.toggleContent}>
                <Ionicons 
                  name="trending-up-outline" 
                  size={20} 
                  color={currentScreen === 'screen2' ? Colors.white : Colors.textLight} 
                />
                <Text style={[styles.toggleText, currentScreen === 'screen2' && styles.toggleTextActive]}>
                  Progress
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {currentScreen === 'screen1' && (
            <View style={styles.screenContainer}>
              <Text style={styles.sectionTitle}>Goals & Streak</Text>

              <DashboardCard 
                style={styles.cardSpacing}
                gradientType="dark"
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="star-outline" size={24} color={Colors.white} />
                    <Text style={styles.cardTitle}>Focus Goal of the Day</Text>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="refresh-outline" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.goalText}>{focusGoal}</Text>
              </DashboardCard>

              <DashboardCard 
                style={styles.cardSpacing}
                gradientType="dark"
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="flame-outline" size={24} color={Colors.white} />
                    <Text style={styles.cardTitle}>Focus Streak</Text>
                  </View>
                </View>
                <View style={styles.fireContainer}>
                  {Array.from({ length: totalStreakDays }, (_, i) => (
                    <Text key={i} style={styles.fireEmoji}>
                      {i < focusStreak ? '🔥' : '🤍'}
                    </Text>
                  ))}
                </View>
                <Text style={styles.streakDescription}>
                  You've stayed focused {focusStreak} days in a row!
                </Text>
              </DashboardCard>

              <DashboardCard style={styles.cardSpacing}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="sparkles-outline" size={24} color={Colors.textDark} />
                    <Text style={styles.cardTitleDark}>AI Insights</Text>
                  </View>
                </View>
                <Text style={styles.insightText}>
                  See when your mind feels most focused and calm — <Text style={styles.italicText}>your flow, your rhythm</Text>
                </Text>
                <TouchableOpacity 
                  style={styles.insightButton}
                  onPress={() => router.push('/(tabs)/dashboard/insight')}
                >
                  <Text style={styles.insightButtonText}>View Insights</Text>
                </TouchableOpacity>
              </DashboardCard>
            </View>
          )}

          {currentScreen === 'screen2' && (
            <View style={styles.screenContainer}>
              <Text style={styles.sectionTitle}>Progress & Insights</Text>

              <DashboardCard 
                style={styles.cardSpacing}
                gradientType="light"
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="pie-chart-outline" size={24} color={Colors.cardDark1} />
                    <Text style={styles.cardTitleGradient}>Today's Progress</Text>
                  </View>
                </View>
                <Text style={styles.progressPercent}>{todayProgress}%</Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${todayProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  Great job! You've completed {completedTasks} of {totalTasks} tasks today.
                </Text>
              </DashboardCard>

              <DashboardCard 
                style={styles.cardSpacing}
                gradientType="light"
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="happy-outline" size={24} color={Colors.cardDark1} />
                    <Text style={styles.cardTitleGradient}>Mood Trend</Text>
                  </View>
                </View>
                <Text style={styles.moodText}>
                  Your mood has been <Text style={styles.improvingText}>{moodTrend}</Text> this week! Keep up the positive momentum.
                </Text>
              </DashboardCard>

              <DashboardCard 
                style={styles.cardSpacing}
                gradientType="light"
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="heart-outline" size={24} color={Colors.cardDark1} />
                    <Text style={styles.cardTitleGradient}>Daily Affirmation</Text>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="refresh-outline" size={20} color={Colors.cardDark1} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.affirmationTextGradient}>"{dailyAffirmation}"</Text>
              </DashboardCard>
            </View>
          )}
        </ScrollView>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'ios' ? 16 : 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 127, 0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  greetingSection: {
    padding: 20,
    paddingTop: 24,
  },
  userName: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textMedium,
    marginBottom: 8,
  },
  subGreeting: {
    fontSize: 16,
    color: Colors.textLight,
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 4,
    gap: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 127, 0.1)',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textLight,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  screenContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardSpacing: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  cardTitleDark: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textDark,
  },
  cardTitleGradient: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.cardDark1,
  },
  goalText: {
    fontSize: 16,
    color: Colors.white,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '400',
  },
  fireContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
  },
  fireEmoji: {
    fontSize: 32,
  },
  streakDescription: {
    fontSize: 15,
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  insightText: {
    fontSize: 15,
    color: Colors.textMedium,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '400',
  },
  italicText: {
    fontStyle: 'italic',
    fontWeight: '300',
  },
  insightButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'center',
  },
  insightButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  progressPercent: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.cardDark1,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -1,
  },
  progressBarContainer: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.cardDark2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.cardDark2,
    borderRadius: 8,
  },
  progressText: {
    fontSize: 15,
    color: Colors.cardDark1,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  moodText: {
    fontSize: 16,
    color: Colors.cardDark1,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '400',
  },
  improvingText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  affirmationTextGradient: {
    fontSize: 17,
    color: Colors.cardDark1,
    lineHeight: 26,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '400',
  },
});