import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

const Colors = {
  red: '#EF4444',
  redActive: '#FCA5A5',
  blue: '#3B82F6',
  blueActive: '#93C5FD',
  green: '#10B981',
  greenActive: '#6EE7B7',
  yellow: '#FBBF24',
  yellowActive: '#FDE68A',
  background: ['#0F172A', '#581C87', '#0F172A'] as const,
  cardBg: 'rgba(255, 255, 255, 0.1)',
  textPrimary: '#FFFFFF',
  textSecondary: '#C4B5FD',
  purple: '#A855F7',
  pink: '#EC4899',
};

type GameColor = 'red' | 'blue' | 'green' | 'yellow';

export default function MemoryGame() {
  const [sequence, setSequence] = useState<GameColor[]>([]);
  const [playerSequence, setPlayerSequence] = useState<GameColor[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [activeColor, setActiveColor] = useState<GameColor | null>(null);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  const colors: GameColor[] = ['red', 'blue', 'green', 'yellow'];
  const scaleAnimations = useRef({
    red: new Animated.Value(1),
    blue: new Animated.Value(1),
    green: new Animated.Value(1),
    yellow: new Animated.Value(1),
  }).current;

  // Sound frequencies for each color
  const playSound = async (color: GameColor) => {
    if (!soundOn) return;

    const frequencies = {
      red: 329.63,
      blue: 261.63,
      green: 392.0,
      yellow: 440.0,
    };

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${generateBeep(frequencies[color])}` },
        { shouldPlay: true }
      );
      setTimeout(() => sound.unloadAsync(), 300);
    } catch (error) {
      console.log('Sound error:', error);
    }
  };

  // Simple beep generator (base64 encoded silence - you can replace with actual sound files)
  const generateBeep = (frequency: number) => {
    return 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  };

  const animateButton = (color: GameColor, active: boolean) => {
    Animated.sequence([
      Animated.timing(scaleAnimations[color], {
        toValue: active ? 0.9 : 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setLevel(1);
    setSequence([]);
    setPlayerSequence([]);
    nextLevel([]);
  };

  const nextLevel = (currentSequence: GameColor[]) => {
    const newColor = colors[Math.floor(Math.random() * colors.length)];
    const newSequence = [...currentSequence, newColor];
    setSequence(newSequence);
    setIsPlaying(true);
    setIsPlayerTurn(false);
    playSequence(newSequence);
  };

  const playSequence = async (seq: GameColor[]) => {
    const speed = Math.max(400 - level * 20, 200);

    for (let i = 0; i < seq.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, speed));
      setActiveColor(seq[i]);
      animateButton(seq[i], true);
      playSound(seq[i]);
      await new Promise((resolve) => setTimeout(resolve, speed));
      setActiveColor(null);
      animateButton(seq[i], false);
    }

    setIsPlaying(false);
    setIsPlayerTurn(true);
  };

  const handleColorClick = (color: GameColor) => {
    if (!isPlayerTurn || isPlaying) return;

    const newPlayerSequence = [...playerSequence, color];
    setPlayerSequence(newPlayerSequence);
    setActiveColor(color);
    animateButton(color, true);
    playSound(color);

    setTimeout(() => {
      setActiveColor(null);
      animateButton(color, false);
    }, 300);

    const currentIndex = newPlayerSequence.length - 1;

    if (newPlayerSequence[currentIndex] !== sequence[currentIndex]) {
      setGameOver(true);
      setIsPlayerTurn(false);
      if (level > highScore) {
        setHighScore(level);
      }
      return;
    }

    if (newPlayerSequence.length === sequence.length) {
      setPlayerSequence([]);
      setLevel(level + 1);
      setTimeout(() => nextLevel(sequence), 1000);
    }
  };

  const getButtonColor = (color: GameColor) => {
    const isActive = activeColor === color;
    switch (color) {
      case 'red':
        return isActive ? Colors.redActive : Colors.red;
      case 'blue':
        return isActive ? Colors.blueActive : Colors.blue;
      case 'green':
        return isActive ? Colors.greenActive : Colors.green;
      case 'yellow':
        return isActive ? Colors.yellowActive : Colors.yellow;
    }
  };

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }, []);

  return (
    <LinearGradient colors={Colors.background} style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Memory Game</Text>
          <Text style={styles.subtitle}>Watch, Remember, Repeat!</Text>
        </View>

        {/* Score Board */}
        <View style={styles.scoreBoard}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Level</Text>
            <Text style={styles.scoreValue}>{level}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>High Score</Text>
            <Text style={[styles.scoreValue, styles.highScoreValue]}>{highScore}</Text>
          </View>
          <TouchableOpacity
            style={styles.soundButton}
            onPress={() => setSoundOn(!soundOn)}
          >
            <Ionicons
              name={soundOn ? 'volume-high' : 'volume-mute'}
              size={24}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Status Message */}
        {gameStarted && !gameOver && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {isPlaying ? '👀 Watch the pattern...' : isPlayerTurn ? '👆 Your turn!' : ''}
            </Text>
          </View>
        )}

        {/* Game Board */}
        <View style={styles.gameBoard}>
          {colors.map((color, index) => (
            <Animated.View
              key={color}
              style={[
                styles.buttonContainer,
                { transform: [{ scale: scaleAnimations[color] }] },
              ]}
            >
              <TouchableOpacity
                onPress={() => handleColorClick(color)}
                disabled={!isPlayerTurn || isPlaying}
                activeOpacity={0.8}
                style={[
                  styles.colorButton,
                  { backgroundColor: getButtonColor(color) },
                  (!isPlayerTurn || isPlaying) && styles.buttonDisabled,
                ]}
              />
            </Animated.View>
          ))}
        </View>

        {/* Game Controls */}
        {(!gameStarted || gameOver) && (
          <View style={styles.controlsContainer}>
            {gameOver && (
              <View style={styles.gameOverCard}>
                <Text style={styles.gameOverTitle}>Game Over!</Text>
                <Text style={styles.gameOverText}>You reached level {level}</Text>
              </View>
            )}
            <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
              <LinearGradient
                colors={[Colors.purple, Colors.pink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButton}
              >
                <Text style={styles.startButtonText}>
                  {gameOver ? 'Play Again' : 'Start Game'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Instructions */}
        {!gameStarted && (
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>How to Play:</Text>
            <Text style={styles.instructionText}>• Watch the color sequence carefully</Text>
            <Text style={styles.instructionText}>
              • Repeat the sequence by tapping the colors in order
            </Text>
            <Text style={styles.instructionText}>
              • Each level adds one more color to remember
            </Text>
            <Text style={styles.instructionText}>• The game gets faster as you progress</Text>
            <Text style={styles.instructionText}>• Make a mistake and it's game over!</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  scoreBoard: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  scoreItem: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  highScoreValue: {
    color: Colors.yellow,
  },
  soundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 30,
    minHeight: 40,
  },
  statusText: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  gameBoard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 30,
  },
  buttonContainer: {
    width: (width - 68) / 2,
    aspectRatio: 1,
  },
  colorButton: {
    flex: 1,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  gameOverCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.red,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  gameOverText: {
    fontSize: 20,
    color: Colors.redActive,
  },
  startButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  instructions: {
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    padding: 20,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
});