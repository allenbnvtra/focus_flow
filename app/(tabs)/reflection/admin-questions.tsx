import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Background, { Colors } from "../../../components/Background";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "reflection" | "rating";

interface QuizCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  daily_question_count: number;
}

interface QuizQuestion {
  id: string;
  category_id: string;
  question: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  question_type: QuestionType;
  options: string[];
  correct_answer: string | null;
  order_index: number;
  is_active: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const QUESTION_TYPES: { value: QuestionType; label: string; icon: string; desc: string; color: string }[] = [
  { value: "reflection", label: "Reflection",   icon: "create-outline", desc: "User writes a free-text answer",  color: Colors.primary },
  { value: "rating",     label: "Rating (1–5)", icon: "star-outline",   desc: "User picks a score from 1 to 5", color: "#FF9800" },
];

const TYPE_COLOR: Record<QuestionType, string> = {
  reflection: Colors.primary,
  rating: "#FF9800",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminQuestions() {
  const { user } = useAuth();
  const router   = useRouter();

  const [categories, setCategories]             = useState<QuizCategory[]>([]);
  const [questions, setQuestions]               = useState<QuizQuestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [loading, setLoading]                   = useState(true);

  // Question modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion]     = useState<QuizQuestion | null>(null);
  const [formQuestion, setFormQuestion]           = useState("");
  const [formExplanation, setFormExplanation]     = useState("");
  const [formDifficulty, setFormDifficulty]       = useState<"easy" | "medium" | "hard">("easy");
  const [formType, setFormType]                   = useState<QuestionType>("reflection");
  const [saving, setSaving]                       = useState(false);

  // Daily limit modal
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [formDailyLimit, setFormDailyLimit] = useState("2");
  const [savingLimit, setSavingLimit]       = useState(false);

  const isAdmin = user?.is_admin || false;

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "You need admin privileges");
      router.back();
      return;
    }
    fetchCategories();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedCategory) fetchQuestions();
  }, [selectedCategory?.id]);

  // ─── Fetch ────────────────────────────────────────────────────────────────────

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quiz_categories").select("*")
        .eq("is_active", true).order("order_index", { ascending: true });
      if (error) throw error;
      setCategories(data || []);
      if (data?.length) setSelectedCategory(data[0]);
    } catch {
      Alert.alert("Error", "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    if (!selectedCategory) return;
    try {
      const { data, error } = await supabase
        .from("quiz_questions").select("*")
        .eq("category_id", selectedCategory.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      setQuestions(data || []);
    } catch {
      Alert.alert("Error", "Failed to load questions");
    }
  };

  // ─── Daily limit ─────────────────────────────────────────────────────────────

  const openLimitModal = () => {
    setFormDailyLimit(String(selectedCategory?.daily_question_count ?? 2));
    setShowLimitModal(true);
  };

  const handleSaveLimit = async () => {
    const parsed = parseInt(formDailyLimit, 10);
    if (isNaN(parsed) || parsed < 1) {
      Alert.alert("Error", "Please enter a valid number (minimum 1)"); return;
    }
    const activeCount = questions.filter(q => q.is_active).length;
    if (parsed > activeCount) {
      Alert.alert("Error", `Only ${activeCount} active questions in pool.`); return;
    }
    try {
      setSavingLimit(true);
      const { error } = await supabase
        .from("quiz_categories")
        .update({ daily_question_count: parsed })
        .eq("id", selectedCategory!.id);
      if (error) throw error;
      const updated = { ...selectedCategory!, daily_question_count: parsed };
      setSelectedCategory(updated);
      setCategories((prev: QuizCategory[]) => prev.map(c => c.id === updated.id ? updated : c));
      setShowLimitModal(false);
      Alert.alert("Saved", `Users will now see ${parsed} question${parsed > 1 ? "s" : ""} per day.`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save");
    } finally {
      setSavingLimit(false);
    }
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingQuestion(null);
    setFormQuestion("");
    setFormExplanation("");
    setFormDifficulty("easy");
    setFormType("reflection");
    setShowQuestionModal(true);
  };

  const openEditModal = (q: QuizQuestion) => {
    setEditingQuestion(q);
    setFormQuestion(q.question);
    setFormExplanation(q.explanation);
    setFormDifficulty(q.difficulty);
    setFormType(q.question_type ?? "reflection");
    setShowQuestionModal(true);
  };

  const handleSave = async () => {
    if (!formQuestion.trim())    { Alert.alert("Error", "Please enter a question"); return; }
    if (!formExplanation.trim()) { Alert.alert("Error", "Please provide an insight/explanation"); return; }

    try {
      setSaving(true);
      const payload = {
        category_id:    selectedCategory!.id,
        question:       formQuestion.trim(),
        explanation:    formExplanation.trim(),
        difficulty:     formDifficulty,
        question_type:  formType,
        options:        [],
        correct_answer: null,
        order_index:    editingQuestion ? editingQuestion.order_index : questions.length,
        is_active:      editingQuestion ? editingQuestion.is_active : true,
      };

      if (editingQuestion) {
        const { error } = await supabase
          .from("quiz_questions")
          .update(payload)
          .eq("id", editingQuestion.id);
        if (error) throw error;

        setQuestions(prev =>
          prev.map(q =>
            q.id === editingQuestion.id
              ? { ...editingQuestion, ...payload }
              : q
          )
        );

        setShowQuestionModal(false);
        Alert.alert("Success", "Question updated");
      } else {
        const { error } = await supabase.from("quiz_questions").insert(payload);
        if (error) throw error;

        setShowQuestionModal(false);
        await fetchQuestions();
        Alert.alert("Success", "Question added");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (q: QuizQuestion) => {
    Alert.alert("Delete Question", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("quiz_questions").delete().eq("id", q.id);
            if (error) throw error;
            await fetchQuestions();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to delete");
          }
        },
      },
    ]);
  };

  const handleToggleActive = async (q: QuizQuestion) => {
    try {
      const { error } = await supabase.from("quiz_questions")
        .update({ is_active: !q.is_active }).eq("id", q.id);
      if (error) throw error;
      setQuestions((prev: QuizQuestion[]) => prev.map(x => x.id === q.id ? { ...x, is_active: !q.is_active } : x));
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update");
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────────

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

  const activeCount = questions.filter(q => q.is_active).length;
  const dailyLimit  = selectedCategory?.daily_question_count ?? 2;
  const typeCounts  = QUESTION_TYPES.map(t => ({
    ...t,
    count: questions.filter(q => (q.question_type ?? "reflection") === t.value).length,
  }));

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Background>
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Manage Questions</Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
              <Ionicons name="add-circle" size={28} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category tabs */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionLabel}>Category:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selectedCategory?.id === cat.id && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, selectedCategory?.id === cat.id && styles.categoryChipTextActive]}>
                  {cat.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats banner */}
        <TouchableOpacity style={styles.statsBanner} onPress={openLimitModal} activeOpacity={0.8}>
          <View style={styles.statItem}>
            <Ionicons name="layers-outline" size={18} color={Colors.primary} />
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Pool</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={styles.statValue}>{dailyLimit}</Text>
            <Text style={styles.statLabel}>Per Day</Text>
          </View>
          {typeCounts.filter(t => t.count > 0).map(t => (
            <React.Fragment key={t.value}>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name={t.icon as any} size={16} color={t.color} />
                <Text style={[styles.statValue, { color: t.color, fontSize: 16 }]}>{t.count}</Text>
                <Text style={styles.statLabel}>{t.label.split(" ")[0]}</Text>
              </View>
            </React.Fragment>
          ))}
          <View style={styles.editLimitBadge}>
            <Ionicons name="pencil-outline" size={13} color={Colors.primary} />
            <Text style={styles.editLimitText}>Edit limit</Text>
          </View>
        </TouchableOpacity>

        {/* Questions list */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {questions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color={Colors.textLight} />
              <Text style={styles.emptyText}>No questions yet</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first question</Text>
            </View>
          ) : (
            questions.map((q, index) => {
              const qt = (q.question_type ?? "reflection") as QuestionType;
              const tc = TYPE_COLOR[qt];
              const typeMeta = QUESTION_TYPES.find(t => t.value === qt);
              return (
                <View key={q.id} style={[styles.questionCard, !q.is_active && styles.questionCardInactive]}>
                  <View style={styles.questionHeader}>
                    <View style={styles.questionNumber}>
                      <Text style={styles.questionNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.questionBadges}>
                      <View style={[styles.typeBadge, { backgroundColor: `${tc}18`, borderColor: `${tc}40` }]}>
                        <Ionicons name={typeMeta?.icon as any} size={11} color={tc} />
                        <Text style={[styles.typeBadgeText, { color: tc }]}>{typeMeta?.label}</Text>
                      </View>
                      <View style={styles.difficultyBadge}>
                        <Text style={styles.badgeText}>{q.difficulty}</Text>
                      </View>
                      {!q.is_active && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>Hidden</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Rating strip preview */}
                  {qt === "rating" && (
                    <View style={styles.ratingPreviewRow}>
                      {["😞","😐","🙂","😊","🤩"].map((e, i) => (
                        <View key={i} style={[styles.ratingPreviewDot, { backgroundColor: `${tc}20` }]}>
                          <Text style={{ fontSize: 14 }}>{e}</Text>
                          <Text style={[styles.ratingPreviewNum, { color: tc }]}>{i + 1}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={[styles.questionTitle, !q.is_active && styles.questionTitleInactive]}>
                    {q.question}
                  </Text>

                  <View style={styles.explanationPreview}>
                    <View style={styles.explanationPreviewHeader}>
                      <Ionicons name="information-circle-outline" size={14} color={Colors.textLight} />
                      <Text style={styles.explanationLabel}>Insight</Text>
                    </View>
                    <Text style={styles.explanationPreviewText} numberOfLines={2}>{q.explanation}</Text>
                  </View>

                  <View style={styles.questionActions}>
                    <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => openEditModal(q)}>
                      <Ionicons name="create-outline" size={20} color={Colors.primary} />
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.toggleButton]} onPress={() => handleToggleActive(q)}>
                      <Ionicons name={q.is_active ? "eye-outline" : "eye-off-outline"} size={20} color={q.is_active ? Colors.primary : Colors.textLight} />
                      <Text style={styles.actionButtonText}>{q.is_active ? "Active" : "Hidden"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(q)}>
                      <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                      <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* ── DAILY LIMIT MODAL ── */}
        <Modal visible={showLimitModal} transparent animationType="fade" onRequestClose={() => setShowLimitModal(false)}>
          <View style={styles.limitModalOverlay}>
            <View style={styles.limitModalContent}>
              <View style={styles.limitModalHeader}>
                <Ionicons name="calendar-outline" size={28} color={Colors.primary} />
                <Text style={styles.limitModalTitle}>Daily Question Limit</Text>
                <Text style={styles.limitModalSub}>
                  How many questions per day from a pool of {activeCount}?
                </Text>
              </View>
              <View style={styles.limitInputRow}>
                <TouchableOpacity style={styles.limitStepBtn} onPress={() => setFormDailyLimit(v => String(Math.max(1, parseInt(v || "1") - 1)))}>
                  <Ionicons name="remove" size={22} color={Colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.limitInput}
                  value={formDailyLimit}
                  onChangeText={v => setFormDailyLimit(v.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                />
                <TouchableOpacity style={styles.limitStepBtn} onPress={() => setFormDailyLimit(v => String(Math.min(activeCount, parseInt(v || "0") + 1)))}>
                  <Ionicons name="add" size={22} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.limitHint}>Questions rotate daily using a seeded shuffle.</Text>
              <View style={styles.limitActions}>
                <TouchableOpacity style={styles.limitCancelBtn} onPress={() => setShowLimitModal(false)}>
                  <Text style={styles.limitCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.limitSaveBtn} onPress={handleSaveLimit} disabled={savingLimit}>
                  <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.limitSaveGradient}>
                    {savingLimit
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Text style={styles.limitSaveText}>Save</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── ADD / EDIT QUESTION MODAL ── */}
        <Modal visible={showQuestionModal} transparent animationType="slide" onRequestClose={() => setShowQuestionModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingQuestion ? "Edit Question" : "Add Question"}</Text>
                <TouchableOpacity onPress={() => setShowQuestionModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={28} color={Colors.textMedium} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Question type */}
                <Text style={styles.inputLabel}>Question Type *</Text>
                <View style={styles.typeRow}>
                  {QUESTION_TYPES.map(t => {
                    const active = formType === t.value;
                    return (
                      <TouchableOpacity
                        key={t.value}
                        style={[styles.typeOption, active && { borderColor: t.color, backgroundColor: `${t.color}10` }]}
                        onPress={() => setFormType(t.value)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.typeOptionIcon, active && { backgroundColor: `${t.color}20` }]}>
                          <Ionicons name={t.icon as any} size={22} color={active ? t.color : Colors.textLight} />
                        </View>
                        <Text style={[styles.typeOptionLabel, active && { color: t.color, fontWeight: "700" }]}>{t.label}</Text>
                        <Text style={styles.typeOptionDesc}>{t.desc}</Text>
                        {active && (
                          <View style={[styles.typeCheckmark, { backgroundColor: t.color }]}>
                            <Ionicons name="checkmark" size={12} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Rating preview */}
                {formType === "rating" && (
                  <View style={[styles.previewCard, { borderColor: "#FF980040", backgroundColor: "#FF980008" }]}>
                    <Text style={[styles.previewTitle, { color: "#FF9800" }]}>Preview — what users will see:</Text>
                    <View style={styles.ratingPreviewBtns}>
                      {[{ v: 1, e: "😞" }, { v: 2, e: "😐" }, { v: 3, e: "🙂" }, { v: 4, e: "😊" }, { v: 5, e: "🤩" }].map(o => (
                        <View key={o.v} style={styles.ratingPreviewItem}>
                          <Text style={{ fontSize: 22 }}>{o.e}</Text>
                          <Text style={[styles.ratingPreviewItemNum, { color: "#FF9800" }]}>{o.v}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.previewHint}>1 = lowest · 5 = highest</Text>
                  </View>
                )}

                {/* Question prompt */}
                <Text style={styles.inputLabel}>
                  {formType === "rating" ? "Rating Prompt *" : "Question *"}
                </Text>
                {formType === "rating" && (
                  <Text style={styles.inputHintBlock}>
                    e.g. "Rate yourself using FocusFlow from 1–5, where 5 is the highest."
                  </Text>
                )}
                <TextInput
                  style={styles.textInput}
                  placeholder={formType === "rating" ? "e.g. Rate your focus today from 1–5..." : "Enter your reflection question"}
                  placeholderTextColor={Colors.textLight}
                  value={formQuestion}
                  onChangeText={setFormQuestion}
                  multiline
                />

                {/* Insight */}
                <Text style={styles.inputLabel}>Insight / Explanation *</Text>
                <Text style={styles.inputHintBlock}>Shown after the user submits their answer.</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 90 }]}
                  placeholder="Provide a thoughtful insight..."
                  placeholderTextColor={Colors.textLight}
                  value={formExplanation}
                  onChangeText={setFormExplanation}
                  multiline
                />

                {/* Difficulty */}
                <Text style={styles.inputLabel}>Difficulty *</Text>
                <View style={styles.difficultySelector}>
                  {(["easy", "medium", "hard"] as const).map(level => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.difficultyOption, formDifficulty === level && styles.difficultyOptionActive]}
                      onPress={() => setFormDifficulty(level)}
                    >
                      <Text style={[styles.difficultyOptionText, formDifficulty === level && styles.difficultyOptionTextActive]}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.saveButtonGradient}>
                    {saving
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : (
                        <>
                          <Ionicons name="checkmark" size={20} color={Colors.white} />
                          <Text style={styles.saveButtonText}>
                            {editingQuestion ? "Update Question" : "Add Question"}
                          </Text>
                        </>
                      )
                    }
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 20 : 20, paddingBottom: 15 },
  headerContent:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton:     { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center" },
  headerTitle:    { fontSize: 20, fontWeight: "700", color: Colors.textDark },
  addButton:      { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  categorySection:{ paddingHorizontal: 20, marginBottom: 12 },
  sectionLabel:   { fontSize: 14, fontWeight: "600", color: Colors.textMedium, marginBottom: 10 },
  categoryChip:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.background, marginRight: 10, borderWidth: 1, borderColor: "transparent" },
  categoryChipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primaryDark },
  categoryChipText:     { fontSize: 14, fontWeight: "600", color: Colors.textMedium },
  categoryChipTextActive: { color: Colors.white },
  statsBanner:    { marginHorizontal: 20, marginBottom: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderWidth: 1, borderColor: "#E8E8E8", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 }, android: { elevation: 2 } }) },
  statItem:       { alignItems: "center", gap: 2 },
  statValue:      { fontSize: 18, fontWeight: "800", color: Colors.textDark },
  statLabel:      { fontSize: 10, fontWeight: "600", color: Colors.textLight, textTransform: "uppercase" },
  statDivider:    { width: 1, height: 32, backgroundColor: "#E8E8E8" },
  editLimitBadge: { position: "absolute", top: 7, right: 10, flexDirection: "row", alignItems: "center", gap: 3 },
  editLimitText:  { fontSize: 11, fontWeight: "600", color: Colors.primary },
  scrollView:     { flex: 1 },
  scrollContent:  { paddingHorizontal: 20, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:    { fontSize: 16, fontWeight: "600", color: Colors.textMedium },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText:      { fontSize: 20, fontWeight: "700", color: Colors.textDark, marginTop: 16 },
  emptySubtext:   { fontSize: 15, color: Colors.textLight, textAlign: "center", paddingHorizontal: 40 },
  questionCard:         { backgroundColor: Colors.white, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#E8E8E8", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 3 } }) },
  questionCardInactive: { opacity: 0.6, backgroundColor: "#F5F5F5" },
  questionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  questionNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  questionNumberText: { fontSize: 14, fontWeight: "700", color: Colors.white },
  questionBadges: { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" },
  typeBadge:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  typeBadgeText:  { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  difficultyBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.bubbleMedium },
  inactiveBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#FF6B6B" },
  inactiveBadgeText:{ fontSize: 11, fontWeight: "700", color: Colors.white, textTransform: "uppercase" },
  badgeText:        { fontSize: 11, fontWeight: "700", color: Colors.textMedium, textTransform: "uppercase" },
  ratingPreviewRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  ratingPreviewDot: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ratingPreviewNum: { fontSize: 10, fontWeight: "800" },
  questionTitle:         { fontSize: 16, fontWeight: "600", color: Colors.textDark, marginBottom: 12, lineHeight: 22 },
  questionTitleInactive: { color: Colors.textLight },
  explanationPreview:       { backgroundColor: Colors.background, padding: 12, borderRadius: 12, marginBottom: 12 },
  explanationPreviewHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  explanationLabel:         { fontSize: 12, fontWeight: "600", color: Colors.textLight },
  explanationPreviewText:   { fontSize: 13, color: Colors.textMedium, lineHeight: 18 },
  questionActions:  { flexDirection: "row", gap: 8 },
  actionButton:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  editButton:       { backgroundColor: Colors.bubbleLight, borderColor: Colors.primary },
  toggleButton:     { backgroundColor: Colors.background, borderColor: "#E8E8E8" },
  deleteButton:     { backgroundColor: "rgba(255,107,107,0.1)", borderColor: "#FF6B6B" },
  actionButtonText: { fontSize: 13, fontWeight: "600", color: Colors.textMedium },
  deleteButtonText: { color: "#FF6B6B" },
  // Limit modal
  limitModalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  limitModalContent:  { backgroundColor: Colors.white, borderRadius: 28, padding: 28, width: "100%", maxWidth: 360 },
  limitModalHeader:   { alignItems: "center", gap: 8, marginBottom: 24 },
  limitModalTitle:    { fontSize: 20, fontWeight: "800", color: Colors.textDark },
  limitModalSub:      { fontSize: 14, color: Colors.textMedium, textAlign: "center", lineHeight: 20 },
  limitInputRow:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 },
  limitStepBtn:       { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.primary },
  limitInput:         { width: 80, height: 56, backgroundColor: Colors.background, borderRadius: 16, fontSize: 28, fontWeight: "800", color: Colors.textDark, borderWidth: 2, borderColor: Colors.primary },
  limitHint:          { fontSize: 13, color: Colors.textLight, textAlign: "center", lineHeight: 18, marginBottom: 24 },
  limitActions:       { flexDirection: "row", gap: 12 },
  limitCancelBtn:     { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.background, alignItems: "center" },
  limitCancelText:    { fontSize: 15, fontWeight: "700", color: Colors.textMedium },
  limitSaveBtn:       { flex: 1, borderRadius: 14, overflow: "hidden" },
  limitSaveGradient:  { paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  limitSaveText:      { fontSize: 15, fontWeight: "700", color: Colors.white },
  // Question modal
  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent:   { backgroundColor: Colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 24, paddingHorizontal: 24, maxHeight: "92%" },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle:     { fontSize: 22, fontWeight: "800", color: Colors.textDark },
  modalScroll:    { marginBottom: 20 },
  inputLabel:     { fontSize: 14, fontWeight: "600", color: Colors.textMedium, marginBottom: 6, marginTop: 18 },
  inputHintBlock: { fontSize: 12, color: Colors.textLight, marginBottom: 8, lineHeight: 17 },
  textInput:      { backgroundColor: Colors.background, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textDark, minHeight: 50, textAlignVertical: "top" },
  // Type selector
  typeRow:         { flexDirection: "row", gap: 12 },
  typeOption:      { flex: 1, borderRadius: 16, borderWidth: 2, borderColor: "#E8E8E8", padding: 14, alignItems: "center", gap: 6, backgroundColor: Colors.background, position: "relative" },
  typeOptionIcon:  { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  typeOptionLabel: { fontSize: 13, fontWeight: "600", color: Colors.textMedium, textAlign: "center" },
  typeOptionDesc:  { fontSize: 10, color: Colors.textLight, textAlign: "center", lineHeight: 14 },
  typeCheckmark:   { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  // Rating preview in modal
  previewCard:         { borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1 },
  previewTitle:        { fontSize: 12, fontWeight: "700", marginBottom: 10 },
  previewHint:         { fontSize: 11, color: Colors.textLight, textAlign: "center", marginTop: 6 },
  ratingPreviewBtns:   { flexDirection: "row", justifyContent: "space-between" },
  ratingPreviewItem:   { alignItems: "center", gap: 4 },
  ratingPreviewItemNum:{ fontSize: 14, fontWeight: "800" },
  // Difficulty
  difficultySelector:         { flexDirection: "row", gap: 10 },
  difficultyOption:           { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.background, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  difficultyOptionActive:     { backgroundColor: Colors.primary, borderColor: Colors.primaryDark },
  difficultyOptionText:       { fontSize: 13, fontWeight: "600", color: Colors.textMedium },
  difficultyOptionTextActive: { color: Colors.white },
  // Save button
  saveButton:         { marginTop: 24, marginBottom: 20, borderRadius: 16, overflow: "hidden" },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  saveButtonText:     { fontSize: 16, fontWeight: "700", color: Colors.white },
});