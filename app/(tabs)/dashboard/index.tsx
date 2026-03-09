import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform, StyleProp, ViewStyle,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import Background, { Colors } from '../../../components/Background';
import { useTheme } from '../../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface SessionEntry {
  id: string;
  task_name: string | null;
  duration_minutes: number; // raw seconds
  completed_at: string;
  emotion: string | null;
}

interface DashboardStats {
  // today's tasks only
  todayTotalTasks: number;
  todayCompletedTasks: number;
  todayIncompleteTasks: number;
  // all-time (for top task / streak)
  allTasks: Task[];
  topTask: Task | null;
  // sessions
  todayFocusSessions: number;      // count
  todayTotalSeconds: number;       // sum of raw seconds from today's sessions
  allTimeFocusMinutes: number;     // all-time minutes from task records (for reference)
  // misc
  currentStreak: number;
  recentMoods: DailyMood[];
  todaySessionList: SessionEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as a local "YYYY-MM-DD" string (never UTC-shifted). */
const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Start of today in local time as an ISO string. */
const localDayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Start of tomorrow in local time as an ISO string. */
const localDayEnd = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

// ─── DashboardCard ────────────────────────────────────────────────────────────

const DashboardCard: React.FC<DashboardCardProps> = ({ children, style, gradientType = 'white' }) => {
  const { colors, isDarkMode } = useTheme();

  const getGradientColors = (): readonly [string, string, ...string[]] => {
    if (isDarkMode) {
      switch (gradientType) {
        case 'dark':  return [colors.surface, colors.bubbleLight, colors.bubbleMedium] as const;
        case 'light': return [colors.bubbleLight, colors.bubbleMedium, colors.surface] as const;
        default:      return [colors.surface, colors.surface] as const;
      }
    } else {
      switch (gradientType) {
        case 'dark':  return ['#2F6B56', '#3D7A63', '#4A9B7F'] as const;
        case 'light': return ['#7DD3C0', '#9DD4BD', '#C5E8DC'] as const;
        default:      return [colors.white, colors.white] as const;
      }
    }
  };

  const gradientColors = getGradientColors();
  const shadowColor = isDarkMode ? 'rgba(0,0,0,0.5)'
    : gradientType === 'dark'  ? '#2F6B56'
    : gradientType === 'light' ? '#7DD3C0'
    : colors.primary;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={gradientType !== 'white' ? [0, 0.5, 1] : undefined}
      style={[
        styles.card,
        {
          shadowColor,
          shadowOpacity: isDarkMode ? 0.4 : gradientType === 'dark' ? 0.35 : gradientType === 'light' ? 0.25 : 0.12,
          borderColor: isDarkMode ? colors.border : 'rgba(255,255,255,0.3)',
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();

  const [currentScreen, setCurrentScreen] = useState('screen1');
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [aiInsight, setAiInsight]         = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    todayTotalTasks: 0, todayCompletedTasks: 0, todayIncompleteTasks: 0,
    allTasks: [], topTask: null,
    todayFocusSessions: 0, todayTotalSeconds: 0, allTimeFocusMinutes: 0,
    currentStreak: 0, recentMoods: [], todaySessionList: [],
  });

  useEffect(() => { if (user) fetchDashboardData(); }, [user]);

  // ─── Data ────────────────────────────────────────────────────────────────────

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const dayStart = localDayStart();
      const dayEnd   = localDayEnd();
      const sevenDaysAgo = (() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
      })();

      const [todayTasksRes, allTasksRes, allSessionsRes, moodsRes, todaySessRes] = await Promise.all([
        // TODAY's tasks only — for progress bar and task counts
        supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user?.id)
          .gte('created_at', dayStart)
          .lt('created_at', dayEnd),

        // ALL tasks — for topTask and all-time focus minutes
        supabase
          .from('tasks')
          .select('id, text, focus_time, completion_count, completed')
          .eq('user_id', user?.id),

        // ALL sessions — for streak calculation only
        supabase
          .from('focus_sessions')
          .select('id, duration_minutes, started_at, completed_at')
          .eq('user_id', user?.id)
          .order('completed_at', { ascending: false }),

        // Recent moods (last 7 days)
        supabase
          .from('daily_moods')
          .select('*')
          .eq('user_id', user?.id)
          .gte('mood_date', sevenDaysAgo)
          .order('mood_date', { ascending: false }),

        // TODAY's sessions with task name + emotion — for session list display
        supabase
          .from('focus_sessions')
          .select('id, duration_minutes, completed_at, emotion, tasks(text)')
          .eq('user_id', user?.id)
          .gte('completed_at', dayStart)
          .lt('completed_at', dayEnd)
          .order('completed_at', { ascending: false }),
      ]);

