import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { router } from 'expo-router';

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
  const [showQuitScore, setShowQuitScore] = useState(false);
  const [quitScore, setQuitScore] = useState(0);

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
    setShowQuitScore(false);
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

  const handleQuit = () => {
    setQuitScore(level);
    setShowQuitScore(true);
    setGameStarted(false);
    setGameOver(false);
    setIsPlaying(false);
    setIsPlayerTurn(false);
    setSequence([]);
    setPlayerSequence([]);
    setActiveColor(null);
  };

  const handleHome = () => {
    setGameStarted(false);
    setGameOver(false);
    setShowQuitScore(false);
    setLevel(1);
    setSequence([]);
    setPlayerSequence([]);
    setIsPlaying(false);
    setIsPlayerTurn(false);
    setActiveColor(null);
    router.push('/learning-hub');
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
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header with Quit Button */}
          <View style={styles.headerContainer}>
            {gameStarted && !gameOver && (
              <TouchableOpacity
                style={styles.quitButton}
                onPress={handleQuit}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                <Text style={styles.quitButtonText}>Quit</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.header, gameStarted && !gameOver && styles.headerWithButton]}>
              <Text style={styles.title}>Memory Game</Text>
              <Text style={styles.subtitle}>Watch, Remember, Repeat!</Text>
            </View>
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

          {/* Quit Score Screen */}
          {showQuitScore && (
            <View style={styles.controlsContainer}>
              <View style={styles.quitScoreCard}>
                <Text style={styles.quitScoreTitle}>Game Paused</Text>
                <Text style={styles.quitScoreText}>You reached level {quitScore}</Text>
                <Text style={styles.quitScoreSubtext}>
                  {quitScore > highScore ? '🎉 New High Score!' : 'Keep playing to beat your record!'}
                </Text>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[Colors.green, '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="play" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionButtonText}>New Game</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleHome} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[Colors.purple, Colors.pink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="home" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionButtonText}>Home</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Game Over Screen */}
          {gameOver && !showQuitScore && (
            <View style={styles.controlsContainer}>
              <View style={styles.gameOverCard}>
                <Text style={styles.gameOverTitle}>Game Over!</Text>
                <Text style={styles.gameOverText}>You reached level {level}</Text>
                <Text style={styles.gameOverSubtext}>
                  {level > highScore ? '🎉 New High Score!' : `High Score: ${highScore}`}
                </Text>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[Colors.green, '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionButtonText}>Play Again</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleHome} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[Colors.purple, Colors.pink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="home" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionButtonText}>Home</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Start Screen */}
          {!gameStarted && !gameOver && !showQuitScore && (
            <View style={styles.controlsContainer}>
              <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                <LinearGradient
                  colors={[Colors.purple, Colors.pink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startButton}
                >
                  <Text style={styles.startButtonText}>Start Game</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Instructions */}
          {!gameStarted && !showQuitScore && (
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
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 20,
  },
  quitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  quitButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  headerWithButton: {
    marginBottom: 0,
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
    width: '100%',
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
    marginBottom: 4,
  },
  gameOverSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  quitScoreCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.blue,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    width: '100%',
  },
  quitScoreTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  quitScoreText: {
    fontSize: 20,
    color: Colors.blueActive,
    marginBottom: 4,
  },
  quitScoreSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
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