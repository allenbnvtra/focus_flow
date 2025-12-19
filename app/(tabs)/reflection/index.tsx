import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';

interface JournalEntry {
  id: number;
  icon: string;
  question: string;
  placeholder: string;
  value: string;
}

export default function Reflection() {
  const [entries, setEntries] = useState<JournalEntry[]>([
    {
      id: 1,
      icon: 'sparkles',
      question: 'What made you proud today?',
      placeholder: 'Take a moment to reflect on your accomplishments . . .',
      value: '',
    },
    {
      id: 2,
      icon: 'trophy',
      question: 'What challenges did you overcome?',
      placeholder: 'Describe a difficult moment and how you handled it . . .',
      value: '',
    },
  ]);

  const handleTextChange = (id: number, text: string) => {
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, value: text } : entry
    ));
  };

  return (
    <Background>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* UNIFIED HEADER */}
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
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>Journal Space</Text>
            <Text style={styles.pageSubtitle}>Your thoughts, your growth.</Text>
          </View>

          <View style={styles.cardsContainer}>
            {entries.map((entry) => (
              <LinearGradient
                key={entry.id}
                colors={['#2F6B56', '#3D7A63', '#4A9B7F']} // YOUR ORIGINAL DARK GRADIENT
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.journalCard}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconBadge}>
                    <Ionicons name={entry.icon as any} size={20} color={Colors.white} />
                  </View>
                  <Text style={styles.questionText}>{entry.question}</Text>
                </View>

                <View style={styles.inputArea}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={entry.placeholder}
                    placeholderTextColor="rgba(26, 58, 50, 0.4)"
                    multiline
                    value={entry.value}
                    onChangeText={(text) => handleTextChange(entry.id, text)}
                    scrollEnabled={false}
                  />
                </View>

                <TouchableOpacity style={styles.saveAction}>
                  <Text style={styles.saveActionText}>Save Reflection</Text>
                  <View style={styles.saveIconCircle}>
                    <Ionicons name="arrow-forward" size={16} color="#2F6B56" />
                  </View>
                </TouchableOpacity>
              </LinearGradient>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    width: 44, height: 44, borderRadius: 12, 
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    alignItems: 'center', justifyContent: 'center', 
    borderWidth: 1, borderColor: 'rgba(74, 155, 127, 0.1)' 
  },
  
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  titleSection: { marginBottom: 25, marginTop: 10 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.textDark },
  pageSubtitle: { fontSize: 16, color: Colors.textLight, marginTop: 4 },

  cardsContainer: { gap: 20 },
  journalCard: {
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)', // Frosted border for depth
    elevation: 10,
    shadowColor: '#1A3A32',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  iconBadge: { 
    width: 38, height: 38, borderRadius: 12, 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    alignItems: 'center', justifyContent: 'center' 
  },
  questionText: { fontSize: 18, fontWeight: '700', color: Colors.white, flex: 1 },

  inputArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // High contrast for readability
    borderRadius: 22,
    padding: 16,
    minHeight: 160,
  },
  textInput: {
    fontSize: 16,
    color: '#1A3A32',
    lineHeight: 24,
    fontWeight: '500',
    minHeight: 130,
  },

  saveAction: {
    backgroundColor: Colors.white,
    paddingVertical: 10,
    paddingLeft: 20,
    paddingRight: 8,
    borderRadius: 16,
    marginTop: 20,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2F6B56',
  },
  saveIconCircle: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: Colors.bubbleMedium,
    alignItems: 'center', justifyContent: 'center'
  }
});