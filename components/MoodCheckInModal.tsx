import React, { useState } from "react";
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoodPeriod = "morning" | "afternoon";

interface MoodOption {
  emoji: string;
  label: string;
  value: number; // 1 = best, 5 = worst (matches daily_moods table)
}

interface MoodCheckInModalProps {
  visible: boolean;
  period: MoodPeriod;
  userName?: string;
  onSubmit: (mood: MoodOption) => Promise<void>;
  onDismiss: () => void;
}

// ─── Mood options ─────────────────────────────────────────────────────────────

const MOODS: MoodOption[] = [
  { emoji: "😄", label: "Great",     value: 1 },
  { emoji: "😊", label: "Good",      value: 2 },
  { emoji: "😐", label: "Okay",      value: 3 },
  { emoji: "😔", label: "Low",       value: 4 },
  { emoji: "😩", label: "Terrible",  value: 5 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function MoodCheckInModal({
  visible,
  period,
  userName,
  onSubmit,
  onDismiss,
}: MoodCheckInModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [selected, setSelected]   = useState<MoodOption | null>(null);
  const [saving, setSaving]       = useState(false);

  const isMorning   = period === "morning";
  const greeting    = isMorning ? "Good morning" : "Good afternoon";
  const periodLabel = isMorning ? "morning" : "afternoon";
  const name        = userName ? `, ${userName}` : "";

  const handleSubmit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onSubmit(selected);
    } finally {
      setSaving(false);
      setSelected(null);
    }
  };

  const handleDismiss = () => {
    setSelected(null);
    onDismiss();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 28,
      padding: 28,
      borderWidth: 2,
      borderColor: colors.border,
    },
    iconRow: {
      alignItems: "center",
      marginBottom: 16,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    greeting: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.textDark,
      textAlign: "center",
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textLight,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 28,
    },
    moodRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 28,
      gap: 8,
    },
    moodItem: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: "transparent",
      backgroundColor: colors.background,
    },
    moodItemSelected: {
      borderColor: colors.primary,
      backgroundColor: isDarkMode
        ? "rgba(93,184,154,0.15)"
        : "rgba(74,155,127,0.1)",
    },
    moodEmoji: {
      fontSize: 30,
      marginBottom: 6,
    },
    moodLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textLight,
      textAlign: "center",
    },
    moodLabelSelected: {
      color: colors.primary,
    },
    checkBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    btnRow: {
      flexDirection: "row",
      gap: 12,
    },
    skipBtn: {
      flex: 1,
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    skipText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textLight,
    },
    submitBtn: {
      flex: 2,
      borderRadius: 14,
      overflow: "hidden",
    },
    submitGradient: {
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    submitText: {
      fontSize: 15,
      fontWeight: "700",
      color: "white",
    },
    disabledBtn: {
      opacity: 0.4,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Icon */}
          <View style={styles.iconRow}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Ionicons
                name={isMorning ? "sunny" : "partly-sunny"}
                size={30}
                color="white"
              />
            </LinearGradient>
          </View>

          {/* Greeting */}
          <Text style={styles.greeting}>
            {greeting}{name}! 👋
          </Text>
          <Text style={styles.subtitle}>
            How are you feeling this {periodLabel}?{"\n"}
            Your mood helps us tailor your focus insights.
          </Text>

          {/* Mood picker */}
          <View style={styles.moodRow}>
            {MOODS.map((mood) => {
              const isSelected = selected?.value === mood.value;
              return (
                <TouchableOpacity
                  key={mood.value}
                  style={[styles.moodItem, isSelected && styles.moodItemSelected]}
                  onPress={() => setSelected(mood)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  <Text style={[styles.moodLabel, isSelected && styles.moodLabelSelected]}>
                    {mood.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={10} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.skipBtn} onPress={handleDismiss}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!selected || saving) && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={!selected || saving}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark ?? colors.primary]}
                style={styles.submitGradient}
              >
                {saving
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.submitText}>Save Mood ✓</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}