import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface LearningItem {
  id: number;
  icon: IconName;
  title: string;
  description: string;
  route?: string;
  colors: readonly [string, string, string];
}

export default function LearningHub() {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();

  const learningItems: LearningItem[] = [
    {
      id: 1,
      icon: 'game-controller-outline',
      title: 'Memory Game',
      description: 'Train your focus and memory with this fun Simon Says game. Test your concentration!',
      route: 'learning-hub/games/memory',
      colors: [Colors.purpleDark, Colors.purple, Colors.purpleLight] as const,
    },
    {
      id: 2,
      icon: 'book-outline',
      title: 'Quick Reads',
      description: 'Short science-based reads to help you understand your focus and emotions.',
      colors: [Colors.cardDark1, Colors.cardDark2, Colors.cardDark3] as const,
    },
    {
      id: 3,
      icon: 'play-circle-outline',
      title: 'Watch and Learn',
      description: 'Simple, visual lessons that show how to stay calm and focused every day.',
      colors: [Colors.cardDark1, Colors.cardDark2, Colors.cardDark3] as const,
    },
    {
      id: 4,
      icon: 'extension-puzzle-outline',
      title: 'Visual Tips',
      description: 'Colorful guides and emotion concepts that are easy to remember.',
      colors: [Colors.cardDark1, Colors.cardDark2, Colors.cardDark3] as const,
    },
    {
      id: 5,
      icon: 'bulb-outline',
      title: 'Test What You Know',
      description: "Quizzes to see how much you've learned — no pressure, just fun discovery!",
      colors: [Colors.cardDark1, Colors.cardDark2, Colors.cardDark3] as const,
    },
    {
      id: 6,
      icon: 'volume-high-outline',
      title: 'Listen Mode',
      description: 'Learn on the go with guided audio about attention and mindfulness.',
      colors: [Colors.cardDark1, Colors.cardDark2, Colors.cardDark3] as const,
    },
  ];

  const handleCardPress = (item: LearningItem) => {
    if (item.route) {
      router.push(item.route);
    }
  };


  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      backgroundColor: 'transparent',
      paddingTop: Platform.OS === 'ios' ? 16 : 8,
      paddingBottom: 16,
      paddingHorizontal: 20,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    logoText: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: -0.5,
    },
    headerIcons: {
      flexDirection: 'row',
      gap: 10,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 3,
      borderWidth: 1,
      borderColor: 'rgba(74, 155, 127, 0.1)',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 100,
    },
    titleSection: {
      marginBottom: 24,
      marginTop: 8,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textDark,
      marginBottom: 8,
    },
    pageDescription: {
      fontSize: 16,
      color: colors.textMedium,
      lineHeight: 24,
    },
    cardsContainer: {
      gap: 16,
    },
    card: {
      borderRadius: 24,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: Colors.cardDark1,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      minHeight: 100,
    },
    iconContainer: {
      marginRight: 16,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: 'rgba(0, 0, 0, 0.2)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    cardContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.white,
      marginBottom: 6,
    },
    cardDescription: {
      fontSize: 14,
      color: Colors.white,
      lineHeight: 20,
      fontWeight: '400',
    },
    arrowContainer: {
      marginLeft: 8,
    },
  });

  return (
    <Background>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
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
            <Text style={styles.pageTitle}>Learning Hub</Text>
            <Text style={styles.pageDescription}>
              Discover short lessons and tips to help you stay focused, calm, and confident.
            </Text>
          </View>

          <View style={styles.cardsContainer}>
            {learningItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => handleCardPress(item)}
              >
                <LinearGradient
                  colors={item.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.5, 1]}
                  style={styles.card}
                >
                  <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                      <Ionicons name={item.icon} size={32} color={Colors.white} />
                    </View>
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardDescription}>{item.description}</Text>
                  </View>
                  {item.route && (
                    <View style={styles.arrowContainer}>
                      <Ionicons name="chevron-forward" size={24} color={Colors.white} />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Background>
  );
}