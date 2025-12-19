import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

export default function FocusTracker() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: 'Complete homework assignment', completed: false },
    { id: 2, text: 'Take morning medication', completed: false },
    { id: 3, text: 'Review study notes', completed: false },
  ]);
  
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [tempMinutes, setTempMinutes] = useState('25');
  const [mood, setMood] = useState<number | null>(null);

  const moods = [
    { emoji: '😊', label: 'Great', value: 1 },
    { emoji: '🙂', label: 'Good', value: 2 },
    { emoji: '😐', label: 'Okay', value: 3 },
    { emoji: '😕', label: 'Low', value: 4 },
    { emoji: '😣', label: 'Stressed', value: 5 },
  ];

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => {
        if (timerSeconds > 0) setTimerSeconds(timerSeconds - 1);
        else if (timerMinutes > 0) {
          setTimerMinutes(timerMinutes - 1);
          setTimerSeconds(59);
        } else {
          setIsRunning(false);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timerMinutes, timerSeconds]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleSetTime = () => {
    const mins = parseInt(tempMinutes);
    if (!isNaN(mins) && mins > 0) {
      setTimerMinutes(mins);
      setTimerSeconds(0);
      setIsRunning(false);
    }
    setShowTimeModal(false);
  };

  const formatTime = (num: number) => num.toString().padStart(2, '0');

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
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="moon-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="menu-outline" size={22} color={Colors.primary} />
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
                <Ionicons name="time-outline" size={20} color={Colors.primary} />
                <Text style={styles.timerTitle}>Focus Timer</Text>
              </View>
              {/* FIXED: Added hitSlop to make clicking easier */}
              <TouchableOpacity 
                onPress={() => setShowTimeModal(true)} 
                style={styles.editBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.editBtnText}>Set Time</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timerDisplay}>
              <Text style={styles.timerText}>{formatTime(timerMinutes)}:{formatTime(timerSeconds)}</Text>
            </View>

            <View style={styles.timerButtons}>
              <TouchableOpacity style={styles.mainBtn} onPress={() => setIsRunning(!isRunning)}>
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.mainBtnGradient}>
                  <Ionicons name={isRunning ? "pause" : "play"} size={20} color="white" />
                  <Text style={styles.mainBtnText}>{isRunning ? "Pause" : "Start Focus"}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetBtn} onPress={() => { setIsRunning(false); setTimerMinutes(25); setTimerSeconds(0); }}>
                <Ionicons name="refresh-outline" size={22} color={Colors.textMedium} />
              </TouchableOpacity>
            </View>
          </View>

          {/* TASKS */}
          <Text style={styles.sectionLabel}>Today's Goals</Text>
          {tasks.map((task) => (
            <TouchableOpacity key={task.id} style={[styles.taskCard, task.completed && styles.taskCardCompleted]} onPress={() => toggleTask(task.id)}>
              <View style={[styles.checkbox, task.completed && styles.checkboxActive]}>
                {task.completed && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text style={[styles.taskText, task.completed && styles.taskTextDone]}>{task.text}</Text>
            </TouchableOpacity>
          ))}

          {/* MOOD CHECK-IN */}
          <View style={styles.moodCard}>
            <View style={styles.moodHeader}>
              <Ionicons name="happy-outline" size={22} color={Colors.primary} />
              <Text style={styles.moodTitle}>How are you feeling?</Text>
            </View>
            <View style={styles.moodContainer}>
              {moods.map((item) => (
                <TouchableOpacity key={item.value} style={[styles.moodButton, mood === item.value && styles.moodButtonActive]} onPress={() => setMood(item.value)}>
                  <Text style={styles.moodEmoji}>{item.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.moodSliderContainer}>
              {mood !== null && (
                <View style={[styles.moodArrow, { left: `${(mood - 1) * 25}%` }]}><View style={styles.arrowTriangle} /></View>
              )}
              <View style={styles.moodSliderBar}>
                {mood !== null && <View style={[styles.moodSliderThumb, { left: `${(mood - 1) * 25}%` }]} />}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* MODAL FOR SETTING TIME */}
        <Modal
          visible={showTimeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContent}>
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
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTimeModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSetTime}>
                  <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.saveBtnGradient}>
                    <Text style={styles.saveBtnText}>Apply</Text>
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
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: '700', color: Colors.primary, letterSpacing: -0.5 },
  headerIcons: { flexDirection: 'row', gap: 10 },
  iconButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    backgroundColor: Colors.white, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1.5, 
    borderColor: '#E8E8E8' // Visible gray border
  },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.textDark, marginVertical: 15 },
  
  // TIMER CARD with light border
  timerCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.98)', // Slightly more solid
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 25, 
    elevation: 20, // Higher elevation for shadow depth
    shadowColor: Colors.primary, 
    shadowOpacity: 0.15, 
    shadowRadius: 12,
    
    // VISIBLE BORDER LOGIC:
    borderWidth: 2,
    borderColor: '#E0F2F1', // Very light teal-gray that is visible on white
  },
  timerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textDark },
  editBtn: { backgroundColor: Colors.bubbleMedium, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  editBtnText: { color: Colors.primaryDark, fontSize: 12, fontWeight: '800' },
  timerDisplay: { alignItems: 'center', marginVertical: 20 },
  timerText: { fontSize: 64, fontWeight: '300', color: Colors.textDark, letterSpacing: 2 },
  
  timerButtons: { flexDirection: 'row', gap: 12 },
  mainBtn: { flex: 4, height: 54, borderRadius: 15, overflow: 'hidden' },
  mainBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mainBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  resetBtn: { flex: 1, backgroundColor: Colors.bubbleLight, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },

  sectionLabel: { fontSize: 18, fontWeight: '700', color: Colors.textDark, marginBottom: 12 },
  
  // TASK CARD with light border
  taskCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    padding: 16, 
    borderRadius: 18, 
    marginBottom: 10, 
    elevation: 3,
    
    // VISIBLE BORDER LOGIC:
    borderWidth: 1.5,
    borderColor: '#D1EAE2', // Slightly darker teal border to define the edge
  },
  taskCardCompleted: { opacity: 0.6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.primaryLight, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  taskText: { fontSize: 15, fontWeight: '500', color: Colors.textMedium },
  taskTextDone: { textDecorationLine: 'line-through', color: Colors.textLight },

  // MOOD CARD with light border
  moodCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.98)', 
    padding: 20, 
    borderRadius: 24, 
    marginTop: 10, 
    elevation: 6,
    
    // VISIBLE BORDER LOGIC:
    borderWidth: 2,
    borderColor: '#E0F2F1', // Solid light border
  },
  moodHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  moodTitle: { fontSize: 16, fontWeight: '700', color: Colors.textDark },
  moodContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  moodButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  moodButtonActive: { backgroundColor: 'white', transform: [{ scale: 1.15 }], elevation: 4, borderColor: Colors.primary, borderWidth: 1 },
  moodEmoji: { fontSize: 28 },
  moodSliderContainer: { position: 'relative', paddingHorizontal: 25, height: 30, justifyContent: 'center' },
  moodSliderBar: { height: 6, backgroundColor: Colors.bubbleMedium, borderRadius: 3, width: '100%' },
  moodSliderThumb: { 
    position: 'absolute', 
    width: 22, 
    height: 22, 
    borderRadius: 11, 
    backgroundColor: Colors.primary, 
    marginLeft: -11, 
    top: -8, 
    borderWidth: 3, 
    borderColor: '#FFFFFF', // White ring around the primary color thumb
    elevation: 4,
  },
  moodArrow: { position: 'absolute', bottom: 28, marginLeft: -8, zIndex: 10, paddingHorizontal: 25 },
  arrowTriangle: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: Colors.primary },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { 
    backgroundColor: 'white', 
    borderRadius: 30, 
    padding: 30, 
    width: '100%', 
    maxWidth: 340, 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)'
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textDark, marginBottom: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 30 },
  input: { fontSize: 48, fontWeight: '700', color: Colors.primary, borderBottomWidth: 3, borderBottomColor: Colors.accent, textAlign: 'center', minWidth: 80 },
  inputLabel: { fontSize: 18, color: Colors.textLight, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 15, width: '100%', marginBottom: 20, },
  cancelBtn: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  cancelBtnText: { color: Colors.textLight, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 1, borderRadius: 15, overflow: 'hidden' },
  saveBtnGradient: { paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});