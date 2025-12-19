import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import Background from '../../../components/Background';

const Colors = {
  primary: '#4A9B7F',
  primaryLight: '#5DB89A',
  primaryDark: '#2F6B56',
  accent: '#7DD3C0',
  background: '#F5F5F5',
  cardDark1: '#2F6B56',
  cardDark2: '#3D7A63',
  cardDark3: '#4A9B7F',
  cardLight1: '#7DD3C0',
  cardLight2: '#9DD4BD',
  cardLight3: '#C5E8DC',
  textDark: '#1A3A32',
  textMedium: '#2D5249',
  textLight: '#5A7770',
  white: '#FFFFFF',
  pink: '#E8A5A5',
  pinkLight: '#F5C5C5',
  blue: '#A5C7E8',
  blueLight: '#C5DDEF',
  green: '#7DD3C0',
  greenLight: '#9DD4BD',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Insight {
  icon: IconName;
  iconBg: string;
  iconBgLight: string;
  title: string;
  subtitle: string;
  description: string;
}

export default function AIInsights() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleBack = () => {
    router.back();
  };

  const insights: Insight[] = [
    {
      icon: 'time-outline',
      iconBg: Colors.green,
      iconBgLight: Colors.greenLight,
      title: 'You focus best between',
      subtitle: '9–11 AM',
      description: 'Your peak productivity hours show highest concentration levels',
    },
    {
      icon: 'heart-outline',
      iconBg: Colors.pink,
      iconBgLight: Colors.pinkLight,
      title: 'Mood improves on days when',
      subtitle: 'journal',
      description: 'Journaling correlates with 40% better emotional regulation',
    },
    {
      icon: 'leaf-outline',
      iconBg: Colors.blue,
      iconBgLight: Colors.blueLight,
      title: 'Short breaks increase focus',
      subtitle: 'consistency',
      description: '5-minute breaks every hour improve sustained attention by 35%',
    },
  ];

  return (
    <Background>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoIcon}
            >
              <Ionicons name="flash" size={20} color={Colors.white} />
            </LinearGradient>
            <Text style={styles.logoText}>FocusFlow</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainCard}>
            <View style={styles.titleSection}>
              <View style={styles.titleRow}>
                <Text style={styles.mainTitle}>AI Insights</Text>
                <Ionicons name="bulb-outline" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.subtitle}>
                Personal focus insights based your daily patterns and reflections.
              </Text>
            </View>

            <View style={styles.highlightsSection}>
              <Text style={styles.highlightsTitle}>Weekly Highlights</Text>

              {insights.map((insight, index) => (
                <View key={index} style={styles.insightCard}>
                  <LinearGradient
                    colors={[insight.iconBgLight, insight.iconBg]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconCircle}
                  >
                    <Ionicons name={insight.icon} size={28} color={Colors.white} />
                  </LinearGradient>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightSubtitle}>{insight.subtitle}</Text>
                    <Text style={styles.insightDescription}>{insight.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.updateText}>
              Insights are updated weekly based your FocusFlow activity.
            </Text>

            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={isRefreshing}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.refreshGradient}
              >
                <Ionicons 
                  name="refresh-outline" 
                  size={20} 
                  color={Colors.white}
                />
                <Text style={styles.refreshText}>Refresh Insights</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.tipsSection}>
            <LinearGradient
              colors={[Colors.cardLight1, Colors.cardLight2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tipCard}
            >
              <Ionicons name="bulb-outline" size={24} color={Colors.cardDark1} />
              <Text style={styles.tipTitle}>Pro Tip</Text>
              <Text style={styles.tipText}>
                Schedule your most challenging tasks during your peak focus hours for optimal results.
              </Text>
            </LinearGradient>
          </View>
        </ScrollView>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 16 : 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 127, 0.1)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A9B7F',
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  mainCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 28,
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 127, 0.1)',
  },
  titleSection: {
    marginBottom: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A3A32',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#2D5249',
    lineHeight: 24,
  },
  highlightsSection: {
    marginBottom: 28,
  },
  highlightsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A3A32',
    marginBottom: 20,
    textAlign: 'center',
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(74, 155, 127, 0.04)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 127, 0.08)',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  insightContent: {
    flex: 1,
    paddingTop: 2,
  },
  insightTitle: {
    fontSize: 16,
    color: '#2D5249',
    marginBottom: 4,
    fontWeight: '400',
  },
  insightSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3A32',
    marginBottom: 8,
  },
  insightDescription: {
    fontSize: 14,
    color: '#5A7770',
    lineHeight: 20,
  },
  updateText: {
    fontSize: 14,
    color: '#5A7770',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  refreshButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  refreshGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
  },
  refreshText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tipsSection: {
    marginTop: 20,
  },
  tipCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#7DD3C0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tipTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2F6B56',
    marginTop: 12,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 15,
    color: '#2F6B56',
    textAlign: 'center',
    lineHeight: 22,
  },
});