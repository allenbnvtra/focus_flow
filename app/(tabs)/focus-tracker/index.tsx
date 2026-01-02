import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Background from "../../../components/Background";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useTheme } from "../../../contexts/ThemeContext";

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

interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  duration_minutes: number;
  started_at: string;
  completed_at: string;
}

interface DailyMood {
  id: string;
  user_id: string;
  mood_value: number;
  mood_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type FocusMode = "single" | "all" | null;

export default function FocusTracker() {
  const { colors, isDarkMode } = useTheme();
  
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Timer states
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [tempMinutes, setTempMinutes] = useState("25");

  // Focus session tracking
  const [focusMode, setFocusMode] = useState<FocusMode>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [initialTimerMinutes, setInitialTimerMinutes] = useState(25);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  // Mood tracking
  const [todayMood, setTodayMood] = useState<DailyMood | null>(null);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [moodNotes, setMoodNotes] = useState("");
  const [savingMood, setSavingMood] = useState(false);

  // Modals
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [showTaskSelectModal, setShowTaskSelectModal] = useState(false);
  const [showModeSelectModal, setShowModeSelectModal] = useState(false);

  // Task action menu
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<string | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTaskText, setEditTaskText] = useState("");

  const moods = [
    { emoji: "😊", label: "Great", value: 1 },
    { emoji: "🙂", label: "Good", value: 2 },
    { emoji: "😐", label: "Okay", value: 3 },
    { emoji: "😕", label: "Low", value: 4 },
    { emoji: "😣", label: "Stressed", value: 5 },
  ];

