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

function getLocalToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface LeaderEntry {
  rank: number;
  user_id: string;
  name: string;
  score: number;
  achieved_at: string;
  isMe: boolean;
}

// ─── Theme palette aligned with app's teal/green identity ────────────────────
const T = {
  primary:      '#4A9B7F',
  primaryLight: '#5DB89A',
  primaryDark:  '#3A7D66',
  accent:       '#7DD3C0',
  bg:           '#E8F7F4',
  bgDeep:       '#D4EFE9',
  white:        '#FFFFFF',
  textDark:     '#1A3A32',
  textMed:      '#2D5249',
  textLight:    '#5A7770',
  shadow:       'rgba(74,155,127,0.22)',
  card:         '#FFFFFF',
  // Game button colors — vivid & kid-friendly, teal-harmonious
  btnRed:       '#FF6B6B',
  btnRedOn:     '#FF9494',
  btnBlue:      '#5B9BD5',
  btnBlueOn:    '#88BDEE',
  btnGreen:     '#4A9B7F',
  btnGreenOn:   '#7DD3C0',
  btnYellow:    '#FFCA3A',
  btnYellowOn:  '#FFDF7E',
  // UI accents
  star:         '#FFCA3A',
  danger:       '#FF6B6B',
  dangerBg:     '#FFF0F0',
  successBg:    '#E8F7F4',
};

