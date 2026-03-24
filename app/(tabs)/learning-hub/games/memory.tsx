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
const GAME_NAME   = 'memory_game';
const DAILY_LIMIT = 3;

type GameColor = 'red' | 'blue' | 'green' | 'yellow';

/** Returns today's date as YYYY-MM-DD in LOCAL time */
function getLocalToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

  const [sequence, setSequence]             = useState<GameColor[]>([]);
  const [playerSequence, setPlayerSequence] = useState<GameColor[]>([]);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [isPlayerTurn, setIsPlayerTurn]     = useState(false);
  const [activeColor, setActiveColor]       = useState<GameColor | null>(null);
  const [level, setLevel]                   = useState(1);
  const [gameOver, setGameOver]             = useState(false);
  const [highScore, setHighScore]           = useState(0);
  const [dbHighScore, setDbHighScore]       = useState(0);
  const [vibrationOn, setVibrationOn]       = useState(true);
  const [gameStarted, setGameStarted]       = useState(false);
  const [showQuitScore, setShowQuitScore]   = useState(false);
  const [quitScore, setQuitScore]           = useState(0);
  const [savingScore, setSavingScore]       = useState(false);

  // Daily limit
  const [playsToday, setPlaysToday]         = useState(0);
  const [loadingPlays, setLoadingPlays]     = useState(true);

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

  useEffect(() => {
    if (user?.id) {
      loadDbHighScore();
      loadDailyPlays();
    } else {
      setLoadingPlays(false);
    }
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
        setHighScore(data.score);
      }
    } catch (e) { console.error('loadDbHighScore:', e); }
  };

  /** Count how many games this user has played today. */
  const loadDailyPlays = async () => {
    if (!user?.id) return;
    try {
      setLoadingPlays(true);
      const today = getLocalToday();

      // Try session_date column first
      const { data, error } = await supabase
        .from('game_scores')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('game_name', GAME_NAME)
        .eq('session_date', today);

      if (error) {
        // Fallback: use created_at range
        const { count } = await supabase
          .from('game_scores')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('game_name', GAME_NAME)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);
        setPlaysToday(count ?? 0);
      } else {
        setPlaysToday(data?.length ?? 0);
      }
    } catch (e) {
      console.error('loadDailyPlays:', e);
    } finally {
      setLoadingPlays(false);
    }
  };

  /**
   * Always saves the score (not just personal bests) so daily play count
   * is accurate. The leaderboard already deduplicates by best score per user.
   */
  const saveScore = async (score: number) => {
    if (!user?.id) return;
    try {
      setSavingScore(true);
      const today = getLocalToday();
      const { error } = await supabase
        .from('game_scores')
        .insert({ user_id: user.id, game_name: GAME_NAME, score, session_date: today });

      if (error) {
        // session_date column might not exist yet — insert without it
        if (error.message?.includes('session_date')) {
          await supabase.from('game_scores').insert({
            user_id: user.id, game_name: GAME_NAME, score,
          });
        } else {
          throw error;
        }
      }

      // Update local personal best
      if (score > Math.max(dbHighScore, highScore)) setDbHighScore(score);

      // Increment daily play count immediately (no refetch needed)
      setPlaysToday(p => p + 1);
    } catch (e) {
      console.error('saveScore:', e);
    } finally {
      setSavingScore(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      const { data: scores, error: scoresErr } = await supabase
        .from('game_scores')
        .select('user_id, score, created_at')
        .eq('game_name', GAME_NAME)
        .order('score', { ascending: false })
        .limit(200);
      if (scoresErr) throw scoresErr;

      const best: Record<string, { user_id: string; score: number; created_at: string }> = {};
      for (const row of scores || []) {
        if (!best[row.user_id] || row.score > best[row.user_id].score)
          best[row.user_id] = row;
      }
      const sorted = Object.values(best).sort((a, b) => b.score - a.score);
      const top10  = sorted.slice(0, 10);
      if (!top10.length) { setLeaderboard([]); setMyRank(null); return; }

      const userIds = top10.map(r => r.user_id);
      const { data: userRows, error: usersErr } = await supabase
        .from('users').select('id, name').in('id', userIds);
      if (usersErr) throw usersErr;

      const nameMap: Record<string, string> = {};
      for (const u of userRows || []) nameMap[u.id] = u.name || 'Unknown';

      const entries: LeaderEntry[] = top10.map((row, i) => ({
        rank: i + 1, user_id: row.user_id,
        name: nameMap[row.user_id] || 'Unknown',
        score: row.score, achieved_at: row.created_at,
        isMe: row.user_id === user?.id,
      }));
      setLeaderboard(entries);

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

  // ─── Game logic ───────────────────────────────────────────────────────────

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
    if (playsToday >= DAILY_LIMIT) return;
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
      setGameOver(true);
      setIsPlayerTurn(false);
      if (vibrationOn) Vibration.vibrate([0, 100, 100, 100]);
      const finalScore = level;
      if (finalScore > highScore) setHighScore(finalScore);
      saveScore(finalScore);
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
    saveScore(score);
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

  const bestScore      = Math.max(highScore, dbHighScore);
  const playsLeft      = Math.max(0, DAILY_LIMIT - playsToday);
  const isLimitReached = playsToday >= DAILY_LIMIT;

  // ─── Leaderboard modal ────────────────────────────────────────────────────

  const renderLeaderboard = () => (
    <Modal visible={showLeaderboard} transparent animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
      <View style={styles.lbOverlay}>
        <View style={styles.lbModal}>
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
                <View key={entry.user_id} style={[styles.lbRow, entry.isMe && styles.lbRowMe]}>
                  <View style={styles.lbRankWrap}>
                    {entry.rank <= 3 ? (
                      <Text style={styles.lbMedal}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                      </Text>
                    ) : (
                      <Text style={styles.lbRankNum}>#{entry.rank}</Text>
                    )}
                  </View>
                  <View style={[styles.lbAvatar, entry.isMe && { backgroundColor: Colors.green }]}>
                    <Text style={styles.lbAvatarText}>{entry.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lbName, entry.isMe && { color: Colors.green }]}>
                      {entry.name}{entry.isMe ? ' (You)' : ''}
                    </Text>
                    <Text style={styles.lbDate}>
                      {new Date(entry.achieved_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.lbScorePill, entry.rank === 1 && styles.lbScorePillGold]}>
                    <Text style={[styles.lbScoreText, entry.rank === 1 && { color: '#B8860B' }]}>
                      Lvl {entry.score}
                    </Text>
                  </View>
                </View>
              ))}
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

          {/* Score board */}
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
            <TouchableOpacity style={styles.iconBtn} onPress={() => setVibrationOn(v => !v)}>
              <Ionicons
                name={vibrationOn ? 'phone-portrait' : 'phone-portrait-outline'}
                size={22} color={Colors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, styles.trophyBtn]} onPress={handleOpenLeaderboard}>
              <Ionicons name="trophy-outline" size={22} color={Colors.yellow} />
            </TouchableOpacity>
          </View>

          {/* Daily plays banner — hidden while a game is active */}
          {!gameStarted && (
            <View style={[styles.dailyBanner, isLimitReached && styles.dailyBannerEmpty]}>
              <Ionicons
                name={isLimitReached ? 'time-outline' : 'game-controller-outline'}
                size={18}
                color={isLimitReached ? '#EF4444' : Colors.green}
              />
              {loadingPlays ? (
                <ActivityIndicator size="small" color={Colors.green} style={{ marginLeft: 8 }} />
              ) : isLimitReached ? (
                <Text style={[styles.dailyBannerText, { color: '#EF4444' }]}>
                  No plays left today — come back tomorrow!
                </Text>
              ) : (
                <Text style={styles.dailyBannerText}>
                  {playsLeft} of {DAILY_LIMIT} {playsLeft === 1 ? 'play' : 'plays'} remaining today
                </Text>
              )}
              {/* Pip indicators */}
              {!loadingPlays && (
                <View style={styles.pipRow}>
                  {Array.from({ length: DAILY_LIMIT }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.pip,
                        i < playsToday ? styles.pipUsed : styles.pipAvail,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

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
                {!isLimitReached ? (
                  <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                    <LinearGradient colors={[Colors.green, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                      <Ionicons name="play" size={20} color={Colors.textPrimary} />
                      <Text style={styles.actionButtonText}>New Game</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.actionButton, styles.actionButtonDisabled]}>
                    <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                    <Text style={[styles.actionButtonText, { color: Colors.textSecondary }]}>No Plays Left</Text>
                  </View>
                )}
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
                {savingScore && <Text style={styles.savingText}>Saving score...</Text>}
                {/* Plays remaining after this game */}
                <View style={[styles.playsLeftPill, isLimitReached && styles.playsLeftPillEmpty]}>
                  <Ionicons
                    name={isLimitReached ? 'lock-closed-outline' : 'game-controller-outline'}
                    size={14}
                    color={isLimitReached ? '#EF4444' : Colors.green}
                  />
                  <Text style={[styles.playsLeftText, isLimitReached && { color: '#EF4444' }]}>
                    {isLimitReached
                      ? 'No plays left today'
                      : `${playsLeft} play${playsLeft !== 1 ? 's' : ''} left today`}
                  </Text>
                </View>
                <TouchableOpacity style={styles.viewLbBtn} onPress={handleOpenLeaderboard}>
                  <Ionicons name="trophy-outline" size={16} color={Colors.yellow} />
                  <Text style={styles.viewLbBtnText}>View Leaderboard</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.buttonRow}>
                {!isLimitReached ? (
                  <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                    <LinearGradient colors={[Colors.green, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                      <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
                      <Text style={styles.actionButtonText}>Play Again</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.actionButton, styles.actionButtonDisabled]}>
                    <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                    <Text style={[styles.actionButtonText, { color: Colors.textSecondary }]}>No Plays Left</Text>
                  </View>
                )}
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
              {isLimitReached ? (
                <View style={styles.limitReachedCard}>
                  <Text style={styles.limitReachedEmoji}>🔒</Text>
                  <Text style={styles.limitReachedTitle}>Daily Limit Reached</Text>
                  <Text style={styles.limitReachedSub}>
                    You've used all {DAILY_LIMIT} plays for today.{'\n'}Come back tomorrow for more!
                  </Text>
                  <TouchableOpacity style={styles.viewLbBtn} onPress={handleOpenLeaderboard}>
                    <Ionicons name="trophy-outline" size={16} color={Colors.yellow} />
                    <Text style={styles.viewLbBtnText}>View Leaderboard</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={startGame} activeOpacity={0.8} disabled={loadingPlays}>
                  <LinearGradient
                    colors={loadingPlays ? ['#555', '#444'] : [Colors.purple, Colors.pink]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.startButton}
                  >
                    <Text style={styles.startButtonText}>
                      {loadingPlays ? 'Loading...' : 'Start Game'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
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
              <Text style={[styles.instructionText, { color: Colors.yellow, marginTop: 4 }]}>
                ⚡ You have {DAILY_LIMIT} plays per day — use them wisely!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

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

  scoreBoard:      { flexDirection: 'row', backgroundColor: Colors.cardBg, borderRadius: 20, padding: 20, marginBottom: 16, alignItems: 'center', gap: 8 },
  scoreItem:       { flex: 1, alignItems: 'center' },
  scoreLabel:      { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  scoreValue:      { fontSize: 36, fontWeight: '700', color: Colors.textPrimary },
  highScoreValue:  { color: Colors.yellow },
  savingIndicator: { fontSize: 20, color: Colors.green },
  iconBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  trophyBtn:       { backgroundColor: 'rgba(255,193,7,0.2)' },

  // Daily plays banner
  dailyBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, flexWrap: 'wrap' },
  dailyBannerEmpty: { backgroundColor: 'rgba(239,68,68,0.12)' },
  dailyBannerText:  { fontSize: 13, fontWeight: '600', color: Colors.green, flex: 1 },
  pipRow:           { flexDirection: 'row', gap: 5 },
  pip:              { width: 10, height: 10, borderRadius: 5 },
  pipUsed:          { backgroundColor: 'rgba(239,68,68,0.6)' },
  pipAvail:         { backgroundColor: Colors.green },

  statusContainer: { alignItems: 'center', marginBottom: 30, minHeight: 40 },
  statusText:      { fontSize: 24, fontWeight: '600', color: Colors.textPrimary },

  gameBoard:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 30 },
  buttonContainer: { width: (width - 68) / 2, aspectRatio: 1 },
  colorButton:     { flex: 1, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  buttonDisabled:  { opacity: 0.7 },

  controlsContainer: { alignItems: 'center', marginBottom: 20, width: '100%' },

  // Limit reached card (start screen)
  limitReachedCard:  { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', padding: 28, alignItems: 'center', gap: 8, width: '100%', marginBottom: 16 },
  limitReachedEmoji: { fontSize: 40 },
  limitReachedTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  limitReachedSub:   { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Plays left pill (game over card)
  playsLeftPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  playsLeftPillEmpty: { backgroundColor: 'rgba(239,68,68,0.15)' },
  playsLeftText:      { fontSize: 13, fontWeight: '600', color: Colors.green },

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

  buttonRow:            { flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'center' },
  actionButton:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6, gap: 8 },
  actionButtonDisabled: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 25, gap: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  actionButtonText:     { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  startButton:          { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 30 },
  startButtonText:      { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },

  instructions:      { backgroundColor: Colors.cardBg, borderRadius: 20, padding: 20 },
  instructionsTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  instructionText:   { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, lineHeight: 20 },

  // Leaderboard modal
  lbOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  lbModal:      { backgroundColor: '#1A1A2E', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  lbHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lbTitle:      { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  lbSubtitle:   { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  lbLoader:     { alignItems: 'center', paddingVertical: 40, gap: 12 },
  lbLoaderText: { color: Colors.textSecondary, fontSize: 14 },
  lbEmpty:      { alignItems: 'center', paddingVertical: 40 },
  lbEmptyText:  { color: Colors.textSecondary, fontSize: 15 },
  lbRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, marginBottom: 8 },
  lbRowMe:      { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: Colors.green },
  lbRankWrap:   { width: 32, alignItems: 'center' },
  lbMedal:      { fontSize: 22 },
  lbRankNum:    { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  lbAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lbAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  lbName:       { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  lbDate:       { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  lbScorePill:      { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  lbScorePillGold:  { backgroundColor: 'rgba(255,193,7,0.2)' },
  lbScoreText:      { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  lbMyRankNote:     { backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 },
  lbMyRankText:     { fontSize: 13, fontWeight: '600', color: Colors.yellow },
  lbLoginHint:      { textAlign: 'center', color: Colors.textSecondary, fontSize: 12, marginTop: 12, fontStyle: 'italic' },
  lbCloseBtn:       { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  lbCloseBtnText:   { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
});