      if (todayTasksRes.error)  throw todayTasksRes.error;
      if (allTasksRes.error)    throw allTasksRes.error;
      if (allSessionsRes.error) throw allSessionsRes.error;
      if (moodsRes.error)       throw moodsRes.error;
      if (todaySessRes.error)   throw todaySessRes.error;

      const todayTasks    = todayTasksRes.data    || [];
      const allTasks      = allTasksRes.data       || [];
      const allSessions   = allSessionsRes.data    || [];
      const moods         = moodsRes.data          || [];
      const todaySessions = todaySessRes.data      || [];

      // Today's task breakdown
      const todayCompleted  = todayTasks.filter(t => t.completed).length;
      const todayIncomplete = todayTasks.filter(t => !t.completed).length;

      // Today's session stats (duration_minutes stores raw seconds)
      const todayTotalSeconds = todaySessions.reduce(
        (sum: number, s: any) => sum + (s.duration_minutes || 0), 0
      );

      // All-time focus minutes (from accumulated task.focus_time fields)
      const allTimeFocusMinutes = allTasks.reduce(
        (sum, t) => sum + (t.focus_time || 0), 0
      );

      // Top focused task (all-time, by focus_time)
      const rawTop = allTasks.length > 0
        ? allTasks.reduce((max, t) => (t.focus_time || 0) > (max.focus_time || 0) ? t : max)
        : null;

      // Streak uses local date strings to avoid UTC-shift bugs
      const streak = calculateStreak(allSessions, todayTasks.filter(t => t.completed));

      const mappedSessions: SessionEntry[] = todaySessions.map((s: any) => ({
        id: s.id,
        task_name: s.tasks?.text || null,
        duration_minutes: s.duration_minutes,   // raw seconds
        completed_at: s.completed_at,
        emotion: s.emotion || null,
      }));

      setStats({
        todayTotalTasks:    todayTasks.length,
        todayCompletedTasks: todayCompleted,
        todayIncompleteTasks: todayIncomplete,
        allTasks,
        topTask: (rawTop?.focus_time || 0) > 0 ? rawTop : null,
        todayFocusSessions: todaySessions.length,
        todayTotalSeconds,
        allTimeFocusMinutes,
        currentStreak: streak,
        recentMoods: moods,
        todaySessionList: mappedSessions,
      });
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStreak = (sessions: FocusSession[], completedTasks: Task[] = []): number => {
    const toLocal = (iso: string) => localDateStr(new Date(iso));

    const sessionDates = sessions
      .filter(s => s.completed_at)
      .map(s => toLocal(s.completed_at));

    const taskDates = completedTasks
      .filter(t => (t as any).updated_at)
      .map(t => toLocal((t as any).updated_at));

    const allDates = [...sessionDates, ...taskDates];
    if (!allDates.length) return 0;

    const uniqueDates = [...new Set(allDates)].sort().reverse();
    let streak = 0;
    const now = new Date();

    for (let i = 0; i < uniqueDates.length; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = localDateStr(d);
      if (uniqueDates.includes(dStr)) streak++;
      else break;
    }
    return streak;
  };

  const onRefresh = () => { setRefreshing(true); fetchDashboardData(); };

