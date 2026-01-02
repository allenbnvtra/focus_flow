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
import Background, { Colors } from '../../../components/Background';
import { useTheme } from '../../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

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
  const { colors, isDarkMode } = useTheme();
  
  const getGradientColors = (): readonly [string, string, ...string[]] => {
    if (isDarkMode) {
      switch (gradientType) {
        case 'dark':
          return [colors.surface, colors.bubbleLight, colors.bubbleMedium] as const;
        case 'light':
          return [colors.bubbleLight, colors.bubbleMedium, colors.surface] as const;
        default:
          return [colors.surface, colors.surface] as const;
      }
    } else {
      switch (gradientType) {
        case 'dark':
          return ['#2F6B56', '#3D7A63', '#4A9B7F'] as const;
        case 'light':
          return ['#7DD3C0', '#9DD4BD', '#C5E8DC'] as const;
        default:
          return [colors.white, colors.white] as const;
      }
    }
  };

  const gradientColors = getGradientColors();
  const shadowColor = isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 
    gradientType === 'dark' ? '#2F6B56' : 
    gradientType === 'light' ? '#7DD3C0' : colors.primary;

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
          shadowOpacity: isDarkMode ? 0.4 : gradientType === 'dark' ? 0.35 : gradientType === 'light' ? 0.25 : 0.12,
          borderColor: isDarkMode ? colors.border : 'rgba(255, 255, 255, 0.3)',
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
  const { colors, isDarkMode } = useTheme();
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
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textLight }]}>Loading dashboard...</Text>
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
                colors={[colors.primary, colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoIcon}
              >
                <Ionicons name="flash" size={24} color={colors.white} />
              </LinearGradient>
              <Text style={[styles.logoText, { color: colors.primary }]}>FocusFlow</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/(tabs)/settings')}>
                <Ionicons name="settings-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={handleLogout}>
                <Ionicons name="exit-outline" size={22} color={colors.primary} />
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
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.greetingSection}>
            <Text style={[styles.userName, { color: colors.textDark }]}>{userName}!</Text>
            <Text style={[styles.greeting, { color: colors.textMedium }]}>Good {timeOfDay}</Text>
            <Text style={[styles.subGreeting, { color: colors.textLight }]}>Ready to focus today?</Text>
          </View>

          <View style={[styles.toggleContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.toggleButton, currentScreen === 'screen1' && { backgroundColor: colors.primary }]}
              onPress={() => setCurrentScreen('screen1')}
            >
              <View style={styles.toggleContent}>
                <Ionicons 
                  name="trophy-outline" 
                  size={20} 
                  color={currentScreen === 'screen1' ? colors.white : colors.textLight} 
                />
                <Text style={[styles.toggleText, { color: colors.textLight }, currentScreen === 'screen1' && { color: colors.white }]}>
                  Goals
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, currentScreen === 'screen2' && { backgroundColor: colors.primary }]}
              onPress={() => setCurrentScreen('screen2')}
            >
              <View style={styles.toggleContent}>
                <Ionicons 
                  name="trending-up-outline" 
                  size={20} 
                  color={currentScreen === 'screen2' ? colors.white : colors.textLight} 
                />
                <Text style={[styles.toggleText, { color: colors.textLight }, currentScreen === 'screen2' && { color: colors.white }]}>
                  Progress
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {currentScreen === 'screen1' && (
            <View style={styles.screenContainer}>
              <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Goals & Streak</Text>

              <DashboardCard 
                style={styles.cardSpacing}
                gradientType="dark"
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="star-outline" size={24} color={isDarkMode ? colors.textDark : '#FFFFFF'} />
                    <Text style={[styles.cardTitle, { color: isDarkMode ? colors.textDark : '#FFFFFF' }]}>
                      {stats.topTask ? 'Top Focus Goal' : 'Focus Goal of the Day'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/focus-tracker')}>
                    <Ionicons name="arrow-forward" size={20} color={isDarkMode ? colors.textDark : '#FFFFFF'} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.goalText, { color: isDarkMode ? colors.textMedium : '#FFFFFF' }]}>{focusGoal}</Text>
                {stats.topTask && (
                  <View style={styles.goalMetaBadge}>
                    <Ionicons name="time" size={14} color={isDarkMode ? colors.textDark : '#FFFFFF'} />
                    <Text style={[styles.goalMetaText, { color: isDarkMode ? colors.textDark : '#FFFFFF' }]}>
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
                    <Ionicons name="flame-outline" size={24} color={isDarkMode ? colors.textDark : '#FFFFFF'} />
                    <Text style={[styles.cardTitle, { color: isDarkMode ? colors.textDark : '#FFFFFF' }]}>Focus Streak</Text>
                  </View>
                </View>
                <View style={styles.fireContainer}>
                  {Array.from({ length: totalStreakDays }, (_, i) => (
                    <Text key={i} style={styles.fireEmoji}>
                      {i < focusStreak ? '🔥' : '🤍'}
                    </Text>
                  ))}
                </View>
                <Text style={[styles.streakDescription, { color: isDarkMode ? colors.textMedium : '#FFFFFF' }]}>
                  {focusStreak > 0 
                    ? `You've stayed focused ${focusStreak} day${focusStreak > 1 ? 's' : ''} in a row!`
                    : "Start a focus session to begin your streak!"
                  }
                </Text>
              </DashboardCard>

              <DashboardCard style={styles.cardSpacing}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="sparkles-outline" size={24} color={colors.textDark} />
                    <Text style={[styles.cardTitleDark, { color: colors.textDark }]}>Focus Summary</Text>
                  </View>
                </View>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.primary }]}>{stats.todayFocusSessions}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.textLight }]}>Sessions Today</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatFocusTime(stats.totalFocusTime)}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.textLight }]}>Total Focus Time</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.insightButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/(tabs)/dashboard/insight')}
                >
                  <Text style={[styles.insightButtonText, { color: colors.white }]}>View Detailed Insights</Text>
                </TouchableOpacity>
              </DashboardCard>
            </View>
          )}

          {currentScreen === 'screen2' && (
            <View style={styles.screenContainer}>
              <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Progress & Insights</Text>

              <DashboardCard 
                style={styles.cardSpacing}
                gradientType="light"
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="pie-chart-outline" size={24} color={isDarkMode ? colors.textDark : '#2F6B56'} />
                    <Text style={[styles.cardTitleGradient, { color: isDarkMode ? colors.textDark : '#2F6B56' }]}>Today's Progress</Text>
                  </View>
                </View>
                <Text style={[styles.progressPercent, { color: isDarkMode ? colors.textDark : '#2F6B56' }]}>{todayProgress}%</Text>
                <View style={[styles.progressBarContainer, { backgroundColor: isDarkMode ? colors.bubbleLight : 'rgba(255, 255, 255, 0.6)', borderColor: isDarkMode ? colors.primary : '#3D7A63' }]}>
                  <View style={[styles.progressBarFill, { width: `${todayProgress}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.progressText, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>
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
                    <Ionicons name="happy-outline" size={24} color={isDarkMode ? colors.textDark : '#2F6B56'} />
                    <Text style={[styles.cardTitleGradient, { color: isDarkMode ? colors.textDark : '#2F6B56' }]}>Mood Trend</Text>
                  </View>
                </View>
                <Text style={[styles.moodText, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>
                  {stats.recentMoods.length === 0 
                    ? "Start tracking your mood to see trends over time!"
                    : moodTrend === "improving"
                    ? "Your mood has been improving this week! Keep up the positive momentum."
                    : moodTrend === "declining"
                    ? "Your mood has been declining lately. Remember to take breaks and practice self-care."
                    : "Your mood has been stable this week. Keep maintaining your balance!"
                  }
                  {moodTrend !== "stable" && stats.recentMoods.length > 0 && (
                    <Text style={[styles.improvingText, { color: colors.primary }, moodTrend === "declining" && styles.decliningText]}>
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
                    <Ionicons name="heart-outline" size={24} color={isDarkMode ? colors.textDark : '#2F6B56'} />
                    <Text style={[styles.cardTitleGradient, { color: isDarkMode ? colors.textDark : '#2F6B56' }]}>Daily Affirmation</Text>
                  </View>
                  <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh-outline" size={20} color={isDarkMode ? colors.textDark : '#2F6B56'} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.affirmationTextGradient, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>"{dailyAffirmation}"</Text>
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
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
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
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
    marginBottom: 4,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 8,
  },
  subGreeting: {
    fontSize: 16,
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 4,
    gap: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  screenContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
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
  },
  cardTitleDark: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardTitleGradient: {
    fontSize: 18,
    fontWeight: '700',
  },
  goalText: {
    fontSize: 16,
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
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  insightButton: {
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