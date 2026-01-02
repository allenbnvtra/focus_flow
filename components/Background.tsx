import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

// Helper hook that safely uses theme context with fallback
const useSafeTheme = () => {
  try {
    return useTheme();
  } catch {
    // Fallback to light colors if ThemeProvider is not available
    return {
      isDarkMode: false,
      toggleDarkMode: () => {},
      colors: {
        primary: '#4A9B7F',
        primaryLight: '#5DB89A',
        primaryDark: '#3A7D66',
        accent: '#7DD3C0',
        background: '#F8FFFE',
        bubbleLight: '#E8F7F4',
        bubbleMedium: '#D4EFE9',
        bubblePale: '#F0FAF8',
        textDark: '#1A3A32',
        textMedium: '#2D5249',
        textLight: '#5A7770',
        white: '#FFFFFF',
        shadow: 'rgba(74, 155, 127, 0.25)',
        surface: '#FFFFFF',
        cardBg: 'rgba(255, 255, 255, 0.96)',
        border: '#D1EAE2',
        settingsBg: 'rgba(255, 255, 255, 0.96)',
        settingsBorder: '#D1EAE2',
        iconBg: '#F0F9F6',
      }
    };
  }
};

const { width, height } = Dimensions.get('window');
const isTablet = Math.min(width, height) >= 600;

const rsSize = (size: number): number => {
  const standardWidth = 375;
  let scale = width / standardWidth;
  if (isTablet) {
    scale *= (width > 800) ? 1.2 : 1.1;
  }
  return Math.round(size * scale);
};

// Export the Colors object for backward compatibility
export const Colors = {
  primary: '#4A9B7F',
  primaryLight: '#5DB89A',
  primaryDark: '#3A7D66',
  accent: '#7DD3C0',
  background: '#F8FFFE',
  bubbleLight: '#E8F7F4',
  bubbleMedium: '#D4EFE9',
  bubblePale: '#F0FAF8',
  textDark: '#1A3A32',
  textMedium: '#2D5249',
  textLight: '#5A7770',
  white: '#FFFFFF',
  shadow: 'rgba(74, 155, 127, 0.25)',
  surface: '#121212',
  textInactive: '#666666',
  indicator: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.1)',
  cardDark1: '#2F6B56',
  cardDark2: '#3D7A63',
  cardDark3: '#4A9B7F',
  cardLight1: '#7DD3C0',
  cardLight2: '#9DD4BD',
  cardLight3: '#C5E8DC',
  pink: '#E8A5A5',
  pinkLight: '#F5C5C5',
  blue: '#A5C7E8',
  blueLight: '#C5DDEF',
  green: '#7DD3C0',
  greenLight: '#9DD4BD',
  purple: '#875df0ff',
  purpleLight: '#773ceeff',
  orange: '#E8C5A5',
  orangeLight: '#F5DFC5',
  red: '#EF4444',
  redActive: '#FCA5A5',
  blueActive: '#93C5FD',
  greenActive: '#6EE7B7',
  yellow: '#FBBF24',
  yellowActive: '#FDE68A',
  gradientBackground: ['#0F172A', '#581C87', '#0F172A'] as const,
  cardBg: 'rgba(255, 255, 255, 0.1)',
  textPrimary: '#FFFFFF',
  textSecondary: '#6c4de9ff',
  pinkStrong: '#EC4899',
  purpleStrong: '#922bf2ff',
  lightGray: '#c6c6c6ff',
  purpleDark: '#6923e3ff',
  glassHighlight: 'rgba(255, 255, 255, 0.4)',
};

interface BubbleProps {
  animX: Animated.Value;
  animY: Animated.Value;
  style: StyleProp<ViewStyle>;
  sizeMultiplier: number;
  colorId: string;
  colors: string[];
  strokeColor: string;
}