// ─── Decorative star shape ────────────────────────────────────────────────────
const StarBadge = ({ size = 32, color = T.star }: { size?: number; color?: string }) => (
  <Text style={{ fontSize: size, lineHeight: size + 4 }}>⭐</Text>
);

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

  const [dailyLimit, setDailyLimit]         = useState(3);
  const [playsToday, setPlaysToday]         = useState(0);
  const [loadingPlays, setLoadingPlays]     = useState(true);

  const [showLeaderboard, setShowLeaderboard]       = useState(false);
  const [leaderboard, setLeaderboard]               = useState<LeaderEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [myRank, setMyRank]                         = useState<number | null>(null);

  // Bounce animation for title
  const titleBounce = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(titleBounce, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(titleBounce, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

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
      if (data?.score) { setDbHighScore(data.score); setHighScore(data.score); }
    } catch (e) { console.error('loadDbHighScore:', e); }
  };

  const loadDailyPlays = async () => {
    if (!user?.id) return;
    try {
      setLoadingPlays(true);
      const today = getLocalToday();
      const { data: settings } = await supabase
        .from('game_settings').select('daily_limit').eq('game_name', GAME_NAME).maybeSingle();
      const limit = settings?.daily_limit ?? 3;
      setDailyLimit(limit);

      const { data, error } = await supabase
        .from('game_scores').select('id', { count: 'exact' })
        .eq('user_id', user.id).eq('game_name', GAME_NAME).eq('session_date', today);

      if (error) {
        const { count } = await supabase
          .from('game_scores').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('game_name', GAME_NAME)
          .gte('created_at', `${today}T00:00:00`).lte('created_at', `${today}T23:59:59`);
        setPlaysToday(count ?? 0);
      } else {
        setPlaysToday(data?.length ?? 0);
      }
    } catch (e) { console.error('loadDailyPlays:', e); }
    finally { setLoadingPlays(false); }
  };

  const saveScore = async (score: number) => {
    if (!user?.id) return;
    try {
      setSavingScore(true);
      const today = getLocalToday();
      const { error } = await supabase
        .from('game_scores').insert({ user_id: user.id, game_name: GAME_NAME, score, session_date: today });
      if (error) {
        if (error.message?.includes('session_date'))
          await supabase.from('game_scores').insert({ user_id: user.id, game_name: GAME_NAME, score });
        else throw error;
      }
      if (score > Math.max(dbHighScore, highScore)) setDbHighScore(score);
      setPlaysToday(p => p + 1);
    } catch (e) { console.error('saveScore:', e); }
    finally { setSavingScore(false); }
  };

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      const { data: scores, error: scoresErr } = await supabase
        .from('game_scores').select('user_id, score, created_at')
        .eq('game_name', GAME_NAME).order('score', { ascending: false }).limit(200);
      if (scoresErr) throw scoresErr;

      const best: Record<string, { user_id: string; score: number; created_at: string }> = {};
      for (const row of scores || []) {
        if (!best[row.user_id] || row.score > best[row.user_id].score) best[row.user_id] = row;
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
    } catch (e) { console.error('loadLeaderboard:', e); }
    finally { setLeaderboardLoading(false); }
  };

  const handleOpenLeaderboard = () => { setShowLeaderboard(true); loadLeaderboard(); };

  // ─── Game logic ───────────────────────────────────────────────────────────

  const vibrate = (color: GameColor) => {
    if (!vibrationOn) return;
    const patterns = { red: [0, 100], blue: [0, 50], green: [0, 30], yellow: [0, 70] };
    try { Vibration.vibrate(patterns[color]); } catch {}
  };

  const animateButton = (color: GameColor, active: boolean) => {
    Animated.sequence([
      Animated.timing(scaleAnimations[color], {
        toValue: active ? 0.88 : 1, duration: 140, useNativeDriver: true,
      }),
    ]).start();
  };

  const startGame = () => {
    if (isLimitReached) return;
    setGameStarted(true); setGameOver(false); setShowQuitScore(false);
    setLevel(1); setSequence([]); setPlayerSequence([]);
    nextLevel([]);
  };

  const nextLevel = (currentSequence: GameColor[]) => {
    const newColor    = colors[Math.floor(Math.random() * colors.length)];
    const newSequence = [...currentSequence, newColor];
    setSequence(newSequence);
    setIsPlaying(true); setIsPlayerTurn(false);
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
    setIsPlaying(false); setIsPlayerTurn(true);
  };

  const handleColorClick = (color: GameColor) => {
    if (!isPlayerTurn || isPlaying) return;
    const newSeq = [...playerSequence, color];
    setPlayerSequence(newSeq);
    setActiveColor(color); animateButton(color, true); vibrate(color);
    setTimeout(() => { setActiveColor(null); animateButton(color, false); }, 300);

    const idx = newSeq.length - 1;
    if (newSeq[idx] !== sequence[idx]) {
      setGameOver(true); setIsPlayerTurn(false);
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
    setShowQuitScore(true); setGameStarted(false); setGameOver(false);
    setIsPlaying(false); setIsPlayerTurn(false);
    setSequence([]); setPlayerSequence([]); setActiveColor(null);
  };

  const handleHome = () => {
    setGameStarted(false); setGameOver(false); setShowQuitScore(false);
    setLevel(1); setSequence([]); setPlayerSequence([]);
    setIsPlaying(false); setIsPlayerTurn(false); setActiveColor(null);
    router.push('/learning-hub');
  };

  const getButtonColors = (color: GameColor): [string, string] => {
    const isActive = activeColor === color;
    const map: Record<GameColor, [string, string]> = {
      red:    isActive ? [T.btnRedOn,    '#FFADAD'] : [T.btnRed,    '#FF4D4D'],
      blue:   isActive ? [T.btnBlueOn,   '#AACFF5'] : [T.btnBlue,   '#3D7BBF'],
      green:  isActive ? [T.btnGreenOn,  '#A0E8D8'] : [T.btnGreen,  '#3A7D66'],
      yellow: isActive ? [T.btnYellowOn, '#FFE99A'] : [T.btnYellow, '#E5A800'],
    };
    return map[color];
  };

  const getButtonEmoji = (color: GameColor) => {
    const map = { red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡' };
    return map[color];
  };

  const bestScore      = Math.max(highScore, dbHighScore);
  const playsLeft      = Math.max(0, dailyLimit - playsToday);
  const isLimitReached = playsToday >= dailyLimit;

  // ─── Leaderboard modal ────────────────────────────────────────────────────

  const renderLeaderboard = () => (
    <Modal visible={showLeaderboard} transparent animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
      <View style={s.lbOverlay}>
        <View style={s.lbModal}>
          {/* Handle bar */}
          <View style={s.lbHandle} />
          <View style={s.lbHeader}>
            <Text style={s.lbTitle}>🏆 Leaderboard</Text>
            <TouchableOpacity onPress={() => setShowLeaderboard(false)} style={s.lbCloseX} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={T.textMed} />
            </TouchableOpacity>
          </View>
          <Text style={s.lbSubtitle}>Memory Game — Top Scores</Text>

          {leaderboardLoading ? (
            <View style={s.lbLoader}>
              <ActivityIndicator size="large" color={T.primary} />
              <Text style={s.lbLoaderText}>Loading champions…</Text>
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={s.lbEmpty}>
              <Text style={{ fontSize: 48 }}>🎮</Text>
              <Text style={s.lbEmptyText}>No scores yet — be the first!</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {leaderboard.map(entry => (
                <View key={entry.user_id} style={[s.lbRow, entry.isMe && s.lbRowMe]}>
                  <View style={s.lbRankWrap}>
                    {entry.rank <= 3 ? (
                      <Text style={s.lbMedal}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                      </Text>
                    ) : (
                      <Text style={s.lbRankNum}>#{entry.rank}</Text>
                    )}
                  </View>
                  <View style={[s.lbAvatar, entry.isMe && { backgroundColor: T.primary }]}>
                    <Text style={s.lbAvatarText}>{entry.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.lbName, entry.isMe && { color: T.primary }]}>
                      {entry.name}{entry.isMe ? ' (You)' : ''}
                    </Text>
                    <Text style={s.lbDate}>
                      {new Date(entry.achieved_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[s.lbScorePill, entry.rank === 1 && s.lbScorePillGold]}>
                    <Text style={[s.lbScoreText, entry.rank === 1 && { color: '#B8860B' }]}>
                      Lvl {entry.score}
                    </Text>
                  </View>
                </View>
              ))}
              {myRank !== null && myRank > 10 && (
                <View style={s.lbMyRankNote}>
                  <Text style={s.lbMyRankText}>Your rank: #{myRank} · Best: Level {bestScore}</Text>
                </View>
              )}
              {!user && (
                <Text style={s.lbLoginHint}>Log in to save your score! 🌟</Text>
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={s.lbCloseBtn} onPress={() => setShowLeaderboard(false)} activeOpacity={0.8}>
            <LinearGradient colors={[T.primary, T.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.lbCloseBtnGrad}>
              <Text style={s.lbCloseBtnText}>Close</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* Soft layered background */}
      <LinearGradient colors={[T.bg, '#C8EDE6', T.bg]} style={StyleSheet.absoluteFill} />
      {/* Decorative blobs */}
      <View style={s.blobTopLeft} />
      <View style={s.blobBottomRight} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.content}>

          {/* ── Header ─────────────────────────────────────────── */}
          <View style={s.headerRow}>
            {gameStarted && !gameOver ? (
              <TouchableOpacity style={s.backBtn} onPress={handleQuit} activeOpacity={0.75}>
                <Ionicons name="arrow-back" size={20} color={T.primaryDark} />
                <Text style={s.backBtnText}>Quit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.backBtn} onPress={handleHome} activeOpacity={0.75}>
                <Ionicons name="arrow-back" size={20} color={T.primaryDark} />
              </TouchableOpacity>
            )}
            <View style={s.headerActions}>
              <TouchableOpacity style={s.iconPill} onPress={() => setVibrationOn(v => !v)} activeOpacity={0.75}>
                <Ionicons name={vibrationOn ? 'phone-portrait' : 'phone-portrait-outline'} size={18} color={T.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.iconPill, s.trophyPill]} onPress={handleOpenLeaderboard} activeOpacity={0.75}>
                <Ionicons name="trophy" size={18} color={T.btnYellow} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Title card ─────────────────────────────────────── */}
          <View style={s.titleCard}>
            <Animated.Text style={[s.titleEmoji, { transform: [{ scale: titleBounce }] }]}>🧠</Animated.Text>
            <Text style={s.titleText}>GuniTap</Text>
            <Text style={s.titleSub}>Memory Game</Text>
            <Text style={s.titleTagline}>Watch · Remember · Repeat!</Text>
          </View>

          {/* ── Score row ──────────────────────────────────────── */}
          <View style={s.scoreRow}>
            <View style={s.scoreCard}>
              <Text style={s.scoreEmoji}>🎯</Text>
              <Text style={s.scoreLabel}>Level</Text>
              <Text style={s.scoreValue}>{level}</Text>
            </View>
            <View style={[s.scoreCard, s.scoreCardBest]}>
              <Text style={s.scoreEmoji}>⭐</Text>
              <Text style={s.scoreLabel}>Best</Text>
              <Text style={[s.scoreValue, { color: T.primary }]}>
                {bestScore}
                {savingScore && <Text style={s.saving}> ↑</Text>}
              </Text>
            </View>
          </View>

          {/* ── Daily plays banner ─────────────────────────────── */}
          {!gameStarted && (
            <View style={[s.playsBanner, isLimitReached && s.playsBannerFull]}>
              <Ionicons
                name={isLimitReached ? 'lock-closed' : 'game-controller'}
                size={18}
                color={isLimitReached ? T.btnRed : T.primary}
              />
              {loadingPlays ? (
                <ActivityIndicator size="small" color={T.primary} style={{ marginLeft: 8 }} />
              ) : isLimitReached ? (
                <Text style={[s.playsText, { color: T.btnRed }]}>No plays left today!</Text>
              ) : (
                <Text style={s.playsText}>
                  {playsLeft} of {dailyLimit} plays left today
                </Text>
              )}
              {!loadingPlays && (
                <View style={s.pipRow}>
                  {Array.from({ length: dailyLimit }).map((_, i) => (
                    <View key={i} style={[s.pip, i < playsToday ? s.pipUsed : s.pipAvail]} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Status line ────────────────────────────────────── */}
          {gameStarted && !gameOver && (
            <View style={s.statusWrap}>
              <LinearGradient
                colors={isPlayerTurn ? [T.primaryLight, T.primary] : ['#B8E0D8', '#8ECDC2']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.statusPill}
              >
                <Text style={s.statusText}>
                  {isPlaying ? '👀  Watch carefully…' : isPlayerTurn ? '👆  Your turn!' : ''}
                </Text>
              </LinearGradient>
            </View>
          )}

          {/* ── Game board ─────────────────────────────────────── */}
          <View style={s.boardWrap}>
            {/* Decorative ring behind board */}
            <View style={s.boardRing} />
            <View style={s.gameBoard}>
              {colors.map(color => {
                const [colorTop, colorBot] = getButtonColors(color);
                const isActive = activeColor === color;
                return (
                  <Animated.View
                    key={color}
                    style={[s.btnWrap, { transform: [{ scale: scaleAnimations[color] }] }]}
                  >
                    <TouchableOpacity
                      onPress={() => handleColorClick(color)}
                      disabled={!isPlayerTurn || isPlaying}
                      activeOpacity={0.85}
                      style={[s.colorBtn, (!isPlayerTurn || isPlaying) && s.btnDisabled]}
                    >
                      <LinearGradient
                        colors={[colorTop, colorBot]}
                        start={{ x: 0.2, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={s.btnGrad}
                      >
                        {/* Shine overlay */}
                        <View style={[s.btnShine, isActive && { opacity: 0.5 }]} />
                        <Text style={s.btnEmoji}>{getButtonEmoji(color)}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* ── Quit score ─────────────────────────────────────── */}
          {showQuitScore && (
            <View style={s.resultCard}>
              <Text style={s.resultEmoji}>⏸️</Text>
              <Text style={s.resultTitle}>Game Paused</Text>
              <Text style={s.resultLevel}>Level {quitScore}</Text>
              <Text style={s.resultSub}>
                {quitScore >= bestScore ? '🎉 New High Score!' : 'Keep going to beat your record!'}
              </Text>
              <View style={s.btnRowCentered}>
                {!isLimitReached ? (
                  <TouchableOpacity onPress={startGame} activeOpacity={0.8} style={s.actionBtnTouch}>
                    <LinearGradient colors={[T.primaryLight, T.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.actionBtn}>
                      <Ionicons name="play" size={18} color={T.white} />
                      <Text style={s.actionBtnText}>New Game</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={[s.actionBtn, s.actionBtnGray]}>
                    <Ionicons name="lock-closed-outline" size={18} color={T.textLight} />
                    <Text style={[s.actionBtnText, { color: T.textLight }]}>No Plays Left</Text>
                  </View>
                )}
                <TouchableOpacity onPress={handleHome} activeOpacity={0.8} style={s.actionBtnTouch}>
                  <LinearGradient colors={['#7BB8F0', '#4A7FBE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.actionBtn}>
                    <Ionicons name="home" size={18} color={T.white} />
                    <Text style={s.actionBtnText}>Home</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Game over ──────────────────────────────────────── */}
          {gameOver && !showQuitScore && (
            <View style={[s.resultCard, s.resultCardOver]}>
              <Text style={s.resultEmoji}>😢</Text>
              <Text style={[s.resultTitle, { color: T.btnRed }]}>Oops!</Text>
              <Text style={s.resultLevel}>You reached Level {level}</Text>
              <Text style={s.resultSub}>
                {level >= bestScore ? '🎉 New High Score!' : `Best: Level ${bestScore}`}
              </Text>
              {savingScore && <Text style={s.savingTxt}>Saving score…</Text>}
              <View style={[s.playsLeftPill, isLimitReached && s.playsLeftPillFull]}>
                <Ionicons
                  name={isLimitReached ? 'lock-closed-outline' : 'game-controller-outline'}
                  size={13}
                  color={isLimitReached ? T.btnRed : T.primary}
                />
                <Text style={[s.playsLeftTxt, isLimitReached && { color: T.btnRed }]}>
                  {isLimitReached ? 'No plays left today' : `${playsLeft} play${playsLeft !== 1 ? 's' : ''} left today`}
                </Text>
              </View>
              <TouchableOpacity style={s.lbMiniBtn} onPress={handleOpenLeaderboard} activeOpacity={0.8}>
                <Ionicons name="trophy" size={14} color={T.btnYellow} />
                <Text style={s.lbMiniBtnText}>View Leaderboard</Text>
              </TouchableOpacity>
              <View style={s.btnRowCentered}>
                {!isLimitReached ? (
                  <TouchableOpacity onPress={startGame} activeOpacity={0.8} style={s.actionBtnTouch}>
                    <LinearGradient colors={[T.primaryLight, T.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.actionBtn}>
                      <Ionicons name="refresh" size={18} color={T.white} />
                      <Text style={s.actionBtnText}>Try Again</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={[s.actionBtn, s.actionBtnGray]}>
                    <Ionicons name="lock-closed-outline" size={18} color={T.textLight} />
                    <Text style={[s.actionBtnText, { color: T.textLight }]}>No Plays Left</Text>
                  </View>
                )}
                <TouchableOpacity onPress={handleHome} activeOpacity={0.8} style={s.actionBtnTouch}>
                  <LinearGradient colors={['#7BB8F0', '#4A7FBE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.actionBtn}>
                    <Ionicons name="home" size={18} color={T.white} />
                    <Text style={s.actionBtnText}>Home</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Start screen ───────────────────────────────────── */}
          {!gameStarted && !gameOver && !showQuitScore && (
            <View style={s.startSection}>
              {isLimitReached ? (
                <View style={s.limitCard}>
                  <Text style={{ fontSize: 48 }}>🔒</Text>
                  <Text style={s.limitTitle}>Daily Limit Reached!</Text>
                  <Text style={s.limitSub}>
                    You've used all {dailyLimit} plays today.{'\n'}Come back tomorrow for more fun! 🌟
                  </Text>
                  <TouchableOpacity style={s.lbMiniBtn} onPress={handleOpenLeaderboard} activeOpacity={0.8}>
                    <Ionicons name="trophy" size={14} color={T.btnYellow} />
                    <Text style={s.lbMiniBtnText}>View Leaderboard</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={startGame} activeOpacity={0.85} disabled={loadingPlays} style={s.startBtnTouch}>
                  <LinearGradient
                    colors={loadingPlays ? ['#ccc', '#bbb'] : [T.primaryLight, T.primaryDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.startBtn}
                  >
                    <Text style={s.startBtnEmoji}>🚀</Text>
                    <Text style={s.startBtnText}>{loadingPlays ? 'Loading…' : 'Start Game!'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Instructions ───────────────────────────────────── */}
          {!gameStarted && !showQuitScore && (
            <View style={s.howCard}>
              <View style={s.howHeader}>
                <Text style={{ fontSize: 20 }}>💡</Text>
                <Text style={s.howTitle}>How to Play</Text>
              </View>
              {[
                ['👀', 'Watch the color pattern light up'],
                ['👆', 'Tap the colors in the same order'],
                ['➕', 'Each level adds one more color'],
                ['⚡', 'Gets faster as you level up!'],
                ['❌', 'Wrong tap = game over'],
                ['🎮', `You get ${dailyLimit} plays per day — use them wisely!`],
              ].map(([icon, text], i) => (
                <View key={i} style={s.howRow}>
                  <Text style={s.howIcon}>{icon}</Text>
                  <Text style={s.howText}>{text}</Text>
                </View>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {renderLeaderboard()}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BOARD_PAD = 20;
const BTN_SIZE  = (width - BOARD_PAD * 2 - 20) / 2;

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: T.bg },
  scroll:      { flex: 1 },
  scrollContent:{ flexGrow: 1 },
  content:     { flex: 1, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingHorizontal: BOARD_PAD, paddingBottom: 48 },

  // Decorative blobs
  blobTopLeft:     { position: 'absolute', top: -80, left: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(125,211,192,0.25)' },
  blobBottomRight: { position: 'absolute', bottom: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(74,155,127,0.18)' },

  // Header
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, shadowColor: T.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 3 },
  backBtnText: { fontSize: 15, fontWeight: '700', color: T.primaryDark },
  headerActions:{ flexDirection: 'row', gap: 8 },
  iconPill:    { width: 40, height: 40, borderRadius: 20, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center', shadowColor: T.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 5, elevation: 3 },
  trophyPill:  { backgroundColor: '#FFF8E1' },

  // Title card
  titleCard:   { alignItems: 'center', backgroundColor: T.white, borderRadius: 28, paddingVertical: 20, paddingHorizontal: 16, marginBottom: 16, shadowColor: T.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6 },
  titleEmoji:  { fontSize: 44, marginBottom: 4 },
  titleText:   { fontSize: 30, fontWeight: '900', color: T.primaryDark, letterSpacing: 0.5 },
  titleSub:    { fontSize: 16, fontWeight: '700', color: T.primary, marginTop: 2 },
  titleTagline:{ fontSize: 13, color: T.textLight, marginTop: 4 },

  // Scores
  scoreRow:    { flexDirection: 'row', gap: 12, marginBottom: 14 },
  scoreCard:   { flex: 1, backgroundColor: T.white, borderRadius: 20, paddingVertical: 14, alignItems: 'center', shadowColor: T.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  scoreCardBest:{ borderWidth: 2, borderColor: T.accent },
  scoreEmoji:  { fontSize: 20, marginBottom: 4 },
  scoreLabel:  { fontSize: 12, fontWeight: '600', color: T.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  scoreValue:  { fontSize: 32, fontWeight: '900', color: T.textDark, marginTop: 2 },
  saving:      { fontSize: 16, color: T.primary },

  // Daily plays
  playsBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8F7F4', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14, flexWrap: 'wrap', borderWidth: 1.5, borderColor: T.accent },
  playsBannerFull: { backgroundColor: '#FFF0F0', borderColor: T.btnRed },
  playsText:       { fontSize: 13, fontWeight: '700', color: T.primary, flex: 1 },
  pipRow:          { flexDirection: 'row', gap: 5 },
  pip:             { width: 10, height: 10, borderRadius: 5 },
  pipUsed:         { backgroundColor: T.btnRed },
  pipAvail:        { backgroundColor: T.primary },

  // Status
  statusWrap: { alignItems: 'center', marginBottom: 16 },
  statusPill: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 25, minWidth: 200, alignItems: 'center' },
  statusText: { fontSize: 17, fontWeight: '800', color: T.white, letterSpacing: 0.3 },

  // Board
  boardWrap:   { alignItems: 'center', marginBottom: 20 },
  boardRing:   { position: 'absolute', width: BTN_SIZE * 2 + 36, height: BTN_SIZE * 2 + 36, borderRadius: (BTN_SIZE * 2 + 36) / 2, borderWidth: 4, borderColor: 'rgba(74,155,127,0.2)', top: (BTN_SIZE * 2 + 20 - (BTN_SIZE * 2 + 36)) / 2 + 10, alignSelf: 'center' },
  gameBoard:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, padding: 4 },
  btnWrap:     { width: BTN_SIZE, height: BTN_SIZE },
  colorBtn:    { flex: 1, borderRadius: 24, overflow: 'hidden', shadowColor: 'rgba(0,0,0,0.18)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 10, elevation: 8 },
  btnGrad:     { flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnShine:    { position: 'absolute', top: 8, left: 12, width: '40%', height: '28%', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.45)' },
  btnEmoji:    { fontSize: 40, opacity: 0.5 },
  btnDisabled: { opacity: 0.65 },

  // Result cards
  resultCard:    { backgroundColor: T.white, borderRadius: 28, padding: 24, marginBottom: 16, alignItems: 'center', gap: 6, shadowColor: T.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6, borderWidth: 2, borderColor: T.accent },
  resultCardOver:{ borderColor: T.btnRed + '60' },
  resultEmoji:   { fontSize: 48 },
  resultTitle:   { fontSize: 28, fontWeight: '900', color: T.primaryDark },
  resultLevel:   { fontSize: 18, fontWeight: '700', color: T.primary },
  resultSub:     { fontSize: 14, color: T.textLight, textAlign: 'center' },
  savingTxt:     { fontSize: 12, color: T.textLight, fontStyle: 'italic' },

  playsLeftPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.successBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  playsLeftPillFull:{ backgroundColor: T.dangerBg },
  playsLeftTxt:     { fontSize: 13, fontWeight: '600', color: T.primary },

  lbMiniBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF8E1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, marginTop: 4 },
  lbMiniBtnText: { fontSize: 13, fontWeight: '700', color: '#B8860B' },

  btnRowCentered: { flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'center' },
  actionBtnTouch: {},
  actionBtn:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 22, gap: 7, shadowColor: T.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 5 },
  actionBtnGray:  { backgroundColor: '#EEE', shadowOpacity: 0 },
  actionBtnText:  { fontSize: 15, fontWeight: '800', color: T.white },

  // Start screen
  startSection:  { alignItems: 'center', marginBottom: 16 },
  limitCard:     { backgroundColor: T.dangerBg, borderRadius: 24, borderWidth: 2, borderColor: T.btnRed + '50', padding: 28, alignItems: 'center', gap: 8, width: '100%' },
  limitTitle:    { fontSize: 20, fontWeight: '900', color: T.textDark, textAlign: 'center' },
  limitSub:      { fontSize: 14, color: T.textLight, textAlign: 'center', lineHeight: 22 },
  startBtnTouch: {},
  startBtn:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 44, paddingVertical: 18, borderRadius: 32, gap: 10, shadowColor: T.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 8 },
  startBtnEmoji: { fontSize: 24 },
  startBtnText:  { fontSize: 22, fontWeight: '900', color: T.white, letterSpacing: 0.3 },

  // How to play
  howCard:   { backgroundColor: T.white, borderRadius: 24, padding: 20, shadowColor: T.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  howHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  howTitle:  { fontSize: 18, fontWeight: '800', color: T.textDark },
  howRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  howIcon:   { fontSize: 16, width: 24 },
  howText:   { fontSize: 14, color: T.textMed, flex: 1, lineHeight: 20 },

  // Leaderboard
  lbOverlay:   { flex: 1, backgroundColor: 'rgba(26,58,50,0.5)', justifyContent: 'flex-end' },
  lbModal:     { backgroundColor: T.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  lbHandle:    { width: 44, height: 5, borderRadius: 3, backgroundColor: T.bgDeep, alignSelf: 'center', marginBottom: 16 },
  lbHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lbTitle:     { fontSize: 22, fontWeight: '900', color: T.textDark },
  lbCloseX:    { width: 32, height: 32, borderRadius: 16, backgroundColor: T.bgDeep, alignItems: 'center', justifyContent: 'center' },
  lbSubtitle:  { fontSize: 13, color: T.textLight, marginBottom: 18 },
  lbLoader:    { alignItems: 'center', paddingVertical: 40, gap: 12 },
  lbLoaderText:{ color: T.textLight, fontSize: 14 },
  lbEmpty:     { alignItems: 'center', paddingVertical: 40, gap: 10 },
  lbEmptyText: { color: T.textMed, fontSize: 15, fontWeight: '600' },
  lbRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.bg, borderRadius: 16, padding: 12, marginBottom: 8 },
  lbRowMe:     { backgroundColor: T.successBg, borderWidth: 1.5, borderColor: T.primary },
  lbRankWrap:  { width: 30, alignItems: 'center' },
  lbMedal:     { fontSize: 22 },
  lbRankNum:   { fontSize: 15, fontWeight: '700', color: T.textLight },
  lbAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: T.bgDeep, alignItems: 'center', justifyContent: 'center' },
  lbAvatarText:{ fontSize: 16, fontWeight: '800', color: T.primaryDark },
  lbName:      { fontSize: 14, fontWeight: '700', color: T.textDark },
  lbDate:      { fontSize: 11, color: T.textLight, marginTop: 2 },
  lbScorePill:     { backgroundColor: T.bgDeep, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 5 },
  lbScorePillGold: { backgroundColor: '#FFF8E1' },
  lbScoreText:     { fontSize: 13, fontWeight: '800', color: T.primaryDark },
  lbMyRankNote:    { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 6 },
  lbMyRankText:    { fontSize: 13, fontWeight: '600', color: '#B8860B' },
  lbLoginHint:     { textAlign: 'center', color: T.textLight, fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  lbCloseBtn:      { marginTop: 16, borderRadius: 18, overflow: 'hidden' },
  lbCloseBtnGrad:  { paddingVertical: 14, alignItems: 'center' },
  lbCloseBtnText:  { fontSize: 16, fontWeight: '800', color: T.white },
});