import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
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

interface Task {
  id: string;
  text: string;
  completed: boolean;
  focus_time: number;
  completion_count: number;
}

interface FocusSession {
  id: string;
  duration_minutes: number;
  started_at: string;
  completed_at: string;
}

interface DailyMood {
  mood_value: number;
  mood_date: string;
  notes: string | null;
}

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  totalFocusTime: number;
  todayFocusSessions: number;
  currentStreak: number;
  recentMoods: DailyMood[];
  topTask: Task | null;
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    incompleteTasks: 0,
    totalFocusTime: 0,
    todayFocusSessions: 0,
    currentStreak: 0,
    recentMoods: [],
    topTask: null,
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id);

      if (tasksError) throw tasksError;

      // Fetch focus sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('completed_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Fetch recent moods (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: moods, error: moodsError } = await supabase
        .from('daily_moods')
        .select('*')
        .eq('user_id', user?.id)
        .gte('mood_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('mood_date', { ascending: false });

      if (moodsError) throw moodsError;

      // Calculate stats
      const completedTasks = tasks?.filter((t) => t.completed).length || 0;
      const incompleteTasks = tasks?.filter((t) => !t.completed).length || 0;
      const totalFocusTime = tasks?.reduce((sum, t) => sum + (t.focus_time || 0), 0) || 0;

      // Count today's focus sessions
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = sessions?.filter((s) => 
        s.completed_at?.startsWith(today)
      ).length || 0;

      // Calculate current streak (consecutive days with focus sessions)
      const streak = calculateStreak(sessions || []);

      // Find task with most focus time
      const topTask = tasks && tasks.length > 0
        ? tasks.reduce((max, task) => 
            (task.focus_time || 0) > (max.focus_time || 0) ? task : max
          )
        : null;

      setStats({
        totalTasks: tasks?.length || 0,
        completedTasks,
        incompleteTasks,
        totalFocusTime,
        todayFocusSessions: todaySessions,
        currentStreak: streak,
        recentMoods: moods || [],
        topTask: (topTask?.focus_time || 0) > 0 ? topTask : null,
      });
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStreak = (sessions: FocusSession[]): number => {
    if (!sessions || sessions.length === 0) return 0;

    const uniqueDates = [...new Set(
      sessions.map((s) => s.completed_at?.split('T')[0])
    )].sort().reverse();

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueDates.length; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateStr = checkDate.toISOString().split('T')[0];

      if (uniqueDates.includes(checkDateStr)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

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

  const focusGoal = stats.topTask?.text || user?.goals?.[0] || "Complete one study session without phone distractions.";
  const focusStreak = stats.currentStreak;
  const totalStreakDays = 7;

  const todayProgress = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;
  const completedTasks = stats.completedTasks;
  const totalTasks = stats.totalTasks;

  // Calculate mood trend
  const getMoodTrend = () => {
    if (stats.recentMoods.length < 2) return "stable";
    
    const recent = stats.recentMoods.slice(0, 3);
    const older = stats.recentMoods.slice(3, 6);
    
    if (recent.length === 0 || older.length === 0) return "stable";
    
    const recentAvg = recent.reduce((sum, m) => sum + m.mood_value, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.mood_value, 0) / older.length;
    
    // Lower mood_value is better (1 = Great, 5 = Stressed)
    if (recentAvg < olderAvg - 0.5) return "improving";
    if (recentAvg > olderAvg + 0.5) return "declining";
    return "stable";
  };

  const moodTrend = getMoodTrend();

  const affirmations = [
    "My mind can slow down — I am in control of my attention.",
    "I choose focus over distraction, one moment at a time.",
    "Every small step forward is progress worth celebrating.",
    "I am capable of deep, meaningful work.",
    "My concentration grows stronger with practice.",
  ];
  const dailyAffirmation = affirmations[new Date().getDate() % affirmations.length];

  const formatFocusTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading && !refreshing) {
    return (
      <Background>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </Background>
    );
  }

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
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/settings')}>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
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
                    <Text style={styles.cardTitle}>
                      {stats.topTask ? 'Top Focus Goal' : 'Focus Goal of the Day'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/focus-tracker')}>
                    <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.goalText}>{focusGoal}</Text>
                {stats.topTask && (
                  <View style={styles.goalMetaBadge}>
                    <Ionicons name="time" size={14} color={Colors.white} />
                    <Text style={styles.goalMetaText}>
                      {formatFocusTime(stats.topTask.focus_time)} focused
                    </Text>
                  </View>
                )}
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
                  {focusStreak > 0 
                    ? `You've stayed focused ${focusStreak} day${focusStreak > 1 ? 's' : ''} in a row!`
                    : "Start a focus session to begin your streak!"
                  }
                </Text>
              </DashboardCard>

              <DashboardCard style={styles.cardSpacing}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="sparkles-outline" size={24} color={Colors.textDark} />
                    <Text style={styles.cardTitleDark}>Focus Summary</Text>
                  </View>
                </View>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{stats.todayFocusSessions}</Text>
                    <Text style={styles.summaryLabel}>Sessions Today</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{formatFocusTime(stats.totalFocusTime)}</Text>
                    <Text style={styles.summaryLabel}>Total Focus Time</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.insightButton}
                  onPress={() => router.push('/(tabs)/dashboard/insight')}
                >
                  <Text style={styles.insightButtonText}>View Detailed Insights</Text>
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
                  {totalTasks === 0 
                    ? "No tasks yet. Add tasks to track your progress!"
                    : completedTasks === totalTasks
                    ? `Amazing! You've completed all ${totalTasks} tasks!`
                    : `Great job! You've completed ${completedTasks} of ${totalTasks} tasks today.`
                  }
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
                  {stats.recentMoods.length === 0 
                    ? "Start tracking your mood to see trends over time!"
                    : moodTrend === "improving"
                    ? "Your mood has been improving this week! Keep up the positive momentum."
                    : moodTrend === "declining"
                    ? "Your mood has been declining lately. Remember to take breaks and practice self-care."
                    : "Your mood has been stable this week. Keep maintaining your balance!"
                  }
                  {moodTrend !== "stable" && stats.recentMoods.length > 0 && (
                    <Text style={[styles.improvingText, moodTrend === "declining" && styles.decliningText]}>
                      {' '}{moodTrend}
                    </Text>
                  )}
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
                  <TouchableOpacity onPress={onRefresh}>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textLight,
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
  goalMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: 12,
  },
  goalMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
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
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
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
  decliningText: {
    fontWeight: '700',
    color: '#FF6B6B',
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