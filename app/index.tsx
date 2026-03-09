import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  // Logo animations
  const logoScale    = useRef(new Animated.Value(0.6)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoGlow     = useRef(new Animated.Value(0)).current;

  // Text animations
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(16)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;

  // Pulse ring
  const ring1Scale   = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.5)).current;
  const ring2Scale   = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.3)).current;

  // Dots loader
  const dot1Opacity  = useRef(new Animated.Value(0.2)).current;
  const dot2Opacity  = useRef(new Animated.Value(0.2)).current;
  const dot3Opacity  = useRef(new Animated.Value(0.2)).current;

  // Floating particles
  const p1Y          = useRef(new Animated.Value(0)).current;
  const p2Y          = useRef(new Animated.Value(0)).current;
  const p3Y          = useRef(new Animated.Value(0)).current;
  const p1Opacity    = useRef(new Animated.Value(0)).current;
  const p2Opacity    = useRef(new Animated.Value(0)).current;
  const p3Opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── Logo entrance ────────────────────────────────────────────────────────
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // ── Title entrance (delayed) ─────────────────────────────────────────────
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 300);

    // ── Tagline entrance ─────────────────────────────────────────────────────
    setTimeout(() => {
      Animated.timing(tagOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 600);

    // ── Pulse rings ──────────────────────────────────────────────────────────
    const pulseRing = (scale: Animated.Value, opacity: Animated.Value, delay: number) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 2.2,
              duration: 1800,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1800,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
      return loop;
    };

    setTimeout(() => {
      pulseRing(ring1Scale, ring1Opacity, 0);
      pulseRing(ring2Scale, ring2Opacity, 700);
    }, 400);

    // ── Logo glow pulse ──────────────────────────────────────────────────────
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoGlow, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // ── Dots loader ──────────────────────────────────────────────────────────
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.2,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.delay(800),
        ])
      ).start();
    };

    setTimeout(() => {
      animateDot(dot1Opacity, 0);
      animateDot(dot2Opacity, 200);
      animateDot(dot3Opacity, 400);
    }, 800);

    // ── Floating particles ───────────────────────────────────────────────────
    const floatParticle = (
      yAnim: Animated.Value,
      opAnim: Animated.Value,
      delay: number,
    ) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(opAnim, {
                toValue: 0.6,
                duration: 600,
                useNativeDriver: true,
              }),
              Animated.timing(yAnim, {
                toValue: -18,
                duration: 2000,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(opAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
              }),
              Animated.timing(yAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
              }),
            ]),
          ])
        ).start();
      }, delay);
    };

    floatParticle(p1Y, p1Opacity, 500);
    floatParticle(p2Y, p2Opacity, 900);
    floatParticle(p3Y, p3Opacity, 1300);
  }, []);

  const glowStyle = {
    shadowColor: '#4A9B7F',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: logoGlow.interpolate({
      inputRange: [0, 1],
      outputRange: [12, 28],
    }),
    shadowOpacity: logoGlow.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    }),
  };

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#0A1F1A', '#0F2E26', '#0A1F1A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft ambient blobs */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />

      {/* Floating particles */}
      {[
        { anim: p1Y, op: p1Opacity, style: styles.particle1 },
        { anim: p2Y, op: p2Opacity, style: styles.particle2 },
        { anim: p3Y, op: p3Opacity, style: styles.particle3 },
      ].map(({ anim, op, style }, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            style,
            { transform: [{ translateY: anim }], opacity: op },
          ]}
        />
      ))}

      {/* Center content */}
      <View style={styles.center}>

        {/* Pulse rings */}
        <Animated.View style={[
          styles.ring,
          { transform: [{ scale: ring1Scale }], opacity: ring1Opacity },
        ]} />
        <Animated.View style={[
          styles.ring,
          { transform: [{ scale: ring2Scale }], opacity: ring2Opacity },
        ]} />

        {/* Logo */}
        <Animated.View style={[
          styles.logoWrap,
          glowStyle,
          { transform: [{ scale: logoScale }], opacity: logoOpacity },
        ]}>
          <LinearGradient
            colors={['#4A9B7F', '#2F6B56', '#1A4D3A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Ionicons name="flash" size={38} color="white" />
          </LinearGradient>
        </Animated.View>

        {/* App name */}
        <Animated.Text style={[
          styles.appName,
          { opacity: titleOpacity, transform: [{ translateY: titleY }] },
        ]}>
          FocusFlow
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
          Your focus, amplified.
        </Animated.Text>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {[dot1Opacity, dot2Opacity, dot3Opacity].map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: dot }]}
            />
          ))}
        </View>

      </View>

      {/* Bottom tagline */}
      <Animated.Text style={[styles.bottomText, { opacity: tagOpacity }]}>
        Building your productive habits
      </Animated.Text>
    </View>
  );
}

// ─── Main Index ───────────────────────────────────────────────────────────────

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/auth/login" />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Ambient blobs
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blob1: {
    width: 320,
    height: 320,
    backgroundColor: 'rgba(74,155,127,0.08)',
    top: height * 0.1,
    left: -80,
  },
  blob2: {
    width: 260,
    height: 260,
    backgroundColor: 'rgba(47,107,86,0.10)',
    bottom: height * 0.15,
    right: -60,
  },

  // Particles
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4A9B7F',
  },
  particle1: { left: width * 0.3,  top: height * 0.3  },
  particle2: { right: width * 0.25, top: height * 0.38 },
  particle3: { left: width * 0.45, top: height * 0.45 },

  // Pulse rings
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(74,155,127,0.4)',
  },

  // Logo
  logoWrap: {
    borderRadius: 28,
    marginBottom: 28,
  },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text
  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    marginBottom: 48,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4A9B7F',
  },

  // Bottom
  bottomText: {
    position: 'absolute',
    bottom: 52,
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0.3,
  },
});