  const generateInsight = () => {
    const sessions = stats.todaySessionList;
    if (sessions.length === 0) return;

    const emotions       = sessions.map(s => s.emotion).filter(Boolean) as string[];
    const completedCount = stats.todayCompletedTasks;
    const totalCount     = stats.todayTotalTasks;
    const totalSecs      = stats.todayTotalSeconds;
    const totalMins      = Math.round(totalSecs / 60);
    const completionRate = totalCount > 0 ? completedCount / totalCount : 0;

    const positive = ['🤩 Energized', '😊 Proud', '😌 Relieved', '😎 Confident'];
    const negative = ['😤 Frustrated', '🤯 Overwhelmed'];
    const draining = ['😴 Tired'];
    const neutral  = ['😐 Neutral'];

    const posCount = emotions.filter(e => positive.includes(e)).length;
    const negCount = emotions.filter(e => negative.includes(e)).length;
    const tirCount = emotions.filter(e => draining.includes(e)).length;
    const neuCount = emotions.filter(e => neutral.includes(e)).length;
    const total    = emotions.length;

    const freq: Record<string, number> = {};
    emotions.forEach(e => { freq[e] = (freq[e] || 0) + 1; });
    const topEmotion = total > 0
      ? Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    let insight = '';

    if (total === 0) {
      if (completionRate === 1) {
        insight = `You crushed all ${completedCount} task${completedCount > 1 ? 's' : ''} today — that's a full win! Next time, try logging how you felt after each one. Tracking your emotions helps you spot when you focus best.`;
      } else if (completionRate >= 0.5) {
        insight = `Solid progress today — ${completedCount} of ${totalCount} tasks done and ${totalMins} minutes of focused work. Try logging your feelings after each session tomorrow to uncover your energy patterns.`;
      } else {
        insight = `You put in ${totalMins} minutes today, and that counts. Even small sessions build the habit. Tomorrow, try tackling your hardest task first while your energy is fresh.`;
      }
      setAiInsight(insight);
      return;
    }

    if (posCount >= total * 0.6) {
      if (completionRate === 1) {
        insight = `${topEmotion} after finishing all your tasks — you're in a real flow today! Your energy is clearly high right now. Consider using the rest of your day for a creative or challenging stretch goal while this momentum lasts.`;
      } else {
        insight = `You're feeling ${topEmotion} through most of your sessions, which is a great sign. With ${completedCount} of ${totalCount} tasks done, you're building real momentum. Keep the pace steady — you don't need to rush the remaining tasks.`;
      }
    } else if (tirCount >= total * 0.5) {
      if (completionRate >= 0.7) {
        insight = `Finishing ${completedCount} tasks while feeling tired shows real discipline — give yourself credit for that. Your focus reserves are running low though. Take a proper break now: step outside, eat something, and avoid screens for 15 minutes.`;
      } else {
        insight = `Your body is sending a clear signal today — ${topEmotion} is showing up across your sessions. It's okay to slow down. Try breaking your remaining tasks into smaller 10-minute chunks with short rests in between.`;
      }
    } else if (negCount >= total * 0.5) {
      if (topEmotion === '🤯 Overwhelmed') {
        insight = `Feeling overwhelmed across ${negCount} session${negCount > 1 ? 's' : ''} is a sign your plate might be too full. Look at your remaining tasks and ask: which one actually needs to happen today? Give yourself permission to defer the rest.`;
      } else {
        insight = `Frustration showed up in your sessions today, but you still got ${completedCount} thing${completedCount > 1 ? 's' : ''} done — that takes grit. Try switching to a lighter, more satisfying task next to reset your mood before tackling anything heavy.`;
      }
    } else if (posCount > 0 && negCount > 0) {
      insight = `Your focus today had real ups and downs — ${posCount} session${posCount > 1 ? 's' : ''} felt good and ${negCount} felt tough. That kind of mixed day is completely normal. Notice which tasks drained you most, and try scheduling those earlier tomorrow when your energy is higher.`;
    } else if (neuCount >= total * 0.5) {
      if (completionRate >= 0.7) {
        insight = `A steady, neutral focus day — ${completedCount} tasks done with ${totalMins} minutes of work. Sometimes "just okay" days produce the most consistent progress. You showed up, and that matters more than feeling inspired.`;
      } else {
        insight = `Feeling neutral through your sessions suggests you might be going through the motions a bit. Try connecting your next task to a specific reason it matters to you — even a small "why" can sharpen focus significantly.`;
      }
    } else {
      if (completionRate === 1) {
        insight = `All ${completedCount} tasks done and ${totalMins} minutes of focused work today — that's a complete day. Take a moment to appreciate that before jumping into anything else.`;
      } else {
        insight = `You've focused for ${totalMins} minutes and completed ${completedCount} of ${totalCount} tasks. Every session adds up. Finish strong — your next completed task is closer than it feels.`;
      }
    }

    setAiInsight(insight);
  };

