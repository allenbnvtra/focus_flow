import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Modal, KeyboardAvoidingView,
  Alert, ActivityIndicator, AppState, Linking, Dimensions
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Background from "../../../components/Background";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  scheduleUndoneTaskReminder,
  scheduleStreakReminder,
  updateTimerNotification,
  clearTimerNotification,
  registerTimerNotificationCategory,
  setupNotificationChannels,
  requestNotificationPermissions,
  requestExactAlarmPermission,
  scheduleTaskReminderNotif,
  cancelTaskReminderNotif,
} from "../../../lib/notifications";
import {
  startLiveActivity,
  updateLiveActivity,
  stopLiveActivity,
} from "../../../lib/liveActivity";

const TIMER_STORAGE_KEY = "focusflow_active_timer";
const GOAL_STORAGE_KEY  = "focusflow_daily_goal";

const NOTIF_UPDATE_INTERVAL_MS        = 10_000;
const LIVE_ACTIVITY_UPDATE_INTERVAL_MS = 15_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "high" | "medium" | "low";

interface Task {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  focus_time: number;
  completion_count: number;
  created_at: string;
  updated_at: string;
  // New scheduling fields (require DB migration: see below)
  task_date?: string | null;        // "YYYY-MM-DD" — which day this task belongs to
  scheduled_time?: string | null;   // "HH:MM"      — reminder time
  target_sessions?: number | null;  // how many focus sessions planned
  priority?: Priority | null;       // high / medium / low
}

