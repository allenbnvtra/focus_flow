import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Platform, ScrollView, Vibration, Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../../components/Background';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';

const { width } = Dimensions.get('window');
const GAME_NAME = 'memory_game';

type GameColor = 'red' | 'blue' | 'green' | 'yellow';

// ─── Leaderboard types ────────────────────────────────────────────────────────

interface LeaderEntry {
  rank: number;
  user_id: string;
  name: string;
  score: number;
  achieved_at: string;
  isMe: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MemoryGame() {
  const { user } = useAuth();

  const [sequence, setSequence]           = useState<GameColor[]>([]);
  const [playerSequence, setPlayerSequence] = useState<GameColor[]>([]);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [isPlayerTurn, setIsPlayerTurn]   = useState(false);
  const [activeColor, setActiveColor]     = useState<GameColor | null>(null);
  const [level, setLevel]                 = useState(1);
  const [gameOver, setGameOver]           = useState(false);
  const [highScore, setHighScore]         = useState(0);        // local session best
  const [dbHighScore, setDbHighScore]     = useState(0);        // persisted best from DB
  const [vibrationOn, setVibrationOn]     = useState(true);
  const [gameStarted, setGameStarted]     = useState(false);
  const [showQuitScore, setShowQuitScore] = useState(false);
  const [quitScore, setQuitScore]         = useState(0);
  const [savingScore, setSavingScore]     = useState(false);

  // Leaderboard
  const [showLeaderboard, setShowLeaderboard]       = useState(false);
  const [leaderboard, setLeaderboard]               = useState<LeaderEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [myRank, setMyRank]                         = useState<number | null>(null);

  const colors: GameColor[] = ['red', 'blue', 'green', 'yellow'];
  const scaleAnimations = useRef({
    red:    new Animated.Value(1),
    blue:   new Animated.Value(1),
    green:  new Animated.Value(1),
    yellow: new Animated.Value(1),
  }).current;

  // Load personal best from DB on mount
  useEffect(() => {
    if (user?.id) loadDbHighScore();
  }, [user?.id]);

  // ─── DB helpers ───────────────────────────────────────────────────────────

  const loadDbHighScore = async () => {
    try {
      const { data } = await supabase
        .from('game_scores')
        .select('score')
        .eq('user_id', user!.id)
        .eq('game_name', GAME_NAME)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.score) {
        setDbHighScore(data.score);
        setHighScore(data.score); // seed local high score from DB
      }
    } catch (e) { console.error('loadDbHighScore:', e); }
  };

