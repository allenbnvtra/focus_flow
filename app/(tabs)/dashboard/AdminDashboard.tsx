import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MoodEntry {
  mood_value: number;
  mood_date: string;
  notes: string | null;
}

interface StudentSummary {
  id: string;
  name: string;
  email: string;
  recentMoods: MoodEntry[];
  todayTasksTotal: number;
  todayTasksDone: number;
  weekFocusSecs: number;
  sessionCount: number;
  currentStreak: number;
  hasMoodAlert: boolean;
}

interface SessionEntry {
  id: string;
  duration_minutes: number;
  completed_at: string;
  emotion: string | null;
  task_name: string | null;
}

interface ReflectionEntry {
  id: string;
  selected_answer: string;
  attempted_at: string;
  question_text: string;
  question_type: string;
}

interface StudentDetail {
  moods: MoodEntry[];
  sessions: SessionEntry[];
  reflections: ReflectionEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => n.toString().padStart(2, '0');

const getMoodColor = (v: number) =>
  v <= 2 ? '#4CAF50' : v <= 3 ? '#FFC107' : '#FF6B6B';

const getMoodEmoji = (v: number) =>
  (['😄', '😊', '😐', '😔', '😢'] as const)[v - 1] ?? '😐';

const getMoodLabel = (v: number) =>
  (['Great', 'Good', 'Okay', 'Low', 'Rough'] as const)[v - 1] ?? 'N/A';

const formatSecs = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

const localDayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); };
const localDayEnd   = () => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+1); return d.toISOString(); };

