import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Background, { Colors } from "../../../components/Background";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";

interface QuizCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
}

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
  is_active: boolean;
}

export default function AdminQuestions() {
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(
    null
  );

  // Form states
  const [formQuestion, setFormQuestion] = useState("");
  const [formType, setFormType] = useState<'multiple_choice' | 'true_false' | 'rating'>('multiple_choice');
  const [formOptions, setFormOptions] = useState(["", "", "", ""]);
  const [formCorrectAnswer, setFormCorrectAnswer] = useState("");
  const [formExplanation, setFormExplanation] = useState("");
  const [formDifficulty, setFormDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("easy");
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.is_admin || false;

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert(
        "Access Denied",
        "You need admin privileges to access this page"
      );
      router.back();
      return;
    }
    fetchCategories();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedCategory) {
      fetchQuestions();
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quiz_categories")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setCategories(data || []);

      if (data && data.length > 0) {
        setSelectedCategory(data[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      Alert.alert("Error", "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    if (!selectedCategory) return;

    try {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("category_id", selectedCategory)
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
    }
  };

  const openAddQuestionModal = () => {
    resetForm();
    setEditingQuestion(null);
    setShowQuestionModal(true);
  };

  const openEditQuestionModal = (question: QuizQuestion) => {
    setEditingQuestion(question);
    setFormQuestion(question.question);
    setFormType(question.question_type);
    setFormOptions(
      question.options.length > 0 ? question.options : ["", "", "", ""]
    );
    setFormCorrectAnswer(question.correct_answer);
    setFormExplanation(question.explanation);
    setFormDifficulty(question.difficulty);
    setShowQuestionModal(true);
  };

  const resetForm = () => {
    setFormQuestion("");
    setFormType("multiple_choice");
    setFormOptions(["", "", "", ""]);
    setFormCorrectAnswer("");
    setFormExplanation("");
    setFormDifficulty("easy");
  };

  const handleSaveQuestion = async () => {
    // Validation
    if (!formQuestion.trim()) {
      Alert.alert("Error", "Please enter a question");
      return;
    }

    if (formType === "multiple_choice") {
      const filledOptions = formOptions.filter((opt) => opt.trim());
      if (filledOptions.length < 2) {
        Alert.alert("Error", "Please provide at least 2 options");
        return;
      }
      if (!formCorrectAnswer.trim()) {
        Alert.alert("Error", "Please select a correct answer");
        return;
      }
    }

    if (formType === "true_false" && !formCorrectAnswer) {
      Alert.alert("Error", "Please select the correct answer");
      return;
    }

    if (!formExplanation.trim()) {
      Alert.alert("Error", "Please provide an explanation");
      return;
    }

    try {
      setSaving(true);

      const questionData = {
        category_id: selectedCategory,
        question: formQuestion.trim(),
        question_type: formType,
        options:
          formType === "multiple_choice"
            ? formOptions.filter((opt) => opt.trim())
            : ["True", "False"],
        correct_answer: formCorrectAnswer,
        explanation: formExplanation.trim(),
        difficulty: formDifficulty,
        order_index: editingQuestion
          ? editingQuestion.order_index
          : questions.length,
        is_active: true,
      };

      if (editingQuestion) {
        // Update existing question
        const { error } = await supabase
          .from("quiz_questions")
          .update(questionData)
          .eq("id", editingQuestion.id);

        if (error) throw error;
        Alert.alert("Success", "Question updated successfully");
      } else {
        // Create new question
        const { error } = await supabase
          .from("quiz_questions")
          .insert(questionData);

        if (error) throw error;
        Alert.alert("Success", "Question added successfully");
      }

      setShowQuestionModal(false);
      resetForm();
      fetchQuestions();
    } catch (error: any) {
      console.error("Error saving question:", error);
      Alert.alert("Error", "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = (question: QuizQuestion) => {
    Alert.alert(
      "Delete Question",
      "Are you sure you want to delete this question?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("quiz_questions")
                .delete()
                .eq("id", question.id);

              if (error) throw error;

              Alert.alert("Success", "Question deleted");
              fetchQuestions();
            } catch (error: any) {
              console.error("Error deleting question:", error);
              Alert.alert("Error", "Failed to delete question");
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (question: QuizQuestion) => {
    try {
      const { error } = await supabase
        .from("quiz_questions")
        .update({ is_active: !question.is_active })
        .eq("id", question.id);

      if (error) throw error;
      fetchQuestions();
    } catch (error: any) {
      console.error("Error toggling question:", error);
      Alert.alert("Error", "Failed to update question");
    }
  };

  if (loading) {
    return (
      <Background>
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </Background>
    );
  }

  return (
    <Background>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Manage Questions</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={openAddQuestionModal}
            >
              <Ionicons name="add-circle" size={28} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Selector */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionLabel}>Category:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category.id &&
                      styles.categoryChipTextActive,
                  ]}
                >
                  {category.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Questions List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {questions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-outline"
                size={64}
                color={Colors.textLight}
              />
              <Text style={styles.emptyText}>No questions yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to add your first question
              </Text>
            </View>
          ) : (
            questions.map((question, index) => (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <View style={styles.questionNumber}>
                    <Text style={styles.questionNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.questionBadges}>
                    <View style={styles.difficultyBadge}>
                      <Text style={styles.badgeText}>
                        {question.difficulty}
                      </Text>
                    </View>
                    <View style={styles.typeBadge}>
                      <Text style={styles.badgeText}>
                        {question.question_type === "multiple_choice"
                          ? "MC"
                          : "T/F"}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.questionTitle}>{question.question}</Text>

                <View style={styles.answerPreview}>
                  <Text style={styles.answerLabel}>Correct Answer:</Text>
                  <Text style={styles.answerText}>
                    {question.correct_answer}
                  </Text>
                </View>

                <View style={styles.questionActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => openEditQuestionModal(question)}
                  >
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color={Colors.primary}
                    />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.toggleButton]}
                    onPress={() => handleToggleActive(question)}
                  >
                    <Ionicons
                      name={
                        question.is_active ? "eye-outline" : "eye-off-outline"
                      }
                      size={20}
                      color={
                        question.is_active ? Colors.primary : Colors.textLight
                      }
                    />
                    <Text style={styles.actionButtonText}>
                      {question.is_active ? "Active" : "Hidden"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteQuestion(question)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                    <Text
                      style={[styles.actionButtonText, styles.deleteButtonText]}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Add/Edit Question Modal */}
        <Modal
          visible={showQuestionModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowQuestionModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingQuestion ? "Edit Question" : "Add New Question"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowQuestionModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={Colors.textMedium} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                {/* Question Input */}
                <Text style={styles.inputLabel}>Question *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your question here"
                  placeholderTextColor={Colors.textLight}
                  value={formQuestion}
                  onChangeText={setFormQuestion}
                  multiline
                />

                {/* Question Type */}
                <Text style={styles.inputLabel}>Question Type *</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      formType === "multiple_choice" && styles.typeOptionActive,
                    ]}
                    onPress={() => setFormType("multiple_choice")}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        formType === "multiple_choice" &&
                          styles.typeOptionTextActive,
                      ]}
                    >
                      Multiple Choice
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      formType === "true_false" && styles.typeOptionActive,
                    ]}
                    onPress={() => setFormType("true_false")}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        formType === "true_false" &&
                          styles.typeOptionTextActive,
                      ]}
                    >
                      True/False
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Options (for multiple choice) */}
                {formType === "multiple_choice" && (
                  <>
                    <Text style={styles.inputLabel}>
                      Options * (at least 2)
                    </Text>
                    {formOptions.map((option, index) => (
                      <View key={index} style={styles.optionInputRow}>
                        <TextInput
                          style={styles.optionInput}
                          placeholder={`Option ${index + 1}`}
                          placeholderTextColor={Colors.textLight}
                          value={option}
                          onChangeText={(text) => {
                            const newOptions = [...formOptions];
                            newOptions[index] = text;
                            setFormOptions(newOptions);
                          }}
                        />
                        <TouchableOpacity
                          style={[
                            styles.correctButton,
                            formCorrectAnswer === option &&
                              styles.correctButtonActive,
                          ]}
                          onPress={() => setFormCorrectAnswer(option)}
                        >
                          <Ionicons
                            name={
                              formCorrectAnswer === option
                                ? "checkmark-circle"
                                : "checkmark-circle-outline"
                            }
                            size={24}
                            color={
                              formCorrectAnswer === option
                                ? Colors.primary
                                : Colors.textLight
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}

                {/* True/False Selection */}
                {formType === "true_false" && (
                  <>
                    <Text style={styles.inputLabel}>Correct Answer *</Text>
                    <View style={styles.trueFalseSelector}>
                      <TouchableOpacity
                        style={[
                          styles.trueFalseOption,
                          formCorrectAnswer === "True" &&
                            styles.trueFalseOptionActive,
                        ]}
                        onPress={() => setFormCorrectAnswer("True")}
                      >
                        <Text
                          style={[
                            styles.trueFalseText,
                            formCorrectAnswer === "True" &&
                              styles.trueFalseTextActive,
                          ]}
                        >
                          True
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.trueFalseOption,
                          formCorrectAnswer === "False" &&
                            styles.trueFalseOptionActive,
                        ]}
                        onPress={() => setFormCorrectAnswer("False")}
                      >
                        <Text
                          style={[
                            styles.trueFalseText,
                            formCorrectAnswer === "False" &&
                              styles.trueFalseTextActive,
                          ]}
                        >
                          False
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Explanation */}
                <Text style={styles.inputLabel}>Explanation *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Explain why this is the correct answer"
                  placeholderTextColor={Colors.textLight}
                  value={formExplanation}
                  onChangeText={setFormExplanation}
                  multiline
                />

                {/* Difficulty */}
                <Text style={styles.inputLabel}>Difficulty *</Text>
                <View style={styles.difficultySelector}>
                  {(["easy", "medium", "hard"] as const).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.difficultyOption,
                        formDifficulty === level &&
                          styles.difficultyOptionActive,
                      ]}
                      onPress={() => setFormDifficulty(level)}
                    >
                      <Text
                        style={[
                          styles.difficultyOptionText,
                          formDifficulty === level &&
                            styles.difficultyOptionTextActive,
                        ]}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    saving && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSaveQuestion}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    style={styles.saveButtonGradient}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={Colors.white}
                        />
                        <Text style={styles.saveButtonText}>
                          {editingQuestion ? "Update Question" : "Add Question"}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textDark,
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  categorySection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMedium,
    marginBottom: 10,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMedium,
  },
  categoryChipTextActive: {
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textMedium,
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
  questionCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  questionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  questionNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.white,
  },
  questionBadges: {
    flexDirection: "row",
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.bubbleMedium,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMedium,
    textTransform: "uppercase",
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textDark,
    marginBottom: 12,
    lineHeight: 22,
  },
  answerPreview: {
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textLight,
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  questionActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: Colors.bubbleLight,
    borderColor: Colors.primary,
  },
  toggleButton: {
    backgroundColor: Colors.background,
    borderColor: "#E8E8E8",
  },
  deleteButton: {
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderColor: "#FF6B6B",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMedium,
  },
  deleteButtonText: {
    color: "#FF6B6B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textDark,
  },
  modalScroll: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMedium,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.textDark,
    minHeight: 50,
    textAlignVertical: "top",
  },
  typeSelector: {
    flexDirection: "row",
    gap: 10,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  typeOptionActive: {
    backgroundColor: Colors.bubbleLight,
    borderColor: Colors.primary,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMedium,
  },
  typeOptionTextActive: {
    color: Colors.primary,
  },
  optionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  optionInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.textDark,
  },
  correctButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  correctButtonActive: {
    backgroundColor: Colors.bubbleLight,
    borderRadius: 12,
  },
  trueFalseSelector: {
    flexDirection: "row",
    gap: 10,
  },
  trueFalseOption: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  trueFalseOptionActive: {
    backgroundColor: Colors.bubbleLight,
    borderColor: Colors.primary,
  },
  trueFalseText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textMedium,
  },
  trueFalseTextActive: {
    color: Colors.primary,
  },
  difficultySelector: {
    flexDirection: "row",
    gap: 10,
  },
  difficultyOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  difficultyOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  difficultyOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMedium,
  },
  difficultyOptionTextActive: {
    color: Colors.white,
  },
  saveButton: {
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
});
