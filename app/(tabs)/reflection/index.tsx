import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Background from "../../../components/Background";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useTheme } from "../../../contexts/ThemeContext";

interface QuizQuestion {
  id: string;
  category_id: string;
  question: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  order_index: number;
}

// Returns a deterministic shuffle of `arr` seeded by `seed` string.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  let s = Math.abs(hash);
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Pick today's N questions from the pool using today's date as seed.
function getDailyQuestions(questions: QuizQuestion[], dailyLimit: number): QuizQuestion[] {
  const today = new Date().toISOString().split("T")[0]; // "2026-03-02"
  const shuffled = seededShuffle(questions, today);
  return shuffled.slice(0, Math.min(dailyLimit, shuffled.length));
}

function getTomorrowDateLabel(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Reflection() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [dailyLimit, setDailyLimit] = useState(2);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date());

  const isAdmin = user?.is_admin || false;

  const fetchQuestions = useCallback(async () => {
    try {
      const { data: category, error: catError } = await supabase
        .from("quiz_categories")
        .select("id, daily_question_count")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (catError) throw catError;
      if (!category) { setQuestions([]); return; }

      const limit = category.daily_question_count ?? 2;
      setDailyLimit(limit);

      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("category_id", category.id)
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;

      const daily = getDailyQuestions(data || [], limit);
      setQuestions(daily);
      setCurrentQuestionIndex(0);
      setUserAnswer("");
      setShowExplanation(false);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
      Alert.alert("Error", "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let questionChannel: RealtimeChannel | null = null;
    let categoryChannel: RealtimeChannel | null = null;

    const setup = async () => {
      await fetchQuestions();

      questionChannel = supabase
        .channel("quiz_questions_realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "quiz_questions" }, () => fetchQuestions())
        .subscribe();

      categoryChannel = supabase
        .channel("quiz_categories_realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "quiz_categories" }, () => fetchQuestions())
        .subscribe();
    };

    setup();

    return () => {
      if (questionChannel) supabase.removeChannel(questionChannel);
      if (categoryChannel) supabase.removeChannel(categoryChannel);
    };
  }, [fetchQuestions]);

  useEffect(() => {
    setQuestionStartTime(new Date());
  }, [currentQuestionIndex]);

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      Alert.alert("", "Please write your reflection before submitting.");
      return;
    }

    const timeSpent = Math.round(
      (new Date().getTime() - questionStartTime.getTime()) / 1000
    );

    try {
      await supabase.from("quiz_attempts").insert({
        user_id: user?.id,
        question_id: questions[currentQuestionIndex].id,
        selected_answer: userAnswer.trim(),
        is_correct: null,
        time_spent_seconds: timeSpent,
      });
    } catch (error: any) {
      console.error("Error saving attempt:", error);
    }

    setShowExplanation(true);
  };

  const handleNext = () => {
    setCurrentQuestionIndex((prev) => prev + 1);
    setUserAnswer("");
    setShowExplanation(false);
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setUserAnswer("");
      setShowExplanation(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 20, paddingBottom: 15 },
    headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    logoContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
    logoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    logoText: { fontSize: 24, fontWeight: "700", color: colors.primary, letterSpacing: -0.5 },
    headerIcons: { flexDirection: "row", gap: 10 },
    iconButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(74,155,127,0.1)" },
    adminButton: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 140 },
    titleSection: { marginBottom: 8, marginTop: 10 },
    pageTitle: { fontSize: 28, fontWeight: "800", color: colors.textDark },
    pageSubtitle: { fontSize: 16, color: colors.textLight, marginTop: 4 },
    dailyBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(74,155,127,0.1)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
    dailyBannerText: { fontSize: 13, fontWeight: "600", color: colors.primary, flex: 1 },
    dailyBannerSub: { fontSize: 12, color: colors.textLight },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    loadingText: { fontSize: 16, color: colors.textMedium, fontWeight: "600" },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 20, fontWeight: "700", color: colors.textDark, marginTop: 16 },
    emptySubtext: { fontSize: 15, color: colors.textLight, textAlign: "center", paddingHorizontal: 40 },
    progressContainer: { marginBottom: 24 },
    progressInfo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
    progressText: { fontSize: 15, fontWeight: "600", color: colors.textMedium },
    progressBarBg: { height: 8, backgroundColor: "rgba(74,155,127,0.2)", borderRadius: 4, overflow: "hidden" },
    progressBarFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
    questionCard: { borderRadius: 32, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", elevation: 10, shadowColor: "#1A3A32", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 16, marginBottom: 24 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    iconBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    difficultyBadge: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 12 },
    difficultyText: { fontSize: 12, fontWeight: "700", color: colors.white, textTransform: "uppercase" },
    questionText: { fontSize: 20, fontWeight: "700", color: colors.white, marginBottom: 20, lineHeight: 28 },
    textInputContainer: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16, padding: 4 },
    answerInput: { fontSize: 15, color: "#1A3A32", padding: 12, minHeight: 100, textAlignVertical: "top", lineHeight: 22 },
    charHint: { fontSize: 12, color: "rgba(45,82,73,0.5)", textAlign: "right", paddingRight: 12, paddingBottom: 8 },
    submitButton: { marginTop: 14, borderRadius: 16, overflow: "hidden" },
    submitGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
    submitText: { fontSize: 16, fontWeight: "700", color: colors.white },
    explanationContainer: { marginTop: 20, padding: 16, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16 },
    explanationHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    explanationTitle: { fontSize: 16, fontWeight: "700", color: "#1A3A32" },
    explanationText: { fontSize: 14, color: "#2D5249", lineHeight: 22 },
    finishedContainer: { marginTop: 20, padding: 20, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, alignItems: "center", gap: 8 },
    finishedIcon: { marginBottom: 4 },
    finishedText: { fontSize: 18, fontWeight: "700", color: colors.white },
    finishedSubtext: { fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 20 },
    finishedNextLabel: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 },
    navigationContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    navButton: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12 },
    navButtonDisabled: { opacity: 0.4 },
    navButtonText: { fontSize: 16, fontWeight: "600", color: colors.primary },
    navButtonTextDisabled: { color: colors.textLight },
    nextButton: { borderRadius: 16, overflow: "hidden" },
    nextButtonGradient: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 24 },
    nextButtonText: { fontSize: 16, fontWeight: "700", color: colors.white },
  });

  if (loading) {
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
            </View>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading today's questions...</Text>
          </View>
        </View>
      </Background>
    );
  }

  if (questions.length === 0) {
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
              <View style={styles.headerIcons}>
                {isAdmin && (
                  <TouchableOpacity style={[styles.iconButton, styles.adminButton]} onPress={() => router.push("/reflection/admin-questions")}>
                    <Ionicons name="add-circle" size={22} color={colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          <View style={styles.emptyContainer}>
            <Ionicons name="bulb-outline" size={64} color={colors.textLight} />
            <Text style={styles.emptyText}>No questions available</Text>
            <Text style={styles.emptySubtext}>
              {isAdmin ? "Tap the + button to add questions" : "Check back tomorrow for new reflections"}
            </Text>
          </View>
        </View>
      </Background>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <Background>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.logoIcon}>
                <Ionicons name="flash" size={24} color={colors.white} />
              </LinearGradient>
              <Text style={styles.logoText}>FocusFlow</Text>
            </View>
            <View style={styles.headerIcons}>
              {isAdmin && (
                <TouchableOpacity style={[styles.iconButton, styles.adminButton]} onPress={() => router.push("/reflection/admin-questions")}>
                  <Ionicons name="settings-outline" size={22} color={colors.white} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>Reflection Space</Text>
            <Text style={styles.pageSubtitle}>Write your thoughts</Text>
          </View>

          <View style={styles.dailyBanner}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.dailyBannerText}>
              Today's {questions.length} reflection{questions.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.dailyBannerSub}>Resets {getTomorrowDateLabel()}</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {currentQuestionIndex + 1} of {questions.length}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <LinearGradient
            colors={["#2F6B56", "#3D7A63", "#4A9B7F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.questionCard}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconBadge}>
                <Ionicons name="create-outline" size={20} color={colors.white} />
              </View>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>{currentQuestion.difficulty}</Text>
              </View>
            </View>

            <Text style={styles.questionText}>{currentQuestion.question}</Text>

            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.answerInput}
                placeholder="Write your reflection here..."
                placeholderTextColor="rgba(45,82,73,0.4)"
                value={userAnswer}
                onChangeText={setUserAnswer}
                multiline
                editable={!showExplanation}
              />
              <Text style={styles.charHint}>{userAnswer.length} characters</Text>
            </View>

            {!showExplanation && (
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitAnswer} activeOpacity={0.8}>
                <LinearGradient colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.15)"]} style={styles.submitGradient}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
                  <Text style={styles.submitText}>Submit Reflection</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {showExplanation && (
              <View style={styles.explanationContainer}>
                <View style={styles.explanationHeader}>
                  <Ionicons name="information-circle" size={20} color="#2196F3" />
                  <Text style={styles.explanationTitle}>Insight</Text>
                </View>
                <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
              </View>
            )}

            {showExplanation && isLastQuestion && (
              <View style={styles.finishedContainer}>
                <Ionicons name="checkmark-circle" size={36} color="rgba(255,255,255,0.9)" style={styles.finishedIcon} />
                <Text style={styles.finishedText}>All done for today!</Text>
                <Text style={styles.finishedSubtext}>
                  Take a moment to sit with your thoughts.
                </Text>
                <Text style={styles.finishedNextLabel}>
                  🗓 New questions on {getTomorrowDateLabel()}
                </Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.navigationContainer}>
            <TouchableOpacity
              style={[styles.navButton, currentQuestionIndex === 0 && styles.navButtonDisabled]}
              onPress={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <Ionicons name="chevron-back" size={24} color={currentQuestionIndex === 0 ? colors.textLight : colors.primary} />
              <Text style={[styles.navButtonText, currentQuestionIndex === 0 && styles.navButtonTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            {showExplanation && !isLastQuestion && (
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.nextButtonGradient}>
                  <Text style={styles.nextButtonText}>Next</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.white} />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Background>
  );
}