import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "reflection" | "rating";

interface QuizQuestion {
  id: string;
  category_id: string;
  question: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  order_index: number;
  question_type: QuestionType;
  options: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in LOCAL time (avoids UTC timezone shift bugs) */
function getLocalToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
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

function getDailyQuestions(questions: QuizQuestion[], dailyLimit: number): QuizQuestion[] {
  const today = getLocalToday();
  return seededShuffle(questions, today).slice(0, Math.min(dailyLimit, questions.length));
}

function getTomorrowDateLabel(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_OPTIONS = [
  { value: 1, label: "Poor",      emoji: "😞" },
  { value: 2, label: "Fair",      emoji: "😐" },
  { value: 3, label: "Good",      emoji: "🙂" },
  { value: 4, label: "Great",     emoji: "😊" },
  { value: 5, label: "Excellent", emoji: "🤩" },
];

const TYPE_META: Record<QuestionType, { icon: string; label: string }> = {
  reflection: { icon: "create-outline", label: "Reflection" },
  rating:     { icon: "star-outline",   label: "Rating"     },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reflection() {
  const { colors } = useTheme();
  const { user }   = useAuth();
  const router     = useRouter();

  const [questions, setQuestions]   = useState<QuizQuestion[]>([]);
  const [loading, setLoading]       = useState(true);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStartTime, setQuestionStartTime]       = useState<Date>(new Date());

  // Per-question answer state (only used for the current unanswered question)
  const [userAnswer,      setUserAnswer]      = useState("");
  const [selectedRating,  setSelectedRating]  = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  /**
   * answeredToday: Set of question IDs the user already submitted today.
   * Populated from the DB on every load — survives app restarts.
   */
  const [answeredToday, setAnsweredToday] = useState<Set<string>>(new Set());

  const isAdmin = user?.is_admin || false;

  // ─── Fetch ────────────────────────────────────────────────────────────────────

  const fetchQuestions = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // 1. Load category
      const { data: category, error: catError } = await supabase
        .from("quiz_categories")
        .select("id, daily_question_count")
        .eq("is_active", true)
        .limit(1)
        .single();
      if (catError) throw catError;
      if (!category) { setQuestions([]); return; }

      const limit = category.daily_question_count ?? 2;

      // 2. Load all active questions
      const { data: allQuestions, error: qError } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("category_id", category.id)
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (qError) throw qError;

      const todayQuestions = getDailyQuestions(allQuestions || [], limit);
      setQuestions(todayQuestions);

      // 3. ── CORE FIX: Load today's answered question IDs from the DB ──
      //    We store `session_date` as a plain YYYY-MM-DD string so there are
      //    zero timezone issues. If the column doesn't exist yet, we fall back
      //    to a created_at range query.
      const today = getLocalToday();
      let answeredIds = new Set<string>();

      const { data: attempts, error: attError } = await supabase
        .from("quiz_attempts")
        .select("question_id")
        .eq("user_id", user.id)
        .eq("session_date", today);

      if (attError) {
        // Fallback: session_date column not yet added — query by created_at
        console.warn("Falling back to created_at range (add session_date column to quiz_attempts):", attError.message);
        const { data: fallback } = await supabase
          .from("quiz_attempts")
          .select("question_id")
          .eq("user_id", user.id)
          .gte("attempted_at", `${today}T00:00:00`)
          .lte("attempted_at", `${today}T23:59:59`);
        answeredIds = new Set<string>((fallback || []).map((a: any) => a.question_id));
      } else {
        answeredIds = new Set<string>((attempts || []).map((a: any) => a.question_id));
      }

      setAnsweredToday(answeredIds);

      // 4. Jump to first unanswered question
      const firstUnanswered = todayQuestions.findIndex(q => !answeredIds.has(q.id));

      if (firstUnanswered === -1) {
        // All questions answered — land on the last one in completed state
        setCurrentQuestionIndex(todayQuestions.length - 1);
        setShowExplanation(true);
      } else {
        setCurrentQuestionIndex(firstUnanswered);
        setUserAnswer("");
        setSelectedRating(null);
        setShowExplanation(false);
      }
    } catch (e: any) {
      console.error("fetchQuestions error:", e);
      Alert.alert("Error", "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    let qCh: RealtimeChannel | null = null;
    let cCh: RealtimeChannel | null = null;

    const setup = async () => {
      await fetchQuestions();

      qCh = supabase
        .channel("quiz_q_rt")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "quiz_questions" },
          (payload) => {
            const updated = payload.new as QuizQuestion;
            setQuestions((prev) => {
              const idx = prev.findIndex((q) => q.id === updated.id);
              if (idx === -1) return prev;
              const next = [...prev];
              next[idx] = { ...next[idx], ...updated };
              return next;
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "quiz_questions" },
          () => fetchQuestions()
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "quiz_questions" },
          () => fetchQuestions()
        )
        .subscribe();

      cCh = supabase
        .channel("quiz_c_rt")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "quiz_categories" },
          () => fetchQuestions()
        )
        .subscribe();
    };