  // ─── Formatters ───────────────────────────────────────────────────────────────

  const pad = (n: number) => n.toString().padStart(2, '0');

  const formatFocusTime = (minutes: number) => {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
  };

  /** duration_minutes column stores raw seconds */
  const formatSeconds = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${pad(h)}:${pad(m)}:${pad(s)}`
      : `${pad(m)}:${pad(s)}`;
  };

  const formatSessionTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ─── Derived values ───────────────────────────────────────────────────────────

  if (!isAuthenticated && !isLoading) return <Redirect href="/auth/login" />;

  const handleLogout = async () => { await logout(); router.replace('/auth/login'); };

  const userName  = user?.name || 'User';
  const timeOfDay = (() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; })();
  const focusGoal = stats.topTask?.text || user?.goals?.[0] || 'Complete one study session without phone distractions.';

  // Accurate today-only progress
  const todayProgress = stats.todayTotalTasks > 0
    ? Math.round((stats.todayCompletedTasks / stats.todayTotalTasks) * 100)
    : 0;

  const getMoodTrend = () => {
    if (stats.recentMoods.length < 2) return 'stable';
    const recent = stats.recentMoods.slice(0, 3);
    const older  = stats.recentMoods.slice(3, 6);
    if (!recent.length || !older.length) return 'stable';
    const rAvg = recent.reduce((s, m) => s + m.mood_value, 0) / recent.length;
    const oAvg = older.reduce((s, m)  => s + m.mood_value, 0) / older.length;
    if (rAvg < oAvg - 0.5) return 'improving';
    if (rAvg > oAvg + 0.5) return 'declining';
    return 'stable';
  };
  const moodTrend = getMoodTrend();

  const affirmations = [
    'My mind can slow down — I am in control of my attention.',
    'I choose focus over distraction, one moment at a time.',
    'Every small step forward is progress worth celebrating.',
    'I am capable of deep, meaningful work.',
    'My concentration grows stronger with practice.',
  ];
  const dailyAffirmation = affirmations[new Date().getDate() % affirmations.length];

  // ─── Loading ──────────────────────────────────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Background>
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primaryLight]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.logoIcon}
              >
                <Ionicons name="flash" size={24} color={colors.white} />
              </LinearGradient>
              <Text style={[styles.logoText, { color: colors.primary }]}>FocusFlow</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => router.push('/(tabs)/settings')}
              >
                <Ionicons name="settings-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={handleLogout}
              >
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          {/* GREETING */}
          <View style={styles.greetingSection}>
            <Text style={[styles.userName,    { color: colors.textDark }]}>{userName}!</Text>
            <Text style={[styles.greeting,    { color: colors.textMedium }]}>Good {timeOfDay}</Text>
            <Text style={[styles.subGreeting, { color: colors.textLight }]}>Ready to focus today?</Text>
          </View>

          {/* TOGGLE */}
          <View style={[styles.toggleContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            {(['screen1', 'screen2'] as const).map((screen, i) => (
              <TouchableOpacity
                key={screen}
                style={[styles.toggleButton, currentScreen === screen && { backgroundColor: colors.primary }]}
                onPress={() => setCurrentScreen(screen)}
              >
                <View style={styles.toggleContent}>
                  <Ionicons
                    name={i === 0 ? 'trophy-outline' : 'trending-up-outline'}
                    size={20}
                    color={currentScreen === screen ? colors.white : colors.textLight}
                  />
                  <Text style={[styles.toggleText, { color: colors.textLight }, currentScreen === screen && { color: colors.white }]}>
                    {i === 0 ? 'Goals' : 'Progress'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── SCREEN 1: Goals ─────────────────────────────────────────────── */}
          {currentScreen === 'screen1' && (
            <View style={styles.screenContainer}>
              <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Goals & Streak</Text>

              {/* Focus Goal */}
              <DashboardCard style={styles.cardSpacing} gradientType="dark">
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
                <Text style={[styles.goalText, { color: isDarkMode ? colors.textMedium : '#FFFFFF' }]}>
                  {focusGoal}
                </Text>
                {stats.topTask && (
                  <View style={styles.goalMetaBadge}>
                    <Ionicons name="time" size={14} color={isDarkMode ? colors.textDark : '#FFFFFF'} />
                    <Text style={[styles.goalMetaText, { color: isDarkMode ? colors.textDark : '#FFFFFF' }]}>
                      {formatFocusTime(stats.topTask.focus_time)} focused (all-time)
                    </Text>
                  </View>
                )}
              </DashboardCard>

              {/* Streak */}
              <DashboardCard style={styles.cardSpacing} gradientType="dark">
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="flame-outline" size={24} color={isDarkMode ? colors.textDark : '#FFFFFF'} />
                    <Text style={[styles.cardTitle, { color: isDarkMode ? colors.textDark : '#FFFFFF' }]}>
                      Focus Streak
                    </Text>
                  </View>
                </View>
                <View style={styles.fireContainer}>
                  {Array.from({ length: 7 }, (_, i) => (
                    <Text key={i} style={styles.fireEmoji}>
                      {i < stats.currentStreak ? '🔥' : '🤍'}
                    </Text>
                  ))}
                </View>
                <Text style={[styles.streakDescription, { color: isDarkMode ? colors.textMedium : '#FFFFFF' }]}>
                  {stats.currentStreak > 0
                    ? `You've stayed focused ${stats.currentStreak} day${stats.currentStreak > 1 ? 's' : ''} in a row!`
                    : 'Start a focus session to begin your streak!'}
                </Text>
              </DashboardCard>

              {/* Focus Summary */}
              <DashboardCard style={styles.cardSpacing}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="sparkles-outline" size={24} color={colors.textDark} />
                    <Text style={[styles.cardTitleDark, { color: colors.textDark }]}>Today's Focus Summary</Text>
                  </View>
                </View>

                {/* Aggregate row — both figures are today-only */}
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.primary }]}>
                      {stats.todayFocusSessions}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: colors.textLight }]}>Sessions Today</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    {/* Show today's total focus time in HH:MM:SS */}
                    <Text style={[styles.summaryValue, { color: colors.primary }]}>
                      {formatSeconds(stats.todayTotalSeconds)}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: colors.textLight }]}>Today's Focus</Text>
                  </View>
                </View>

                {/* Session list */}
                {stats.todaySessionList.length > 0 ? (
                  <>
                    <View style={[styles.sessionTotalRow, { backgroundColor: isDarkMode ? colors.background : 'rgba(0,0,0,0.04)', borderColor: colors.border }]}>
                      <View style={styles.sessionTotalLeft}>
                        <Ionicons name="timer-outline" size={16} color={colors.primary} />
                        <Text style={[styles.sessionTotalLabel, { color: colors.textMedium }]}>Today's Total</Text>
                      </View>
                      <Text style={[styles.sessionTotalValue, { color: colors.primary }]}>
                        {formatSeconds(stats.todayTotalSeconds)}
                      </Text>
                    </View>

                    {stats.todaySessionList.map((sess, idx) => (
                      <View
                        key={sess.id}
                        style={[
                          styles.sessionEntry,
                          { borderTopColor: isDarkMode ? colors.border : 'rgba(0,0,0,0.07)' },
                          idx === 0 && { borderTopWidth: 0 },
                        ]}
                      >
                        <View style={[styles.sessionDot, { backgroundColor: colors.primary }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sessionEntryName, { color: colors.textDark }]} numberOfLines={1}>
                            {sess.task_name || 'General Focus'}
                          </Text>
                          <Text style={[styles.sessionEntryTime, { color: colors.textLight }]}>
                            Completed at {formatSessionTime(sess.completed_at)}
                            {sess.emotion ? `  ·  ${sess.emotion}` : ''}
                          </Text>
                        </View>
                        <Text style={[styles.sessionEntryDur, { color: colors.primary }]}>
                          {formatSeconds(sess.duration_minutes)}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={[styles.sessionsEmpty, { color: colors.textLight }]}>
                    No sessions yet today. Start a task to track your focus!
                  </Text>
                )}

                {/* All-time focus footnote */}
                {stats.allTimeFocusMinutes > 0 && (
                  <View style={[styles.allTimeBadge, { backgroundColor: isDarkMode ? colors.background : 'rgba(0,0,0,0.04)' }]}>
                    <Ionicons name="infinite-outline" size={14} color={colors.textLight} />
                    <Text style={[styles.allTimeText, { color: colors.textLight }]}>
                      All-time focus: {formatFocusTime(stats.allTimeFocusMinutes)}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.insightButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={() => router.push('/(tabs)/dashboard/insight')}
                >
                  <Text style={[styles.insightButtonText, { color: colors.white }]}>View Detailed Insights</Text>
                </TouchableOpacity>
              </DashboardCard>

              {/* AI Mood Insight */}
              {stats.todaySessionList.length > 0 && (
                <DashboardCard style={styles.cardSpacing}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleContainer}>
                      <Ionicons name="bulb-outline" size={24} color={colors.textDark} />
                      <Text style={[styles.cardTitleDark, { color: colors.textDark }]}>Today's Insight</Text>
                    </View>
                    <TouchableOpacity
                      onPress={generateInsight}
                      style={[styles.insightRefreshBtn, { backgroundColor: isDarkMode ? colors.background : 'rgba(0,0,0,0.05)' }]}
                    >
                      <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {stats.todaySessionList.some(s => s.emotion) && (
                    <View style={styles.emotionChipsRow}>
                      {stats.todaySessionList
                        .filter(s => s.emotion)
                        .map(s => (
                          <View key={s.id} style={[styles.emotionChip, { backgroundColor: isDarkMode ? colors.background : 'rgba(0,0,0,0.05)' }]}>
                            <Text style={styles.emotionChipText}>{s.emotion}</Text>
                          </View>
                        ))}
                    </View>
                  )}

                  {aiInsight ? (
                    <Text style={[styles.insightText, { color: colors.textMedium }]}>{aiInsight}</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.generateBtn, { borderColor: colors.primary }]}
                      onPress={generateInsight}
                    >
                      <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                      <Text style={[styles.generateBtnText, { color: colors.primary }]}>
                        Generate my insight
                      </Text>
                    </TouchableOpacity>
                  )}
                </DashboardCard>
              )}
            </View>
          )}

          {/* ── SCREEN 2: Progress ──────────────────────────────────────────── */}
          {currentScreen === 'screen2' && (
            <View style={styles.screenContainer}>
              <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Progress & Insights</Text>

              {/* Today's Progress */}
              <DashboardCard style={styles.cardSpacing} gradientType="light">
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="pie-chart-outline" size={24} color={isDarkMode ? colors.textDark : '#2F6B56'} />
                    <Text style={[styles.cardTitleGradient, { color: isDarkMode ? colors.textDark : '#2F6B56' }]}>
                      Today's Progress
                    </Text>
                  </View>
                </View>
                <Text style={[styles.progressPercent, { color: isDarkMode ? colors.textDark : '#2F6B56' }]}>
                  {todayProgress}%
                </Text>
                <View style={[
                  styles.progressBarContainer,
                  { backgroundColor: isDarkMode ? colors.bubbleLight : 'rgba(255,255,255,0.6)', borderColor: isDarkMode ? colors.primary : '#3D7A63' },
                ]}>
                  <View style={[styles.progressBarFill, { width: `${todayProgress}%`, backgroundColor: colors.primary }]} />
                </View>
                {/* Task count breakdown */}
                <View style={styles.progressCountRow}>
                  <View style={styles.progressCountItem}>
                    <Text style={[styles.progressCountValue, { color: colors.primary }]}>
                      {stats.todayCompletedTasks}
                    </Text>
                    <Text style={[styles.progressCountLabel, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>Done</Text>
                  </View>
                  <View style={[styles.progressCountDivider, { backgroundColor: isDarkMode ? colors.border : 'rgba(47,107,86,0.2)' }]} />
                  <View style={styles.progressCountItem}>
                    <Text style={[styles.progressCountValue, { color: colors.primary }]}>
                      {stats.todayIncompleteTasks}
                    </Text>
                    <Text style={[styles.progressCountLabel, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>Remaining</Text>
                  </View>
                  <View style={[styles.progressCountDivider, { backgroundColor: isDarkMode ? colors.border : 'rgba(47,107,86,0.2)' }]} />
                  <View style={styles.progressCountItem}>
                    <Text style={[styles.progressCountValue, { color: colors.primary }]}>
                      {stats.todayTotalTasks}
                    </Text>
                    <Text style={[styles.progressCountLabel, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>Total</Text>
                  </View>
                </View>
                <Text style={[styles.progressText, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>
                  {stats.todayTotalTasks === 0
                    ? 'No tasks yet today. Add tasks to track your progress!'
                    : stats.todayCompletedTasks === stats.todayTotalTasks
                    ? `Amazing! You've completed all ${stats.todayTotalTasks} tasks today!`
                    : `${stats.todayCompletedTasks} of ${stats.todayTotalTasks} tasks done — keep going!`}
                </Text>
              </DashboardCard>

              {/* Mood Trend */}
              <DashboardCard style={styles.cardSpacing} gradientType="light">
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="happy-outline" size={24} color={isDarkMode ? colors.textDark : '#2F6B56'} />
                    <Text style={[styles.cardTitleGradient, { color: isDarkMode ? colors.textDark : '#2F6B56' }]}>
                      Mood Trend
                    </Text>
                  </View>
                </View>
                <Text style={[styles.moodText, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>
                  {stats.recentMoods.length === 0
                    ? 'Start tracking your mood to see trends over time!'
                    : moodTrend === 'improving'
                    ? 'Your mood has been improving this week! Keep up the positive momentum.'
                    : moodTrend === 'declining'
                    ? 'Your mood has been declining lately. Remember to take breaks and practice self-care.'
                    : 'Your mood has been stable this week. Keep maintaining your balance!'}
                  {moodTrend !== 'stable' && stats.recentMoods.length > 0 && (
                    <Text style={[
                      styles.improvingText,
                      { color: colors.primary },
                      moodTrend === 'declining' && styles.decliningText,
                    ]}>
                      {' '}{moodTrend}
                    </Text>
                  )}
                </Text>
                {stats.recentMoods.length > 0 && (
                  <View style={styles.moodDotsRow}>
                    {stats.recentMoods.slice(0, 7).reverse().map((m, i) => {
                      const dotColor = m.mood_value <= 2 ? '#4CAF50' : m.mood_value <= 3 ? '#FFC107' : '#FF6B6B';
                      return <View key={i} style={[styles.moodDot, { backgroundColor: dotColor }]} />;
                    })}
                  </View>
                )}
              </DashboardCard>

              {/* Daily Affirmation */}
              <DashboardCard style={styles.cardSpacing} gradientType="light">
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Ionicons name="heart-outline" size={24} color={isDarkMode ? colors.textDark : '#2F6B56'} />
                    <Text style={[styles.cardTitleGradient, { color: isDarkMode ? colors.textDark : '#2F6B56' }]}>
                      Daily Affirmation
                    </Text>
                  </View>
                  <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh-outline" size={20} color={isDarkMode ? colors.textDark : '#2F6B56'} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.affirmationTextGradient, { color: isDarkMode ? colors.textMedium : '#2F6B56' }]}>
                  "{dailyAffirmation}"
                </Text>
              </DashboardCard>
            </View>
          )}
        </ScrollView>
      </View>
    </Background>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText:   { marginTop: 16, fontSize: 16 },

  header:        { backgroundColor: 'transparent', paddingTop: Platform.OS === 'ios' ? 16 : 8, paddingBottom: 16, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  logoText:      { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  headerIcons:   { flexDirection: 'row', gap: 10 },
  iconButton:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3, borderWidth: 1 },

  scrollView:    { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  greetingSection: { padding: 20, paddingTop: 24 },
  userName:        { fontSize: 32, fontWeight: '700', marginBottom: 4 },
  greeting:        { fontSize: 18, fontWeight: '400', marginBottom: 8 },
  subGreeting:     { fontSize: 16, marginTop: 4 },

  toggleContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, borderRadius: 16, padding: 4, gap: 4, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4, borderWidth: 1 },
  toggleButton:    { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggleContent:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText:      { fontSize: 15, fontWeight: '600' },

  screenContainer: { paddingHorizontal: 20 },
  sectionTitle:    { fontSize: 20, fontWeight: '700', marginBottom: 16 },

  card:        { borderRadius: 20, padding: 20, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 8, overflow: 'hidden', borderWidth: 1 },
  cardSpacing: { marginBottom: 16 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:         { fontSize: 18, fontWeight: '700' },
  cardTitleDark:     { fontSize: 18, fontWeight: '700' },
  cardTitleGradient: { fontSize: 18, fontWeight: '700' },

  goalText:      { fontSize: 16, lineHeight: 24, textAlign: 'center', fontWeight: '400' },
  goalMetaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'center', marginTop: 12 },
  goalMetaText:  { fontSize: 13, fontWeight: '600' },

  fireContainer:     { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 16 },
  fireEmoji:         { fontSize: 32 },
  streakDescription: { fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '400' },

  summaryGrid:    { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16 },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(0,0,0,0.08)' },
  summaryItem:    { alignItems: 'center', flex: 1 },
  summaryValue:   { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  summaryLabel:   { fontSize: 12, textAlign: 'center' },

  sessionTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth },
  sessionTotalLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionTotalLabel: { fontSize: 13, fontWeight: '600' },
  sessionTotalValue: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  sessionEntry:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  sessionDot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sessionEntryName:  { fontSize: 13, fontWeight: '600' },
  sessionEntryTime:  { fontSize: 11, marginTop: 1 },
  sessionEntryDur:   { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  sessionsEmpty:     { fontSize: 13, textAlign: 'center', paddingVertical: 12, lineHeight: 20 },

  allTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  allTimeText:  { fontSize: 12, fontWeight: '600' },

  insightButton:     { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, alignSelf: 'center' },
  insightButtonText: { fontSize: 15, fontWeight: '600' },

  // Progress card
  progressPercent:    { fontSize: 48, fontWeight: '700', textAlign: 'center', marginBottom: 16, letterSpacing: -1 },
  progressBarContainer: { height: 16, borderRadius: 10, overflow: 'hidden', marginBottom: 16, borderWidth: 2 },
  progressBarFill:    { height: '100%', borderRadius: 8 },
  progressCountRow:   { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 14 },
  progressCountItem:  { alignItems: 'center', flex: 1 },
  progressCountValue: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
  progressCountLabel: { fontSize: 12, fontWeight: '500' },
  progressCountDivider: { width: 1, height: 32 },
  progressText:       { fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '400' },

  moodText:      { fontSize: 16, lineHeight: 24, textAlign: 'center', fontWeight: '400' },
  improvingText: { fontWeight: '700' },
  decliningText: { color: '#FF6B6B', fontWeight: '700' },
  moodDotsRow:   { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  moodDot:       { width: 12, height: 12, borderRadius: 6 },

  affirmationTextGradient: { fontSize: 17, lineHeight: 26, textAlign: 'center', fontStyle: 'italic', fontWeight: '400' },

  insightRefreshBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emotionChipsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  emotionChip:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  emotionChipText:   { fontSize: 12, fontWeight: '600' },
  insightText:       { fontSize: 15, lineHeight: 24, fontWeight: '400' },
  generateBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, borderStyle: 'dashed' },
  generateBtnText:   { fontSize: 14, fontWeight: '700' },
});