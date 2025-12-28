import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Background, { Colors } from "../../../components/Background";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";

interface QuizQuestion {
  id: string;
  category_id: string;
  question: string;
  question_type: "multiple_choice" | "true_false" | "rating";
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  order_index: number;
}

interface QuizAttempt {
  id: string;
  user_id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_spent_seconds: number;
  attempted_at: string;
}

export default function Reflection() {
  const { user } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(
    new Set()
  );
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date());
  const [showResults, setShowResults] = useState(false);

  const isAdmin = user?.is_admin || false;

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    // Reset timer when question changes
    setQuestionStartTime(new Date());
  }, [currentQuestionIndex]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);

      // Get active category (you can modify this to select specific category)
      const { data: categories, error: catError } = await supabase
        .from("quiz_categories")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (catError) throw catError;

      if (!categories) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Get questions for the category
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("category_id", categories.id)
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;

      const formattedQuestions = data.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : [],
      }));

      setQuestions(formattedQuestions || []);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
      Alert.alert("Error", "Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = async (answer: string) => {
    if (showExplanation || answeredQuestions.has(currentQuestion.id)) return;

    setSelectedAnswer(answer);
    const isCorrect = answer === currentQuestion.correct_answer;

    // Calculate time spent
    const timeSpent = Math.round(
      (new Date().getTime() - questionStartTime.getTime()) / 1000
    );

    // Update score
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    // Mark as answered
    setAnsweredQuestions((prev) => new Set([...prev, currentQuestion.id]));

    // Save attempt to database
    try {
      const { error } = await supabase.from("quiz_attempts").insert({
        user_id: user?.id,
        question_id: currentQuestion.id,
        selected_answer: answer,
        is_correct: isCorrect,
        time_spent_seconds: timeSpent,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Error saving attempt:", error);
    }

    // Show explanation after a brief delay
    setTimeout(() => {
      setShowExplanation(true);
    }, 300);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      // Quiz completed
      setShowResults(true);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
    setAnsweredQuestions(new Set());
    setShowResults(false);
  };

  if (loading) {
    return (
      <Background>
        <View style={styles.container}>
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
            </View>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading questions...</Text>
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
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryLight]}
                  style={styles.logoIcon}
                >
                  <Ionicons name="flash" size={24} color={Colors.white} />
                </LinearGradient>
                <Text style={styles.logoText}>FocusFlow</Text>
              </View>
              <View style={styles.headerIcons}>
                {isAdmin && (
                  <TouchableOpacity
                    style={[styles.iconButton, styles.adminButton]}
                    onPress={() => router.push("/admin/questions")}
                  >
                    <Ionicons
                      name="add-circle"
                      size={22}
                      color={Colors.white}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          <View style={styles.emptyContainer}>
            <Ionicons name="bulb-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>No questions available</Text>
            <Text style={styles.emptySubtext}>
              {isAdmin
                ? "Tap the + button to add questions"
                : "Check back later for new quizzes"}
            </Text>
          </View>
        </View>
      </Background>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

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
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.iconButton, styles.adminButton]}
                  onPress={() => router.push("/reflection/admin-questions")}
                >
                  <Ionicons
                    name="settings-outline"
                    size={22}
                    color={Colors.white}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons
                  name="moon-outline"
                  size={22}
                  color={Colors.primary}
                />
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
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>Knowledge Quiz</Text>
            <Text style={styles.pageSubtitle}>Test your understanding</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                Question {currentQuestionIndex + 1} of {questions.length}
              </Text>
              <Text style={styles.scoreText}>
                Score: {score.correct}/{score.total}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progress}%` }]}
              />
            </View>
          </View>

          {/* Question Card */}
          <LinearGradient
            colors={["#2F6B56", "#3D7A63", "#4A9B7F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.questionCard}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconBadge}>
                <Ionicons name="bulb-outline" size={20} color={Colors.white} />
              </View>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>
                  {currentQuestion.difficulty}
                </Text>
              </View>
            </View>

            <Text style={styles.questionText}>{currentQuestion.question}</Text>

            {/* Answer Options */}
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = option === currentQuestion.correct_answer;
                const showCorrectness = showExplanation;

                // Determine the button style
                let buttonStyle = styles.optionButton;
                if (showCorrectness) {
                  if (isCorrect) {
                    buttonStyle = styles.optionButtonCorrect;
                  } else if (isSelected && !isCorrect) {
                    buttonStyle = styles.optionButtonWrong;
                  }
                } else if (isSelected) {
                  buttonStyle = styles.optionButtonSelected;
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={buttonStyle}
                    onPress={() => handleAnswerSelect(option)}
                    disabled={showExplanation}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                    {showCorrectness && isCorrect && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#4CAF50"
                      />
                    )}
                    {showCorrectness && isSelected && !isCorrect && (
                      <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Explanation */}
            {showExplanation && (
              <View style={styles.explanationContainer}>
                <View style={styles.explanationHeader}>
                  <Ionicons
                    name={
                      selectedAnswer === currentQuestion.correct_answer
                        ? "checkmark-circle"
                        : "information-circle"
                    }
                    size={20}
                    color={
                      selectedAnswer === currentQuestion.correct_answer
                        ? "#4CAF50"
                        : "#2196F3"
                    }
                  />
                  <Text style={styles.explanationTitle}>
                    {selectedAnswer === currentQuestion.correct_answer
                      ? "Correct!"
                      : "Not quite!"}
                  </Text>
                </View>
                <Text style={styles.explanationText}>
                  {currentQuestion.explanation}
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* Navigation Buttons */}
          <View style={styles.navigationContainer}>
            <TouchableOpacity
              style={[
                styles.navButton,
                currentQuestionIndex === 0 && styles.navButtonDisabled,
              ]}
              onPress={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={
                  currentQuestionIndex === 0 ? Colors.textLight : Colors.primary
                }
              />
              <Text
                style={[
                  styles.navButtonText,
                  currentQuestionIndex === 0 && styles.navButtonTextDisabled,
                ]}
              >
                Previous
              </Text>
            </TouchableOpacity>

            {showExplanation && (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNextQuestion}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  style={styles.nextButtonGradient}
                >
                  <Text style={styles.nextButtonText}>
                    {currentQuestionIndex === questions.length - 1
                      ? "Finish"
                      : "Next"}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors.white}
                  />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Results Modal */}
        <Modal
          visible={showResults}
          transparent
          animationType="slide"
          onRequestClose={() => setShowResults(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.resultsModal}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.resultsHeader}
              >
                <Ionicons name="trophy" size={48} color={Colors.white} />
                <Text style={styles.resultsTitle}>Quiz Complete!</Text>
              </LinearGradient>

              <View style={styles.resultsBody}>
                <Text style={styles.resultsScore}>
                  Your Score: {score.correct}/{score.total}
                </Text>
                <Text style={styles.resultsPercentage}>
                  {Math.round((score.correct / score.total) * 100)}%
                </Text>

                <View style={styles.resultsFeedback}>
                  {score.correct === score.total && (
                    <Text style={styles.feedbackText}>
                      🎉 Perfect score! Excellent work!
                    </Text>
                  )}
                  {score.correct >= score.total * 0.7 &&
                    score.correct < score.total && (
                      <Text style={styles.feedbackText}>
                        👏 Great job! You're doing well!
                      </Text>
                    )}
                  {score.correct >= score.total * 0.5 &&
                    score.correct < score.total * 0.7 && (
                      <Text style={styles.feedbackText}>
                        👍 Good effort! Keep learning!
                      </Text>
                    )}
                  {score.correct < score.total * 0.5 && (
                    <Text style={styles.feedbackText}>
                      💪 Keep practicing! You'll improve!
                    </Text>
                  )}
                </View>

                <View style={styles.resultsActions}>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      setShowResults(false);
                      resetQuiz();
                    }}
                  >
                    <LinearGradient
                      colors={[Colors.primary, Colors.primaryDark]}
                      style={styles.retryButtonGradient}
                    >
                      <Ionicons name="refresh" size={20} color={Colors.white} />
                      <Text style={styles.retryButtonText}>Try Again</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => {
                      setShowResults(false);
                      router.back();
                    }}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(74, 155, 127, 0.1)",
  },
  adminButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  titleSection: { marginBottom: 20, marginTop: 10 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: Colors.textDark },
  pageSubtitle: { fontSize: 16, color: Colors.textLight, marginTop: 4 },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textMedium,
    fontWeight: "600",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textDark,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: Colors.textLight,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  progressContainer: {
    marginBottom: 24,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textMedium,
  },
  scoreText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "rgba(74, 155, 127, 0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },

  questionCard: {
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    elevation: 10,
    shadowColor: "#1A3A32",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.white,
    textTransform: "uppercase",
  },
  questionText: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.white,
    marginBottom: 24,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionButtonSelected: {
    backgroundColor: "rgba(255, 255, 255, 1)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  optionButtonCorrect: {
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  optionButtonWrong: {
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FF6B6B",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A3A32",
    flex: 1,
  },
  explanationContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A3A32",
  },
  explanationText: {
    fontSize: 14,
    color: "#2D5249",
    lineHeight: 20,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.primary,
  },
  navButtonTextDisabled: {
    color: Colors.textLight,
  },
  nextButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  nextButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  resultsModal: {
    backgroundColor: Colors.white,
    borderRadius: 32,
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
  },
  resultsHeader: {
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.white,
  },
  resultsBody: {
    padding: 24,
    alignItems: "center",
  },
  resultsScore: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textMedium,
    marginBottom: 8,
  },
  resultsPercentage: {
    fontSize: 48,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 20,
  },
  resultsFeedback: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    width: "100%",
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textDark,
    textAlign: "center",
  },
  resultsActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  retryButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  retryButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
  doneButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textDark,
  },
});