    setup();

    return () => {
      if (qCh) supabase.removeChannel(qCh);
      if (cCh) supabase.removeChannel(cCh);
    };
  }, [fetchQuestions]);

  useEffect(() => { setQuestionStartTime(new Date()); }, [currentQuestionIndex]);

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const currentQuestion     = questions[currentQuestionIndex];
  const qType: QuestionType = currentQuestion?.question_type ?? "reflection";
  const isCurrentAnswered   = !!currentQuestion && answeredToday.has(currentQuestion.id);
  const isLastQuestion      = currentQuestionIndex === questions.length - 1;
  const meta                = TYPE_META[qType] ?? TYPE_META.reflection;

  const hasAnswer = qType === "rating"
    ? selectedRating !== null
    : userAnswer.trim().length > 0;

  // Prevent going back to already-answered questions
  const canGoPrevious =
    currentQuestionIndex > 0 &&
    !answeredToday.has(questions[currentQuestionIndex - 1]?.id);

  // ─── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmitAnswer = async () => {
    if (!hasAnswer) {
      Alert.alert("", qType === "reflection"
        ? "Please write your reflection before submitting."
        : "Please select a rating before submitting.");
      return;
    }

    const timeSpent   = Math.round((Date.now() - questionStartTime.getTime()) / 1000);
    const answerValue = qType === "rating" ? String(selectedRating) : userAnswer.trim();
    const today       = getLocalToday();

    try {
      // Try inserting with session_date first
      const { error } = await supabase.from("quiz_attempts").insert({
        user_id:            user?.id,
        question_id:        currentQuestion.id,
        selected_answer:    answerValue,
        is_correct:         null,
        time_spent_seconds: timeSpent,
        session_date:       today,  // YYYY-MM-DD local date — add this column if missing
      });

      if (error) {
        if (error.message?.includes("session_date")) {
          // Column doesn't exist yet — insert without it
          await supabase.from("quiz_attempts").insert({
            user_id:            user?.id,
            question_id:        currentQuestion.id,
            selected_answer:    answerValue,
            is_correct:         null,
            time_spent_seconds: timeSpent,
          });
        } else {
          throw error;
        }
      }

      // Mark as answered locally — instant UI update, no refetch needed
      setAnsweredToday(prev => new Set([...prev, currentQuestion.id]));
    } catch (e: any) {
      console.error("Error saving attempt:", e);
    }

    setShowExplanation(true);
  };

  const handleNext = () => {
    setCurrentQuestionIndex(p => p + 1);
    setUserAnswer("");
    setSelectedRating(null);
    setShowExplanation(false);
  };

  const handlePrevious = () => {
    if (canGoPrevious) {
      setCurrentQuestionIndex(p => p - 1);
      setUserAnswer("");
      setSelectedRating(null);
      setShowExplanation(false);
    }
  };

  // ─── Styles ───────────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    container:           { flex: 1 },
    header:              { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 20 : 20, paddingBottom: 15 },
    headerContent:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    logoContainer:       { flexDirection: "row", alignItems: "center", gap: 10 },
    logoIcon:            { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    logoText:            { fontSize: 24, fontWeight: "700", color: colors.primary, letterSpacing: -0.5 },
    headerIcons:         { flexDirection: "row", gap: 10 },
    iconButton:          { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(74,155,127,0.1)" },
    adminButton:         { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    scrollView:          { flex: 1 },
    scrollContent:       { paddingHorizontal: 20, paddingBottom: 140 },
    titleSection:        { marginBottom: 8, marginTop: 10 },
    pageTitle:           { fontSize: 28, fontWeight: "800", color: colors.textDark },
    pageSubtitle:        { fontSize: 16, color: colors.textLight, marginTop: 4 },
    dailyBanner:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(74,155,127,0.1)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
    dailyBannerText:     { fontSize: 13, fontWeight: "600", color: colors.primary, flex: 1 },
    dailyBannerSub:      { fontSize: 12, color: colors.textLight },
    loadingContainer:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    loadingText:         { fontSize: 16, color: colors.textMedium, fontWeight: "600" },
    emptyContainer:      { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60, gap: 12 },
    emptyText:           { fontSize: 20, fontWeight: "700", color: colors.textDark, marginTop: 16 },
    emptySubtext:        { fontSize: 15, color: colors.textLight, textAlign: "center", paddingHorizontal: 40 },
    progressDotsRow:     { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 8 },
    answeredPip:         { height: 8, borderRadius: 4 },
    progressBarBg:       { height: 8, backgroundColor: "rgba(74,155,127,0.2)", borderRadius: 4, overflow: "hidden", marginBottom: 24 },
    progressBarFill:     { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
    progressText:        { fontSize: 15, fontWeight: "600", color: colors.textMedium, marginBottom: 10 },
    questionCard:        { borderRadius: 32, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", elevation: 10, shadowColor: "#1A3A32", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 16, marginBottom: 24 },
    cardHeader:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    cardHeaderLeft:      { flexDirection: "row", alignItems: "center", gap: 10 },
    iconBadge:           { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    typePill:            { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10 },
    typePillText:        { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.9)", textTransform: "uppercase", letterSpacing: 0.5 },
    difficultyBadge:     { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 12 },
    difficultyText:      { fontSize: 12, fontWeight: "700", color: colors.white, textTransform: "uppercase" },
    questionText:        { fontSize: 20, fontWeight: "700", color: colors.white, marginBottom: 20, lineHeight: 28 },
    alreadyAnsweredBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
    alreadyAnsweredText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
    textInputContainer:  { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16, padding: 4 },
    answerInput:         { fontSize: 15, color: "#1A3A32", padding: 12, minHeight: 100, textAlignVertical: "top", lineHeight: 22 },
    charHint:            { fontSize: 12, color: "rgba(45,82,73,0.5)", textAlign: "right", paddingRight: 12, paddingBottom: 8 },
    ratingRow:           { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    ratingBtn:           { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 2, borderColor: "transparent", gap: 4 },
    ratingBtnSelected:   { backgroundColor: "rgba(255,255,255,0.95)", borderColor: "rgba(255,255,255,0.4)" },
    ratingEmoji:         { fontSize: 24 },
    ratingNumber:        { fontSize: 18, fontWeight: "800", color: "rgba(255,255,255,0.9)" },
    ratingNumberSelected:{ color: "#2F6B56" },
    ratingLabel:         { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.4 },
    ratingLabelSelected: { color: "#2F6B56" },
    ratingScaleRow:      { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: 8 },
    ratingScaleText:     { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
    selectedBanner:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10 },
    selectedBannerText:  { fontSize: 14, fontWeight: "700", color: colors.white },
    submitButton:        { marginTop: 14, borderRadius: 16, overflow: "hidden" },
    submitGradient:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
    submitText:          { fontSize: 16, fontWeight: "700", color: colors.white },
    submitDisabled:      { opacity: 0.4 },
    explanationContainer:{ marginTop: 20, padding: 16, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16 },
    explanationHeader:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    explanationTitle:    { fontSize: 16, fontWeight: "700", color: "#1A3A32" },
    explanationText:     { fontSize: 14, color: "#2D5249", lineHeight: 22 },
    finishedContainer:   { marginTop: 20, padding: 20, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, alignItems: "center", gap: 8 },
    finishedText:        { fontSize: 18, fontWeight: "700", color: colors.white },
    finishedSubtext:     { fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 20 },
    finishedNextLabel:   { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 },
    navigationContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    navButton:           { flexDirection: "row", alignItems: "center", gap: 6, padding: 12 },
    navButtonDisabled:   { opacity: 0.4 },
    navButtonText:       { fontSize: 16, fontWeight: "600", color: colors.primary },
    navButtonTextDisabled:{ color: colors.textLight },
    nextButton:          { borderRadius: 16, overflow: "hidden" },
    nextButtonGradient:  { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 24 },
    nextButtonText:      { fontSize: 16, fontWeight: "700", color: colors.white },
  });

  // ─── Header ───────────────────────────────────────────────────────────────────

  const headerJSX = (
    <View style={s.header}>
      <View style={s.headerContent}>
        <View style={s.logoContainer}>
          <LinearGradient colors={[colors.primary, colors.primaryLight]} style={s.logoIcon}>
            <Ionicons name="flash" size={24} color={colors.white} />
          </LinearGradient>
          <Text style={s.logoText}>FocusFlow</Text>
        </View>
        <View style={s.headerIcons}>
          {isAdmin && (
            <TouchableOpacity
              style={[s.iconButton, s.adminButton]}
              onPress={() => router.push("/reflection/admin-questions")}
            >
              <Ionicons name="settings-outline" size={22} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  // ─── Loading / empty ──────────────────────────────────────────────────────────

  if (loading) return (
    <Background>
      <View style={s.container}>
        {headerJSX}
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Loading today's questions...</Text>
        </View>
      </View>
    </Background>
  );

  if (questions.length === 0) return (
    <Background>
      <View style={s.container}>
        {headerJSX}
        <View style={s.emptyContainer}>
          <Ionicons name="bulb-outline" size={64} color={colors.textLight} />
          <Text style={s.emptyText}>No questions available</Text>
          <Text style={s.emptySubtext}>
            {isAdmin ? "Tap settings to add questions" : "Check back tomorrow for new reflections"}
          </Text>
        </View>
      </View>
    </Background>
  );

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Background>
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {headerJSX}
        <ScrollView
          style={s.scrollView}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.titleSection}>
            <Text style={s.pageTitle}>Munimuni Corner</Text>
            <Text style={s.pageSubtitle}>Reflection and Journal Space</Text>
          </View>

          <View style={s.dailyBanner}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={s.dailyBannerText}>
              Today's {questions.length} question{questions.length > 1 ? "s" : ""}
            </Text>
            <Text style={s.dailyBannerSub}>Resets {getTomorrowDateLabel()}</Text>
          </View>

          {/* Progress dots: green = answered, active pill = current, faded = upcoming */}
          <View style={s.progressDotsRow}>
            {questions.map((q, i) => (
              <View
                key={q.id}
                style={[
                  s.answeredPip,
                  {
                    width: i === currentQuestionIndex ? 20 : 8,
                    backgroundColor: answeredToday.has(q.id)
                      ? colors.primary
                      : i === currentQuestionIndex
                      ? (colors.primaryLight ?? colors.primary)
                      : "rgba(74,155,127,0.2)",
                  },
                ]}
              />
            ))}
          </View>

          <Text style={s.progressText}>
            {currentQuestionIndex + 1} of {questions.length}
            {answeredToday.size > 0 ? ` · ${answeredToday.size} answered` : ""}
          </Text>
          <View style={s.progressBarBg}>
            <View style={[s.progressBarFill, { width: `${progress}%` }]} />
          </View>

          {/* Question card */}
          <LinearGradient
            colors={["#2F6B56", "#3D7A63", "#4A9B7F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.questionCard}
          >
            <View style={s.cardHeader}>
              <View style={s.cardHeaderLeft}>
                <View style={s.iconBadge}>
                  <Ionicons name={meta.icon as any} size={20} color={colors.white} />
                </View>
                <View style={s.typePill}>
                  <Text style={s.typePillText}>{meta.label}</Text>
                </View>
              </View>
              <View style={s.difficultyBadge}>
                <Text style={s.difficultyText}>{currentQuestion.difficulty}</Text>
              </View>
            </View>

            <Text style={s.questionText}>{currentQuestion.question}</Text>

            {/* Already answered badge */}
            {isCurrentAnswered && (
              <View style={s.alreadyAnsweredBanner}>
                <Ionicons name="checkmark-circle" size={16} color="rgba(255,255,255,0.85)" />
                <Text style={s.alreadyAnsweredText}>You already answered this today</Text>
              </View>
            )}

            {/* ── Rating ── */}
            {qType === "rating" && (
              <View>
                <View style={s.ratingRow}>
                  {RATING_OPTIONS.map(opt => {
                    const sel = selectedRating === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.ratingBtn, sel && s.ratingBtnSelected]}
                        onPress={() => { if (!isCurrentAnswered) setSelectedRating(opt.value); }}
                        activeOpacity={isCurrentAnswered ? 1 : 0.75}
                        disabled={isCurrentAnswered}
                      >
                        <Text style={s.ratingEmoji}>{opt.emoji}</Text>
                        <Text style={[s.ratingNumber, sel && s.ratingNumberSelected]}>{opt.value}</Text>
                        <Text style={[s.ratingLabel, sel && s.ratingLabelSelected]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.ratingScaleRow}>
                  <Text style={s.ratingScaleText}>Lowest</Text>
                  <Text style={s.ratingScaleText}>Highest</Text>
                </View>
                {selectedRating !== null && (
                  <View style={s.selectedBanner}>
                    <Text style={s.selectedBannerText}>
                      {RATING_OPTIONS.find(o => o.value === selectedRating)?.emoji}{" "}
                      You rated {selectedRating}/5 —{" "}
                      {RATING_OPTIONS.find(o => o.value === selectedRating)?.label}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Reflection ── */}
            {qType === "reflection" && (
              <View style={s.textInputContainer}>
                <TextInput
                  style={s.answerInput}
                  placeholder={
                    isCurrentAnswered
                      ? "You've already answered this question today."
                      : "Write your reflection here..."
                  }
                  placeholderTextColor="rgba(45,82,73,0.4)"
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  multiline
                  editable={!isCurrentAnswered}
                />
                {!isCurrentAnswered && (
                  <Text style={s.charHint}>{userAnswer.length} characters</Text>
                )}
              </View>
            )}

            {/* Submit — hidden once answered */}
            {!isCurrentAnswered && (
              <TouchableOpacity
                style={[s.submitButton, !hasAnswer && s.submitDisabled]}
                onPress={handleSubmitAnswer}
                activeOpacity={0.8}
                disabled={!hasAnswer}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.15)"]}
                  style={s.submitGradient}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
                  <Text style={s.submitText}>Submit {meta.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Insight — shown after submit OR if already answered on reload */}
            {(showExplanation || isCurrentAnswered) && (
              <View style={s.explanationContainer}>
                <View style={s.explanationHeader}>
                  <Ionicons name="information-circle" size={20} color="#2196F3" />
                  <Text style={s.explanationTitle}>Insight</Text>
                </View>
                <Text style={s.explanationText}>{currentQuestion.explanation}</Text>
              </View>
            )}

            {/* All done */}
            {(showExplanation || isCurrentAnswered) && isLastQuestion && (
              <View style={s.finishedContainer}>
                <Ionicons name="checkmark-circle" size={36} color="rgba(255,255,255,0.9)" />
                <Text style={s.finishedText}>All done for today! 🎉</Text>
                <Text style={s.finishedSubtext}>Take a moment to sit with your thoughts.</Text>
                <Text style={s.finishedNextLabel}>🗓 New questions on {getTomorrowDateLabel()}</Text>
              </View>
            )}
          </LinearGradient>

          {/* Navigation */}
          <View style={s.navigationContainer}>
            <TouchableOpacity
              style={[s.navButton, !canGoPrevious && s.navButtonDisabled]}
              onPress={handlePrevious}
              disabled={!canGoPrevious}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={!canGoPrevious ? colors.textLight : colors.primary}
              />
              <Text style={[s.navButtonText, !canGoPrevious && s.navButtonTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            {(showExplanation || isCurrentAnswered) && !isLastQuestion && (
              <TouchableOpacity style={s.nextButton} onPress={handleNext}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={s.nextButtonGradient}
                >
                  <Text style={s.nextButtonText}>Next</Text>
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