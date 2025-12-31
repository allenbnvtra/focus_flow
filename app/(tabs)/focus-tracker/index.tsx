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
import Background, { Colors } from "../../../components/Background";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";

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
          // Timer completed
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
      
      console.log("Fetching tasks from:", startOfDay.toISOString(), "to:", endOfDay.toISOString());
      
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user?.id)
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch tasks error:", error);
        throw error;
      }

      console.log("Fetched today's tasks:", data?.length || 0);
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
      console.log("Fetching mood for date:", today);

      const { data, error } = await supabase
        .from("daily_moods")
        .select("*")
        .eq("user_id", user?.id)
        .eq("mood_date", today)
        .maybeSingle();

      if (error) {
        console.error("Fetch mood error:", error);
        throw error;
      }

      console.log("Fetched mood data:", data);
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

      console.log("Saving mood:", {
        user_id: user?.id,
        mood_value: selectedMood,
        mood_date: today,
        notes: moodNotes.trim() || null,
      });

      if (todayMood) {
        // Update existing mood
        console.log("Updating existing mood with ID:", todayMood.id);

        const { data, error } = await supabase
          .from("daily_moods")
          .update({
            mood_value: selectedMood,
            notes: moodNotes.trim() || null,
          })
          .eq("id", todayMood.id)
          .select()
          .single();

        if (error) {
          console.error("Update mood error:", error);
          throw error;
        }

        console.log("Mood updated successfully:", data);
        setTodayMood(data);
      } else {
        // Insert new mood
        console.log("Inserting new mood");

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

        if (error) {
          console.error("Insert mood error:", error);
          throw error;
        }

        console.log("Mood inserted successfully:", data);
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

    // Prevent saving sessions with 0 or negative duration
    if (durationInMinutes <= 0) {
      console.log("Session duration too short, not saving");
      resetTimerState();
      return;
    }

    try {
      console.log("Saving focus session:", {
        user_id: user?.id,
        task_id: selectedTaskId,
        duration_minutes: durationInMinutes,
      });

      // Save focus session
      const { error: sessionError } = await supabase
        .from("focus_sessions")
        .insert({
          user_id: user?.id,
          task_id: selectedTaskId,
          duration_minutes: durationInMinutes,
          started_at: sessionStartTime.toISOString(),
          completed_at: endTime.toISOString(),
        });

      if (sessionError) {
        console.error("Session save error:", sessionError);
        throw sessionError;
      }

      console.log("Focus session saved successfully");

      // Update task focus time
      if (selectedTaskId) {
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (task) {
          const newFocusTime = (task.focus_time || 0) + durationInMinutes;

          console.log("Updating task focus time:", {
            task_id: selectedTaskId,
            new_focus_time: newFocusTime,
          });

          const { error: updateError } = await supabase
            .from("tasks")
            .update({ focus_time: newFocusTime })
            .eq("id", selectedTaskId);

          if (updateError) {
            console.error("Task update error:", updateError);
            throw updateError;
          }

          console.log("Task focus time updated successfully");

          // Update local state
          setTasks(
            tasks.map((t) =>
              t.id === selectedTaskId ? { ...t, focus_time: newFocusTime } : t
            )
          );
        }
      }

      // Handle different modes
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

    // Check if there are more incomplete tasks
    if (nextIndex < incompleteTasks.length) {
      // Move to next task
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
      // All tasks completed - automatically stop timer
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

    // Don't save if duration is too short
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
      console.log("Saving partial session:", {
        user_id: user?.id,
        task_id: selectedTaskId,
        duration_minutes: durationInMinutes,
      });

      const { error: sessionError } = await supabase
        .from("focus_sessions")
        .insert({
          user_id: user?.id,
          task_id: selectedTaskId,
          duration_minutes: durationInMinutes,
          started_at: sessionStartTime.toISOString(),
          completed_at: endTime.toISOString(),
        });

      if (sessionError) {
        console.error("Partial session save error:", sessionError);
        throw sessionError;
      }

      console.log("Partial session saved successfully");

      if (selectedTaskId) {
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (task) {
          const newFocusTime = (task.focus_time || 0) + durationInMinutes;

          const { error: updateError } = await supabase
            .from("tasks")
            .update({ focus_time: newFocusTime })
            .eq("id", selectedTaskId);

          if (updateError) {
            console.error("Task update error:", updateError);
            throw updateError;
          }

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

      console.log("Adding new task:", {
        user_id: user?.id,
        text: newTaskText.trim(),
      });

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

      if (error) {
        console.error("Add task error:", error);
        throw error;
      }

      console.log("Task added successfully:", data);

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

    // Optimistic update
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
      console.log("Toggling task:", {
        task_id: taskId,
        completed: updatedCompleted,
        completion_count: newCompletionCount,
      });

      const { error } = await supabase
        .from("tasks")
        .update({
          completed: updatedCompleted,
          completion_count: newCompletionCount,
        })
        .eq("id", taskId);

      if (error) {
        console.error("Toggle task error:", error);
        throw error;
      }

      console.log("Task toggled successfully");

      // Show celebration for completion
      if (updatedCompleted) {
        Alert.alert(
          "✅ Task Completed!",
          `Great job! You've completed this task ${newCompletionCount} time${
            newCompletionCount > 1 ? "s" : ""
          }!`
        );

        // Check if all tasks are now completed during "All Tasks" mode
        if (focusMode === "all" && isRunning) {
          const remainingIncompleteTasks = tasks.filter(
            (t) => t.id !== taskId && !t.completed
          );

          // If this was the last incomplete task, stop the timer
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
      // Revert on error
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
              console.log("Deleting task:", taskId);

              const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", taskId);

              if (error) {
                console.error("Delete task error:", error);
                throw error;
              }

              console.log("Task deleted successfully");

              // Check if all remaining tasks are completed during "All Tasks" mode
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

  return (
    <Background>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                style={styles.logoIcon}
              >
                <Ionicons name="flash" size={24} color={Colors.white} />
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
                  color={Colors.primary}
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
                  color={Colors.primary}
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
                    color={Colors.primary}
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
                      color={Colors.primary}
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
                    colors={[Colors.primary, Colors.primaryDark]}
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
                          ? [Colors.primary, Colors.primaryDark]
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
              <Ionicons name="add-circle" size={28} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="checkmark-done-outline"
                size={48}
                color={Colors.textLight}
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
                            color={Colors.primary}
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
                  <Ionicons name="close" size={28} color={Colors.textMedium} />
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
                    color={Colors.primary}
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
                  color={Colors.textLight}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modeOptionCard}
                onPress={() => selectFocusMode("all")}
              >
                <View style={styles.modeOptionIcon}>
                  <Ionicons name="list" size={32} color={Colors.primaryDark} />
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
                  color={Colors.textLight}
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
                  <Ionicons name="close" size={28} color={Colors.textMedium} />
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
                      color={Colors.primary}
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
                    color={Colors.textLight}
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
                          color={Colors.primaryLight}
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
                        color={Colors.textLight}
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
                  <Ionicons name="close" size={28} color={Colors.textMedium} />
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
                placeholderTextColor={Colors.textLight}
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
                  colors={[Colors.primary, Colors.primaryLight]}
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
                    colors={[Colors.primary, Colors.primaryLight]}
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
                  <Ionicons name="create-outline" size={24} color={Colors.primary} />
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
                  color={Colors.textLight}
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
                  <Ionicons name="close" size={28} color={Colors.textMedium} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.taskInput}
                placeholder="What do you want to accomplish?"
                placeholderTextColor={Colors.textLight}
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
                    colors={[Colors.primary, Colors.primaryLight]}
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
                  <Ionicons name="close" size={28} color={Colors.textMedium} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.taskInput}
                placeholder="What do you want to accomplish?"
                placeholderTextColor={Colors.textLight}
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
                    colors={[Colors.primary, Colors.primaryLight]}
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
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerIcons: { flexDirection: "row", gap: 10 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  moodButtonEmoji: {
    fontSize: 24,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textDark,
    marginVertical: 15,
  },
  timerCard: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 25,
    elevation: 20,
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 2,
    borderColor: "#E0F2F1",
  },
  timerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  timerTitle: { fontSize: 16, fontWeight: "700", color: Colors.textDark },
  editBtn: {
    backgroundColor: Colors.bubbleMedium,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editBtnText: { color: Colors.primaryDark, fontSize: 12, fontWeight: "800" },
  activeInfoContainer: {
    marginTop: 12,
    gap: 8,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(79, 195, 247, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  activeTaskBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(79, 195, 247, 0.1)",
    padding: 12,
    borderRadius: 12,
  },
  activeTaskText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  taskProgress: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  timerDisplay: { alignItems: "center", marginVertical: 20 },
  timerText: {
    fontSize: 64,
    fontWeight: "300",
    color: Colors.textDark,
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
    color: Colors.textDark,
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
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 16,
    borderRadius: 18,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "#D1EAE2",
  },
  taskCardCompleted: { opacity: 0.6 },
  taskCardActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: "rgba(79, 195, 247, 0.05)",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  taskContent: {
    flex: 1,
    gap: 6,
  },
  taskText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textMedium,
  },
  taskTextDone: {
    textDecorationLine: "line-through",
    color: Colors.textLight,
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
    color: Colors.primary,
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
    color: Colors.textMedium,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textLight,
  },
  // MOOD MODAL STYLES
  moodModalContent: {
    backgroundColor: "white",
    borderRadius: 30,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  moodModalSubtitle: {
    fontSize: 14,
    color: Colors.textLight,
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
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    gap: 4,
  },
  moodButtonActive: {
    backgroundColor: "white",
    transform: [{ scale: 1.05 }],
    elevation: 4,
    borderColor: Colors.primary,
  },
  moodEmoji: { fontSize: 28 },
  moodLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textMedium,
  },
  moodNotesInput: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: Colors.textDark,
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
    backgroundColor: "white",
    borderRadius: 30,
    padding: 30,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  addTaskModalContent: {
    backgroundColor: "white",
    borderRadius: 30,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  modeSelectContent: {
    backgroundColor: "white",
    borderRadius: 30,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  taskSelectModalContent: {
    backgroundColor: "white",
    borderRadius: 30,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    maxHeight: "70%",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
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
    color: Colors.textDark,
  },
  taskSelectSubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 20,
  },
  // MODE OPTION STYLES
  modeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: Colors.background,
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
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  modeOptionInfo: {
    flex: 1,
  },
  modeOptionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textDark,
    marginBottom: 4,
  },
  modeOptionDesc: {
    fontSize: 14,
    color: Colors.textLight,
  },
  taskSelectScroll: {
    maxHeight: 400,
  },
  taskSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 16,
    marginBottom: 10,
    gap: 12,
  },
  taskSelectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  taskSelectInfo: {
    flex: 1,
  },
  taskSelectName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textDark,
    marginBottom: 2,
  },
  taskSelectDesc: {
    fontSize: 12,
    color: Colors.textLight,
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
    color: Colors.primary,
    borderBottomWidth: 3,
    borderBottomColor: Colors.accent,
    textAlign: "center",
    minWidth: 80,
  },
  inputLabel: {
    fontSize: 18,
    color: Colors.textLight,
    fontWeight: "600",
  },
  taskInput: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: Colors.textDark,
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
    color: Colors.textLight,
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
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  actionMenuHeader: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
    marginBottom: 5,
  },
  actionMenuTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textDark,
    textAlign: "center",
  },
  actionMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 16,
    gap: 12,
  },
  actionMenuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(79, 195, 247, 0.1)",
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
    color: Colors.textDark,
    marginBottom: 2,
  },
  actionMenuItemDesc: {
    fontSize: 13,
    color: Colors.textLight,
  },
  dangerText: {
    color: "#FF6B6B",
  },
  actionMenuCancelBtn: {
    marginTop: 10,
    padding: 16,
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 16,
  },
  actionMenuCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textMedium,
  },
});
