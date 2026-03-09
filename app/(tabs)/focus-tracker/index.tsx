import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Modal, KeyboardAvoidingView,
  Alert, ActivityIndicator, AppState,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Background from "../../../components/Background";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useTheme } from "../../../contexts/ThemeContext";

const TIMER_STORAGE_KEY  = "focusflow_active_timer";
const GOAL_STORAGE_KEY   = "focusflow_daily_goal";        // NEW

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  focus_time: number;
  completion_count: number;
  created_at: string;
  updated_at: string;
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function FocusTracker() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);

  const [tasks, setTasks]                 = useState<Task[]>([]);
  const [todaySessions, setTodaySessions] = useState<SessionDisplay[]>([]);
  const [loading, setLoading]             = useState(true);

  // Per-task count-up timer
  const [activeTaskId, setActiveTaskId]         = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds]     = useState(0);
  const [isPaused, setIsPaused]                 = useState(false);
  const [elapsedAtPause, setElapsedAtPause]     = useState(0);

  // Pause reason
  const [pauseReason, setPauseReason]       = useState<string | null>(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [savingPause, setSavingPause]       = useState(false);

  // Post-completion emotion
  const [showEmotionModal, setShowEmotionModal]               = useState(false);
  const [selectedEmotion, setSelectedEmotion]                 = useState<string | null>(null);
  const [pendingCompletionTaskId, setPendingCompletionTaskId] = useState<string | null>(null);
  const [pendingElapsedSeconds, setPendingElapsedSeconds]     = useState(0);
  const [savingCompletion, setSavingCompletion]               = useState(false);

  // Task modals
  const [showAddTaskModal, setShowAddTaskModal]           = useState(false);
  const [newTaskText, setNewTaskText]                     = useState("");
  const [addingTask, setAddingTask]                       = useState(false);
  const [showActionMenu, setShowActionMenu]               = useState(false);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<string | null>(null);
  const [editingTask, setEditingTask]                     = useState<Task | null>(null);
  const [showEditModal, setShowEditModal]                 = useState(false);
  const [editTaskText, setEditTaskText]                   = useState("");

  // ── NEW: Daily goal countdown ──────────────────────────────────────────────
  const [dailyGoalSeconds, setDailyGoalSeconds] = useState<number>(0);   // 0 = not set
  const [showGoalModal, setShowGoalModal]       = useState(false);
  const [goalHours, setGoalHours]               = useState("2");
  const [goalMinutes, setGoalMinutes]           = useState("0");
  const goalAlertedRef = useRef(false);          // fire "Goal reached!" only once

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchTodaySessions();
      restoreTimerState();
      loadDailyGoal();          // NEW
    }
  }, [user]);

  useEffect(() => { saveTimerState(); },
    [activeTaskId, isPaused, pauseReason, elapsedAtPause, sessionStartTime]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        restoreTimerState();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

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

  // NEW: fire a one-time alert when the countdown hits 0, then persist the alerted flag
  useEffect(() => {
    if (!dailyGoalSeconds) return;
    const totalSpent = totalSessionSecs + (activeTaskId ? elapsedSeconds : 0);
    if (totalSpent >= dailyGoalSeconds && !goalAlertedRef.current) {
      goalAlertedRef.current = true;
      saveDailyGoal(dailyGoalSeconds, true); // persist so it won't re-fire after restart
      Alert.alert("🏆 Daily Goal Reached!", "You've hit your focus target for today. Amazing work!");
    }
  }, [elapsedSeconds, todaySessions, dailyGoalSeconds]);

  // ─── Daily goal persistence ───────────────────────────────────────────────

  const todayDateStr = () => new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const loadDailyGoal = async () => {
    try {
      const raw = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
      if (!raw) return;
      const { goalSecs, goalDate, goalAlerted } = JSON.parse(raw);
      const today = todayDateStr();

      if (goalDate !== today) {
        // New day — keep the goal duration but reset the alerted flag
        goalAlertedRef.current = false;
        await AsyncStorage.setItem(
          GOAL_STORAGE_KEY,
          JSON.stringify({ goalSecs, goalDate: today, goalAlerted: false })
        );
      } else {
        goalAlertedRef.current = goalAlerted ?? false;
      }

      setDailyGoalSeconds(goalSecs ?? 0);
    } catch (e) {
      console.error("Failed to load daily goal:", e);
    }
  };

  const saveDailyGoal = async (secs: number, alerted = goalAlertedRef.current) => {
    try {
      await AsyncStorage.setItem(
        GOAL_STORAGE_KEY,
        JSON.stringify({ goalSecs: secs, goalDate: todayDateStr(), goalAlerted: alerted })
      );
    } catch (e) {
      console.error("Failed to save daily goal:", e);
    }
  };

  const confirmGoal = () => {
    const h = Math.max(0, parseInt(goalHours  || "0", 10));
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

  // ─── Timer persistence ────────────────────────────────────────────────────────

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

  // ─── Data fetching ────────────────────────────────────────────────────────────

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const { data, error } = await supabase
        .from("tasks").select("*").eq("user_id", user?.id)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch { Alert.alert("Error", "Failed to load tasks"); }
    finally { setLoading(false); }
  };

  const fetchTodaySessions = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
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

  // ─── Timer helpers ────────────────────────────────────────────────────────────

  const startNewTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setSessionStartTime(new Date());
    setElapsedSeconds(0);
    setElapsedAtPause(0);
    setIsPaused(false);
    setPauseReason(null);
  };

  const resetTimer = () => {
    setActiveTaskId(null);
    setSessionStartTime(null);
    setElapsedSeconds(0);
    setElapsedAtPause(0);
    setIsPaused(false);
    setPauseReason(null);
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

  // ─── Pause ────────────────────────────────────────────────────────────────────

  const handlePause = () => {
    setElapsedAtPause(elapsedSeconds);
    setSessionStartTime(null);
    setIsPaused(true);
    setPauseReason(null);
    setShowPauseModal(true);
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
  };

  // ─── Completion ───────────────────────────────────────────────────────────────

  const handleCompleteActiveTask = () => {
    if (!activeTaskId) return;
    setPendingCompletionTaskId(activeTaskId);
    setPendingElapsedSeconds(elapsedSeconds);
    setSelectedEmotion(null);
    setSessionStartTime(null);
    setShowEmotionModal(true);
  };

  const confirmCompletion = async () => {
    const taskId = pendingCompletionTaskId;
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

  // ─── Stop early ───────────────────────────────────────────────────────────────

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

  // ─── Task CRUD ────────────────────────────────────────────────────────────────

  const handleAddTask = async () => {
    if (!newTaskText.trim()) { Alert.alert("Error", "Please enter a task"); return; }
    try {
      setAddingTask(true);
      const { data, error } = await supabase.from("tasks").insert({
        user_id: user?.id, text: newTaskText.trim(),
        completed: false, focus_time: 0, completion_count: 0,
      }).select().single();
      if (error) throw error;
      setTasks([data, ...tasks]);
      setNewTaskText("");
      setShowAddTaskModal(false);
    } catch { Alert.alert("Error", "Failed to add task"); }
    finally { setAddingTask(false); }
  };

  const handleEditTask = async () => {
    if (!editTaskText.trim() || !editingTask) { Alert.alert("Error", "Please enter a task"); return; }
    try {
      setAddingTask(true);
      const { data, error } = await supabase.from("tasks")
        .update({ text: editTaskText.trim() }).eq("id", editingTask.id).select().single();
      if (error) throw error;
      setTasks(tasks.map(t => t.id === editingTask.id ? data : t));
      setShowEditModal(false); setEditTaskText(""); setEditingTask(null);
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
            await supabase.from("tasks").delete().eq("id", taskId);
          } catch { setTasks(copy); Alert.alert("Error", "Failed to delete task"); }
        },
      },
    ]);
  };

  // ─── Formatters ───────────────────────────────────────────────────────────────

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

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const completedCount   = tasks.filter(t => t.completed).length;
  const totalCount       = tasks.length;
  const totalFocusTime   = tasks.reduce((s, t) => s + (t.focus_time || 0), 0);
  const totalSessionSecs = todaySessions.reduce((s, sess) => s + sess.duration_minutes, 0);
  const activeTask       = tasks.find(t => t.id === activeTaskId);

  // NEW: live total spent = completed sessions + current active tick
  const liveSpentSeconds = totalSessionSecs + (activeTaskId ? elapsedSeconds : 0);
  const countdownSeconds = dailyGoalSeconds > 0
    ? Math.max(0, dailyGoalSeconds - liveSpentSeconds)
    : 0;
  const goalProgress = dailyGoalSeconds > 0
    ? Math.min(1, liveSpentSeconds / dailyGoalSeconds)
    : 0;
  const goalReached = dailyGoalSeconds > 0 && countdownSeconds === 0;

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
    headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    logoContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
    logoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    logoText: { fontSize: 24, fontWeight: "700", color: colors.primary, letterSpacing: -0.5 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    pageTitle: { fontSize: 28, fontWeight: "800", color: colors.textDark, marginVertical: 15 },

    // Stats bar
    statsBar: { flexDirection: "row", backgroundColor: colors.cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, padding: 16, marginBottom: 16, gap: 4 },
    statItem: { flex: 1, alignItems: "center" },
    statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
    statValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
    statLabel: { fontSize: 11, fontWeight: "600", color: colors.textLight, marginTop: 2 },

    // ── NEW: Countdown goal card ──────────────────────────────────────────────
    goalCard: {
      backgroundColor: colors.cardBg, borderRadius: 20, borderWidth: 1.5,
      borderColor: colors.border, padding: 16, marginBottom: 16,
    },
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
    // Progress bar
    progressTrack: { height: 8, backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 4 },
    progressMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    progressMetaText: { fontSize: 11, fontWeight: "600", color: colors.textLight },
    // Set goal prompt
    goalSetPrompt: { flexDirection: "row", alignItems: "center", gap: 10 },
    goalSetPromptText: { flex: 1, fontSize: 14, color: colors.textLight },
    goalSetBtn: { borderRadius: 12, overflow: "hidden" },
    goalSetBtnGradient: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },
    goalSetBtnText: { fontSize: 13, fontWeight: "700", color: "white" },

    // ── NEW: Goal modal ───────────────────────────────────────────────────────
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

    // Active banner
    activeBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)", borderWidth: 1.5, borderColor: colors.primary, borderRadius: 16, padding: 14, marginBottom: 20 },
    activeBannerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    activeBannerText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.primary },
    activeBannerStop: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,107,107,0.15)", borderRadius: 10 },

    // Section
    taskHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionLabel: { fontSize: 18, fontWeight: "700", color: colors.textDark },
    addTaskBtn: { padding: 4 },

    // Task card
    taskCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.cardBg, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10, overflow: "hidden" },
    taskCardActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: isDarkMode ? "rgba(93,184,154,0.08)" : "rgba(79,195,247,0.05)" },
    taskCardCompleted: { opacity: 0.55 },
    taskMain: { flex: 1, padding: 16 },
    taskText: { fontSize: 15, fontWeight: "500", color: colors.textMedium },
    taskTextDone: { textDecorationLine: "line-through", color: colors.textLight },
    taskMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
    focusTimeBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    focusTimeText: { fontSize: 12, fontWeight: "600", color: colors.primary },
    completionBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    completionText: { fontSize: 12, fontWeight: "600", color: "#FFB300" },
    activeTimerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
    elapsedText: { fontSize: 20, fontWeight: "700", color: colors.primary, letterSpacing: 1 },
    pausedPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,152,0,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    pausedPillText: { fontSize: 10, fontWeight: "800", color: "#FF9800", letterSpacing: 0.5 },
    startBtn: { width: 44, height: 44, borderRadius: 14, overflow: "hidden" },
    startBtnGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
    activeActions: { flexDirection: "row", gap: 8, paddingVertical: 12, paddingRight: 12 },
    actionBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: isDarkMode ? "rgba(93,184,154,0.2)" : "rgba(79,195,247,0.15)" },
    doneBtn: { backgroundColor: colors.primary },

    // Loading / empty
    loadingContainer: { paddingVertical: 40, alignItems: "center" },
    emptyContainer: { paddingVertical: 40, alignItems: "center", gap: 8 },
    emptyText: { fontSize: 18, fontWeight: "600", color: colors.textMedium, marginTop: 12 },
    emptySubtext: { fontSize: 14, color: colors.textLight },

    // Sessions
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

    // Modals (shared)
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
    addTaskModalContent: { backgroundColor: colors.surface, borderRadius: 30, padding: 24, width: "100%", maxWidth: 400, borderWidth: 2, borderColor: colors.border },
    addTaskHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: "800", color: colors.textDark },
    taskInput: { backgroundColor: colors.background, borderRadius: 16, padding: 16, fontSize: 16, color: colors.textDark, minHeight: 100, textAlignVertical: "top", marginBottom: 20 },
    modalButtons: { flexDirection: "row", gap: 15, width: "100%" },
    cancelBtn: { flex: 1, paddingVertical: 15, alignItems: "center" },
    cancelBtnText: { fontSize: 16, fontWeight: "600" },
    saveBtn: { flex: 1, borderRadius: 15, overflow: "hidden" },
    saveBtnGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center", minHeight: 48 },
    saveBtnText: { color: "white", fontSize: 16, fontWeight: "700" },
    buttonDisabled: { opacity: 0.7 },
    actionMenuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", padding: 20 },
    actionMenuContent: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 10 },
    actionMenuHeader: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.background, marginBottom: 5 },
    actionMenuTitle: { fontSize: 18, fontWeight: "700", color: colors.textDark, textAlign: "center" },
    actionMenuItem: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: colors.background, borderRadius: 16, gap: 12 },
    actionMenuIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)", alignItems: "center", justifyContent: "center" },
    actionMenuIconDanger: { backgroundColor: "rgba(255,107,107,0.1)" },
    actionMenuInfo: { flex: 1 },
    actionMenuItemTitle: { fontSize: 16, fontWeight: "600", color: colors.textDark, marginBottom: 2 },
    actionMenuItemDesc: { fontSize: 13, color: colors.textLight },
    dangerText: { color: "#FF6B6B" },
    actionMenuCancelBtn: { marginTop: 10, padding: 16, alignItems: "center", backgroundColor: colors.background, borderRadius: 16 },
    actionMenuCancelText: { fontSize: 16, fontWeight: "600", color: colors.textMedium },
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
  });

  // ─── Goal card sub-render ─────────────────────────────────────────────────

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

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={progressColors}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.round(goalProgress * 100)}%` }]}
              />
            </View>
            <View style={styles.progressMetaRow}>
              <Text style={styles.progressMetaText}>
                {formatSessionDuration(liveSpentSeconds)} done
              </Text>
              <Text style={styles.progressMetaText}>
                {Math.round(goalProgress * 100)}% · Goal: {formatSessionDuration(dailyGoalSeconds)}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.goalSetPrompt}>
            <Ionicons name="flag-outline" size={22} color={colors.textLight} />
            <Text style={styles.goalSetPromptText}>
              Set a daily focus goal to track your progress.
            </Text>
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

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Background>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.logoIcon}>
                <Ionicons name="flash" size={24} color={colors.white} />
              </LinearGradient>
              <Text style={styles.logoText}>FocusFlow</Text>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.pageTitle}>Sipat: Daily Focus Tracker</Text>

          {/* STATS BAR */}
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

          {/* ── NEW: DAILY GOAL COUNTDOWN CARD ── */}
          {renderGoalCard()}

          {/* ACTIVE TASK BANNER */}
          {activeTask && (
            <View style={styles.activeBanner}>
              <View style={styles.activeBannerDot} />
              <Text style={styles.activeBannerText} numberOfLines={1}>
                {isPaused ? "⏸ Paused: " : "▶ Focusing: "}{activeTask.text}
              </Text>
              <TouchableOpacity style={styles.activeBannerStop} onPress={handleStopTask}>
                <Ionicons name="stop" size={16} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          )}

          {/* TASKS */}
          <View style={styles.taskHeaderRow}>
            <Text style={styles.sectionLabel}>Today's Goals</Text>
            <TouchableOpacity style={styles.addTaskBtn} onPress={() => setShowAddTaskModal(true)}>
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
              <Text style={styles.emptySubtext}>Tap + to add your first goal</Text>
            </View>
          ) : (
            tasks.map((task) => {
              const isActive = activeTaskId === task.id;
              return (
                <View key={task.id} style={[
                  styles.taskCard,
                  task.completed && styles.taskCardCompleted,
                  isActive && styles.taskCardActive,
                ]}>
                  <View style={styles.taskMain}>
                    <Text style={[styles.taskText, task.completed && styles.taskTextDone]} numberOfLines={2}>
                      {task.text}
                    </Text>
                    {isActive ? (
                      <View style={styles.activeTimerRow}>
                        <Text style={styles.elapsedText}>{formatElapsed(elapsedSeconds)}</Text>
                        {isPaused && (
                          <View style={styles.pausedPill}>
                            <Ionicons name="pause" size={10} color="#FF9800" />
                            <Text style={styles.pausedPillText}>{pauseReason ?? "PAUSED"}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.taskMetaRow}>
                        {task.focus_time > 0 && (
                          <View style={styles.focusTimeBadge}>
                            <Ionicons name="time" size={12} color={colors.primary} />
                            <Text style={styles.focusTimeText}>{formatFocusTime(task.focus_time)}</Text>
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
                      <TouchableOpacity
                        style={styles.startBtn}
                        onPress={() => handleStartTask(task.id)}
                        onLongPress={() => { setSelectedTaskForAction(task.id); setShowActionMenu(true); }}
                        delayLongPress={500}
                      >
                        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.startBtnGradient}>
                          <Ionicons name="play" size={18} color="white" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* TODAY'S SESSIONS */}
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
        </ScrollView>

        {/* ── NEW: SET GOAL MODAL ── */}
        <Modal visible={showGoalModal} transparent animationType="slide"
          onRequestClose={() => setShowGoalModal(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.goalModalContent}>
              <View style={styles.goalModalHeader}>
                <Text style={styles.goalModalTitle}>Set Daily Goal ⏱</Text>
                <TouchableOpacity onPress={() => setShowGoalModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={26} color={colors.textMedium} />
                </TouchableOpacity>
              </View>
              <Text style={styles.goalModalSub}>
                How long do you want to focus today? The countdown starts immediately.
              </Text>

              {/* HH : MM inputs */}
              <View style={styles.goalInputRow}>
                <View style={styles.goalInputBlock}>
                  <Text style={styles.goalInputLabel}>HOURS</Text>
                  <TextInput
                    style={styles.goalInput}
                    value={goalHours}
                    onChangeText={v => setGoalHours(v.replace(/[^0-9]/g, "").slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                </View>
                <Text style={styles.goalInputSep}>:</Text>
                <View style={styles.goalInputBlock}>
                  <Text style={styles.goalInputLabel}>MINUTES</Text>
                  <TextInput
                    style={styles.goalInput}
                    value={goalMinutes}
                    onChangeText={v => {
                      const n = parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
                      setGoalMinutes(Math.min(59, n).toString());
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                </View>
              </View>

              {/* Quick presets */}
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
                      goalHours === p.h.toString() && goalMinutes === p.m.toString() && { borderColor: colors.primary, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)" },
                    ]}
                    onPress={() => { setGoalHours(p.h.toString()); setGoalMinutes(p.m.toString()); }}
                  >
                    <Text style={[
                      styles.goalPresetText,
                      goalHours === p.h.toString() && goalMinutes === p.m.toString() && { color: colors.primary, fontWeight: "700" },
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

        {/* ── POST-COMPLETION EMOTION MODAL ── */}
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

        {/* ── PAUSE REASON MODAL ── */}
        <Modal visible={showPauseModal} transparent animationType="slide"
          onRequestClose={() => setShowPauseModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.pauseModalContent}>
              <View style={styles.pauseModalHeader}>
                <Text style={styles.pauseModalTitle}>Why are you pausing?</Text>
                <Text style={styles.pauseModalSub}>This helps you stay self-aware 🧠</Text>
              </View>
              {PAUSE_REASONS.map(({ icon, label }) => {
                const isSelected = pauseReason === label;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.pauseReasonItem,
                      isSelected && { borderColor: colors.primary, backgroundColor: isDarkMode ? "rgba(93,184,154,0.15)" : "rgba(79,195,247,0.1)" },
                    ]}
                    onPress={() => setPauseReason(label)}
                  >
                    <View style={[styles.pauseReasonIcon, isSelected && { backgroundColor: colors.primary }]}>
                      <Ionicons name={icon as any} size={20} color={isSelected ? "white" : colors.primary} />
                    </View>
                    <Text style={[styles.pauseReasonLabel, { color: colors.textDark }, isSelected && { color: colors.primary, fontWeight: "700" }]}>
                      {label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.pauseConfirmBtn, { opacity: pauseReason && !savingPause ? 1 : 0.45 }]}
                onPress={() => { if (pauseReason) confirmPause(pauseReason); }}
                disabled={!pauseReason || savingPause}
              >
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.pauseConfirmGradient}>
                  {savingPause
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={styles.pauseConfirmText}>Got it, stay paused</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── ACTION MENU ── */}
        <Modal visible={showActionMenu} transparent animationType="fade"
          onRequestClose={() => { setShowActionMenu(false); setSelectedTaskForAction(null); }}>
          <TouchableOpacity style={styles.actionMenuOverlay} activeOpacity={1}
            onPress={() => { setShowActionMenu(false); setSelectedTaskForAction(null); }}>
            <View style={styles.actionMenuContent}>
              <View style={styles.actionMenuHeader}>
                <Text style={styles.actionMenuTitle}>Task Actions</Text>
              </View>
              <TouchableOpacity style={styles.actionMenuItem} onPress={() => {
                const task = tasks.find(t => t.id === selectedTaskForAction);
                if (task) { setEditingTask(task); setEditTaskText(task.text); setShowActionMenu(false); setShowEditModal(true); }
              }}>
                <View style={styles.actionMenuIcon}>
                  <Ionicons name="create-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.actionMenuInfo}>
                  <Text style={styles.actionMenuItemTitle}>Edit Task</Text>
                  <Text style={styles.actionMenuItemDesc}>Modify task description</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionMenuItem} onPress={() => {
                setShowActionMenu(false);
                if (selectedTaskForAction) handleDeleteTask(selectedTaskForAction);
              }}>
                <View style={[styles.actionMenuIcon, styles.actionMenuIconDanger]}>
                  <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
                </View>
                <View style={styles.actionMenuInfo}>
                  <Text style={[styles.actionMenuItemTitle, styles.dangerText]}>Delete Task</Text>
                  <Text style={styles.actionMenuItemDesc}>Remove task permanently</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionMenuCancelBtn}
                onPress={() => { setShowActionMenu(false); setSelectedTaskForAction(null); }}>
                <Text style={styles.actionMenuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── EDIT TASK MODAL ── */}
        <Modal visible={showEditModal} transparent animationType="slide"
          onRequestClose={() => { setShowEditModal(false); setEditTaskText(""); setEditingTask(null); }}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.addTaskModalContent}>
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>Edit Goal</Text>
                <TouchableOpacity onPress={() => { setShowEditModal(false); setEditTaskText(""); setEditingTask(null); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={28} color={colors.textMedium} />
                </TouchableOpacity>
              </View>
              <TextInput style={styles.taskInput} placeholder="What do you want to accomplish?"
                placeholderTextColor={colors.textLight} value={editTaskText}
                onChangeText={setEditTaskText} multiline maxLength={200} autoFocus />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowEditModal(false); setEditTaskText(""); setEditingTask(null); }}>
                  <Text style={[styles.cancelBtnText, { color: colors.textLight }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, addingTask && styles.buttonDisabled]} onPress={handleEditTask} disabled={addingTask}>
                  <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.saveBtnGradient}>
                    {addingTask ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* ── ADD TASK MODAL ── */}
        <Modal visible={showAddTaskModal} transparent animationType="slide"
          onRequestClose={() => setShowAddTaskModal(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.addTaskModalContent}>
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>Add New Goal</Text>
                <TouchableOpacity onPress={() => { setShowAddTaskModal(false); setNewTaskText(""); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={28} color={colors.textMedium} />
                </TouchableOpacity>
              </View>
              <TextInput style={styles.taskInput} placeholder="What do you want to accomplish?"
                placeholderTextColor={colors.textLight} value={newTaskText}
                onChangeText={setNewTaskText} multiline maxLength={200} autoFocus />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddTaskModal(false); setNewTaskText(""); }}>
                  <Text style={[styles.cancelBtnText, { color: colors.textLight }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, addingTask && styles.buttonDisabled]} onPress={handleAddTask} disabled={addingTask}>
                  <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.saveBtnGradient}>
                    {addingTask ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveBtnText}>Add Goal</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </Background>
  );
}