import React, { useRef, useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Linking, Platform, Animated, Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// ── Constants ────────────────────────────────────────────────────────────────

const APP_STORE_URL  = 'https://apps.apple.com/app/id6758321014';
const PLAY_STORE_URL = 'https://apps.apple.com/app/id6758321014';

export const STORAGE_KEY_RATED      = '@focusflow:rating_done';
export const STORAGE_KEY_APP_OPENS  = '@focusflow:app_opens';

/** How many app opens before we prompt. */
export const OPENS_BEFORE_PROMPT = 5;

// ── Helpers (call from _layout on every app open) ────────────────────────────

/** Increment open counter. Returns the new count. */
export async function incrementAppOpens(): Promise<number> {
  const raw   = await AsyncStorage.getItem(STORAGE_KEY_APP_OPENS);
  const count = (parseInt(raw ?? '0', 10) || 0) + 1;
  await AsyncStorage.setItem(STORAGE_KEY_APP_OPENS, String(count));
  return count;
}

/** Returns true when we should show the prompt. */
export async function shouldShowRateModal(): Promise<boolean> {
  const rated = await AsyncStorage.getItem(STORAGE_KEY_RATED);
  if (rated === 'true') return false;

  const raw = await AsyncStorage.getItem(STORAGE_KEY_APP_OPENS);
  const opens = parseInt(raw ?? '0', 10) || 0;
  return opens >= OPENS_BEFORE_PROMPT;
}

/** Mark that the user has been prompted (dismiss or rated). */
export async function markRatingDone(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_RATED, 'true');
}

// ── Component ────────────────────────────────────────────────────────────────

interface RateUsModalProps {
  visible: boolean;
  onDismiss: () => void;
  userId?: string;
}

const STARS = [1, 2, 3, 4, 5];

export default function RateUsModal({ visible, onDismiss, userId }: RateUsModalProps) {
  const [selected, setSelected]   = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const slideAnim   = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const starScales  = useRef(STARS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (visible) {
      setSelected(0);
      setSubmitted(false);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(40);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleStarPress = (star: number) => {
    setSelected(star);
    // Bounce the tapped star and cascade fill effect
    Animated.sequence([
      Animated.timing(starScales[star - 1], {
        toValue: 1.35,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(starScales[star - 1], {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSubmit = async () => {
    await markRatingDone();

    // Mark in Supabase so the modal never shows again on any device
    if (userId) {
      await supabase
        .from('users')
        .update({ has_rated: true })
        .eq('id', userId);
    }

    setSubmitted(true);

    setTimeout(() => {
      const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
      Linking.openURL(url).catch(() => {});
      onDismiss();
    }, 900);
  };

  const handleDismiss = async () => {
    await markRatingDone();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={s.overlay}>
        <Animated.View
          style={[
            s.card,
            {
              transform: [{ translateY: slideAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {!submitted ? (
            <>
              {/* ── Header ── */}
              <View style={s.header}>
                <View style={s.iconWrap}>
                  <Ionicons name="heart" size={34} color="#fff" />
                </View>
                <Text style={s.appName}>FocusFlow</Text>
                <Text style={s.title}>How was your experience?</Text>
                <Text style={s.subtitle}>
                  Tap a star to rate us on the{' '}
                  {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}
                </Text>
              </View>

              {/* ── Stars ── */}
              <View style={s.starsRow}>
                {STARS.map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleStarPress(star)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Animated.View style={{ transform: [{ scale: starScales[star - 1] }] }}>
                      <Ionicons
                        name={star <= selected ? 'star' : 'star-outline'}
                        size={40}
                        color={star <= selected ? '#F4A820' : '#D1D1D6'}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Hint label ── */}
              <Text style={s.hint}>
                {selected === 0
                  ? 'Select a rating'
                  : selected <= 2
                  ? 'We\'re sorry to hear that 😔'
                  : selected === 3
                  ? 'Thanks for the feedback!'
                  : selected === 4
                  ? 'Great, glad you enjoy it!'
                  : 'Awesome, you\'re the best! 🎉'}
              </Text>

              <View style={s.divider} />

              {/* ── CTA ── */}
              <View style={s.footer}>
                <TouchableOpacity
                  onPress={handleSubmit}
                  activeOpacity={0.82}
                  style={[s.btn, selected === 0 && s.btnDisabled]}
                  disabled={selected === 0}
                >
                  <Ionicons
                    name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'}
                    size={16}
                    color={selected === 0 ? '#aaa' : '#fff'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[s.btnText, selected === 0 && s.btnTextDisabled]}>
                    {Platform.OS === 'ios' ? 'Rate on App Store' : 'Rate on Play Store'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
                  <Text style={s.laterText}>Not now</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* ── Thank-you state ── */
            <View style={s.thankYouWrap}>
              <Text style={s.thankYouIcon}>🎉</Text>
              <Text style={s.thankYouTitle}>Thank you!</Text>
              <Text style={s.thankYouSub}>Taking you to the store…</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const GREEN = '#1D9E75';

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.9,
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 19,
  },

  // ── Stars ──
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  hint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    minHeight: 18,
    marginBottom: 20,
  },

  // ── Divider ──
  divider: {
    height: 0.5,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 24,
  },

  // ── Footer ──
  footer: {
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: '#F0F0F0',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.1,
  },
  btnTextDisabled: {
    color: '#aaa',
  },
  laterText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },

  // ── Thank-you ──
  thankYouWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  thankYouIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  thankYouTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  thankYouSub: {
    fontSize: 14,
    color: '#888',
  },
});