  // Load tasks and mood on mount
  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchTodayMood();
    }
  }, [user]);

  // Timer effect
  useEffect(() => {
    let interval: any;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        if (timerSeconds > 0) {
          setTimerSeconds(timerSeconds - 1);
        } else if (timerMinutes > 0) {
          setTimerMinutes(timerMinutes - 1);
          setTimerSeconds(59);
        } else {
          handleTimerComplete();
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused, timerMinutes, timerSeconds]);

  // Fetch tasks from Supabase
  const fetchTasks = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user?.id)
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error("Error fetching tasks:", error.message);
      Alert.alert("Error", "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  // Fetch today's mood
  const fetchTodayMood = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("daily_moods")
        .select("*")
        .eq("user_id", user?.id)
        .eq("mood_date", today)
        .maybeSingle();

      if (error) throw error;
      setTodayMood(data);

      if (data) {
        setSelectedMood(data.mood_value);
        setMoodNotes(data.notes || "");
      }
    } catch (error: any) {
      console.error("Error fetching mood:", error.message);
    }
  };

  // Save or update mood
  const saveMood = async () => {
    if (selectedMood === null) {
      Alert.alert("Error", "Please select a mood");
      return;
    }

    try {
      setSavingMood(true);
      const today = new Date().toISOString().split("T")[0];

      if (todayMood) {
        const { data, error } = await supabase
          .from("daily_moods")
          .update({
            mood_value: selectedMood,
            notes: moodNotes.trim() || null,
          })
          .eq("id", todayMood.id)
          .select()
          .single();

        if (error) throw error;
        setTodayMood(data);
      } else {
        const { data, error } = await supabase
          .from("daily_moods")
          .insert({
            user_id: user?.id,
            mood_value: selectedMood,
            mood_date: today,
            notes: moodNotes.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;
        setTodayMood(data);
      }

      setShowMoodModal(false);
      Alert.alert("Success", "Your mood has been saved!");
    } catch (error: any) {
      console.error("Error saving mood:", error);
      Alert.alert("Error", error.message || "Failed to save mood");
    } finally {
      setSavingMood(false);
    }
  };

  // Start focus session - show mode selection
  const handleStartFocus = () => {
    const incompleteTasks = tasks.filter((t) => !t.completed);

    if (incompleteTasks.length === 0) {
      Alert.alert(
        "No Tasks",
        "Please add a task first before starting a focus session"
      );
      return;
    }

    setShowModeSelectModal(true);
  };

  // Select focus mode
  const selectFocusMode = (mode: FocusMode) => {
    setFocusMode(mode);
    setShowModeSelectModal(false);

    if (mode === "single") {
      setShowTaskSelectModal(true);
    } else if (mode === "all") {
      startAllTasksMode();
    }
  };

  // Start all tasks mode
  const startAllTasksMode = () => {
    const incompleteTasks = tasks.filter((t) => !t.completed);
    if (incompleteTasks.length === 0) {
      Alert.alert("No Tasks", "All tasks are completed!");
      return;
    }

    setCurrentTaskIndex(0);
    setSelectedTaskId(incompleteTasks[0].id);
    setSessionStartTime(new Date());
    setInitialTimerMinutes(timerMinutes);
    setIsRunning(true);
    setIsPaused(false);
  };

  // Select single task and start
  const selectTaskAndStart = (taskId: string | null) => {
    setSelectedTaskId(taskId);
    setSessionStartTime(new Date());
    setInitialTimerMinutes(timerMinutes);
    setIsRunning(true);
    setIsPaused(false);
    setShowTaskSelectModal(false);
  };

  // Handle timer completion
  const handleTimerComplete = async () => {
    setIsRunning(false);
    setIsPaused(false);

    if (!sessionStartTime) return;

    const endTime = new Date();
    const durationInMinutes = Math.round(
      (endTime.getTime() - sessionStartTime.getTime()) / 60000
    );

    if (durationInMinutes <= 0) {
      resetTimerState();
      return;
    }

    try {
      const { error: sessionError } = await supabase
        .from("focus_sessions")
        .insert({
          user_id: user?.id,
          task_id: selectedTaskId,
          duration_minutes: durationInMinutes,
          started_at: sessionStartTime.toISOString(),
          completed_at: endTime.toISOString(),
        });

      if (sessionError) throw sessionError;

      if (selectedTaskId) {
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (task) {
          const newFocusTime = (task.focus_time || 0) + durationInMinutes;

          const { error: updateError } = await supabase
            .from("tasks")
            .update({ focus_time: newFocusTime })
            .eq("id", selectedTaskId);

          if (updateError) throw updateError;

          setTasks(
            tasks.map((t) =>
              t.id === selectedTaskId ? { ...t, focus_time: newFocusTime } : t
            )
          );
        }
      }

      if (focusMode === "all") {
        handleAllTasksModeCompletion();
      } else {
        handleSingleTaskCompletion(durationInMinutes);
      }
    } catch (error: any) {
      console.error("Error saving focus session:", error);
      Alert.alert("Error", "Failed to save focus session");
      resetTimerState();
    }
  };

  // Handle single task completion
  const handleSingleTaskCompletion = (duration: number) => {
    Alert.alert(
      "🎉 Focus Session Complete!",
      `Great work! You focused for ${duration} minutes.`,
      [
        {
          text: "Start Another",
          onPress: () => {
            setTimerMinutes(initialTimerMinutes);
            setTimerSeconds(0);
            handleStartFocus();
          },
        },
        {
          text: "Take a Break",
          style: "cancel",
          onPress: () => {
            resetTimerState();
          },
        },
      ]
    );
  };

  // Handle all tasks mode completion
  const handleAllTasksModeCompletion = () => {
    const incompleteTasks = tasks.filter((t) => !t.completed);
    const nextIndex = currentTaskIndex + 1;

    if (nextIndex < incompleteTasks.length) {
      Alert.alert(
        "✅ Task Session Complete!",
        "Ready to move to the next task?",
        [
          {
            text: "Continue",
            onPress: () => {
              setCurrentTaskIndex(nextIndex);
              setSelectedTaskId(incompleteTasks[nextIndex].id);
              setSessionStartTime(new Date());
              setTimerMinutes(initialTimerMinutes);
              setTimerSeconds(0);
              setIsRunning(true);
              setIsPaused(false);
            },
          },
          {
            text: "Stop Session",
            style: "cancel",
            onPress: () => resetTimerState(),
          },
        ]
      );
    } else {
      setIsRunning(false);
      setIsPaused(false);
      Alert.alert(
        "🎊 All Tasks Complete!",
        "Congratulations! You've completed all your tasks! The timer has been automatically stopped.",
        [
          {
            text: "Awesome!",
            onPress: () => resetTimerState(),
          },
        ]
      );
    }
  };

  // Reset timer state
  const resetTimerState = () => {
    setTimerMinutes(initialTimerMinutes);
    setTimerSeconds(0);
    setSelectedTaskId(null);
    setSessionStartTime(null);
    setFocusMode(null);
    setCurrentTaskIndex(0);
    setIsRunning(false);
    setIsPaused(false);
  };

  // Toggle pause/resume
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Stop timer early
  const handleStopTimer = () => {
    if (!isRunning) return;

    Alert.alert(
      "Stop Focus Session?",
      "Do you want to save this partial session?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Don't Save",
          style: "destructive",
          onPress: () => {
            setIsRunning(false);
            setIsPaused(false);
            resetTimerState();
          },
        },
        {
          text: "Save Session",
          onPress: async () => {
            await savePartialSession();
          },
        },
      ]
    );
  };

  // Save partial session
  const savePartialSession = async () => {
    if (!sessionStartTime) return;

    const endTime = new Date();
    const durationInMinutes = Math.round(
      (endTime.getTime() - sessionStartTime.getTime()) / 60000
    );

    if (durationInMinutes <= 0) {
      Alert.alert(
        "Session Too Short",
        "Focus session must be at least 1 minute to save."
      );
      setIsRunning(false);
      setIsPaused(false);
      resetTimerState();
      return;
    }

    try {
      const { error: sessionError } = await supabase
        .from("focus_sessions")
        .insert({
          user_id: user?.id,
          task_id: selectedTaskId,
          duration_minutes: durationInMinutes,
          started_at: sessionStartTime.toISOString(),
          completed_at: endTime.toISOString(),
        });

      if (sessionError) throw sessionError;

      if (selectedTaskId) {
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (task) {
          const newFocusTime = (task.focus_time || 0) + durationInMinutes;

          const { error: updateError } = await supabase
            .from("tasks")
            .update({ focus_time: newFocusTime })
            .eq("id", selectedTaskId);

          if (updateError) throw updateError;

          setTasks(
            tasks.map((t) =>
              t.id === selectedTaskId ? { ...t, focus_time: newFocusTime } : t
            )
          );
        }
      }

      Alert.alert(
        "Session Saved",
        `Logged ${durationInMinutes} minutes of focus time`
      );
    } catch (error: any) {
      console.error("Error saving session:", error);
      Alert.alert("Error", "Failed to save session");
    } finally {
      setIsRunning(false);
      setIsPaused(false);
      resetTimerState();
    }
  };

  // Add new task
  const handleAddTask = async () => {
    if (!newTaskText.trim()) {
      Alert.alert("Error", "Please enter a task");
      return;
    }

    try {
      setAddingTask(true);

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user?.id,
          text: newTaskText.trim(),
          completed: false,
          focus_time: 0,
          completion_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      setTasks([data, ...tasks]);
      setNewTaskText("");
      setShowAddTaskModal(false);
    } catch (error: any) {
      console.error("Error adding task:", error);
      Alert.alert("Error", "Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  // Toggle task completion
  const toggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedCompleted = !task.completed;
    const newCompletionCount = updatedCompleted
      ? (task.completion_count || 0) + 1
      : task.completion_count;

    setTasks(
      tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: updatedCompleted,
              completion_count: newCompletionCount,
            }
          : t
      )
    );

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          completed: updatedCompleted,
          completion_count: newCompletionCount,
        })
        .eq("id", taskId);

      if (error) throw error;

      if (updatedCompleted) {
        Alert.alert(
          "✅ Task Completed!",
          `Great job! You've completed this task ${newCompletionCount} time${
            newCompletionCount > 1 ? "s" : ""
          }!`
        );

        if (focusMode === "all" && isRunning) {
          const remainingIncompleteTasks = tasks.filter(
            (t) => t.id !== taskId && !t.completed
          );

          if (remainingIncompleteTasks.length === 0) {
            setIsRunning(false);
            setIsPaused(false);
            Alert.alert(
              "🎊 All Tasks Complete!",
              "Amazing work! All tasks are now completed! The timer has been automatically stopped.",
              [
                {
                  text: "Awesome!",
                  onPress: () => resetTimerState(),
                },
              ]
            );
          }
        }
      }
    } catch (error: any) {
      console.error("Error updating task:", error);
      setTasks(
        tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: task.completed,
                completion_count: task.completion_count,
              }
            : t
        )
      );
      Alert.alert("Error", "Failed to update task");
    }
  };

  // Edit task
  const handleEditTask = async () => {
    if (!editTaskText.trim() || !editingTask) {
      Alert.alert("Error", "Please enter a task");
      return;
    }

    try {
      setAddingTask(true);

      const { data, error } = await supabase
        .from("tasks")
        .update({ text: editTaskText.trim() })
        .eq("id", editingTask.id)
        .select()
        .single();

      if (error) throw error;

      setTasks(tasks.map((t) => (t.id === editingTask.id ? data : t)));
      setShowEditModal(false);
      setEditTaskText("");
      setEditingTask(null);
      Alert.alert("Success", "Task updated successfully!");
    } catch (error: any) {
      console.error("Error updating task:", error);
      Alert.alert("Error", "Failed to update task");
    } finally {
      setAddingTask(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task? All focus sessions will also be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const tasksCopy = [...tasks];
            setTasks(tasks.filter((t) => t.id !== taskId));

            try {
              const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", taskId);

              if (error) throw error;

              if (
                focusMode === "all" &&
                isRunning &&
                selectedTaskId === taskId
              ) {
                const remainingIncompleteTasks = tasks.filter(
                  (t) => t.id !== taskId && !t.completed
                );

                if (remainingIncompleteTasks.length === 0) {
                  setIsRunning(false);
                  setIsPaused(false);
                  Alert.alert(
                    "All Tasks Complete",
                    "All remaining tasks are completed! The timer has been stopped.",
                    [
                      {
                        text: "OK",
                        onPress: () => resetTimerState(),
                      },
                    ]
                  );
                }
              }
            } catch (error: any) {
              console.error("Error deleting task:", error);
              setTasks(tasksCopy);
              Alert.alert("Error", "Failed to delete task");
            }
          },
        },
      ]
    );
  };

  const handleSetTime = () => {
    const mins = parseInt(tempMinutes);
    if (!isNaN(mins) && mins > 0 && mins <= 180) {
      setTimerMinutes(mins);
      setTimerSeconds(0);
      setInitialTimerMinutes(mins);
      setShowTimeModal(false);
    } else {
      Alert.alert(
        "Invalid Time",
        "Please enter a valid time between 1 and 180 minutes"
      );
    }
  };

  const formatTime = (num: number) => num.toString().padStart(2, "0");

  const formatFocusTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getMoodEmoji = (value: number) => {
    return moods.find((m) => m.value === value)?.emoji || "😊";
  };

    const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
    headerContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    logoContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
    logoIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.primary,
      letterSpacing: -0.5,
    },
    headerIcons: { flexDirection: "row", gap: 10 },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    moodButtonEmoji: {
      fontSize: 24,
    },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    pageTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.textDark,
      marginVertical: 15,
    },
    timerCard: {
      backgroundColor: colors.cardBg,
      borderRadius: 24,
      padding: 20,
      marginBottom: 25,
      elevation: 20,
      shadowColor: colors.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    timerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    timerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
    timerTitle: { fontSize: 16, fontWeight: "700", color: colors.textDark },
    editBtn: {
      backgroundColor: colors.bubbleMedium,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    editBtnText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
    activeInfoContainer: {
      marginTop: 12,
      gap: 8,
    },
    modeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      backgroundColor: isDarkMode ? "rgba(93, 184, 154, 0.2)" : "rgba(79, 195, 247, 0.15)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    modeBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    activeTaskBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: isDarkMode ? "rgba(93, 184, 154, 0.15)" : "rgba(79, 195, 247, 0.1)",
      padding: 12,
      borderRadius: 12,
    },
    activeTaskText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.primary,
    },
    taskProgress: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primaryDark,
    },
    timerDisplay: { alignItems: "center", marginVertical: 20 },
    timerText: {
      fontSize: 64,
      fontWeight: "300",
      color: colors.textDark,
      letterSpacing: 2,
    },
    pausedText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FF9800",
      marginTop: 8,
      letterSpacing: 2,
    },
    timerButtons: { flexDirection: "row", gap: 12 },
    mainBtn: { flex: 4, height: 54, borderRadius: 15, overflow: "hidden" },
    mainBtnGradient: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    mainBtnText: { color: "white", fontWeight: "700", fontSize: 16 },
    stopBtn: {
      flex: 1,
      backgroundColor: "rgba(255, 107, 107, 0.1)",
      borderRadius: 15,
      justifyContent: "center",
      alignItems: "center",
    },
    taskHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textDark,
    },
    addTaskBtn: {
      padding: 4,
    },
    taskCardWrapper: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      gap: 8,
    },
    taskCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBg,
      padding: 16,
      borderRadius: 18,
      elevation: 3,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    taskCardCompleted: { opacity: 0.6 },
    taskCardActive: {
      borderColor: colors.primary,
      borderWidth: 2,
      backgroundColor: isDarkMode ? "rgba(93, 184, 154, 0.1)" : "rgba(79, 195, 247, 0.05)",
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.primaryLight,
      marginRight: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    taskContent: {
      flex: 1,
      gap: 6,
    },
    taskText: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.textMedium,
    },
    taskTextDone: {
      textDecorationLine: "line-through",
      color: colors.textLight,
    },
    taskMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    focusTimeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    focusTimeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    completionBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    completionText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#FFB300",
    },
    deleteBtn: {
      padding: 8,
      backgroundColor: "rgba(255, 107, 107, 0.1)",
      borderRadius: 12,
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: "center",
    },
    emptyContainer: {
      paddingVertical: 40,
      alignItems: "center",
      gap: 8,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textMedium,
      marginTop: 12,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textLight,
    },
    moodModalContent: {
      backgroundColor: colors.surface,
      borderRadius: 30,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      borderWidth: 2,
      borderColor: colors.border,
    },
    moodModalSubtitle: {
      fontSize: 14,
      color: colors.textLight,
      marginBottom: 20,
    },
    moodContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    moodButton: {
      width: 60,
      height: 70,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
      gap: 4,
    },
    moodButtonActive: {
      backgroundColor: colors.cardBg,
      transform: [{ scale: 1.05 }],
      elevation: 4,
      borderColor: colors.primary,
    },
    moodEmoji: { fontSize: 28 },
    moodLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textMedium,
    },
    moodNotesInput: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      fontSize: 15,
      color: colors.textDark,
      minHeight: 80,
      textAlignVertical: "top",
      marginBottom: 20,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 30,
      padding: 30,
      width: "100%",
      maxWidth: 340,
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.border,
    },
    addTaskModalContent: {
      backgroundColor: colors.surface,
      borderRadius: 30,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      borderWidth: 2,
      borderColor: colors.border,
    },
    modeSelectContent: {
      backgroundColor: colors.surface,
      borderRadius: 30,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      borderWidth: 2,
      borderColor: colors.border,
    },
    taskSelectModalContent: {
      backgroundColor: colors.surface,
      borderRadius: 30,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      maxHeight: "70%",
      borderWidth: 2,
      borderColor: colors.border,
    },
    addTaskHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.textDark,
    },
    taskSelectSubtitle: {
      fontSize: 14,
      color: colors.textLight,
      marginBottom: 20,
    },
    modeOptionCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      backgroundColor: colors.background,
      borderRadius: 20,
      marginBottom: 12,
      gap: 16,
      borderWidth: 2,
      borderColor: "transparent",
    },
    modeOptionIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.cardBg,
      alignItems: "center",
      justifyContent: "center",
    },
    modeOptionInfo: {
      flex: 1,
    },
    modeOptionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textDark,
      marginBottom: 4,
    },
    modeOptionDesc: {
      fontSize: 14,
      color: colors.textLight,
    },
    taskSelectScroll: {
      maxHeight: 400,
    },
    taskSelectItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.background,
      borderRadius: 16,
      marginBottom: 10,
      gap: 12,
    },
    taskSelectIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cardBg,
      alignItems: "center",
      justifyContent: "center",
    },
    taskSelectInfo: {
      flex: 1,
    },
    taskSelectName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textDark,
      marginBottom: 2,
    },
    taskSelectDesc: {
      fontSize: 12,
      color: colors.textLight,
    },
    taskSelectMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 30,
    },
    input: {
      fontSize: 48,
      fontWeight: "700",
      color: colors.primary,
      borderBottomWidth: 3,
      borderBottomColor: colors.accent,
      textAlign: "center",
      minWidth: 80,
    },
    inputLabel: {
      fontSize: 18,
      color: colors.textLight,
      fontWeight: "600",
    },
    taskInput: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
      color: colors.textDark,
      minHeight: 100,
      textAlignVertical: "top",
      marginBottom: 20,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 15,
      width: "100%",
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 15,
      alignItems: "center",
    },
    cancelBtnText: {
      color: colors.textLight,
      fontSize: 16,
      fontWeight: "600",
    },
    saveBtn: {
      flex: 1,
      borderRadius: 15,
      overflow: "hidden",
    },
    saveBtnGradient: {
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    saveBtnText: {
      color: "white",
      fontSize: 16,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    actionMenuOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
      padding: 20,
    },
    actionMenuContent: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      gap: 10,
    },
    actionMenuHeader: {
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.background,
      marginBottom: 5,
    },
    actionMenuTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textDark,
      textAlign: "center",
    },
    actionMenuItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.background,
      borderRadius: 16,
      gap: 12,
    },
    actionMenuIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDarkMode ? "rgba(93, 184, 154, 0.15)" : "rgba(79, 195, 247, 0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    actionMenuIconDanger: {
      backgroundColor: "rgba(255, 107, 107, 0.1)",
    },
    actionMenuInfo: {
      flex: 1,
    },
    actionMenuItemTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textDark,
      marginBottom: 2,
    },
    actionMenuItemDesc: {
      fontSize: 13,
      color: colors.textLight,
    },
    dangerText: {
      color: "#FF6B6B",
    },
    actionMenuCancelBtn: {
      marginTop: 10,
      padding: 16,
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 16,
    },
    actionMenuCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textMedium,
    },
  });

  return (
    <Background>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primaryLight]}
                style={styles.logoIcon}
              >
                <Ionicons name="flash" size={24} color={colors.white} />
              </LinearGradient>
              <Text style={styles.logoText}>FocusFlow</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowMoodModal(true)}
              >
                <Text style={styles.moodButtonEmoji}>
                  {todayMood ? getMoodEmoji(todayMood.mood_value) : "😊"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons
                  name="menu-outline"
                  size={22}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.pageTitle}>Daily Focus Tracker</Text>

          {/* TIMER CARD */}
          <View style={styles.timerCard}>
            <View style={styles.timerHeader}>
              <View style={styles.timerTitleGroup}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.timerTitle}>Focus Timer</Text>
              </View>
              {!isRunning && (
                <TouchableOpacity
                  onPress={() => setShowTimeModal(true)}
                  style={styles.editBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.editBtnText}>Set Time</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Show mode and task info if active */}
            {isRunning && (
              <View style={styles.activeInfoContainer}>
                <View style={styles.modeBadge}>
                  <Ionicons
                    name={focusMode === "all" ? "list" : "checkmark-circle"}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.modeBadgeText}>
                    {focusMode === "all" ? "All Tasks Mode" : "Single Task"}
                  </Text>
                </View>
                {selectedTaskId && (
                  <View style={styles.activeTaskBanner}>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.activeTaskText} numberOfLines={1}>
                      {tasks.find((t) => t.id === selectedTaskId)?.text ||
                        "General Focus"}
                    </Text>
                    {focusMode === "all" && (
                      <Text style={styles.taskProgress}>
                        ({currentTaskIndex + 1}/
                        {tasks.filter((t) => !t.completed).length})
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            <View style={styles.timerDisplay}>
              <Text style={styles.timerText}>
                {formatTime(timerMinutes)}:{formatTime(timerSeconds)}
              </Text>
              {isPaused && <Text style={styles.pausedText}>PAUSED</Text>}
            </View>

            <View style={styles.timerButtons}>
              {!isRunning ? (
                <TouchableOpacity
                  style={styles.mainBtn}
                  onPress={handleStartFocus}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    style={styles.mainBtnGradient}
                  >
                    <Ionicons name="play" size={20} color="white" />
                    <Text style={styles.mainBtnText}>Start Focus</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.mainBtn}
                    onPress={togglePause}
                  >
                    <LinearGradient
                      colors={
                        isPaused
                          ? [colors.primary, colors.primaryDark]
                          : ["#FF9800", "#F57C00"]
                      }
                      style={styles.mainBtnGradient}
                    >
                      <Ionicons
                        name={isPaused ? "play" : "pause"}
                        size={20}
                        color="white"
                      />
                      <Text style={styles.mainBtnText}>
                        {isPaused ? "Resume" : "Pause"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stopBtn}
                    onPress={handleStopTimer}
                  >
                    <Ionicons name="stop" size={22} color="#FF6B6B" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* TASKS SECTION */}
          <View style={styles.taskHeaderRow}>
            <Text style={styles.sectionLabel}>Today's Goals</Text>
            <TouchableOpacity
              style={styles.addTaskBtn}
              onPress={() => setShowAddTaskModal(true)}
            >
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="checkmark-done-outline"
                size={48}
                color={colors.textLight}
              />
              <Text style={styles.emptyText}>No tasks yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to add your first goal
              </Text>
            </View>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.taskCardWrapper}>
                <TouchableOpacity
                  style={[
                    styles.taskCard,
                    task.completed && styles.taskCardCompleted,
                    selectedTaskId === task.id &&
                      isRunning &&
                      styles.taskCardActive,
                  ]}
                  onPress={() => toggleTask(task.id)}
                  onLongPress={() => {
                    setSelectedTaskForAction(task.id);
                    setShowActionMenu(true);
                  }}
                  activeOpacity={0.7}
                  delayLongPress={500}
                >
                  <View
                    style={[
                      styles.checkbox,
                      task.completed && styles.checkboxActive,
                    ]}
                  >
                    {task.completed && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <View style={styles.taskContent}>
                    <Text
                      style={[
                        styles.taskText,
                        task.completed && styles.taskTextDone,
                      ]}
                      numberOfLines={2}
                    >
                      {task.text}
                    </Text>
                    <View style={styles.taskMetaRow}>
                      {task.focus_time > 0 && (
                        <View style={styles.focusTimeBadge}>
                          <Ionicons
                            name="time"
                            size={12}
                            color={colors.primary}
                          />
                          <Text style={styles.focusTimeText}>
                            {formatFocusTime(task.focus_time)}
                          </Text>
                        </View>
                      )}
                      {task.completion_count > 0 && (
                        <View style={styles.completionBadge}>
                          <Ionicons name="trophy" size={12} color="#FFB300" />
                          <Text style={styles.completionText}>
                            ×{task.completion_count}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        {/* MODE SELECTION MODAL */}
        <Modal
          visible={showModeSelectModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowModeSelectModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modeSelectContent}>
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>Choose Focus Mode</Text>
                <TouchableOpacity
                  onPress={() => setShowModeSelectModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.textMedium} />
                </TouchableOpacity>
              </View>

              <Text style={styles.taskSelectSubtitle}>
                How would you like to focus today?
              </Text>

              <TouchableOpacity
                style={styles.modeOptionCard}
                onPress={() => selectFocusMode("single")}
              >
                <View style={styles.modeOptionIcon}>
                  <Ionicons
                    name="checkmark-circle"
                    size={32}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.modeOptionInfo}>
                  <Text style={styles.modeOptionTitle}>Single Task</Text>
                  <Text style={styles.modeOptionDesc}>
                    Focus on one specific task
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={colors.textLight}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modeOptionCard}
                onPress={() => selectFocusMode("all")}
              >
                <View style={styles.modeOptionIcon}>
                  <Ionicons name="list" size={32} color={colors.primaryDark} />
                </View>
                <View style={styles.modeOptionInfo}>
                  <Text style={styles.modeOptionTitle}>All Tasks</Text>
                  <Text style={styles.modeOptionDesc}>
                    Work through all incomplete tasks
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={colors.textLight}
                />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* TASK SELECTION MODAL */}
        <Modal
          visible={showTaskSelectModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTaskSelectModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.taskSelectModalContent}>
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>Select a Task</Text>
                <TouchableOpacity
                  onPress={() => setShowTaskSelectModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.textMedium} />
                </TouchableOpacity>
              </View>

              <Text style={styles.taskSelectSubtitle}>
                Which task will you focus on?
              </Text>

              <ScrollView style={styles.taskSelectScroll}>
                {/* General Focus Option */}
                <TouchableOpacity
                  style={styles.taskSelectItem}
                  onPress={() => selectTaskAndStart(null)}
                >
                  <View style={styles.taskSelectIcon}>
                    <Ionicons
                      name="flash-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.taskSelectInfo}>
                    <Text style={styles.taskSelectName}>General Focus</Text>
                    <Text style={styles.taskSelectDesc}>
                      Focus without a specific task
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textLight}
                  />
                </TouchableOpacity>

                {/* Task List */}
                {tasks
                  .filter((t) => !t.completed)
                  .map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      style={styles.taskSelectItem}
                      onPress={() => selectTaskAndStart(task.id)}
                    >
                      <View style={styles.taskSelectIcon}>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={24}
                          color={colors.primaryLight}
                        />
                      </View>
                      <View style={styles.taskSelectInfo}>
                        <Text style={styles.taskSelectName} numberOfLines={1}>
                          {task.text}
                        </Text>
                        <View style={styles.taskSelectMetaRow}>
                          {task.focus_time > 0 && (
                            <Text style={styles.taskSelectDesc}>
                              {formatFocusTime(task.focus_time)}
                            </Text>
                          )}
                          {task.completion_count > 0 && (
                            <Text style={styles.taskSelectDesc}>
                              • ×{task.completion_count} completed
                            </Text>
                          )}
                        </View>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={colors.textLight}
                      />
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MOOD MODAL */}
        <Modal
          visible={showMoodModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMoodModal(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.moodModalContent}
            >
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>How are you feeling?</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowMoodModal(false);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.textMedium} />
                </TouchableOpacity>
              </View>

              <Text style={styles.moodModalSubtitle}>
                Track your daily mood
              </Text>

              <View style={styles.moodContainer}>
                {moods.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.moodButton,
                      selectedMood === item.value && styles.moodButtonActive,
                    ]}
                    onPress={() => setSelectedMood(item.value)}
                  >
                    <Text style={styles.moodEmoji}>{item.emoji}</Text>
                    <Text style={styles.moodLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.moodNotesInput}
                placeholder="Any notes about your day? (optional)"
                placeholderTextColor={colors.textLight}
                value={moodNotes}
                onChangeText={setMoodNotes}
                multiline
                maxLength={200}
              />

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (selectedMood === null || savingMood) &&
                    styles.buttonDisabled,
                ]}
                onPress={saveMood}
                disabled={selectedMood === null || savingMood}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryLight]}
                  style={styles.saveBtnGradient}
                >
                  {savingMood ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Mood</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* TIME SETTING MODAL */}
        <Modal
          visible={showTimeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalContent}
            >
              <Text style={styles.modalTitle}>Set Duration</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={tempMinutes}
                  onChangeText={setTempMinutes}
                  keyboardType="number-pad"
                  autoFocus
                  selectTextOnFocus
                />
                <Text style={styles.inputLabel}>minutes</Text>
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowTimeModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSetTime}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryLight]}
                    style={styles.saveBtnGradient}
                  >
                    <Text style={styles.saveBtnText}>Apply</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* ACTION MENU MODAL */}
        <Modal
          visible={showActionMenu}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowActionMenu(false);
            setSelectedTaskForAction(null);
          }}
        >
          <TouchableOpacity
            style={styles.actionMenuOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowActionMenu(false);
              setSelectedTaskForAction(null);
            }}
          >
            <View style={styles.actionMenuContent}>
              <View style={styles.actionMenuHeader}>
                <Text style={styles.actionMenuTitle}>Task Actions</Text>
              </View>

              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  const task = tasks.find((t) => t.id === selectedTaskForAction);
                  if (task) {
                    setEditingTask(task);
                    setEditTaskText(task.text);
                    setShowActionMenu(false);
                    setShowEditModal(true);
                  }
                }}
              >
                <View style={styles.actionMenuIcon}>
                  <Ionicons name="create-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.actionMenuInfo}>
                  <Text style={styles.actionMenuItemTitle}>Edit Task</Text>
                  <Text style={styles.actionMenuItemDesc}>
                    Modify task description
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textLight}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setShowActionMenu(false);
                  if (selectedTaskForAction) {
                    handleDeleteTask(selectedTaskForAction);
                  }
                }}
              >
                <View style={[styles.actionMenuIcon, styles.actionMenuIconDanger]}>
                  <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
                </View>
                <View style={styles.actionMenuInfo}>
                  <Text style={[styles.actionMenuItemTitle, styles.dangerText]}>
                    Delete Task
                  </Text>
                  <Text style={styles.actionMenuItemDesc}>
                    Remove task permanently
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionMenuCancelBtn}
                onPress={() => {
                  setShowActionMenu(false);
                  setSelectedTaskForAction(null);
                }}
              >
                <Text style={styles.actionMenuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* EDIT TASK MODAL */}
        <Modal
          visible={showEditModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowEditModal(false);
            setEditTaskText("");
            setEditingTask(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.addTaskModalContent}
            >
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>Edit Goal</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowEditModal(false);
                    setEditTaskText("");
                    setEditingTask(null);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.textMedium} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.taskInput}
                placeholder="What do you want to accomplish?"
                placeholderTextColor={colors.textLight}
                value={editTaskText}
                onChangeText={setEditTaskText}
                multiline
                maxLength={200}
                autoFocus
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditTaskText("");
                    setEditingTask(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, addingTask && styles.buttonDisabled]}
                  onPress={handleEditTask}
                  disabled={addingTask}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryLight]}
                    style={styles.saveBtnGradient}
                  >
                    {addingTask ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* ADD TASK MODAL */}
        <Modal
          visible={showAddTaskModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddTaskModal(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.addTaskModalContent}
            >
              <View style={styles.addTaskHeader}>
                <Text style={styles.modalTitle}>Add New Goal</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddTaskModal(false);
                    setNewTaskText("");
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.textMedium} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.taskInput}
                placeholder="What do you want to accomplish?"
                placeholderTextColor={colors.textLight}
                value={newTaskText}
                onChangeText={setNewTaskText}
                multiline
                maxLength={200}
                autoFocus
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowAddTaskModal(false);
                    setNewTaskText("");
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, addingTask && styles.buttonDisabled]}
                  onPress={handleAddTask}
                  disabled={addingTask}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryLight]}
                    style={styles.saveBtnGradient}
                  >
                    {addingTask ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.saveBtnText}>Add Goal</Text>
                    )}
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