const nDaysAgo = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { logout } = useAuth();
  const router = useRouter();

  const [students, setStudents]               = useState<StudentSummary[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [search, setSearch]                   = useState('');
  const [filterAlerts, setFilterAlerts]       = useState(false);

  const [selected, setSelected]               = useState<StudentSummary | null>(null);
  const [detail, setDetail]                   = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading]     = useState(false);
  const [detailTab, setDetailTab]             = useState<'overview' | 'moods' | 'sessions' | 'reflections'>('overview');

  useEffect(() => { fetchStudents(); }, []);

  // ─── Fetch all students (batch) ───────────────────────────────────────────

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const dayStart = localDayStart();
      const dayEnd   = localDayEnd();
      const weekAgo  = nDaysAgo(7);

      // 1. Non-admin profiles
      // ⚠️ Adjust table/column names to match your Supabase schema
      const { data: profiles, error: pErr } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('is_admin', false)
        .order('name');
      if (pErr) throw pErr;

      console.log(profiles)

      const ids = (profiles || []).map(p => p.id);
      if (!ids.length) { setStudents([]); return; }

      const [moodsRes, tasksRes, sessRes] = await Promise.all([
        supabase.from('daily_moods')
          .select('user_id, mood_value, mood_date, notes')
          .in('user_id', ids)
          .gte('mood_date', weekAgo)
          .order('mood_date', { ascending: false }),

        supabase.from('tasks')
          .select('user_id, completed')
          .in('user_id', ids)
          .gte('created_at', dayStart)
          .lt('created_at', dayEnd),

        supabase.from('focus_sessions')
          .select('user_id, duration_minutes, completed_at')
          .in('user_id', ids)
          .gte('completed_at', `${weekAgo}T00:00:00`)
          .order('completed_at', { ascending: false }),
      ]);

      const summaries: StudentSummary[] = (profiles || []).map(profile => {
        const pMoods = (moodsRes.data || [])
          .filter(m => m.user_id === profile.id)
          .map(m => ({ mood_value: m.mood_value, mood_date: m.mood_date, notes: m.notes }));
        const pTasks = (tasksRes.data || []).filter(t => t.user_id === profile.id);
        const pSess  = (sessRes.data  || []).filter(s => s.user_id === profile.id);

        const weekSecs  = pSess.reduce((a, s) => a + (s.duration_minutes || 0), 0);
        const recentAvg = pMoods.length > 0
          ? pMoods.slice(0,3).reduce((a, m) => a + m.mood_value, 0) / Math.min(3, pMoods.length)
          : 0;
        const hasMoodAlert = recentAvg > 3.5 || (pMoods.length === 0 && pSess.length > 0);

        // streak from session dates
        const dates = [...new Set(pSess.map(s => s.completed_at.split('T')[0]))].sort().reverse();
        let streak = 0;
        for (let i = 0; i < dates.length; i++) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const ds = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
          if (dates.includes(ds)) streak++; else break;
        }

        return {
          id: profile.id,
          name:  profile.name  || 'Unknown',
          email: profile.email || '',
          recentMoods:     pMoods,
          todayTasksTotal: pTasks.length,
          todayTasksDone:  pTasks.filter(t => t.completed).length,
          weekFocusSecs:   weekSecs,
          sessionCount:    pSess.length,
          currentStreak:   streak,
          hasMoodAlert,
        };
      });

      setStudents(summaries);
    } catch (e: any) {
      console.error('Admin fetchStudents:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ─── Fetch detail (lazy, on student tap) ─────────────────────────────────

  const fetchDetail = async (userId: string) => {
    try {
      setDetailLoading(true);
      const ago30 = nDaysAgo(30);

      const [mRes, sRes, rRes] = await Promise.all([
        supabase.from('daily_moods')
          .select('mood_value, mood_date, notes')
          .eq('user_id', userId)
          .gte('mood_date', ago30)
          .order('mood_date', { ascending: false }),

        supabase.from('focus_sessions')
          .select('id, duration_minutes, completed_at, emotion, tasks(text)')
          .eq('user_id', userId)
          .gte('completed_at', `${ago30}T00:00:00`)
          .order('completed_at', { ascending: false })
          .limit(50),

        supabase.from('quiz_attempts')
          .select('id, selected_answer, attempted_at, quiz_questions(question, question_type)')
          .eq('user_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(30),
      ]);

      setDetail({
        moods: (mRes.data || []).map((m: any) => ({
          mood_value: m.mood_value, mood_date: m.mood_date, notes: m.notes,
        })),
        sessions: (sRes.data || []).map((s: any) => ({
          id: s.id, duration_minutes: s.duration_minutes,
          completed_at: s.completed_at, emotion: s.emotion,
          task_name: s.tasks?.text ?? null,
        })),
        reflections: (rRes.data || []).map((r: any) => ({
          id: r.id, selected_answer: r.selected_answer,
          attempted_at: r.attempted_at,
          question_text: r.quiz_questions?.question    ?? 'Unknown question',
          question_type: r.quiz_questions?.question_type ?? 'reflection',
        })),
      });
    } catch (e: any) {
      console.error('Admin fetchDetail:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelect = (student: StudentSummary) => {
    setSelected(student);
    setDetailTab('overview');
    setDetail(null);
    fetchDetail(student.id);
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const alertCount = students.filter(s => s.hasMoodAlert).length;
  const filtered   = students
    .filter(s => !filterAlerts || s.hasMoodAlert)
    .filter(s => !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()));

  // ─── Tab content renderers ────────────────────────────────────────────────

  const renderOverview = () => {
    if (!selected) return null;
    const avgMood = selected.recentMoods.length > 0
      ? selected.recentMoods.reduce((a, m) => a + m.mood_value, 0) / selected.recentMoods.length
      : null;
    const latest = selected.recentMoods[0] ?? null;

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>

        {/* 4-stat grid */}
        <View style={styles.overviewGrid}>
          {[
            { icon: 'flame-outline',          val: `${selected.currentStreak}d`,                   label: 'Streak'       },
            { icon: 'timer-outline',           val: formatSecs(selected.weekFocusSecs),             label: 'This Week'    },
            { icon: 'checkmark-done-outline',  val: `${selected.todayTasksDone}/${selected.todayTasksTotal}`, label: "Today's Tasks" },
            { icon: 'happy-outline',           val: avgMood !== null ? avgMood.toFixed(1) : 'N/A',  label: 'Avg Mood'     },
          ].map(({ icon, val, label }) => (
            <View key={label} style={styles.overviewCard}>
              <Ionicons name={icon as any} size={22} color={Colors.primary} />
              <Text style={styles.overviewVal}>{val}</Text>
              <Text style={styles.overviewLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Mood alert banner */}
        {selected.hasMoodAlert && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning-outline" size={18} color="#FF6B6B" />
            <Text style={styles.alertBannerText}>
              {selected.recentMoods.length === 0
                ? 'Student has sessions but no mood logs — consider checking in.'
                : 'Recent moods are consistently low. This student may need support.'}
            </Text>
          </View>
        )}

        {/* Latest mood */}
        {latest && (
          <View style={[styles.latestMoodCard, { borderLeftColor: getMoodColor(latest.mood_value) }]}>
            <Text style={styles.sectionLabel}>Latest Mood · {latest.mood_date}</Text>
            <View style={styles.latestMoodRow}>
              <Text style={styles.latestMoodEmoji}>{getMoodEmoji(latest.mood_value)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.latestMoodLabel, { color: getMoodColor(latest.mood_value) }]}>
                  {getMoodLabel(latest.mood_value)}  ({latest.mood_value}/5)
                </Text>
                {latest.notes && (
                  <Text style={styles.latestMoodNotes}>"{latest.notes}"</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* 7-day bar chart */}
        {selected.recentMoods.length > 0 && (
          <View style={styles.moodBarCard}>
            <Text style={styles.sectionLabel}>7-Day Mood Trend</Text>
            <View style={styles.moodBarRow}>
              {[...selected.recentMoods].slice(0,7).reverse().map((m, i) => (
                <View key={i} style={styles.moodBarCol}>
                  <View style={styles.moodBarTrack}>
                    <View style={[
                      styles.moodBarFill,
                      {
                        height: `${(m.mood_value / 5) * 100}%`,
                        backgroundColor: getMoodColor(m.mood_value),
                      },
                    ]} />
                  </View>
                  <Text style={styles.moodBarDate}>{m.mood_date.slice(5)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.moodBarLegend}>
              {[['#4CAF50','Good (1–2)'],['#FFC107','Okay (3)'],['#FF6B6B','Low (4–5)']].map(([c,l]) => (
                <View key={l} style={styles.moodBarLegendItem}>
                  <View style={[styles.moodBarLegendDot, { backgroundColor: c }]} />
                  <Text style={styles.moodBarLegendText}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderMoods = () => {
    if (detailLoading || !detail) return <ActivityIndicator style={styles.tabLoader} size="large" color={Colors.primary} />;
    if (!detail.moods.length) return <Text style={styles.tabEmpty}>No mood logs in the last 30 days</Text>;
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {detail.moods.map((m, i) => (
          <View key={i} style={[styles.moodEntry, { borderLeftColor: getMoodColor(m.mood_value) }]}>
            <Text style={styles.moodEntryEmoji}>{getMoodEmoji(m.mood_value)}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.moodEntryHeader}>
                <Text style={[styles.moodEntryLabel, { color: getMoodColor(m.mood_value) }]}>
                  {getMoodLabel(m.mood_value)}
                </Text>
                <Text style={styles.moodEntryDate}>{m.mood_date}</Text>
              </View>
              {m.notes ? <Text style={styles.moodEntryNotes}>"{m.notes}"</Text> : null}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderSessions = () => {
    if (detailLoading || !detail) return <ActivityIndicator style={styles.tabLoader} size="large" color={Colors.primary} />;
    if (!detail.sessions.length) return <Text style={styles.tabEmpty}>No sessions in the last 30 days</Text>;
    const totalSecs = detail.sessions.reduce((a, s) => a + s.duration_minutes, 0);
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sessTotalRow}>
          <Ionicons name="timer-outline" size={15} color={Colors.primary} />
          <Text style={styles.sessTotalText}>
            {detail.sessions.length} sessions · {formatSecs(totalSecs)} total
          </Text>
        </View>
        {detail.sessions.map(s => (
          <View key={s.id} style={styles.sessEntry}>
            <View style={[styles.sessEntryDot, { backgroundColor: Colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sessEntryTask} numberOfLines={1}>
                {s.task_name || 'General Focus'}
              </Text>
              <Text style={styles.sessEntryMeta}>
                {new Date(s.completed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {s.emotion ? `  ·  ${s.emotion}` : ''}
              </Text>
            </View>
            <Text style={styles.sessEntryDur}>{formatSecs(s.duration_minutes)}</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderReflections = () => {
    if (detailLoading || !detail) return <ActivityIndicator style={styles.tabLoader} size="large" color={Colors.primary} />;
    if (!detail.reflections.length) return <Text style={styles.tabEmpty}>No reflections submitted yet</Text>;
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {detail.reflections.map(r => (
          <View key={r.id} style={styles.reflCard}>
            <View style={styles.reflHeader}>
              <View style={[styles.reflBadge, r.question_type === 'rating' && styles.reflBadgeRating]}>
                <Ionicons
                  name={r.question_type === 'rating' ? 'star-outline' : 'create-outline'}
                  size={11}
                  color={r.question_type === 'rating' ? '#FF9800' : Colors.primary}
                />
                <Text style={[styles.reflBadgeText, r.question_type === 'rating' && { color: '#FF9800' }]}>
                  {r.question_type === 'rating' ? 'Rating' : 'Reflection'}
                </Text>
              </View>
              <Text style={styles.reflDate}>
                {new Date(r.attempted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <Text style={styles.reflQuestion}>{r.question_text}</Text>
            <View style={styles.reflAnswerBox}>
              {r.question_type === 'rating' ? (
                <View style={styles.ratingRow}>
                  {[1,2,3,4,5].map(v => (
                    <View key={v} style={[styles.ratingPip, parseInt(r.selected_answer) >= v && { backgroundColor: '#FF9800' }]} />
                  ))}
                  <Text style={styles.ratingText}>{r.selected_answer}/5</Text>
                </View>
              ) : (
                <Text style={styles.reflAnswer}>{r.selected_answer}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  // ─── Student detail screen ────────────────────────────────────────────────

  const renderDetail = () => {
    if (!selected) return null;
    const TABS = [
      { key: 'overview',     label: 'Overview',     icon: 'grid-outline'      },
      { key: 'moods',        label: 'Moods',        icon: 'happy-outline'     },
      { key: 'sessions',     label: 'Sessions',     icon: 'timer-outline'     },
      { key: 'reflections',  label: 'Reflections',  icon: 'create-outline'    },
    ] as const;

    return (
      <View style={styles.detailWrap}>
        {/* Detail header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelected(null)}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.detailAvatarWrap}>
            <LinearGradient colors={[Colors.primary, Colors.primaryDark ?? Colors.primary]} style={styles.detailAvatar}>
              <Text style={styles.detailAvatarText}>{selected.name.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailName} numberOfLines={1}>{selected.name}</Text>
            <Text style={styles.detailEmail} numberOfLines={1}>{selected.email}</Text>
          </View>
          {selected.hasMoodAlert && (
            <View style={styles.detailAlertPill}>
              <Ionicons name="warning" size={13} color={Colors.white} />
              <Text style={styles.detailAlertText}>Alert</Text>
            </View>
          )}
        </View>

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, detailTab === tab.key && styles.tabBtnActive]}
              onPress={() => setDetailTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={15} color={detailTab === tab.key ? Colors.primary : Colors.textLight} />
              <Text style={[styles.tabBtnText, detailTab === tab.key && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        <View style={{ flex: 1 }}>
          {detailTab === 'overview'    && renderOverview()}
          {detailTab === 'moods'       && renderMoods()}
          {detailTab === 'sessions'    && renderSessions()}
          {detailTab === 'reflections' && renderReflections()}
        </View>
      </View>
    );
  };

  // ─── Student list ─────────────────────────────────────────────────────────

  const renderList = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStudents(); }} tintColor={Colors.primary} />
      }
    >
      <Text style={styles.pageTitle}>Student Monitor</Text>

      {/* Summary pills */}
      <View style={styles.pillsRow}>
        <View style={styles.pill}>
          <Ionicons name="people-outline" size={16} color={Colors.primary} />
          <Text style={styles.pillText}>{students.length} Students</Text>
        </View>
        {alertCount > 0 && (
          <TouchableOpacity style={[styles.pill, styles.pillAlert, filterAlerts && styles.pillAlertActive]}
            onPress={() => setFilterAlerts(v => !v)}>
            <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
            <Text style={[styles.pillText, { color: '#FF6B6B' }]}>{alertCount} Mood Alerts</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={Colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            placeholderTextColor={Colors.textLight}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={17} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, filterAlerts && styles.filterBtnActive]}
          onPress={() => setFilterAlerts(v => !v)}
        >
          <Ionicons name="alert-circle-outline" size={20} color={filterAlerts ? Colors.white : Colors.textMedium} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={56} color={Colors.textLight} />
          <Text style={styles.emptyText}>{search || filterAlerts ? 'No matches found' : 'No students yet'}</Text>
        </View>
      ) : (
        filtered.map(student => {
          const latestMood = student.recentMoods[0];
          return (
            <TouchableOpacity
              key={student.id}
              style={[styles.studentCard, student.hasMoodAlert && styles.studentCardAlert]}
              onPress={() => handleSelect(student)}
              activeOpacity={0.8}
            >
              {/* Left accent bar */}
              <View style={[styles.cardAccent, {
                backgroundColor: latestMood ? getMoodColor(latestMood.mood_value) : Colors.textLight,
              }]} />

              <View style={styles.cardBody}>
                {/* Row 1: avatar + name + chevron */}
                <View style={styles.cardTopRow}>
                  <LinearGradient
                    colors={student.hasMoodAlert ? ['#FF6B6B', '#FF8A80'] : [Colors.primary, Colors.primaryDark ?? Colors.primary]}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>{student.name.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
                      {student.hasMoodAlert && (
                        <View style={styles.cardAlertBadge}>
                          <Ionicons name="warning" size={10} color={Colors.white} />
                          <Text style={styles.cardAlertBadgeText}>Alert</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.studentEmail} numberOfLines={1}>{student.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
                </View>

                {/* Mood dots */}
                {student.recentMoods.length > 0 ? (
                  <View style={styles.moodDotsRow}>
                    <Text style={styles.moodDotsLabel}>7-day mood:</Text>
                    {[...student.recentMoods].slice(0,7).reverse().map((m, i) => (
                      <View key={i} style={[styles.moodDot, { backgroundColor: getMoodColor(m.mood_value) }]} />
                    ))}
                    <Text style={styles.moodLatest}>
                      {getMoodEmoji(student.recentMoods[0].mood_value)} {getMoodLabel(student.recentMoods[0].mood_value)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noMoodText}>No mood logs yet</Text>
                )}

                {/* Stats chips */}
                <View style={styles.chipsRow}>
                  <View style={styles.chip}>
                    <Ionicons name="checkmark-circle-outline" size={12} color={Colors.primary} />
                    <Text style={styles.chipText}>{student.todayTasksDone}/{student.todayTasksTotal} tasks today</Text>
                  </View>
                  <View style={styles.chip}>
                    <Ionicons name="timer-outline" size={12} color={Colors.primary} />
                    <Text style={styles.chipText}>{formatSecs(student.weekFocusSecs)} this week</Text>
                  </View>
                  {student.currentStreak > 0 && (
                    <View style={styles.chip}>
                      <Text style={{ fontSize: 11 }}>🔥</Text>
                      <Text style={styles.chipText}>{student.currentStreak}d streak</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <Background>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <LinearGradient colors={[Colors.primary, Colors.primaryDark ?? Colors.primary]} style={styles.logoIcon}>
              <Ionicons name="school-outline" size={22} color={Colors.white} />
            </LinearGradient>
            <Text style={styles.logoText}>Admin Panel</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/auth/login'); }}>
              <Ionicons name="exit-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {selected ? renderDetail() : renderList()}
      </View>
    </Background>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1 },
  header:     { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 16 : 10, paddingBottom: 14 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon:   { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logoText:   { fontSize: 22, fontWeight: '700', color: Colors.textDark, flex: 1 },
  logoutBtn:  { width: 40, height: 40, borderRadius: 11, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },

  scrollView:    { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  pageTitle:     { fontSize: 28, fontWeight: '800', color: Colors.textDark, marginBottom: 14 },

  pillsRow:      { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  pill:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E8E8E8' },
  pillText:      { fontSize: 13, fontWeight: '600', color: Colors.textMedium },
  pillAlert:     { borderColor: '#FF6B6B', backgroundColor: 'rgba(255,107,107,0.06)' },
  pillAlertActive: { backgroundColor: 'rgba(255,107,107,0.15)' },

  searchRow:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchBox:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E8E8E8' },
  searchInput:   { flex: 1, fontSize: 15, color: Colors.textDark },
  filterBtn:     { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  loaderWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap:  { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyText:  { fontSize: 17, fontWeight: '600', color: Colors.textMedium },

  studentCard:      { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E8E8E8', overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }, android: { elevation: 2 } }) },
  studentCardAlert: { borderColor: '#FF6B6B' },
  cardAccent:       { width: 5, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  cardBody:         { flex: 1, padding: 14, gap: 8 },
  cardTopRow:       { flexDirection: 'row', alignItems: 'center' },
  avatar:           { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 18, fontWeight: '800', color: Colors.white },
  nameRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  studentName:      { fontSize: 15, fontWeight: '700', color: Colors.textDark, flex: 1 },
  studentEmail:     { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  cardAlertBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FF6B6B', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  cardAlertBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.white, textTransform: 'uppercase' },

  moodDotsRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  moodDotsLabel: { fontSize: 11, fontWeight: '600', color: Colors.textLight },
  moodDot:       { width: 10, height: 10, borderRadius: 5 },
  moodLatest:    { fontSize: 12, fontWeight: '600', color: Colors.textMedium, marginLeft: 4 },
  noMoodText:    { fontSize: 12, color: Colors.textLight, fontStyle: 'italic' },

  chipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(74,155,127,0.08)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textMedium },

  // ── Detail ────────────────────────────────────────────────────────────────
  detailWrap:       { flex: 1 },
  detailHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14 },
  backBtn:          { width: 40, height: 40, borderRadius: 11, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8E8E8' },
  detailAvatarWrap: {},
  detailAvatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detailAvatarText: { fontSize: 20, fontWeight: '800', color: Colors.white },
  detailName:       { fontSize: 16, fontWeight: '700', color: Colors.textDark },
  detailEmail:      { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  detailAlertPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF6B6B', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  detailAlertText:  { fontSize: 11, fontWeight: '700', color: Colors.white },

  tabBarScroll: { maxHeight: 52, flexGrow: 0 },
  tabBar:       { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 10 },
  tabBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#E8E8E8' },
  tabBtnActive: { backgroundColor: 'rgba(74,155,127,0.12)', borderColor: Colors.primary },
  tabBtnText:   { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  tabBtnTextActive: { color: Colors.primary, fontWeight: '700' },

  tabContent: { paddingHorizontal: 20, paddingBottom: 60, gap: 12 },
  tabEmpty:   { textAlign: 'center', marginTop: 40, fontSize: 14, color: Colors.textLight, paddingHorizontal: 40 },
  tabLoader:  { marginTop: 40 },

  // Overview
  overviewGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  overviewCard:  { flex: 1, minWidth: '45%', backgroundColor: Colors.white, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E8E8E8' },
  overviewVal:   { fontSize: 22, fontWeight: '800', color: Colors.textDark },
  overviewLabel: { fontSize: 11, fontWeight: '600', color: Colors.textLight, textTransform: 'uppercase' },

  alertBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,107,107,0.08)', borderRadius: 14, borderWidth: 1, borderColor: '#FF6B6B', padding: 14 },
  alertBannerText: { flex: 1, fontSize: 13, color: '#FF6B6B', fontWeight: '500', lineHeight: 18 },

  latestMoodCard:  { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderWidth: 1, borderColor: '#E8E8E8' },
  latestMoodRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 10 },
  latestMoodEmoji: { fontSize: 32 },
  latestMoodLabel: { fontSize: 16, fontWeight: '700' },
  latestMoodNotes: { fontSize: 13, color: Colors.textMedium, marginTop: 4, fontStyle: 'italic', lineHeight: 18 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textMedium, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  moodBarCard:     { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8E8E8' },
  moodBarRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  moodBarCol:      { flex: 1, alignItems: 'center', gap: 4 },
  moodBarTrack:    { width: '100%', flex: 1, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  moodBarFill:     { width: '100%', borderRadius: 4 },
  moodBarDate:     { fontSize: 9, color: Colors.textLight, fontWeight: '600' },
  moodBarLegend:   { flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  moodBarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  moodBarLegendDot:  { width: 8, height: 8, borderRadius: 4 },
  moodBarLegendText: { fontSize: 10, color: Colors.textLight, fontWeight: '600' },

  // Moods tab
  moodEntry:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: '#E8E8E8' },
  moodEntryEmoji:  { fontSize: 24, lineHeight: 28 },
  moodEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moodEntryLabel:  { fontSize: 15, fontWeight: '700' },
  moodEntryDate:   { fontSize: 12, color: Colors.textLight, fontWeight: '500' },
  moodEntryNotes:  { fontSize: 13, color: Colors.textMedium, marginTop: 4, fontStyle: 'italic', lineHeight: 18 },

  // Sessions tab
  sessTotalRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(74,155,127,0.08)', borderRadius: 12, padding: 12 },
  sessTotalText:  { fontSize: 13, fontWeight: '700', color: Colors.primary },
  sessEntry:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E8E8E8' },
  sessEntryDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sessEntryTask:  { fontSize: 14, fontWeight: '600', color: Colors.textDark },
  sessEntryMeta:  { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  sessEntryDur:   { fontSize: 14, fontWeight: '800', color: Colors.primary },

  // Reflections tab
  reflCard:        { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#E8E8E8' },
  reflHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reflBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(74,155,127,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  reflBadgeRating: { backgroundColor: 'rgba(255,152,0,0.1)' },
  reflBadgeText:   { fontSize: 10, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },
  reflDate:        { fontSize: 11, color: Colors.textLight, fontWeight: '500' },
  reflQuestion:    { fontSize: 13, fontWeight: '600', color: Colors.textMedium, lineHeight: 18 },
  reflAnswerBox:   { backgroundColor: 'rgba(74,155,127,0.06)', borderRadius: 10, padding: 12 },
  reflAnswer:      { fontSize: 14, color: Colors.textDark, lineHeight: 20 },
  ratingRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingPip:       { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E0E0E0' },
  ratingText:      { fontSize: 14, fontWeight: '800', color: '#FF9800', marginLeft: 6 },
});