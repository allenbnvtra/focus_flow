import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import Background from '../../../components/Background';

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
  pink: '#E8A5A5',
  pinkLight: '#F5C5C5',
  blue: '#A5C7E8',
  blueLight: '#C5DDEF',
  green: '#7DD3C0',
  greenLight: '#9DD4BD',
  purple: '#B8A5E8',
  purpleLight: '#D5C5F5',
  orange: '#E8C5A5',
  orangeLight: '#F5DFC5',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Insight {
  icon: IconName;
  iconBg: string;
  iconBgLight: string;
  title: string;
  subtitle: string;
  description: string;
}

interface FocusSession {
  id: string;
  duration_minutes: number;
  started_at: string;
  completed_at: string;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  focus_time: number;
  completion_count: number;
}

interface DailyMood {
  mood_value: number;
  mood_date: string;
  notes: string | null;
}

export default function AIInsights() {
  const router = useRouter();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [proTip, setProTip] = useState('');

  useEffect(() => {
    if (user) {
      generateInsights();
    }
  }, [user]);

  const generateInsights = async () => {
    try {
      setLoading(true);

      // Fetch focus sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;

      // Fetch tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id);

      if (tasksError) throw tasksError;

      // Fetch moods (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: moods, error: moodsError } = await supabase
        .from('daily_moods')
        .select('*')
        .eq('user_id', user?.id)
        .gte('mood_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('mood_date', { ascending: false });

      if (moodsError) throw moodsError;

      // Generate insights from data
      const generatedInsights = generateInsightsFromData(
        sessions || [],
        tasks || [],
        moods || []
      );

      setInsights(generatedInsights);
      setProTip(getRandomProTip());
    } catch (error: any) {
      console.error('Error generating insights:', error);
      Alert.alert('Error', 'Failed to load insights');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const generateInsightsFromData = (
    sessions: FocusSession[],
    tasks: Task[],
    moods: DailyMood[]
  ): Insight[] => {
    const generatedInsights: Insight[] = [];

    // Insight 1: Peak productivity time
    if (sessions.length > 0) {
      const hourCounts: { [key: number]: number } = {};
      sessions.forEach((session) => {
        const hour = new Date(session.started_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const peakHour = Object.entries(hourCounts).reduce((a, b) =>
        a[1] > b[1] ? a : b
      )[0];

      const peakHourNum = parseInt(peakHour);
      const endHour = peakHourNum + 2;
      const formatHour = (h: number) => {
        if (h === 0) return '12 AM';
        if (h === 12) return '12 PM';
        if (h < 12) return `${h} AM`;
        return `${h - 12} PM`;
      };

      generatedInsights.push({
        icon: 'time-outline',
        iconBg: Colors.green,
        iconBgLight: Colors.greenLight,
        title: 'You focus best between',
        subtitle: `${formatHour(peakHourNum)}–${formatHour(endHour)}`,
        description: `You've completed ${sessions.length} focus sessions, with ${hourCounts[peakHourNum]} during your peak hours`,
      });
    } else {
      generatedInsights.push({
        icon: 'time-outline',
        iconBg: Colors.green,
        iconBgLight: Colors.greenLight,
        title: 'Discover your peak time',
        subtitle: 'Start tracking',
        description: 'Complete focus sessions to discover when you work best',
      });
    }

    // Insight 2: Task completion patterns
    if (tasks.length > 0) {
      const completedTasks = tasks.filter((t) => t.completed).length;
      const completionRate = Math.round((completedTasks / tasks.length) * 100);

      const topTask = tasks.reduce((max, task) =>
        (task.focus_time || 0) > (max.focus_time || 0) ? task : max
      );

      if (topTask.focus_time > 0) {
        const hours = Math.floor(topTask.focus_time / 60);
        const mins = topTask.focus_time % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        generatedInsights.push({
          icon: 'trophy-outline',
          iconBg: Colors.orange,
          iconBgLight: Colors.orangeLight,
          title: 'Your top focus task',
          subtitle: topTask.text.slice(0, 30) + (topTask.text.length > 30 ? '...' : ''),
          description: `${timeStr} of focused work with ${completionRate}% overall completion rate`,
        });
      } else {
        generatedInsights.push({
          icon: 'checkmark-circle-outline',
          iconBg: Colors.orange,
          iconBgLight: Colors.orangeLight,
          title: 'Task completion rate',
          subtitle: `${completionRate}%`,
          description: `You've completed ${completedTasks} of ${tasks.length} tasks`,
        });
      }
    } else {
      generatedInsights.push({
        icon: 'list-outline',
        iconBg: Colors.orange,
        iconBgLight: Colors.orangeLight,
        title: 'Build your task list',
        subtitle: 'Get started',
        description: 'Add tasks to track your productivity patterns',
      });
    }

    // Insight 3: Mood and productivity correlation
    if (moods.length > 0) {
      const avgMood =
        moods.reduce((sum, m) => sum + m.mood_value, 0) / moods.length;
      const moodLabel =
        avgMood <= 1.5
          ? 'Excellent'
          : avgMood <= 2.5
          ? 'Good'
          : avgMood <= 3.5
          ? 'Stable'
          : avgMood <= 4.5
          ? 'Challenging'
          : 'Stressed';

      const daysTracked = moods.length;
      const recentMoods = moods.slice(0, 7);
      const recentAvg =
        recentMoods.reduce((sum, m) => sum + m.mood_value, 0) /
        recentMoods.length;

      const trend =
        recentAvg < avgMood - 0.3
          ? 'improving'
          : recentAvg > avgMood + 0.3
          ? 'needs attention'
          : 'stable';

      generatedInsights.push({
        icon: 'heart-outline',
        iconBg: Colors.pink,
        iconBgLight: Colors.pinkLight,
        title: 'Your emotional wellbeing',
        subtitle: `${moodLabel} (${trend})`,
        description: `Tracked for ${daysTracked} days. Consistent mood tracking improves self-awareness by 45%`,
      });
    } else {
      generatedInsights.push({
        icon: 'heart-outline',
        iconBg: Colors.pink,
        iconBgLight: Colors.pinkLight,
        title: 'Track your mood daily',
        subtitle: 'Build awareness',
        description: 'Daily mood tracking helps identify patterns and improve emotional regulation',
      });
    }

    // Insight 4: Focus session patterns
    if (sessions.length >= 3) {
      const totalMinutes = sessions.reduce(
        (sum, s) => sum + s.duration_minutes,
        0
      );
      const avgDuration = Math.round(totalMinutes / sessions.length);

      const sessionDates = [
        ...new Set(sessions.map((s) => s.completed_at.split('T')[0])),
      ];
      const daysActive = sessionDates.length;

      generatedInsights.push({
        icon: 'flame-outline',
        iconBg: Colors.purple,
        iconBgLight: Colors.purpleLight,
        title: 'Focus consistency',
        subtitle: `${daysActive} active days`,
        description: `Average ${avgDuration}min per session. Consistency is key to building focus stamina`,
      });
    } else if (sessions.length > 0) {
      generatedInsights.push({
        icon: 'rocket-outline',
        iconBg: Colors.blue,
        iconBgLight: Colors.blueLight,
        title: 'You\'re just getting started',
        subtitle: `${sessions.length} session${sessions.length > 1 ? 's' : ''} completed`,
        description: 'Keep going! Focus skills improve significantly after 10 sessions',
      });
    }

    // Shuffle insights to show different ones
    return generatedInsights.sort(() => Math.random() - 0.5).slice(0, 3);
  };

  const getRandomProTip = (): string => {
    const tips = [
      'Schedule your most challenging tasks during your peak focus hours for optimal results.',
      'Take a 5-minute break every hour to maintain sustained attention throughout the day.',
      'Create a dedicated workspace to help your brain associate the area with focused work.',
      'Use the 2-minute rule: If a task takes less than 2 minutes, do it immediately.',
      'Turn off notifications during focus sessions to reduce cognitive interruptions.',
      'Start your day by identifying your top 3 priorities to maintain clear direction.',
      'Practice single-tasking instead of multitasking for deeper, more meaningful work.',
      'Use music without lyrics or ambient sounds to enhance concentration.',
      'Keep a distraction list nearby to jot down wandering thoughts and address them later.',
      'Celebrate small wins to maintain motivation and positive momentum.',
      'Review your completed tasks weekly to recognize progress and adjust strategies.',
      'Consistency beats intensity: 25 minutes daily is better than 3 hours once a week.',
    ];

    return tips[Math.floor(Math.random() * tips.length)];
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    generateInsights();
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <Background>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Analyzing your patterns...</Text>
        </View>
      </Background>
    );
  }

  return (
    <Background>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoIcon}
            >
              <Ionicons name="flash" size={20} color={Colors.white} />
            </LinearGradient>
            <Text style={styles.logoText}>FocusFlow</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainCard}>
            <View style={styles.titleSection}>
              <View style={styles.titleRow}>
                <Text style={styles.mainTitle}>AI Insights</Text>
                <Ionicons name="bulb-outline" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.subtitle}>
                Personal focus insights based on your daily patterns and reflections.
              </Text>
            </View>

            <View style={styles.highlightsSection}>
              <Text style={styles.highlightsTitle}>
                {insights.length > 0 ? 'Your Insights' : 'Getting Started'}
              </Text>

              {insights.map((insight, index) => (
                <View key={index} style={styles.insightCard}>
                  <LinearGradient
                    colors={[insight.iconBgLight, insight.iconBg]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconCircle}
                  >
                    <Ionicons
                      name={insight.icon}
                      size={28}
                      color={Colors.white}
                    />
                  </LinearGradient>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightSubtitle}>
                      {insight.subtitle}
                    </Text>
                    <Text style={styles.insightDescription}>
                      {insight.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.updateText}>
              Insights update in real-time based on your FocusFlow activity.
            </Text>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={isRefreshing}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.refreshGradient}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="refresh-outline"
                      size={20}
                      color={Colors.white}
                    />
                    <Text style={styles.refreshText}>Refresh Insights</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.tipsSection}>
            <LinearGradient
              colors={[Colors.cardLight1, Colors.cardLight2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tipCard}
            >
              <Ionicons
                name="bulb-outline"
                size={24}
                color={Colors.cardDark1}
              />
              <Text style={styles.tipTitle}>Pro Tip</Text>
              <Text style={styles.tipText}>{proTip}</Text>
            </LinearGradient>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 16 : 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 127, 0.1)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A9B7F',
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  mainCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 28,
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 127, 0.1)',
  },
  titleSection: {
    marginBottom: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A3A32',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#2D5249',
    lineHeight: 24,
  },
  highlightsSection: {
    marginBottom: 28,
  },
  highlightsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A3A32',
    marginBottom: 20,
    textAlign: 'center',
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(74, 155, 127, 0.04)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 127, 0.08)',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  insightContent: {
    flex: 1,
    paddingTop: 2,
  },
  insightTitle: {
    fontSize: 16,
    color: '#2D5249',
    marginBottom: 4,
    fontWeight: '400',
  },
  insightSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3A32',
    marginBottom: 8,
  },
  insightDescription: {
    fontSize: 14,
    color: '#5A7770',
    lineHeight: 20,
  },
  updateText: {
    fontSize: 14,
    color: '#5A7770',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  refreshButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  refreshGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
    minHeight: 54,
  },
  refreshText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tipsSection: {
    marginTop: 20,
  },
  tipCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#7DD3C0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tipTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2F6B56',
    marginTop: 12,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 15,
    color: '#2F6B56',
    textAlign: 'center',
    lineHeight: 22,
  },
});