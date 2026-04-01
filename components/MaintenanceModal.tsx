import React, { useRef, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet,
  Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MaintenanceModalProps {
  visible: boolean;
  message?: string;
  estimatedTime?: string;
}

const DEFAULT_MESSAGE = "We're making FocusFlow better for you. Please check back shortly.";

const WHAT_WE_DO = [
  'Improving app performance and stability',
  'Applying important security updates',
  'Rolling out new features and fixes',
];

export default function MaintenanceModal({
  visible,
  message,
  estimatedTime,
}: MaintenanceModalProps) {
  const slideAnim   = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
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
          {/* ── Icon + titles ── */}
          <View style={s.header}>
            <View style={s.iconWrap}>
              <Ionicons name="construct-outline" size={38} color="#fff" />
              {/* Pulse badge */}
              <View style={s.badge}>
                <Ionicons name="time-outline" size={11} color="#fff" />
              </View>
            </View>

            <Text style={s.appName}>FocusFlow</Text>
            <Text style={s.title}>Under Maintenance</Text>
            <Text style={s.subtitle}>{message || DEFAULT_MESSAGE}</Text>

            {/* Estimated time pill — only shown if provided */}
            {estimatedTime ? (
              <View style={s.etaRow}>
                <Ionicons name="hourglass-outline" size={13} color={GREEN_DRK} />
                <Text style={s.etaText}>Back in ~{estimatedTime}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Divider ── */}
          <View style={s.divider} />

          {/* ── What we're doing ── */}
          <View style={s.body}>
            <Text style={s.sectionLabel}>What we're doing</Text>
            {WHAT_WE_DO.map((item, i) => (
              <View key={i} style={s.bulletRow}>
                <View style={s.dot} />
                <Text style={s.bulletText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* ── Footer ── */}
          <View style={s.footer}>
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={GREEN} />
              <Text style={s.infoText}>
                The app will resume automatically once maintenance is complete.
              </Text>
            </View>
            <Text style={s.footnote}>We apologize for the inconvenience 🙏</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const GREEN     = '#1D9E75';
const GREEN_BG  = '#E1F5EE';
const GREEN_DRK = '#085041';

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
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF9800',
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GREEN_BG,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: '#9FE1CB',
  },
  etaText: {
    fontSize: 12,
    color: GREEN_DRK,
    fontWeight: '600',
  },

  // ── Divider ──
  divider: {
    height: 0.5,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 24,
  },

  // ── Body ──
  body: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
    marginTop: 5,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 13,
    color: '#222',
    lineHeight: 20,
    flex: 1,
  },

  // ── Footer ──
  footer: {
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: GREEN_BG,
    borderRadius: 14,
    padding: 14,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: GREEN_DRK,
    lineHeight: 19,
  },
  footnote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});