const FloatingBubbles = () => {
  const { colors } = useSafeTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnimX1 = useRef(new Animated.Value(-width / 2)).current;
  const slideAnimY1 = useRef(new Animated.Value(-height / 4)).current;
  const slideAnimX2 = useRef(new Animated.Value(width / 2)).current;
  const slideAnimY2 = useRef(new Animated.Value(-height / 4)).current;
  const slideAnimX3 = useRef(new Animated.Value(-width / 2)).current;
  const slideAnimY3 = useRef(new Animated.Value(height / 4)).current;
  const slideAnimX4 = useRef(new Animated.Value(width / 2)).current;
  const slideAnimY4 = useRef(new Animated.Value(height / 4)).current;

  useEffect(() => {
    const springConfig = {
      tension: 40, 
      friction: 8, 
      useNativeDriver: true,
    };

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnimX1, { ...springConfig, toValue: 0, delay: 200 }),
      Animated.spring(slideAnimY1, { ...springConfig, toValue: 0, delay: 300 }),
      Animated.spring(slideAnimX2, { ...springConfig, toValue: 0, delay: 400 }),
      Animated.spring(slideAnimY2, { ...springConfig, toValue: 0, delay: 400 }),
      Animated.spring(slideAnimX3, { ...springConfig, toValue: 0, delay: 500 }),
      Animated.spring(slideAnimY3, { ...springConfig, toValue: 0, delay: 500 }),
      Animated.spring(slideAnimX4, { ...springConfig, toValue: 0, delay: 600 }),
      Animated.spring(slideAnimY4, { ...springConfig, toValue: 0, delay: 600 }),
    ]).start();
  }, []);

  const Bubble: React.FC<BubbleProps> = ({ animX, animY, style, sizeMultiplier, colorId, colors: bubbleColors, strokeColor }) => (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateX: animX }, { translateY: animY }],
      }}
    >
      <Svg
        style={style}
        width={width * sizeMultiplier}
        height={width * sizeMultiplier}
      >
        <Defs>
          <LinearGradient id={colorId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={bubbleColors[0]} stopOpacity="0.95" />
            <Stop offset="1" stopColor={bubbleColors[1]} stopOpacity="0.75" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={(width * sizeMultiplier) / 2}
          cy={(width * sizeMultiplier) / 2}
          r={(width * sizeMultiplier) / 2 - 5} 
          fill={`url(#${colorId})`}
          stroke={strokeColor}
          strokeWidth="2"
        />
      </Svg>
    </Animated.View>
  );

  return (
    <>
      <Bubble
        animX={slideAnimX1}
        animY={slideAnimY1}
        style={{ position: 'absolute', top: rsSize(20), left: rsSize(-30) }}
        sizeMultiplier={0.45}
        colorId="bubble1"
        colors={[colors.bubbleLight, colors.bubbleMedium]}
        strokeColor={colors.white}
      />

      <Bubble
        animX={slideAnimX2}
        animY={slideAnimY2}
        style={{ position: 'absolute', top: rsSize(-50), right: rsSize(-50) }}
        sizeMultiplier={0.5}
        colorId="bubble2"
        colors={[colors.bubbleMedium, colors.bubbleLight]}
        strokeColor={colors.white}
      />

      <Bubble
        animX={slideAnimX3}
        animY={slideAnimY3}
        style={{ position: 'absolute', top: height * 0.30, left: rsSize(-60) }}
        sizeMultiplier={0.55}
        colorId="bubble3"
        colors={[colors.bubblePale, colors.bubbleMedium]}
        strokeColor={colors.white}
      />

      <Bubble
        animX={slideAnimX4}
        animY={slideAnimY4}
        style={{ position: 'absolute', top: rsSize(180), right: rsSize(-20) }}
        sizeMultiplier={0.35}
        colorId="bubble4"
        colors={[colors.bubbleLight, colors.bubblePale]}
        strokeColor={colors.white}
      />
    </>
  );
};

interface BottomWaveGraphicProps {
  heightPercentage: number;
}

const BottomWaveGraphic: React.FC<BottomWaveGraphicProps> = ({ heightPercentage }) => {
  const { colors } = useSafeTheme();
  const waveHeight = height * (heightPercentage / 100);
  const startY = waveHeight * 0.20; 
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height / 4)).current; 

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 30,
        friction: 8,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const wavePath = 
    `M0 ${startY} C${width * 0.2} ${startY - 55} ${width * 0.35} ${startY + 40} ${width * 0.5} ${startY} C${width * 0.65} ${startY - 40} ${width * 0.8} ${startY + 55} ${width} ${startY} L${width} ${waveHeight + 50} L0 ${waveHeight + 50} Z`;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        width: width,
        height: waveHeight,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <Svg
        height={waveHeight + 50}
        width={width}
        viewBox={`0 0 ${width} ${waveHeight}`}
      >
        <Defs>
          <LinearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primaryLight} stopOpacity="1" />
            <Stop offset="0.6" stopColor={colors.primary} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.primaryDark} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path
          d={wavePath}
          fill="url(#waveGradient)"
          stroke="none"
        />
        <Path
          d={`M0 ${startY} C${width * 0.2} ${startY - 55} ${width * 0.35} ${startY + 40} ${width * 0.5} ${startY} C${width * 0.65} ${startY - 40} ${width * 0.8} ${startY + 55} ${width} ${startY}`}
          stroke={colors.accent}
          strokeWidth="4"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
};

interface BackgroundProps {
  children: React.ReactNode;
}

const Background: React.FC<BackgroundProps> = ({ children }) => {
  const { colors } = useSafeTheme();
  const insets = {
    top: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20,
    bottom: Platform.OS === 'ios' ? 34 : 0,
  };

  if (isTablet) {
    insets.top = 20;
    insets.bottom = 20;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
      <FloatingBubbles />
      <BottomWaveGraphic heightPercentage={isTablet ? 30 : 35} /> 
      <View style={styles.contentContainer}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    zIndex: 10,
  },
});

export default Background;