  const saveScore = async (score: number) => {
    if (!user?.id) return;
    // Only save if it's a new personal best
    const best = Math.max(dbHighScore, highScore);
    if (score <= best) return;
    try {
      setSavingScore(true);
      const { error } = await supabase
        .from('game_scores')
        .insert({ user_id: user.id, game_name: GAME_NAME, score });
      if (error) throw error;
      setDbHighScore(score);
    } catch (e) { console.error('saveScore:', e); }
    finally { setSavingScore(false); }
  };

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);

      // Step 1: fetch scores
      const { data: scores, error: scoresErr } = await supabase
        .from('game_scores')
        .select('user_id, score, created_at')
        .eq('game_name', GAME_NAME)
        .order('score', { ascending: false })
        .limit(200);

      if (scoresErr) throw scoresErr;

      // Step 2: deduplicate — best score per user
      const best: Record<string, { user_id: string; score: number; created_at: string }> = {};
      for (const row of scores || []) {
        if (!best[row.user_id] || row.score > best[row.user_id].score) {
          best[row.user_id] = row;
        }
      }

      const sorted = Object.values(best).sort((a, b) => b.score - a.score);
      const top10  = sorted.slice(0, 10);

      if (!top10.length) {
        setLeaderboard([]);
        setMyRank(null);
        return;
      }

      // Step 3: fetch names from users table (separate query — avoids FK join issues)
      const userIds = top10.map(r => r.user_id);
      const { data: userRows, error: usersErr } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);

      if (usersErr) throw usersErr;

      const nameMap: Record<string, string> = {};
      for (const u of userRows || []) nameMap[u.id] = u.name || 'Unknown';

      const entries: LeaderEntry[] = top10.map((row, i) => ({
        rank:        i + 1,
        user_id:     row.user_id,
        name:        nameMap[row.user_id] || 'Unknown',
        score:       row.score,
        achieved_at: row.created_at,
        isMe:        row.user_id === user?.id,
      }));

      setLeaderboard(entries);

      // Personal rank (may be outside top 10)
      const myIdx = sorted.findIndex(r => r.user_id === user?.id);
      setMyRank(myIdx === -1 ? null : myIdx + 1);

    } catch (e) {
      console.error('loadLeaderboard:', e);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleOpenLeaderboard = () => {
    setShowLeaderboard(true);
    loadLeaderboard();
  };

  // ─── Game logic (unchanged from original) ────────────────────────────────

  const vibrate = (color: GameColor) => {
    if (!vibrationOn) return;
    const patterns = { red: [0, 100], blue: [0, 50], green: [0, 30], yellow: [0, 70] };
    try { Vibration.vibrate(patterns[color]); } catch {}
  };

  const animateButton = (color: GameColor, active: boolean) => {
    Animated.sequence([
      Animated.timing(scaleAnimations[color], {
        toValue: active ? 0.9 : 1, duration: 150, useNativeDriver: true,
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
    const newColor    = colors[Math.floor(Math.random() * colors.length)];
    const newSequence = [...currentSequence, newColor];
    setSequence(newSequence);
    setIsPlaying(true);
    setIsPlayerTurn(false);
    playSequence(newSequence);
  };

  const playSequence = async (seq: GameColor[]) => {
    const speed = Math.max(400 - level * 20, 200);
    for (let i = 0; i < seq.length; i++) {
      await new Promise(r => setTimeout(r, speed));
      setActiveColor(seq[i]); animateButton(seq[i], true); vibrate(seq[i]);
      await new Promise(r => setTimeout(r, speed));
      setActiveColor(null); animateButton(seq[i], false);
    }
    setIsPlaying(false);
    setIsPlayerTurn(true);
  };

  const handleColorClick = (color: GameColor) => {
    if (!isPlayerTurn || isPlaying) return;

    const newSeq = [...playerSequence, color];
    setPlayerSequence(newSeq);
    setActiveColor(color); animateButton(color, true); vibrate(color);
    setTimeout(() => { setActiveColor(null); animateButton(color, false); }, 300);

    const idx = newSeq.length - 1;
    if (newSeq[idx] !== sequence[idx]) {
      // ── Game over ──
      setGameOver(true);
      setIsPlayerTurn(false);
      if (vibrationOn) Vibration.vibrate([0, 100, 100, 100]);
      const finalScore = level;
      if (finalScore > highScore) setHighScore(finalScore);
      saveScore(finalScore); // 🔑 persist to Supabase
      return;
    }

    if (newSeq.length === sequence.length) {
      setPlayerSequence([]);
      setLevel(l => l + 1);
      if (vibrationOn) Vibration.vibrate([0, 50, 50, 50]);
      setTimeout(() => nextLevel(sequence), 1000);
    }
  };

  const handleQuit = () => {
    const score = level;
    setQuitScore(score);
    if (score > highScore) setHighScore(score);
    saveScore(score); // persist on quit too
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
    setGameStarted(false); setGameOver(false); setShowQuitScore(false);
    setLevel(1); setSequence([]); setPlayerSequence([]);
    setIsPlaying(false); setIsPlayerTurn(false); setActiveColor(null);
    router.push('/learning-hub');
  };

  const getButtonColor = (color: GameColor) => {
    const isActive = activeColor === color;
    switch (color) {
      case 'red':    return isActive ? Colors.redActive    : Colors.red;
      case 'blue':   return isActive ? Colors.blueActive   : Colors.blue;
      case 'green':  return isActive ? Colors.greenActive  : Colors.green;
      case 'yellow': return isActive ? Colors.yellowActive : Colors.yellow;
    }
  };

  const bestScore = Math.max(highScore, dbHighScore);

  // ─── Leaderboard modal ────────────────────────────────────────────────────

  const renderLeaderboard = () => (
    <Modal visible={showLeaderboard} transparent animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
      <View style={styles.lbOverlay}>
        <View style={styles.lbModal}>
          {/* Header */}
          <View style={styles.lbHeader}>
            <Text style={styles.lbTitle}>🏆 Leaderboard</Text>
            <TouchableOpacity onPress={() => setShowLeaderboard(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.lbSubtitle}>Memory Game — Best Scores</Text>

          {leaderboardLoading ? (
            <View style={styles.lbLoader}>
              <ActivityIndicator size="large" color={Colors.green} />
              <Text style={styles.lbLoaderText}>Loading...</Text>
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.lbEmpty}>
              <Text style={styles.lbEmptyText}>No scores yet — be the first! 🎮</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {leaderboard.map(entry => (
                <View
                  key={entry.user_id}
                  style={[styles.lbRow, entry.isMe && styles.lbRowMe]}
                >
                  {/* Rank */}
                  <View style={styles.lbRankWrap}>
                    {entry.rank <= 3 ? (
                      <Text style={styles.lbMedal}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                      </Text>
                    ) : (
                      <Text style={styles.lbRankNum}>#{entry.rank}</Text>
                    )}
                  </View>
                  {/* Avatar */}
                  <View style={[styles.lbAvatar, entry.isMe && { backgroundColor: Colors.green }]}>
                    <Text style={styles.lbAvatarText}>{entry.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  {/* Name + date */}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lbName, entry.isMe && { color: Colors.green }]}>
                      {entry.name}{entry.isMe ? ' (You)' : ''}
                    </Text>
                    <Text style={styles.lbDate}>
                      {new Date(entry.achieved_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}
                    </Text>
                  </View>
                  {/* Score */}
                  <View style={[styles.lbScorePill, entry.rank === 1 && styles.lbScorePillGold]}>
                    <Text style={[styles.lbScoreText, entry.rank === 1 && { color: '#B8860B' }]}>
                      Lvl {entry.score}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Show user's rank if outside top 10 */}
              {myRank !== null && myRank > 10 && (
                <View style={styles.lbMyRankNote}>
                  <Text style={styles.lbMyRankText}>Your rank: #{myRank} · Best: Level {bestScore}</Text>
                </View>
              )}

              {!user && (
                <Text style={styles.lbLoginHint}>Log in to save your score to the leaderboard!</Text>
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.lbCloseBtn} onPress={() => setShowLeaderboard(false)}>
            <Text style={styles.lbCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={Colors.gradientBackground} style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          {/* Header */}
          <View style={styles.headerContainer}>
            {gameStarted && !gameOver && (
              <TouchableOpacity style={styles.quitButton} onPress={handleQuit} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                <Text style={styles.quitButtonText}>Quit</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.header, gameStarted && !gameOver && styles.headerWithButton]}>
              <Text style={styles.title}>GuniTap: Memory Game</Text>
              <Text style={styles.subtitle}>Watch, Remember, Repeat!</Text>
            </View>
          </View>

          {/* Score board — now has trophy button */}
          <View style={styles.scoreBoard}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Level</Text>
              <Text style={styles.scoreValue}>{level}</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Best</Text>
              <Text style={[styles.scoreValue, styles.highScoreValue]}>
                {bestScore}
                {savingScore && <Text style={styles.savingIndicator}> ↑</Text>}
              </Text>
            </View>
            {/* Vibration toggle */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => setVibrationOn(v => !v)}>
              <Ionicons
                name={vibrationOn ? 'phone-portrait' : 'phone-portrait-outline'}
                size={22}
                color={Colors.textPrimary}
              />
            </TouchableOpacity>
            {/* 🏆 Leaderboard button */}
            <TouchableOpacity style={[styles.iconBtn, styles.trophyBtn]} onPress={handleOpenLeaderboard}>
              <Ionicons name="trophy-outline" size={22} color={Colors.yellow} />
            </TouchableOpacity>
          </View>

          {/* Status */}
          {gameStarted && !gameOver && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {isPlaying ? '👀 Watch the pattern...' : isPlayerTurn ? '👆 Your turn!' : ''}
              </Text>
            </View>
          )}

          {/* Game board */}
          <View style={styles.gameBoard}>
            {colors.map(color => (
              <Animated.View
                key={color}
                style={[styles.buttonContainer, { transform: [{ scale: scaleAnimations[color] }] }]}
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

          {/* Quit score */}
          {showQuitScore && (
            <View style={styles.controlsContainer}>
              <View style={styles.quitScoreCard}>
                <Text style={styles.quitScoreTitle}>Game Paused</Text>
                <Text style={styles.quitScoreText}>You reached level {quitScore}</Text>
                <Text style={styles.quitScoreSubtext}>
                  {quitScore >= bestScore ? '🎉 New High Score!' : 'Keep playing to beat your record!'}
                </Text>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                  <LinearGradient colors={[Colors.green, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                    <Ionicons name="play" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionButtonText}>New Game</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleHome} activeOpacity={0.8}>
                  <LinearGradient colors={[Colors.purple, Colors.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                    <Ionicons name="home" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionButtonText}>Home</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Game over */}
          {gameOver && !showQuitScore && (
            <View style={styles.controlsContainer}>
              <View style={styles.gameOverCard}>
                <Text style={styles.gameOverTitle}>Game Over!</Text>
                <Text style={styles.gameOverText}>You reached level {level}</Text>
                <Text style={styles.gameOverSubtext}>
                  {level >= bestScore ? '🎉 New High Score!' : `Best: Level ${bestScore}`}
                </Text>
                {savingScore && (
                  <Text style={styles.savingText}>Saving score...</Text>
                )}
                <TouchableOpacity style={styles.viewLbBtn} onPress={handleOpenLeaderboard}>
                  <Ionicons name="trophy-outline" size={16} color={Colors.yellow} />
                  <Text style={styles.viewLbBtnText}>View Leaderboard</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                  <LinearGradient colors={[Colors.green, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                    <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionButtonText}>Play Again</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleHome} activeOpacity={0.8}>
                  <LinearGradient colors={[Colors.purple, Colors.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                    <Ionicons name="home" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionButtonText}>Home</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Start screen */}
          {!gameStarted && !gameOver && !showQuitScore && (
            <View style={styles.controlsContainer}>
              <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                <LinearGradient colors={[Colors.purple, Colors.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startButton}>
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
              <Text style={styles.instructionText}>• Repeat the sequence by tapping the colors in order</Text>
              <Text style={styles.instructionText}>• Each level adds one more color to remember</Text>
              <Text style={styles.instructionText}>• The game gets faster as you progress</Text>
              <Text style={styles.instructionText}>• Make a mistake and it's game over!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Leaderboard modal */}
      {renderLeaderboard()}
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scrollView:   { flex: 1 },
  scrollContent:{ flexGrow: 1 },
  content:      { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 40 },

  headerContainer: { marginBottom: 20 },
  quitButton:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 20 },
  quitButtonText:  { color: Colors.textPrimary, fontSize: 16, fontWeight: '600', marginLeft: 8 },
  header:          { alignItems: 'center', marginBottom: 10 },
  headerWithButton:{ marginBottom: 0 },
  title:           { fontSize: 48, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  subtitle:        { fontSize: 18, color: Colors.textSecondary },

  scoreBoard:       { flexDirection: 'row', backgroundColor: Colors.cardBg, borderRadius: 20, padding: 20, marginBottom: 30, alignItems: 'center', gap: 8 },
  scoreItem:        { flex: 1, alignItems: 'center' },
  scoreLabel:       { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  scoreValue:       { fontSize: 36, fontWeight: '700', color: Colors.textPrimary },
  highScoreValue:   { color: Colors.yellow },
  savingIndicator:  { fontSize: 20, color: Colors.green },
  iconBtn:          { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  trophyBtn:        { backgroundColor: 'rgba(255,193,7,0.2)' },

  statusContainer: { alignItems: 'center', marginBottom: 30, minHeight: 40 },
  statusText:      { fontSize: 24, fontWeight: '600', color: Colors.textPrimary },

  gameBoard:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 30 },
  buttonContainer: { width: (width - 68) / 2, aspectRatio: 1 },
  colorButton:     { flex: 1, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  buttonDisabled:  { opacity: 0.7 },

  controlsContainer: { alignItems: 'center', marginBottom: 20 },

  gameOverCard:    { backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 20, borderWidth: 2, borderColor: Colors.red, padding: 24, marginBottom: 24, alignItems: 'center', width: '100%', gap: 6 },
  gameOverTitle:   { fontSize: 32, fontWeight: '700', color: Colors.textPrimary },
  gameOverText:    { fontSize: 20, color: Colors.redActive },
  gameOverSubtext: { fontSize: 16, color: Colors.textSecondary },
  savingText:      { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
  viewLbBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,193,7,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, marginTop: 6 },
  viewLbBtnText:   { fontSize: 14, fontWeight: '700', color: Colors.yellow },

  quitScoreCard:   { backgroundColor: 'rgba(59,130,246,0.2)', borderRadius: 20, borderWidth: 2, borderColor: Colors.blue, padding: 24, marginBottom: 24, alignItems: 'center', width: '100%' },
  quitScoreTitle:  { fontSize: 32, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  quitScoreText:   { fontSize: 20, color: Colors.blueActive, marginBottom: 4 },
  quitScoreSubtext:{ fontSize: 16, color: Colors.textSecondary, marginTop: 8 },

  buttonRow:       { flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'center' },
  actionButton:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6, gap: 8 },
  actionButtonText:{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  startButton:     { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 30 },
  startButtonText: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },

  instructions:      { backgroundColor: Colors.cardBg, borderRadius: 20, padding: 20 },
  instructionsTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  instructionText:   { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, lineHeight: 20 },

  // ── Leaderboard modal ──────────────────────────────────────────────────────
  lbOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  lbModal:   { backgroundColor: '#1A1A2E', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  lbHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lbTitle:   { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  lbSubtitle:{ fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  lbLoader:  { alignItems: 'center', paddingVertical: 40, gap: 12 },
  lbLoaderText: { color: Colors.textSecondary, fontSize: 14 },
  lbEmpty:   { alignItems: 'center', paddingVertical: 40 },
  lbEmptyText: { color: Colors.textSecondary, fontSize: 15 },

  lbRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, marginBottom: 8 },
  lbRowMe:   { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: Colors.green },
  lbRankWrap:{ width: 32, alignItems: 'center' },
  lbMedal:   { fontSize: 22 },
  lbRankNum: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  lbAvatar:  { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lbAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  lbName:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  lbDate:    { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  lbScorePill:    { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  lbScorePillGold:{ backgroundColor: 'rgba(255,193,7,0.2)' },
  lbScoreText:    { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },

  lbMyRankNote: { backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 },
  lbMyRankText: { fontSize: 13, fontWeight: '600', color: Colors.yellow },
  lbLoginHint:  { textAlign: 'center', color: Colors.textSecondary, fontSize: 12, marginTop: 12, fontStyle: 'italic' },

  lbCloseBtn:     { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  lbCloseBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
});