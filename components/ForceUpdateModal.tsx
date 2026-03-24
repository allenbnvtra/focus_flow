import React, { useRef, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Linking, Platform, Animated, Easing, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// ── Replace these with your actual App Store / Play Store links ──────────────
const APP_STORE_URL  = 'https://apps.apple.com/app/idYOUR_APP_ID';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME';

interface ForceUpdateModalProps {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
}

export default function ForceUpdateModal({
  visible,
  currentVersion,
  latestVersion,
}: ForceUpdateModalProps) {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconBounce  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Card entrance
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Icon bounce loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconBounce, {
            toValue: 1.12,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(iconBounce, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible]);

  const handleUpdate = () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(url).catch(() => {
      // Fallback: open store search if deep link fails
      const fallback = Platform.OS === 'ios'
        ? 'https://apps.apple.com'
        : 'https://play.google.com/store';
      Linking.openURL(fallback);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Prevent dismissal — user MUST update
      onRequestClose={() => {}}
    >
      <View style={s.overlay}>
        <Animated.View
          style={[
            s.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Header gradient strip */}
          <LinearGradient
            colors={['#4A9B7F', '#2F6B56']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.headerStrip}
          >
            <Animated.View style={{ transform: [{ scale: iconBounce }] }}>
              <View style={s.iconWrap}>
                <Ionicons name="arrow-up-circle" size={40} color="#fff" />
              </View>
            </Animated.View>
            <Text style={s.headerTitle}>Update Required</Text>
            <Text style={s.headerSub}>A new version of the app is available</Text>
          </LinearGradient>

          {/* Body */}
          <View style={s.body}>
            <View style={s.versionRow}>
              <View style={s.versionPill}>
                <Text style={s.versionLabel}>Current</Text>
                <Text style={s.versionNum}>v{currentVersion}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#5A7770" style={{ marginTop: 6 }} />
              <View style={[s.versionPill, s.versionPillNew]}>
                <Text style={[s.versionLabel, { color: '#4A9B7F' }]}>Latest</Text>
                <Text style={[s.versionNum, { color: '#4A9B7F' }]}>v{latestVersion}</Text>
              </View>
            </View>

            <Text style={s.bodyText}>
              This version is no longer supported. Please update to continue using FocusFlow and enjoy the latest improvements.
            </Text>

            {/* What's new bullets */}
            <View style={s.bulletBox}>
              {[
                '🐛  Bug fixes & stability improvements',
                '⚡  Faster performance',
                '✨  New features & enhancements',
              ].map((item, i) => (
                <Text key={i} style={s.bullet}>{item}</Text>
              ))}
            </View>

            <TouchableOpacity onPress={handleUpdate} activeOpacity={0.85} style={s.btnTouch}>
              <LinearGradient
                colors={['#5DB89A', '#3A7D66']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.btn}
              >
                <Ionicons
                  name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'}
                  size={20}
                  color="#fff"
                />
                <Text style={s.btnText}>
                  {Platform.OS === 'ios' ? 'Update on App Store' : 'Update on Play Store'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={s.footnote}>
              You must update to continue using the app.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,31,26,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.35)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 16,
  },

  // Header
  headerStrip: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    gap: 6,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },

  // Body
  body: {
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  versionPill: {
    alignItems: 'center',
    backgroundColor: '#F0FAF8',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  versionPillNew: {
    backgroundColor: '#E8F7F4',
    borderWidth: 1.5,
    borderColor: '#7DD3C0',
  },
  versionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5A7770',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A3A32',
    marginTop: 2,
  },
  bodyText: {
    fontSize: 14,
    color: '#2D5249',
    textAlign: 'center',
    lineHeight: 22,
  },
  bulletBox: {
    width: '100%',
    backgroundColor: '#F0FAF8',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  bullet: {
    fontSize: 13,
    color: '#2D5249',
    lineHeight: 20,
  },
  btnTouch: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: 'rgba(74,155,127,0.4)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  footnote: {
    fontSize: 12,
    color: '#5A7770',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});