interface SessionDisplay {
  id: string;
  task_name: string | null;
  duration_minutes: number;
  completed_at: string;
  emotion: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAUSE_REASONS = [
  { icon: "cafe-outline",            label: "Taking a break" },
  { icon: "sad-outline",             label: "Feeling bored" },
  { icon: "swap-horizontal-outline", label: "Switching tasks" },
  { icon: "call-outline",            label: "Phone call" },
  { icon: "restaurant-outline",      label: "Eating / drinking" },
  { icon: "walk-outline",            label: "Stepping away" },
  { icon: "help-circle-outline",     label: "Other" },
] as const;

const EMOTIONS = [
  { emoji: "🤩", label: "Energized" },
  { emoji: "😊", label: "Proud" },
  { emoji: "😌", label: "Relieved" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😤", label: "Frustrated" },
  { emoji: "🤯", label: "Overwhelmed" },
  { emoji: "😎", label: "Confident" },
] as const;

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: string }> = {
  high:   { label: "High",   color: "#FF6B6B", icon: "flame" },
  medium: { label: "Medium", color: "#FFB300", icon: "alert-circle" },
  low:    { label: "Low",    color: "#4CAF50", icon: "leaf" },
};

const DATE_RANGE       = 7;  // days before/after today to show in strip
const DATE_ITEM_WIDTH  = 52; // matches minWidth in styles.dateItem
const DATE_ITEM_GAP    = 6;  // matches gap in styles.dateStrip
const DATE_STRIP_PAD   = 16; // matches paddingHorizontal in styles.dateStrip

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" in the device's LOCAL timezone — never UTC. */
const localDateStr = (d: Date = new Date()) => {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${dy}`;
};

const todayStr = () => localDateStr();

function buildDateRange(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  for (let i = -DATE_RANGE; i <= DATE_RANGE; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function toDateStr(d: Date): string {
  return localDateStr(d);
}

function formatDisplayDate(dateStr: string): string {
  const today = todayStr();
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d); })();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d); })();
  if (dateStr === today)     return "Today's Goals";
  if (dateStr === tomorrow)  return "Tomorrow's Goals";
  if (dateStr === yesterday) return "Yesterday's Goals";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) + "'s Goals";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FocusTracker() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  const dateStripRef = useRef<ScrollView>(null);

  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map()).current;

  const [tasks, setTasks]                 = useState<Task[]>([]);
  const [todaySessions, setTodaySessions] = useState<SessionDisplay[]>([]);
  const [loading, setLoading]             = useState(true);

  // Date navigation
  const [selectedDate, setSelectedDate]   = useState<string>(todayStr());
  const dateRange = buildDateRange();

  // Full calendar modal
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarYear, setCalendarYear]           = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth]         = useState(new Date().getMonth()); // 0-indexed
  const [taskCountsByDate, setTaskCountsByDate]   = useState<Record<string, number>>({});
  const [loadingCalendar, setLoadingCalendar]     = useState(false);

  // Timer state
  const [activeTaskId, setActiveTaskId]         = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds]     = useState(0);
  const [isPaused, setIsPaused]                 = useState(false);
  const [elapsedAtPause, setElapsedAtPause]     = useState(0);

  // Pause
  const [pauseReason, setPauseReason]       = useState<string | null>(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [savingPause, setSavingPause]       = useState(false);

  // Emotion
  const [showEmotionModal, setShowEmotionModal]               = useState(false);
  const [selectedEmotion, setSelectedEmotion]                 = useState<string | null>(null);
  const [pendingCompletionTaskId, setPendingCompletionTaskId] = useState<string | null>(null);
  const [pendingElapsedSeconds, setPendingElapsedSeconds]     = useState(0);
  const [savingCompletion, setSavingCompletion]               = useState(false);

  // Task modals — add
  const [showAddTaskModal, setShowAddTaskModal]   = useState(false);
  const [newTaskText, setNewTaskText]             = useState("");
  const [newTaskTimeHour, setNewTaskTimeHour]     = useState("09");
  const [newTaskTimeMinute, setNewTaskTimeMinute] = useState("00");
  const [newTaskUseTime, setNewTaskUseTime]       = useState(false);
  const [newTaskSessions, setNewTaskSessions]     = useState("1");
  const [newTaskPriority, setNewTaskPriority]     = useState<Priority | null>(null);
  const [addingTask, setAddingTask]               = useState(false);

  // Task modals — edit
  const [showEditModal, setShowEditModal]           = useState(false);
  const [editingTask, setEditingTask]               = useState<Task | null>(null);
  const [editTaskText, setEditTaskText]             = useState("");
  const [editTaskTimeHour, setEditTaskTimeHour]     = useState("09");
  const [editTaskTimeMinute, setEditTaskTimeMinute] = useState("00");
  const [editTaskUseTime, setEditTaskUseTime]       = useState(false);
  const [editTaskSessions, setEditTaskSessions]     = useState("1");
  const [editTaskPriority, setEditTaskPriority]     = useState<Priority | null>(null);

  // Daily goal
  const [dailyGoalSeconds, setDailyGoalSeconds] = useState<number>(0);
  const [showGoalModal, setShowGoalModal]       = useState(false);
  const [goalHours, setGoalHours]               = useState("2");
  const [goalMinutes, setGoalMinutes]           = useState("0");
  const goalAlertedRef = useRef(false);

  // Refs for notification + Live Activity
  const activeTaskNameRef          = useRef<string>('Focus session');
  const lastNotifUpdateRef         = useRef<number>(0);
  const lastLiveActivityUpdateRef  = useRef<number>(0);
  const elapsedSecondsRef          = useRef<number>(0);
  const isPausedRef                = useRef<boolean>(false);
  const activeTaskIdRef            = useRef<string | null>(null);

  // Ref to always hold the latest stopCurrentSession (avoids stale closure in deep link handler)
  const stopCurrentSessionRef = useRef<(save: boolean) => Promise<void>>(async () => {});

  // Keep refs in sync
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { activeTaskIdRef.current = activeTaskId; }, [activeTaskId]);

  // Scroll date strip so today is centred on mount
  useEffect(() => {
    const screenWidth = Dimensions.get("window").width;
    const itemSlot    = DATE_ITEM_WIDTH + DATE_ITEM_GAP;
    const todayLeft   = DATE_STRIP_PAD + DATE_RANGE * itemSlot;
    const scrollX     = todayLeft - screenWidth / 2 + DATE_ITEM_WIDTH / 2;
    setTimeout(() => {
      dateStripRef.current?.scrollTo({ x: Math.max(0, scrollX), animated: false });
    }, 50);
  }, []);

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in your device settings so FocusFlow can remind you when it's time to focus.",
        );
      }
      await setupNotificationChannels();
      await registerTimerNotificationCategory();
      // Android 12: exact-alarm permission lives in system settings
      await requestExactAlarmPermission();
    })();
    if (user) {
      fetchTasks(selectedDate);
      fetchTodaySessions();
      restoreTimerState();
      loadDailyGoal();
    }
  }, [user]);

  // Re-fetch tasks when date changes
  useEffect(() => {
    if (user) fetchTasks(selectedDate);
  }, [selectedDate]);

  useEffect(() => { saveTimerState(); },
    [activeTaskId, isPaused, pauseReason, elapsedAtPause, sessionStartTime]);

  // App foreground restore
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        restoreTimerState();
        fetchTasks(selectedDate);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [selectedDate]);

  // Deep link handler — Dynamic Island pause/resume/stop buttons
  useEffect(() => {
    const handleURL = ({ url }: { url: string }) => {
      if (url === "focusflow://timer/pause" && activeTaskIdRef.current && !isPausedRef.current) {
        setElapsedAtPause(elapsedSecondsRef.current);
        setSessionStartTime(null);
        setIsPaused(true);
        setPauseReason("Break");
        pushUpdatesNow(activeTaskNameRef.current, elapsedSecondsRef.current, true);
      } else if (url === "focusflow://timer/resume" && activeTaskIdRef.current && isPausedRef.current) {
        setSessionStartTime(new Date());
        setIsPaused(false);
        setPauseReason(null);
        pushUpdatesNow(activeTaskNameRef.current, elapsedSecondsRef.current, false);
      } else if (url === "focusflow://timer/stop" && activeTaskIdRef.current) {
        stopCurrentSessionRef.current(true);
      }
    };

    // Handle URL if app was opened from a cold start via the deep link
    Linking.getInitialURL().then((url) => { if (url) handleURL({ url }); });

    const sub = Linking.addEventListener("url", handleURL);
    return () => sub.remove();
  }, []);

  // Main 1-second tick
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeTaskId && !isPaused && sessionStartTime) {
      interval = setInterval(() => {
        setElapsedSeconds(
          Math.floor((Date.now() - sessionStartTime.getTime()) / 1000) + elapsedAtPause
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTaskId, isPaused, sessionStartTime, elapsedAtPause]);

  // Notification + Live Activity update interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeTaskIdRef.current) return;
      const name    = activeTaskNameRef.current;
      const elapsed = elapsedSecondsRef.current;
      const paused  = isPausedRef.current;
      const now     = Date.now();

      if (now - lastNotifUpdateRef.current >= NOTIF_UPDATE_INTERVAL_MS) {
        lastNotifUpdateRef.current = now;
        updateTimerNotification(name, elapsed, paused);
      }
      if (now - lastLiveActivityUpdateRef.current >= LIVE_ACTIVITY_UPDATE_INTERVAL_MS) {
        lastLiveActivityUpdateRef.current = now;
        updateLiveActivity(name, elapsed, paused);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync task name ref
  useEffect(() => {
    const task = tasks.find(t => t.id === activeTaskId);
    activeTaskNameRef.current = task?.text ?? 'Focus session';
  }, [tasks, activeTaskId]);

  // Immediate update on pause/resume
  const pushUpdatesNow = useCallback((name: string, elapsed: number, paused: boolean) => {
    lastNotifUpdateRef.current        = Date.now();
    lastLiveActivityUpdateRef.current = Date.now();
    updateTimerNotification(name, elapsed, paused);
    updateLiveActivity(name, elapsed, paused);
  }, []);

  useEffect(() => {
    if (!dailyGoalSeconds) return;
    const totalSpent = totalSessionSecs + (activeTaskId ? elapsedSeconds : 0);
    if (totalSpent >= dailyGoalSeconds && !goalAlertedRef.current) {
      goalAlertedRef.current = true;
      saveDailyGoal(dailyGoalSeconds, true);
      Alert.alert("🏆 Daily Goal Reached!", "You've hit your focus target for today. Amazing work!");
    }
  }, [elapsedSeconds, todaySessions, dailyGoalSeconds]);

  // Notification action buttons
  useEffect(() => {
    const interval = setInterval(async () => {
      const action = await AsyncStorage.getItem("focusflow_notif_action");
      if (!action) return;
      await AsyncStorage.removeItem("focusflow_notif_action");
      if (action === "pause"  && activeTaskId && !isPaused) handlePause();
      if (action === "resume" && activeTaskId && isPaused)  handleResume();
      if (action === "stop"   && activeTaskId)              handleStopTask();
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTaskId, isPaused]);

  useEffect(() => {
    if (!tasks.length) return;
    const incomplete = tasks.filter(t => !t.completed).map(t => t.text);
    scheduleUndoneTaskReminder(incomplete);
  }, [tasks]);

  useEffect(() => {
    scheduleStreakReminder(todaySessions.length > 0);
  }, [todaySessions]);

  // ─── Daily goal ───────────────────────────────────────────────────────────

  const loadDailyGoal = async () => {
    try {
      const raw = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
      if (!raw) return;
      const { goalSecs, goalDate, goalAlerted } = JSON.parse(raw);
      const today = todayStr();
      if (goalDate !== today) {
        goalAlertedRef.current = false;
        await AsyncStorage.setItem(
          GOAL_STORAGE_KEY,
          JSON.stringify({ goalSecs, goalDate: today, goalAlerted: false })
        );
      } else {
        goalAlertedRef.current = goalAlerted ?? false;
      }
      setDailyGoalSeconds(goalSecs ?? 0);
    } catch (e) { console.error("Failed to load daily goal:", e); }
  };

  const saveDailyGoal = async (secs: number, alerted = goalAlertedRef.current) => {
    try {
      await AsyncStorage.setItem(
        GOAL_STORAGE_KEY,
        JSON.stringify({ goalSecs: secs, goalDate: todayStr(), goalAlerted: alerted })
      );
    } catch (e) { console.error("Failed to save daily goal:", e); }
  };

  const confirmGoal = () => {
    const h = Math.max(0, parseInt(goalHours   || "0", 10));
    const m = Math.max(0, Math.min(59, parseInt(goalMinutes || "0", 10)));
    const secs = h * 3600 + m * 60;
    if (secs === 0) { Alert.alert("Invalid Goal", "Please enter at least 1 minute."); return; }
    goalAlertedRef.current = false;
    setDailyGoalSeconds(secs);
    saveDailyGoal(secs, false);
    setShowGoalModal(false);
  };

  const clearGoal = () => {
    goalAlertedRef.current = false;
    setDailyGoalSeconds(0);
    saveDailyGoal(0, false);
    setShowGoalModal(false);
  };

  // ─── Timer persistence ────────────────────────────────────────────────────

  const saveTimerState = async () => {
    try {
      if (!activeTaskId) {
        await AsyncStorage.removeItem(TIMER_STORAGE_KEY);
        if (user?.id) {
          await supabase.from("active_timer_state").delete().eq("user_id", user.id);
        }
        return;
      }
      const payload = {
        activeTaskId, isPaused, pauseReason, elapsedAtPause,
        sessionStartEpoch: isPaused ? null : sessionStartTime?.getTime() ?? null,
      };
      await AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(payload));
      if (user?.id) {
        await supabase.from("active_timer_state").upsert({
          user_id: user.id, task_id: activeTaskId, is_paused: isPaused,
          pause_reason: pauseReason, elapsed_at_pause: elapsedAtPause,
          session_start_epoch: isPaused ? null : sessionStartTime?.getTime() ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    } catch (e) { console.error("Failed to save timer state:", e); }
  };

  const restoreTimerState = async () => {
    try {
      let saved: any = null;
      if (user?.id) {
        const { data } = await supabase
          .from("active_timer_state").select("*").eq("user_id", user.id).maybeSingle();
        if (data) {
          saved = {
            activeTaskId: data.task_id, isPaused: data.is_paused,
            pauseReason: data.pause_reason, elapsedAtPause: data.elapsed_at_pause,
            sessionStartEpoch: data.session_start_epoch,
          };
          await AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(saved));
        }
      }
      if (!saved) {
        const raw = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
      }
      if (!saved?.activeTaskId) return;
      const { activeTaskId: tid, isPaused: paused, pauseReason: reason,
              elapsedAtPause: atPause, sessionStartEpoch } = saved;
      setActiveTaskId(tid);
      setIsPaused(paused);
      setPauseReason(reason ?? null);
      setElapsedAtPause(atPause ?? 0);
      if (!paused && sessionStartEpoch) {
        const reconstructed = new Date(sessionStartEpoch);
        setSessionStartTime(reconstructed);
        setElapsedSeconds(Math.floor((Date.now() - reconstructed.getTime()) / 1000) + (atPause ?? 0));
      } else {
        setSessionStartTime(null);
        setElapsedSeconds(atPause ?? 0);
      }
    } catch (e) { console.error("Failed to restore timer state:", e); }
  };

  // ─── Data fetching ────────────────────────────────────────────────────────

  /**
   * Fetch tasks for a given date.
   * Queries task_date = dateStr first (new tasks).
   * For today also falls back to tasks with no task_date (legacy tasks created_at today).
   */
  const fetchTasks = async (dateStr: string) => {
    try {
      setLoading(true);
      const start = new Date(dateStr + "T00:00:00");
      const end   = new Date(dateStr + "T23:59:59");

      // Tasks explicitly scheduled for this date
      const { data: scheduled, error: e1 } = await supabase
        .from("tasks").select("*").eq("user_id", user?.id)
        .eq("task_date", dateStr)
        .order("created_at", { ascending: false });
      if (e1) throw e1;

      // Legacy tasks (no task_date) only shown on the date they were created
      const { data: legacy, error: e2 } = await supabase
        .from("tasks").select("*").eq("user_id", user?.id)
        .is("task_date", null)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false });
      if (e2) throw e2;

      const combined = [...(scheduled || []), ...(legacy || [])];
      // Sort: incomplete first, then completed; within each group by created_at desc
      combined.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setTasks(combined);
    } catch { Alert.alert("Error", "Failed to load tasks"); }
    finally { setLoading(false); }
  };

  const fetchTodaySessions = async () => {
    try {
      const today = todayStr();
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("id, duration_minutes, completed_at, emotion, tasks(text)")
        .eq("user_id", user?.id)
        .gte("completed_at", `${today}T00:00:00`)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      setTodaySessions(
        (data || []).map((s: any) => ({
          id: s.id, task_name: s.tasks?.text || null,
          duration_minutes: s.duration_minutes, completed_at: s.completed_at,
          emotion: s.emotion || null,
        }))
      );
    } catch (e) { console.error("Error fetching sessions:", e); }
  };

  // ─── Calendar task counts ─────────────────────────────────────────────────

  const fetchTaskCountsForMonth = async (year: number, month: number) => {
    if (!user?.id) return;
    setLoadingCalendar(true);
    try {
      const firstDay  = `${year}-${pad(month + 1)}-01`;
      const lastDayN  = new Date(year, month + 1, 0).getDate();
      const lastDay   = `${year}-${pad(month + 1)}-${pad(lastDayN)}`;

      // Tasks with explicit task_date in this month
      const { data: scheduled } = await supabase
        .from("tasks").select("task_date")
        .eq("user_id", user.id)
        .gte("task_date", firstDay)
        .lte("task_date", lastDay);

      // Legacy tasks (no task_date) created in this month
      const { data: legacy } = await supabase
        .from("tasks").select("created_at")
        .eq("user_id", user.id)
        .is("task_date", null)
        .gte("created_at", `${firstDay}T00:00:00`)
        .lte("created_at", `${lastDay}T23:59:59`);

      const counts: Record<string, number> = {};
      for (const t of (scheduled || [])) {
        if (t.task_date) counts[t.task_date] = (counts[t.task_date] || 0) + 1;
      }
      for (const t of (legacy || [])) {
        if (t.created_at) {
          const d = t.created_at.split("T")[0];
          counts[d] = (counts[d] || 0) + 1;
        }
      }
      setTaskCountsByDate(counts);
    } catch (e) { console.error("Failed to fetch task counts:", e); }
    finally { setLoadingCalendar(false); }
  };

  // Re-fetch counts when calendar month changes or opens
  useEffect(() => {
    if (showCalendarModal) fetchTaskCountsForMonth(calendarYear, calendarMonth);
  }, [showCalendarModal, calendarYear, calendarMonth]);

  const openCalendar = () => {
    // Open to the month of the currently selected date
    const d = new Date(selectedDate + "T00:00:00");
    setCalendarYear(d.getFullYear());
    setCalendarMonth(d.getMonth());
    setShowCalendarModal(true);
  };

  // ─── Date navigation ──────────────────────────────────────────────────────

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const isToday = selectedDate === todayStr();

  // ─── Timer helpers ────────────────────────────────────────────────────────

  const startNewTask = (taskId: string) => {
    const taskName = tasks.find(t => t.id === taskId)?.text ?? 'Focus session';
    setActiveTaskId(taskId);
    setSessionStartTime(new Date());
    setElapsedSeconds(0);
    setElapsedAtPause(0);
    setIsPaused(false);
    setPauseReason(null);
    activeTaskNameRef.current        = taskName;
    lastNotifUpdateRef.current        = 0;
    lastLiveActivityUpdateRef.current = 0;
    updateTimerNotification(taskName, 0, false);
    startLiveActivity(taskName, 0);
  };

  const resetTimer = () => {
    setActiveTaskId(null);
    setSessionStartTime(null);
    setElapsedSeconds(0);
    setElapsedAtPause(0);
    setIsPaused(false);
    setPauseReason(null);
    activeTaskNameRef.current        = 'Focus session';
    lastNotifUpdateRef.current        = 0;
    lastLiveActivityUpdateRef.current = 0;
    clearTimerNotification();
    stopLiveActivity();
    AsyncStorage.removeItem(TIMER_STORAGE_KEY).catch(() => {});
    if (user?.id) {
      supabase.from("active_timer_state").delete().eq("user_id", user.id).then(() => {});
    }
  };

  const handleStartTask = (taskId: string) => {
    if (activeTaskId && activeTaskId !== taskId) {
      Alert.alert("Task In Progress", "Stop the current session first?", [
        { text: "Cancel", style: "cancel" },
        { text: "Stop & Switch", onPress: async () => { await stopCurrentSession(false); startNewTask(taskId); } },
      ]);
      return;
    }
    startNewTask(taskId);
  };

  // ─── Pause ────────────────────────────────────────────────────────────────

  const handlePause = () => {
    setElapsedAtPause(elapsedSeconds);
    setSessionStartTime(null);
    setIsPaused(true);
    setPauseReason(null);
    setShowPauseModal(true);
    pushUpdatesNow(activeTaskNameRef.current, elapsedSeconds, true);
  };

  const confirmPause = async (reason: string) => {
    setPauseReason(reason);
    setSavingPause(true);
    try {
      await supabase.from("pause_logs").insert({
        user_id: user?.id, task_id: activeTaskId, reason,
        paused_at: new Date().toISOString(), elapsed_seconds: elapsedSeconds,
      });
    } catch (e) { console.error("Failed to save pause log:", e); }
    finally { setSavingPause(false); setShowPauseModal(false); }
  };

  const handleResume = () => {
    setSessionStartTime(new Date());
    setIsPaused(false);
    setPauseReason(null);
    pushUpdatesNow(activeTaskNameRef.current, elapsedSeconds, false);
  };

  // ─── Completion ───────────────────────────────────────────────────────────

  const handleCompleteActiveTask = () => {
    if (!activeTaskId) return;
    setPendingCompletionTaskId(activeTaskId);
    setPendingElapsedSeconds(elapsedSeconds);
    setSelectedEmotion(null);
    setSessionStartTime(null);
    setShowEmotionModal(true);
  };

  const confirmCompletion = async () => {
    const taskId  = pendingCompletionTaskId;
    const elapsed = pendingElapsedSeconds;
    if (!taskId) return;
    setSavingCompletion(true);
    const startedAt = new Date(Date.now() - elapsed * 1000);
    try {
      const { error: sErr } = await supabase.from("focus_sessions").insert({
        user_id: user?.id, task_id: taskId, duration_minutes: elapsed,
        started_at: startedAt.toISOString(), completed_at: new Date().toISOString(),
        emotion: selectedEmotion,
      });
      if (sErr) throw sErr;
      const task = tasks.find(t => t.id === taskId);
      const newFocusTime = (task?.focus_time || 0) + Math.round(elapsed / 60);
      const newCount     = (task?.completion_count || 0) + 1;
      const { error: tErr } = await supabase.from("tasks").update({
        completed: true, focus_time: newFocusTime, completion_count: newCount,
      }).eq("id", taskId);
      if (tErr) throw tErr;
      setTasks(prev => prev.map(t => t.id === taskId
        ? { ...t, completed: true, focus_time: newFocusTime, completion_count: newCount } : t));
      resetTimer();
      setPendingCompletionTaskId(null);
      setPendingElapsedSeconds(0);
      setShowEmotionModal(false);
      fetchTodaySessions();
      Alert.alert("🎉 Task Complete!",
        `You focused for ${formatElapsed(elapsed)}${selectedEmotion ? `\nFeeling: ${selectedEmotion}` : ""}`);
    } catch { Alert.alert("Error", "Failed to save session"); }
    finally { setSavingCompletion(false); }
  };

  // ─── Stop early ───────────────────────────────────────────────────────────

  const handleStopTask = () => {
    Alert.alert("Stop Session?", "Save progress before stopping?", [
      { text: "Cancel", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => resetTimer() },
      { text: "Save", onPress: () => stopCurrentSession(true) },
    ]);
  };

  const stopCurrentSession = async (save: boolean) => {
    if (save && activeTaskId) {
      if (elapsedSeconds < 60) {
        Alert.alert("Too Short", "Sessions under 1 minute won't be saved.");
        resetTimer(); return;
      }
      const startedAt = new Date(Date.now() - elapsedSeconds * 1000);
      try {
        await supabase.from("focus_sessions").insert({
          user_id: user?.id, task_id: activeTaskId, duration_minutes: elapsedSeconds,
          started_at: startedAt.toISOString(), completed_at: new Date().toISOString(),
        });
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
          const newFocusTime = (task.focus_time || 0) + Math.round(elapsedSeconds / 60);
          await supabase.from("tasks").update({ focus_time: newFocusTime }).eq("id", activeTaskId);
          setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, focus_time: newFocusTime } : t));
        }
        fetchTodaySessions();
        Alert.alert("Session Saved", `Logged ${formatElapsed(elapsedSeconds)}`);
      } catch { Alert.alert("Error", "Failed to save session"); }
    }
    resetTimer();
  };

  // Keep ref in sync so deep link handler always calls the latest version
  stopCurrentSessionRef.current = stopCurrentSession;

  // ─── Task CRUD ────────────────────────────────────────────────────────────

  const resetAddForm = () => {
    setNewTaskText("");
    setNewTaskTimeHour("09");
    setNewTaskTimeMinute("00");
    setNewTaskUseTime(false);
    setNewTaskSessions("1");
    setNewTaskPriority(null);
  };

  const handleAddTask = async () => {
    if (!newTaskText.trim()) { Alert.alert("Error", "Please enter a task"); return; }
    const targetSessions = Math.max(1, parseInt(newTaskSessions || "1", 10));
    const scheduledTime  = newTaskUseTime
      ? `${newTaskTimeHour.padStart(2, "0")}:${newTaskTimeMinute.padStart(2, "0")}`
      : null;

    try {
      setAddingTask(true);
      const { data, error } = await supabase.from("tasks").insert({
        user_id: user?.id,
        text: newTaskText.trim(),
        completed: false,
        focus_time: 0,
        completion_count: 0,
        task_date: selectedDate,
        scheduled_time: scheduledTime,
        target_sessions: targetSessions,
        priority: newTaskPriority,
      }).select().single();
      if (error) throw error;

      setTasks(prev => [data, ...prev]);
      resetAddForm();
      setShowAddTaskModal(false);

      // Schedule a reminder notification if time is set
      if (scheduledTime && data?.id) {
        const result = await scheduleTaskReminderNotif(data.id, data.text, selectedDate, scheduledTime);
        if (result === 'past') {
          Alert.alert(
            "Reminder Not Set",
            `The time you chose (${formatTime12h(scheduledTime)}) has already passed for ${selectedDate === todayStr() ? "today" : selectedDate}. Edit the task to pick a future time.`,
          );
        } else if (result === 'error') {
          Alert.alert("Reminder Error", "Task was saved but the reminder could not be scheduled. Check your notification permissions in Settings.");
        }
      }
    } catch { Alert.alert("Error", "Failed to add task"); }
    finally { setAddingTask(false); }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditTaskText(task.text);
    const [h, m] = (task.scheduled_time || "09:00").split(":");
    setEditTaskTimeHour(h || "09");
    setEditTaskTimeMinute(m || "00");
    setEditTaskUseTime(!!task.scheduled_time);
    setEditTaskSessions((task.target_sessions ?? 1).toString());
    setEditTaskPriority(task.priority ?? null);
    setShowEditModal(true);
  };

  const handleEditTask = async () => {
    if (!editTaskText.trim() || !editingTask) { Alert.alert("Error", "Please enter a task"); return; }
    const targetSessions = Math.max(1, parseInt(editTaskSessions || "1", 10));
    const scheduledTime  = editTaskUseTime
      ? `${editTaskTimeHour.padStart(2, "0")}:${editTaskTimeMinute.padStart(2, "0")}`
      : null;

    try {
      setAddingTask(true);
      const { data, error } = await supabase.from("tasks")
        .update({
          text: editTaskText.trim(),
          scheduled_time: scheduledTime,
          target_sessions: targetSessions,
          priority: editTaskPriority,
        })
        .eq("id", editingTask.id)
        .select().single();
      if (error) throw error;

      setTasks(tasks.map(t => t.id === editingTask.id ? data : t));

      if (activeTaskId === editingTask.id) {
        activeTaskNameRef.current = editTaskText.trim();
        pushUpdatesNow(editTaskText.trim(), elapsedSeconds, isPaused);
      }

      // Re-schedule reminder
      await cancelTaskReminderNotif(editingTask.id);
      if (scheduledTime && data?.task_date) {
        const result = await scheduleTaskReminderNotif(data.id, data.text, data.task_date, scheduledTime);
        if (result === 'past') {
          Alert.alert(
            "Reminder Not Set",
            `The time you chose (${formatTime12h(scheduledTime)}) has already passed. Update it to a future time to receive a reminder.`,
          );
        } else if (result === 'error') {
          Alert.alert("Reminder Error", "Task was saved but the reminder could not be scheduled. Check your notification permissions in Settings.");
        }
      }

      setShowEditModal(false);
      setEditingTask(null);
    } catch { Alert.alert("Error", "Failed to update task"); }
    finally { setAddingTask(false); }
  };

  const handleDeleteTask = async (taskId: string) => {
    Alert.alert("Delete Task", "Remove this task and all its sessions?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const copy = [...tasks];
          setTasks(tasks.filter(t => t.id !== taskId));
          if (activeTaskId === taskId) resetTimer();
          try {
            await cancelTaskReminderNotif(taskId);
            await supabase.from("tasks").delete().eq("id", taskId);
          } catch { setTasks(copy); Alert.alert("Error", "Failed to delete task"); }
        },
      },
    ]);
  };

  // ─── Formatters ───────────────────────────────────────────────────────────

  const pad = (n: number) => n.toString().padStart(2, "0");

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  const formatSessionDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  const formatFocusTime = (minutes: number) => {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
  };

  const formatSessionTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatTime12h = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12  = h % 12 || 12;
    return `${h12}:${pad(m)} ${ampm}`;
  };

  // ─── Derived ─────────────────────────────────────────────────────────────

  const completedCount   = tasks.filter(t => t.completed).length;
  const totalCount       = tasks.length;
  const totalFocusTime   = tasks.reduce((s, t) => s + (t.focus_time || 0), 0);
  const totalSessionSecs = todaySessions.reduce((s, sess) => s + sess.duration_minutes, 0);
  const activeTask       = tasks.find(t => t.id === activeTaskId);

  const liveSpentSeconds = totalSessionSecs + (activeTaskId ? elapsedSeconds : 0);
  const countdownSeconds = dailyGoalSeconds > 0
    ? Math.max(0, dailyGoalSeconds - liveSpentSeconds) : 0;
  const goalProgress = dailyGoalSeconds > 0
    ? Math.min(1, liveSpentSeconds / dailyGoalSeconds) : 0;
  const goalReached = dailyGoalSeconds > 0 && countdownSeconds === 0;

  // For the active task's session progress
  const activeTaskData    = tasks.find(t => t.id === activeTaskId);
  const currentSessionNum = (activeTaskData?.completion_count ?? 0) + 1;
  const targetSessions    = activeTaskData?.target_sessions ?? null;

  // ─── Swipeables ──────────────────────────────────────────────────────────

  const closeAllSwipeables = (exceptId?: string) => {
    swipeableRefs.forEach((ref, id) => {
      if (id !== exceptId) ref?.close();
    });
  };

  const renderRightActions = (task: Task) => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={[styles.swipeAction, styles.swipeEdit]}
        onPress={() => {
          swipeableRefs.get(task.id)?.close();
          openEditModal(task);
        }}
      >
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={styles.swipeActionText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeAction, styles.swipeDelete]}
        onPress={() => {
          swipeableRefs.get(task.id)?.close();
          handleDeleteTask(task.id);
        }}
      >
        <Ionicons name="trash-outline" size={18} color="#fff" />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Styles ──────────────────────────────────────────────────────────────

  const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
    headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    logoContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
    logoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    logoText: { fontSize: 24, fontWeight: "700", color: colors.primary, letterSpacing: -0.5 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    pageTitle: { fontSize: 28, fontWeight: "800", color: colors.textDark, marginTop: 12, marginBottom: 4 },
    pageTitleFuture: { color: colors.primary },

    // Date strip
    dateStripWrapper: { marginHorizontal: -20, marginBottom: 14 },
    dateStrip: { paddingHorizontal: 16, paddingVertical: 6, gap: 6 },
    dateItem: {
      alignItems: "center", justifyContent: "center",
      paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14,
      minWidth: 52, backgroundColor: "transparent",
    },
    dateItemSelected: {
      backgroundColor: colors.primary,
    },
    dateItemToday: {
      borderWidth: 1.5, borderColor: colors.primary,
    },
    dateDayName: { fontSize: 10, fontWeight: "600", color: colors.textLight, marginBottom: 2, textTransform: "uppercase" },
    dateDayNameSelected: { color: "#fff" },
    dateDayNum: { fontSize: 18, fontWeight: "800", color: colors.textDark },
    dateDayNumSelected: { color: "#fff" },
    todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 2 },
    todayDotSelected: { backgroundColor: "#fff" },

    statsBar: { flexDirection: "row", backgroundColor: colors.cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, padding: 16, marginBottom: 16, gap: 4 },
    statItem: { flex: 1, alignItems: "center" },
    statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
    statValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
    statLabel: { fontSize: 11, fontWeight: "600", color: colors.textLight, marginTop: 2 },

    goalCard: { backgroundColor: colors.cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, padding: 16, marginBottom: 16 },
    goalCardReached: { borderColor: "#4CAF50" },
    goalCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    goalCardTitle: { fontSize: 14, fontWeight: "700", color: colors.textMedium, letterSpacing: 0.3 },
    goalEditBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)" },
    goalEditBtnText: { fontSize: 12, fontWeight: "700", color: colors.primary },
    goalCountdownRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 12 },
    goalCountdownTime: { fontSize: 42, fontWeight: "800", color: colors.primary, letterSpacing: 1 },
    goalCountdownLabel: { fontSize: 13, fontWeight: "600", color: colors.textLight, marginBottom: 6 },
    goalReachedBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(76,175,80,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 6 },
    goalReachedText: { fontSize: 13, fontWeight: "700", color: "#4CAF50" },
    progressTrack: { height: 8, backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 4 },
    progressMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    progressMetaText: { fontSize: 11, fontWeight: "600", color: colors.textLight },
    goalSetPrompt: { flexDirection: "row", alignItems: "center", gap: 10 },
    goalSetPromptText: { flex: 1, fontSize: 14, color: colors.textLight },
    goalSetBtn: { borderRadius: 12, overflow: "hidden" },
    goalSetBtnGradient: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },
    goalSetBtnText: { fontSize: 13, fontWeight: "700", color: "white" },
    goalModalContent: { backgroundColor: colors.surface, borderRadius: 28, padding: 24, width: "100%", maxWidth: 380, borderWidth: 2, borderColor: colors.border },
    goalModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    goalModalTitle: { fontSize: 20, fontWeight: "800", color: colors.textDark },
    goalModalSub: { fontSize: 13, color: colors.textLight, marginBottom: 24 },
    goalInputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 },
    goalInputBlock: { flex: 1, alignItems: "center" },
    goalInputLabel: { fontSize: 12, fontWeight: "600", color: colors.textLight, marginBottom: 6 },
    goalInput: { width: "100%", backgroundColor: colors.background, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 14, fontSize: 32, fontWeight: "800", color: colors.textDark, textAlign: "center" },
    goalInputSep: { fontSize: 28, fontWeight: "800", color: colors.textLight, marginTop: 18 },
    goalPresets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
    goalPresetChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
    goalPresetText: { fontSize: 13, fontWeight: "600", color: colors.textMedium },
    goalModalBtns: { flexDirection: "row", gap: 10 },
    goalClearBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 14, borderWidth: 1.5, borderColor: colors.border },
    goalClearBtnText: { fontSize: 14, fontWeight: "600", color: colors.textMedium },
    goalConfirmBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
    goalConfirmGradient: { paddingVertical: 14, alignItems: "center" },
    goalConfirmText: { fontSize: 15, fontWeight: "700", color: "white" },

    activeBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)", borderWidth: 1.5, borderColor: colors.primary, borderRadius: 16, padding: 14, marginBottom: 20 },
    activeBannerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    activeBannerText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.primary },
    activeBannerStop: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,107,107,0.15)", borderRadius: 10 },

    taskHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionLabel: { fontSize: 18, fontWeight: "700", color: colors.textDark },
    addTaskBtn: { padding: 4 },

    taskCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.cardBg, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, overflow: "hidden" },
    taskCardActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: isDarkMode ? "rgba(93,184,154,0.08)" : "rgba(79,195,247,0.05)" },
    taskCardCompleted: { opacity: 0.55 },
    taskPriorityBar: { width: 4, alignSelf: "stretch", borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
    taskMain: { flex: 1, padding: 16 },
    taskText: { fontSize: 15, fontWeight: "500", color: colors.textMedium },
    taskTextDone: { textDecorationLine: "line-through", color: colors.textLight },
    taskMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 },
    focusTimeBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    focusTimeText: { fontSize: 12, fontWeight: "600", color: colors.primary },
    completionBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    completionText: { fontSize: 12, fontWeight: "600", color: "#FFB300" },
    scheduledTimeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: isDarkMode ? "rgba(93,184,154,0.12)" : "rgba(79,195,247,0.1)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    scheduledTimeText: { fontSize: 11, fontWeight: "700", color: colors.primary },
    sessionsBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    sessionsText: { fontSize: 12, fontWeight: "600", color: colors.textLight },
    priorityBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    priorityBadgeText: { fontSize: 10, fontWeight: "700" },

    activeTimerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" },
    elapsedText: { fontSize: 20, fontWeight: "700", color: colors.primary, letterSpacing: 1 },
    sessionProgressText: { fontSize: 11, fontWeight: "700", color: colors.textLight },
    pausedPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,152,0,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    pausedPillText: { fontSize: 10, fontWeight: "800", color: "#FF9800", letterSpacing: 0.5 },

    startBtn: { width: 44, height: 44, borderRadius: 14, overflow: "hidden" },
    startBtnGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
    activeActions: { flexDirection: "row", gap: 8, paddingVertical: 12, paddingRight: 12 },
    actionBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: isDarkMode ? "rgba(93,184,154,0.2)" : "rgba(79,195,247,0.15)" },
    doneBtn: { backgroundColor: colors.primary },

    swipeWrapper: { marginBottom: 10, borderRadius: 18, overflow: "hidden" },
    swipeActions: { flexDirection: "row", overflow: "hidden", borderRadius: 18, marginBottom: 10 },
    swipeAction: { width: 72, alignItems: "center", justifyContent: "center", gap: 5 },
    swipeEdit: { backgroundColor: colors.primary },
    swipeDelete: { backgroundColor: "#FF6B6B" },
    swipeActionText: { fontSize: 11, fontWeight: "700", color: "#fff", letterSpacing: 0.2 },

    loadingContainer: { paddingVertical: 40, alignItems: "center" },
    emptyContainer: { paddingVertical: 40, alignItems: "center", gap: 8 },
    emptyText: { fontSize: 18, fontWeight: "600", color: colors.textMedium, marginTop: 12 },
    emptySubtext: { fontSize: 14, color: colors.textLight },

    sessionCard: { backgroundColor: colors.cardBg, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, padding: 16, marginBottom: 10 },
    sessionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    sessionIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)", alignItems: "center", justifyContent: "center" },
    sessionInfo: { flex: 1 },
    sessionTaskName: { fontSize: 14, fontWeight: "600", color: colors.textDark },
    sessionMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    sessionTime: { fontSize: 12, color: colors.textLight },
    sessionEmotion: { fontSize: 12, color: colors.textLight },
    sessionDuration: { fontSize: 16, fontWeight: "800", color: colors.primary },
    sessionsEmpty: { fontSize: 14, color: colors.textLight, textAlign: "center", paddingVertical: 20 },
    totalSessionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: isDarkMode ? "rgba(93,184,154,0.1)" : "rgba(79,195,247,0.08)", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    totalSessionLabel: { fontSize: 14, fontWeight: "600", color: colors.textMedium },
    totalSessionValue: { fontSize: 18, fontWeight: "800", color: colors.primary },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
    addTaskModalContent: { backgroundColor: colors.surface, borderRadius: 30, padding: 24, width: "100%", maxWidth: 420, borderWidth: 2, borderColor: colors.border },
    addTaskHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: "800", color: colors.textDark },
    taskInput: { backgroundColor: colors.background, borderRadius: 16, padding: 16, fontSize: 16, color: colors.textDark, minHeight: 80, textAlignVertical: "top", marginBottom: 16, borderWidth: 1.5, borderColor: colors.border },

    // Scheduling section inside modal
    schedulingSection: { marginBottom: 16 },
    schedulingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.background, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border },
    schedulingLabel: { fontSize: 14, fontWeight: "600", color: colors.textDark },
    schedulingToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
    schedulingToggleText: { fontSize: 13, color: colors.textLight },
    togglePill: { width: 44, height: 24, borderRadius: 12, justifyContent: "center", paddingHorizontal: 3 },
    toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
    timePickerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
    timeInput: { flex: 1, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, padding: 10, fontSize: 26, fontWeight: "800", color: colors.textDark, textAlign: "center" },
    timeSep: { fontSize: 22, fontWeight: "800", color: colors.textLight },
    timeLabel: { fontSize: 11, fontWeight: "600", color: colors.textLight, textAlign: "center", marginTop: 3 },

    // Sessions row
    sessionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.background, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 },
    sessionsLabel: { fontSize: 14, fontWeight: "600", color: colors.textDark },
    sessionsControl: { flexDirection: "row", alignItems: "center", gap: 12 },
    sessionsBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: isDarkMode ? "rgba(93,184,154,0.2)" : "rgba(79,195,247,0.15)", alignItems: "center", justifyContent: "center" },
    sessionsValue: { fontSize: 18, fontWeight: "800", color: colors.textDark, minWidth: 28, textAlign: "center" },

    // Priority
    priorityRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    priorityChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
    priorityChipText: { fontSize: 12, fontWeight: "700" },

    modalButtons: { flexDirection: "row", gap: 15, width: "100%", marginTop: 4 },
    cancelBtn: { flex: 1, paddingVertical: 15, alignItems: "center" },
    cancelBtnText: { fontSize: 16, fontWeight: "600" },
    saveBtn: { flex: 1, borderRadius: 15, overflow: "hidden" },
    saveBtnGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center", minHeight: 48 },
    saveBtnText: { color: "white", fontSize: 16, fontWeight: "700" },
    buttonDisabled: { opacity: 0.7 },

    pauseModalContent: { backgroundColor: colors.surface, borderRadius: 28, padding: 24, width: "100%", maxWidth: 420, borderWidth: 2, borderColor: colors.border, gap: 10 },
    pauseModalHeader: { marginBottom: 6 },
    pauseModalTitle: { fontSize: 20, fontWeight: "800", color: colors.textDark, marginBottom: 4 },
    pauseModalSub: { fontSize: 13, color: colors.textLight },
    pauseReasonItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: colors.background, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent" },
    pauseReasonIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)", alignItems: "center", justifyContent: "center" },
    pauseReasonLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
    pauseConfirmBtn: { borderRadius: 15, overflow: "hidden", marginTop: 4 },
    pauseConfirmGradient: { paddingVertical: 15, alignItems: "center" },
    pauseConfirmText: { color: "white", fontSize: 16, fontWeight: "700" },

    emotionModalContent: { backgroundColor: colors.surface, borderRadius: 28, padding: 24, width: "100%", maxWidth: 420, borderWidth: 2, borderColor: colors.border },
    emotionModalTitle: { fontSize: 22, fontWeight: "800", color: colors.textDark, marginBottom: 6, textAlign: "center" },
    emotionModalSub: { fontSize: 14, color: colors.textLight, marginBottom: 20, textAlign: "center", lineHeight: 20 },
    emotionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
    emotionItem: { width: "22%", flexGrow: 1, alignItems: "center", paddingVertical: 12, borderRadius: 16, borderWidth: 2, position: "relative" },
    emotionEmoji: { fontSize: 32, marginBottom: 6 },
    emotionLabel: { fontSize: 11, textAlign: "center" },
    emotionCheck: { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },

    sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
    modalSubLabel: { fontSize: 13, fontWeight: "700", color: colors.textLight, marginBottom: 8, letterSpacing: 0.4 },

    // Calendar button in header
    calendarBtn: {
      width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
      backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)",
    },

    // Full calendar modal
    calOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    calContainer: {
      backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24,
      paddingTop: 20, borderWidth: 1.5, borderBottomWidth: 0, borderColor: colors.border,
      maxHeight: "88%",
    },
    calHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      marginBottom: 18,
    },
    calTitle: { fontSize: 20, fontWeight: "800", color: colors.textDark },
    calMonthNav: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: 16, paddingHorizontal: 4,
    },
    calNavBtn: {
      width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center",
      backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)",
    },
    calMonthTitle: { fontSize: 17, fontWeight: "800", color: colors.textDark },
    calWeekdayRow: { flexDirection: "row", marginBottom: 6 },
    calWeekdayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: colors.textLight, letterSpacing: 0.3 },
    calRow: { flexDirection: "row", marginBottom: 4 },
    calDayCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 5, borderRadius: 12, minHeight: 52 },
    calDayCellToday: { backgroundColor: isDarkMode ? "rgba(93,184,154,0.12)" : "rgba(79,195,247,0.1)", borderWidth: 1.5, borderColor: colors.primary },
    calDayCellSelected: { backgroundColor: colors.primary },
    calDayNum: { fontSize: 15, fontWeight: "600", color: colors.textDark },
    calDayNumToday: { color: colors.primary, fontWeight: "800" },
    calDayNumSelected: { color: "#fff", fontWeight: "800" },
    calTaskBadge: {
      minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: isDarkMode ? "rgba(93,184,154,0.2)" : "rgba(79,195,247,0.15)",
      alignItems: "center", justifyContent: "center", marginTop: 2, paddingHorizontal: 4,
    },
    calTaskBadgeSelected: { backgroundColor: "rgba(255,255,255,0.3)" },
    calTaskBadgeText: { fontSize: 10, fontWeight: "800", color: colors.primary },
    calTaskBadgeTextSelected: { color: "#fff" },
    calLoadingWrap: { paddingVertical: 60, alignItems: "center" },
    calLegend: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
    calLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    calLegendText: { fontSize: 12, color: colors.textLight },
    calTodayBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)" },
    calTodayBtnText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  });

  // ─── Goal card ────────────────────────────────────────────────────────────

  const renderGoalCard = () => {
    const progressColors: [string, string] = goalReached
      ? ["#4CAF50", "#81C784"]
      : [colors.primary, colors.primaryDark ?? colors.primary];

    return (
      <View style={[styles.goalCard, goalReached && styles.goalCardReached]}>
        <View style={styles.goalCardHeader}>
          <Text style={styles.goalCardTitle}>⏱ DAILY FOCUS GOAL</Text>
          {dailyGoalSeconds > 0 && (
            <TouchableOpacity style={styles.goalEditBtn} onPress={() => setShowGoalModal(true)}>
              <Ionicons name="pencil" size={12} color={colors.primary} />
              <Text style={styles.goalEditBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        {dailyGoalSeconds > 0 ? (
          <>
            <View style={styles.goalCountdownRow}>
              <Text style={[styles.goalCountdownTime, goalReached && { color: "#4CAF50" }]}>
                {formatSessionDuration(countdownSeconds)}
              </Text>
              {goalReached ? (
                <View style={styles.goalReachedBadge}>
                  <Ionicons name="trophy" size={14} color="#4CAF50" />
                  <Text style={styles.goalReachedText}>Goal reached!</Text>
                </View>
              ) : (
                <Text style={styles.goalCountdownLabel}>remaining</Text>
              )}
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={progressColors}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.round(goalProgress * 100)}%` }]}
              />
            </View>
            <View style={styles.progressMetaRow}>
              <Text style={styles.progressMetaText}>{formatSessionDuration(liveSpentSeconds)} done</Text>
              <Text style={styles.progressMetaText}>
                {Math.round(goalProgress * 100)}% · Goal: {formatSessionDuration(dailyGoalSeconds)}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.goalSetPrompt}>
            <Ionicons name="flag-outline" size={22} color={colors.textLight} />
            <Text style={styles.goalSetPromptText}>Set a daily focus goal to track your progress.</Text>
            <TouchableOpacity style={styles.goalSetBtn} onPress={() => setShowGoalModal(true)}>
              <LinearGradient colors={[colors.primary, colors.primaryDark ?? colors.primary]} style={styles.goalSetBtnGradient}>
                <Ionicons name="add" size={14} color="white" />
                <Text style={styles.goalSetBtnText}>Set Goal</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ─── Date strip ───────────────────────────────────────────────────────────

  const renderDateStrip = () => {
    const today = todayStr();
    return (
      <View style={styles.dateStripWrapper}>
        <ScrollView
          ref={dateStripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {dateRange.map((d) => {
            const dateStr    = toDateStr(d);
            const isSelected = dateStr === selectedDate;
            const isTodayDate = dateStr === today;
            const dayName    = isTodayDate
              ? "Today"
              : d.toLocaleDateString([], { weekday: "short" });

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dateItem,
                  isTodayDate && !isSelected && styles.dateItemToday,
                  isSelected && styles.dateItemSelected,
                ]}
                onPress={() => handleDateSelect(dateStr)}
                activeOpacity={0.75}
              >
                <Text style={[styles.dateDayName, isSelected && styles.dateDayNameSelected]}>
                  {dayName}
                </Text>
                <Text style={[styles.dateDayNum, isSelected && styles.dateDayNumSelected]}>
                  {d.getDate()}
                </Text>
                {isTodayDate && (
                  <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ─── Full calendar modal ─────────────────────────────────────────────────

  const renderCalendarModal = () => {
    const today       = todayStr();
    const firstOfMonth = new Date(calendarYear, calendarMonth, 1);
    const daysInMonth  = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const startOffset  = firstOfMonth.getDay(); // 0=Sun
    const monthLabel   = firstOfMonth.toLocaleDateString([], { month: "long", year: "numeric" });

    const navigateMonth = (delta: number) => {
      let m = calendarMonth + delta;
      let y = calendarYear;
      if (m > 11) { m = 0; y++; }
      if (m < 0)  { m = 11; y--; }
      setCalendarMonth(m);
      setCalendarYear(y);
    };

    const jumpToToday = () => {
      const now = new Date();
      setCalendarMonth(now.getMonth());
      setCalendarYear(now.getFullYear());
    };

    // Build grid: nulls for blank leading cells, then day numbers
    const cells: (number | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    const isCurrentMonth =
      calendarYear === new Date().getFullYear() && calendarMonth === new Date().getMonth();

    return (
      <Modal
        visible={showCalendarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.calOverlay}>
          <View style={styles.calContainer}>
            {/* Header */}
            <View style={styles.calHeader}>
              <Text style={styles.calTitle}>📅 Calendar</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {!isCurrentMonth && (
                  <TouchableOpacity style={styles.calTodayBtn} onPress={jumpToToday}>
                    <Text style={styles.calTodayBtnText}>Today</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowCalendarModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={26} color={colors.textMedium} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Month navigation */}
            <View style={styles.calMonthNav}>
              <TouchableOpacity style={styles.calNavBtn} onPress={() => navigateMonth(-1)}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>{monthLabel}</Text>
              <TouchableOpacity style={styles.calNavBtn} onPress={() => navigateMonth(1)}>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.calWeekdayRow}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <Text key={d} style={styles.calWeekdayLabel}>{d}</Text>
              ))}
            </View>

            {loadingCalendar ? (
              <View style={styles.calLoadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <>
                {rows.map((row, ri) => (
                  <View key={ri} style={styles.calRow}>
                    {row.map((day, ci) => {
                      if (!day) return <View key={ci} style={styles.calDayCell} />;
                      const dateStr    = `${calendarYear}-${pad(calendarMonth + 1)}-${pad(day)}`;
                      const isToday    = dateStr === today;
                      const isSelected = dateStr === selectedDate;
                      const count      = taskCountsByDate[dateStr] || 0;

                      return (
                        <TouchableOpacity
                          key={ci}
                          style={[
                            styles.calDayCell,
                            isToday    && !isSelected && styles.calDayCellToday,
                            isSelected && styles.calDayCellSelected,
                          ]}
                          onPress={() => {
                            handleDateSelect(dateStr);
                            setShowCalendarModal(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.calDayNum,
                            isToday    && !isSelected && styles.calDayNumToday,
                            isSelected && styles.calDayNumSelected,
                          ]}>
                            {day}
                          </Text>
                          {count > 0 && (
                            <View style={[
                              styles.calTaskBadge,
                              isSelected && styles.calTaskBadgeSelected,
                            ]}>
                              <Text style={[
                                styles.calTaskBadgeText,
                                isSelected && styles.calTaskBadgeTextSelected,
                              ]}>
                                {count}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </>
            )}

            {/* Legend */}
            <View style={styles.calLegend}>
              <View style={styles.calLegendItem}>
                <View style={styles.calDayCellToday}>
                  <Text style={[styles.calDayNum, styles.calDayNumToday]}>7</Text>
                </View>
                <Text style={styles.calLegendText}>Today</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calTaskBadge, { minWidth: 22 }]}>
                  <Text style={styles.calTaskBadgeText}>3</Text>
                </View>
                <Text style={styles.calLegendText}>Tasks scheduled</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ─── Task modal fields (shared between add and edit) ──────────────────────

  const renderTaskSchedulingFields = (
    useTime: boolean, setUseTime: (v: boolean) => void,
    hour: string, setHour: (v: string) => void,
    minute: string, setMinute: (v: string) => void,
    sessions: string, setSessions: (v: string) => void,
    priority: Priority | null, setPriority: (v: Priority | null) => void,
  ) => {
    const adjSessions = (delta: number) => {
      const cur = Math.max(1, parseInt(sessions || "1", 10));
      setSessions(Math.max(1, cur + delta).toString());
    };

    return (
      <>
        <View style={styles.sectionDivider} />

        {/* Scheduled time toggle */}
        <Text style={styles.modalSubLabel}>SCHEDULE</Text>
        <View style={[styles.schedulingSection]}>
          <TouchableOpacity
            style={styles.schedulingRow}
            onPress={() => setUseTime(!useTime)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="alarm-outline" size={18} color={colors.textMedium} />
              <Text style={styles.schedulingLabel}>Set reminder time</Text>
            </View>
            <View style={styles.schedulingToggle}>
              {useTime && <Text style={styles.schedulingToggleText}>{formatTime12h(`${hour.padStart(2,"0")}:${minute.padStart(2,"0")}`)}</Text>}
              <View style={[styles.togglePill, { backgroundColor: useTime ? colors.primary : colors.border, alignItems: useTime ? "flex-end" : "flex-start" }]}>
                <View style={styles.toggleKnob} />
              </View>
            </View>
          </TouchableOpacity>

          {useTime && (
            <View>
              <View style={styles.timePickerRow}>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <TextInput
                    style={styles.timeInput}
                    value={hour}
                    onChangeText={v => {
                      const n = parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
                      setHour(Math.min(23, Math.max(0, n)).toString());
                    }}
                    keyboardType="number-pad" maxLength={2} selectTextOnFocus
                  />
                  <Text style={styles.timeLabel}>HOUR</Text>
                </View>
                <Text style={styles.timeSep}>:</Text>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <TextInput
                    style={styles.timeInput}
                    value={minute}
                    onChangeText={v => {
                      const n = parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
                      setMinute(Math.min(59, Math.max(0, n)).toString());
                    }}
                    keyboardType="number-pad" maxLength={2} selectTextOnFocus
                  />
                  <Text style={styles.timeLabel}>MINUTE</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Target sessions */}
        <View style={[styles.sessionsRow, { marginTop: 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="layers-outline" size={18} color={colors.textMedium} />
            <Text style={styles.sessionsLabel}>Focus sessions</Text>
          </View>
          <View style={styles.sessionsControl}>
            <TouchableOpacity style={styles.sessionsBtn} onPress={() => adjSessions(-1)}>
              <Ionicons name="remove" size={16} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.sessionsValue}>{sessions}</Text>
            <TouchableOpacity style={styles.sessionsBtn} onPress={() => adjSessions(1)}>
              <Ionicons name="add" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Priority */}
        <Text style={[styles.modalSubLabel, { marginTop: 12 }]}>PRIORITY</Text>
        <View style={styles.priorityRow}>
          {(["high", "medium", "low"] as Priority[]).map(p => {
            const cfg       = PRIORITY_CONFIG[p];
            const selected  = priority === p;
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityChip,
                  selected && { borderColor: cfg.color, backgroundColor: cfg.color + "22" },
                ]}
                onPress={() => setPriority(selected ? null : p)}
                activeOpacity={0.8}
              >
                <Ionicons name={cfg.icon as any} size={13} color={selected ? cfg.color : colors.textLight} />
                <Text style={[styles.priorityChipText, { color: selected ? cfg.color : colors.textLight }]}>
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Background>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.logoIcon}>
                <Ionicons name="flash" size={24} color={colors.white} />
              </LinearGradient>
              <Text style={styles.logoText}>FocusFlow</Text>
            </View>
            <TouchableOpacity style={styles.calendarBtn} onPress={openCalendar} activeOpacity={0.75}>
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.pageTitle, !isToday && styles.pageTitleFuture]}>
            {formatDisplayDate(selectedDate)}
          </Text>

          {/* Date navigation strip */}
          {renderDateStrip()}

          {/* Stats bar — only show for today */}
          {isToday && (
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedCount}/{totalCount}</Text>
                <Text style={styles.statLabel}>Tasks Done</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatFocusTime(totalFocusTime)}</Text>
                <Text style={styles.statLabel}>Focus Time</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{todaySessions.length}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
            </View>
          )}

          {/* Daily goal — only today */}
          {isToday && renderGoalCard()}

          {/* Active timer banner */}
          {activeTask && (
            <View style={styles.activeBanner}>
              <View style={styles.activeBannerDot} />
              <Text style={styles.activeBannerText} numberOfLines={1}>
                {isPaused ? "⏸ Paused: " : "▶ Focusing: "}{activeTask.text}
                {targetSessions != null
                  ? `  (Session ${currentSessionNum}/${targetSessions})`
                  : ""}
              </Text>
              <TouchableOpacity style={styles.activeBannerStop} onPress={handleStopTask}>
                <Ionicons name="stop" size={16} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          )}

          {/* Task list header */}
          <View style={styles.taskHeaderRow}>
            <Text style={styles.sectionLabel}>
              {isToday ? "Tasks" : selectedDate < todayStr() ? "Past Tasks" : "Planned Tasks"}
            </Text>
            <TouchableOpacity style={styles.addTaskBtn} onPress={() => { resetAddForm(); setShowAddTaskModal(true); }}>
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>No tasks yet</Text>
              <Text style={styles.emptySubtext}>
                {selectedDate < todayStr()
                  ? "Nothing was logged for this day"
                  : "Tap + to add a goal for this day"}
              </Text>
            </View>
          ) : (
            tasks.map((task) => {
              const isActive     = activeTaskId === task.id;
              const swipeEnabled = !task.completed && !isActive;
              const priorityCfg  = task.priority ? PRIORITY_CONFIG[task.priority] : null;
              const taskSessions = task.completion_count ?? 0;
              const taskTarget   = task.target_sessions ?? null;

              return (
                <Swipeable
                  key={task.id}
                  ref={(ref: any) => {
                    if (ref) swipeableRefs.set(task.id, ref);
                    else swipeableRefs.delete(task.id);
                  }}
                  renderRightActions={() => renderRightActions(task)}
                  rightThreshold={40}
                  overshootRight={false}
                  friction={2}
                  enabled={swipeEnabled}
                  containerStyle={styles.swipeWrapper}
                  onSwipeableOpen={() => closeAllSwipeables(task.id)}
                >
                  <View style={[
                    styles.taskCard,
                    task.completed && styles.taskCardCompleted,
                    isActive && styles.taskCardActive,
                  ]}>
                    {/* Priority color bar */}
                    {priorityCfg && (
                      <View style={[styles.taskPriorityBar, { backgroundColor: priorityCfg.color }]} />
                    )}

                    <View style={styles.taskMain}>
                      <Text style={[styles.taskText, task.completed && styles.taskTextDone]} numberOfLines={2}>
                        {task.text}
                      </Text>

                      {isActive ? (
                        <View style={styles.activeTimerRow}>
                          <Text style={styles.elapsedText}>{formatElapsed(elapsedSeconds)}</Text>
                          {taskTarget != null && (
                            <Text style={styles.sessionProgressText}>
                              Session {currentSessionNum}/{taskTarget}
                            </Text>
                          )}
                          {isPaused && (
                            <View style={styles.pausedPill}>
                              <Ionicons name="pause" size={10} color="#FF9800" />
                              <Text style={styles.pausedPillText}>{pauseReason ?? "PAUSED"}</Text>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View style={styles.taskMetaRow}>
                          {task.scheduled_time && (
                            <View style={styles.scheduledTimeBadge}>
                              <Ionicons name="alarm" size={11} color={colors.primary} />
                              <Text style={styles.scheduledTimeText}>
                                {formatTime12h(task.scheduled_time)}
                              </Text>
                            </View>
                          )}
                          {task.focus_time > 0 && (
                            <View style={styles.focusTimeBadge}>
                              <Ionicons name="time" size={12} color={colors.primary} />
                              <Text style={styles.focusTimeText}>{formatFocusTime(task.focus_time)}</Text>
                            </View>
                          )}
                          {taskTarget != null && (
                            <View style={styles.sessionsBadge}>
                              <Ionicons name="layers" size={12} color={colors.textLight} />
                              <Text style={styles.sessionsText}>
                                {taskSessions}/{taskTarget} sessions
                              </Text>
                            </View>
                          )}
                          {task.completion_count > 0 && (
                            <View style={styles.completionBadge}>
                              <Ionicons name="trophy" size={12} color="#FFB300" />
                              <Text style={styles.completionText}>×{task.completion_count}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {task.completed ? (
                      <View style={{ paddingRight: 16 }}>
                        <Ionicons name="checkmark-circle" size={30} color={colors.primary} />
                      </View>
                    ) : isActive ? (
                      <View style={styles.activeActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={isPaused ? handleResume : handlePause}>
                          <Ionicons name={isPaused ? "play" : "pause"} size={18} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.doneBtn]} onPress={handleCompleteActiveTask}>
                          <Ionicons name="checkmark" size={18} color="white" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ paddingRight: 12 }}>
                        <TouchableOpacity style={styles.startBtn} onPress={() => handleStartTask(task.id)}>
                          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.startBtnGradient}>
                            <Ionicons name="play" size={18} color="white" />
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </Swipeable>
              );
            })
          )}

          {/* Sessions section — only on today */}
          {isToday && (
            <>
              <View style={[styles.taskHeaderRow, { marginTop: 10 }]}>
                <Text style={styles.sectionLabel}>Today's Sessions</Text>
              </View>
              {todaySessions.length > 0 && (
                <View style={styles.totalSessionRow}>
                  <Text style={styles.totalSessionLabel}>Total Focus Time</Text>
                  <Text style={styles.totalSessionValue}>{formatSessionDuration(totalSessionSecs)}</Text>
                </View>
              )}
              {todaySessions.length === 0 ? (
                <Text style={styles.sessionsEmpty}>No sessions recorded yet. Start a task!</Text>
              ) : (
                todaySessions.map((sess) => (
                  <View key={sess.id} style={styles.sessionCard}>
                    <View style={styles.sessionRow}>
                      <View style={styles.sessionIconWrap}>
                        <Ionicons name="timer-outline" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionTaskName} numberOfLines={1}>
                          {sess.task_name || "General Focus"}
                        </Text>
                        <View style={styles.sessionMeta}>
                          <Text style={styles.sessionTime}>
                            Completed at {formatSessionTime(sess.completed_at)}
                          </Text>
                          {sess.emotion && (
                            <>
                              <Text style={[styles.sessionTime, { color: colors.border }]}>·</Text>
                              <Text style={styles.sessionEmotion}>{sess.emotion}</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <Text style={styles.sessionDuration}>{formatSessionDuration(sess.duration_minutes)}</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        {/* ── ADD TASK MODAL ─────────────────────────────────────────────────── */}
        <Modal visible={showAddTaskModal} transparent animationType="slide" onRequestClose={() => setShowAddTaskModal(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.addTaskModalContent}>
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>
                  {isToday ? "New Task" : `Plan for ${new Date(selectedDate + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}`}
                </Text>
                <TouchableOpacity onPress={() => { setShowAddTaskModal(false); resetAddForm(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={26} color={colors.textMedium} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={styles.taskInput}
                  placeholder="What do you want to accomplish?"
                  placeholderTextColor={colors.textLight}
                  value={newTaskText}
                  onChangeText={setNewTaskText}
                  multiline
                  autoFocus
                />

                {renderTaskSchedulingFields(
                  newTaskUseTime, setNewTaskUseTime,
                  newTaskTimeHour, setNewTaskTimeHour,
                  newTaskTimeMinute, setNewTaskTimeMinute,
                  newTaskSessions, setNewTaskSessions,
                  newTaskPriority, setNewTaskPriority,
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddTaskModal(false); resetAddForm(); }}>
                    <Text style={[styles.cancelBtnText, { color: colors.textLight }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, addingTask && styles.buttonDisabled]}
                    onPress={handleAddTask}
                    disabled={addingTask}
                  >
                    <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveBtnGradient}>
                      {addingTask
                        ? <ActivityIndicator size="small" color="white" />
                        : <Text style={styles.saveBtnText}>Add Task ✓</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* ── EDIT TASK MODAL ────────────────────────────────────────────────── */}
        <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.addTaskModalContent}>
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>Edit Task</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={26} color={colors.textMedium} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={styles.taskInput}
                  placeholder="What do you want to accomplish?"
                  placeholderTextColor={colors.textLight}
                  value={editTaskText}
                  onChangeText={setEditTaskText}
                  multiline
                  autoFocus
                />

                {renderTaskSchedulingFields(
                  editTaskUseTime, setEditTaskUseTime,
                  editTaskTimeHour, setEditTaskTimeHour,
                  editTaskTimeMinute, setEditTaskTimeMinute,
                  editTaskSessions, setEditTaskSessions,
                  editTaskPriority, setEditTaskPriority,
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                    <Text style={[styles.cancelBtnText, { color: colors.textLight }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, addingTask && styles.buttonDisabled]}
                    onPress={handleEditTask}
                    disabled={addingTask}
                  >
                    <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveBtnGradient}>
                      {addingTask
                        ? <ActivityIndicator size="small" color="white" />
                        : <Text style={styles.saveBtnText}>Save Changes ✓</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* ── SET GOAL MODAL ─────────────────────────────────────────────────── */}
        <Modal visible={showGoalModal} transparent animationType="slide" onRequestClose={() => setShowGoalModal(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.goalModalContent}>
              <View style={styles.goalModalHeader}>
                <Text style={styles.goalModalTitle}>Set Daily Goal ⏱</Text>
                <TouchableOpacity onPress={() => setShowGoalModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={26} color={colors.textMedium} />
                </TouchableOpacity>
              </View>
              <Text style={styles.goalModalSub}>How long do you want to focus today? The countdown starts immediately.</Text>
              <View style={styles.goalInputRow}>
                <View style={styles.goalInputBlock}>
                  <Text style={styles.goalInputLabel}>HOURS</Text>
                  <TextInput
                    style={styles.goalInput} value={goalHours}
                    onChangeText={v => setGoalHours(v.replace(/[^0-9]/g, "").slice(0, 2))}
                    keyboardType="number-pad" maxLength={2} selectTextOnFocus
                  />
                </View>
                <Text style={styles.goalInputSep}>:</Text>
                <View style={styles.goalInputBlock}>
                  <Text style={styles.goalInputLabel}>MINUTES</Text>
                  <TextInput
                    style={styles.goalInput} value={goalMinutes}
                    onChangeText={v => {
                      const n = parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
                      setGoalMinutes(Math.min(59, n).toString());
                    }}
                    keyboardType="number-pad" maxLength={2} selectTextOnFocus
                  />
                </View>
              </View>
              <View style={styles.goalPresets}>
                {[
                  { label: "30 min", h: 0, m: 30 },
                  { label: "1 hr",   h: 1, m: 0  },
                  { label: "2 hrs",  h: 2, m: 0  },
                  { label: "3 hrs",  h: 3, m: 0  },
                  { label: "4 hrs",  h: 4, m: 0  },
                  { label: "8 hrs",  h: 8, m: 0  },
                ].map(p => (
                  <TouchableOpacity
                    key={p.label}
                    style={[
                      styles.goalPresetChip,
                      goalHours === p.h.toString() && goalMinutes === p.m.toString() &&
                        { borderColor: colors.primary, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)" },
                    ]}
                    onPress={() => { setGoalHours(p.h.toString()); setGoalMinutes(p.m.toString()); }}
                  >
                    <Text style={[
                      styles.goalPresetText,
                      goalHours === p.h.toString() && goalMinutes === p.m.toString() &&
                        { color: colors.primary, fontWeight: "700" },
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.goalModalBtns}>
                {dailyGoalSeconds > 0 && (
                  <TouchableOpacity style={styles.goalClearBtn} onPress={clearGoal}>
                    <Text style={styles.goalClearBtnText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.goalConfirmBtn} onPress={confirmGoal}>
                  <LinearGradient colors={[colors.primary, colors.primaryDark ?? colors.primary]} style={styles.goalConfirmGradient}>
                    <Text style={styles.goalConfirmText}>Start Countdown ✓</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* ── EMOTION MODAL ──────────────────────────────────────────────────── */}
        <Modal visible={showEmotionModal} transparent animationType="slide" onRequestClose={() => {}}>
          <View style={styles.modalOverlay}>
            <View style={styles.emotionModalContent}>
              <Text style={styles.emotionModalTitle}>How do you feel? 🎯</Text>
              <Text style={styles.emotionModalSub}>
                You focused for{" "}
                <Text style={{ fontWeight: "800", color: colors.primary }}>
                  {formatElapsed(pendingElapsedSeconds)}
                </Text>
                {" "}— share your feeling!
              </Text>
              <View style={styles.emotionGrid}>
                {EMOTIONS.map(({ emoji, label }) => {
                  const key = `${emoji} ${label}`;
                  const isSelected = selectedEmotion === key;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.emotionItem,
                        {
                          borderColor: isSelected ? colors.primary : "transparent",
                          backgroundColor: isSelected
                            ? isDarkMode ? "rgba(93,184,154,0.2)" : "rgba(79,195,247,0.12)"
                            : colors.background,
                        },
                      ]}
                      onPress={() => setSelectedEmotion(key)}
                    >
                      <Text style={styles.emotionEmoji}>{emoji}</Text>
                      <Text style={[
                        styles.emotionLabel,
                        { color: isSelected ? colors.primary : colors.textLight, fontWeight: isSelected ? "700" : "500" },
                      ]}>
                        {label}
                      </Text>
                      {isSelected && (
                        <View style={[styles.emotionCheck, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={10} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={confirmCompletion} disabled={savingCompletion}>
                  <Text style={[styles.cancelBtnText, { color: colors.textLight }]}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (!selectedEmotion || savingCompletion) && styles.buttonDisabled]}
                  onPress={confirmCompletion}
                  disabled={!selectedEmotion || savingCompletion}
                >
                  <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveBtnGradient}>
                    {savingCompletion
                      ? <ActivityIndicator size="small" color="white" />
                      : <Text style={styles.saveBtnText}>Save & Done ✓</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── PAUSE MODAL ────────────────────────────────────────────────────── */}
        <Modal visible={showPauseModal} transparent animationType="slide" onRequestClose={() => {}}>
          <View style={styles.modalOverlay}>
            <View style={styles.pauseModalContent}>
              <View style={styles.pauseModalHeader}>
                <Text style={styles.pauseModalTitle}>Why are you pausing? ⏸</Text>
                <Text style={styles.pauseModalSub}>This helps track your focus patterns.</Text>
              </View>
              {PAUSE_REASONS.map(({ icon, label }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.pauseReasonItem}
                  onPress={() => confirmPause(label)}
                  disabled={savingPause}
                >
                  <View style={styles.pauseReasonIcon}>
                    <Ionicons name={icon as any} size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.pauseReasonLabel, { color: colors.textDark }]}>{label}</Text>
                  {savingPause && <ActivityIndicator size="small" color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* ── FULL CALENDAR MODAL ────────────────────────────────────────────── */}
        {renderCalendarModal()}

      </View>
    </Background>
  );
}
