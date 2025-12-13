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

const Colors = {
  primary: '#4A9B7F',     // Dark Teal/Green
  primaryLight: '#5DB89A',  // Lighter Teal/Green
  primaryDark: '#3A7D66',   // Deep Teal/Green
  accent: '#7DD3C0',      // Very Light Accent Teal
  background: '#F8FFFE',  // Near White
  bubbleLight: '#E8F7F4', // Light Bubble
  bubbleMedium: '#D4EFE9',// Medium Bubble
  bubblePale: '#F0FAF8',  // Pale Bubble
  textDark: '#1A3A32',
  textMedium: '#2D5249',
  textLight: '#5A7770',
  white: '#FFFFFF',
  shadow: 'rgba(74, 155, 127, 0.25)', // Shadow based on primary color
};
// ----------------------------------------

interface BubbleProps {
  animX: Animated.Value;
  animY: Animated.Value;
  style: StyleProp<ViewStyle>;
  sizeMultiplier: number;
  colorId: string;
  colors: string[];
}

const FloatingBubbles = () => {
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

  const Bubble: React.FC<BubbleProps> = ({ animX, animY, style, sizeMultiplier, colorId, colors }) => (
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
            <Stop offset="0" stopColor={colors[0]} stopOpacity="0.95" />
            <Stop offset="1" stopColor={colors[1]} stopOpacity="0.75" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={(width * sizeMultiplier) / 2}
          cy={(width * sizeMultiplier) / 2}
          r={(width * sizeMultiplier) / 2 - 5} 
          fill={`url(#${colorId})`}
          stroke={Colors.white}
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
        colors={[Colors.bubbleLight, Colors.bubbleMedium]}
      />

      <Bubble
        animX={slideAnimX2}
        animY={slideAnimY2}
        style={{ position: 'absolute', top: rsSize(-50), right: rsSize(-50) }}
        sizeMultiplier={0.5} // Larger
        colorId="bubble2"
        colors={[Colors.bubbleMedium, Colors.bubbleLight]}
      />

      <Bubble
        animX={slideAnimX3}
        animY={slideAnimY3}
        style={{ position: 'absolute', top: height * 0.30, left: rsSize(-60) }}
        sizeMultiplier={0.55} // Even larger
        colorId="bubble3"
        colors={[Colors.bubblePale, Colors.bubbleMedium]}
      />

      <Bubble
        animX={slideAnimX4}
        animY={slideAnimY4}
        style={{ position: 'absolute', top: rsSize(180), right: rsSize(-20) }}
        sizeMultiplier={0.35} // Smallest
        colorId="bubble4"
        colors={[Colors.bubbleLight, Colors.bubblePale]}
      />
    </>
  );
};

// --- FIX: Define the props interface for BottomWaveGraphic component ---
interface BottomWaveGraphicProps {
    heightPercentage: number;
}
// ------------------------------------------------------------------------

const BottomWaveGraphic: React.FC<BottomWaveGraphicProps> = ({ heightPercentage }) => {
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
        tension: 30, // Bouncier spring
        friction: 8,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Smoother, deeper curve for a fun, organic look
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
            <Stop offset="0" stopColor={Colors.primaryLight} stopOpacity="1" />
            <Stop offset="0.6" stopColor={Colors.primary} stopOpacity="1" />
            <Stop offset="1" stopColor={Colors.primaryDark} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path
          d={wavePath}
          fill="url(#waveGradient)"
          stroke="none"
        />
        {/* Added a subtle light green/white foamy top line for visual appeal */}
        <Path
          d={`M0 ${startY} C${width * 0.2} ${startY - 55} ${width * 0.35} ${startY + 40} ${width * 0.5} ${startY} C${width * 0.65} ${startY - 40} ${width * 0.8} ${startY + 55} ${width} ${startY}`}
          stroke={Colors.accent} // Using the light accent color for the foam
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
  const insets = {
    top: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20,
    bottom: Platform.OS === 'ios' ? 34 : 0,
  };

  if (isTablet) {
    insets.top = 20;
    insets.bottom = 20;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
    backgroundColor: Colors.background,
  },
  contentContainer: {
    flex: 1,
    zIndex: 10,
  },
});

export default Background;
export { Colors };