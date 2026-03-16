import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';
import { supabase } from '../../../lib/supabase';
import { passwordResetFlag } from '../../../lib/passwordResetFlag';

type Step = 'email' | 'otp' | 'newPassword';

const OTP_LENGTH = 6;

const STEPS: Step[] = ['email', 'otp', 'newPassword'];

export default function ForgotPassword() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const otpRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  const currentStepIndex = STEPS.indexOf(step);

  const recoverySession = useRef<{ access_token: string; refresh_token: string } | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function goBack() {
    if (step === 'email') {
      router.back();
    } else if (step === 'otp') {
      setStep('email');
    } else {
      setStep('otp');
    }
  }

  function isStepDone(index: number) {
    return index < currentStepIndex;
  }

  // ── Step 1: Send OTP ─────────────────────────────────────────────────────────

  async function handleSendOtp() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) { Alert.alert('Error', 'Please enter your email address.'); return; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) { Alert.alert('Error', 'Please enter a valid email address.'); return; }

    try {
      setIsLoading(true);

      // ✅ resetPasswordForEmail sends a RECOVERY OTP, not a login OTP
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) throw error;

      setStep('otp');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────────

  async function handleVerifyOtp() {
    const token = otp.join('');
    if (token.length < OTP_LENGTH) { Alert.alert('Error', 'Please enter the complete 6-digit OTP.'); return; }

    try {
      setIsLoading(true);

      // ✅ type: 'recovery' — Supabase returns a session but fires PASSWORD_RECOVERY
      //    event, NOT SIGNED_IN, so AuthContext won't redirect to home
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'recovery',   // 🔑 was 'email' — that's what caused the auto-login
      });
      if (error) throw error;

      setStep('newPassword');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 3: Update Password ──────────────────────────────────────────────────

  async function handleUpdatePassword() {
    if (!password) { Alert.alert('Error', 'Please enter a new password.'); return; }
    if (password.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters long.'); return; }
    if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match.'); return; }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Sign out cleanly so user lands on login screen
      await supabase.auth.signOut();

      Alert.alert('Success', 'Your password has been reset successfully.', [
        { text: 'Login', onPress: () => router.replace('/') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── OTP Digit Input ──────────────────────────────────────────────────────────

  function handleOtpChange(value: string, index: number) {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...otp];
    updated[index] = digit;
    setOtp(updated);

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    setOtp(Array(OTP_LENGTH).fill(''));
    otpRefs.current[0]?.focus();
    await handleSendOtp();
  }

  // ── UI Meta per Step ─────────────────────────────────────────────────────────

  const stepMeta: Record<Step, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string }> = {
    email: {
      icon: 'lock-closed-outline',
      title: 'Forgot Password?',
      subtitle: "Enter your registered email and we'll send a 6-digit OTP to reset your password.",
    },
    otp: {
      icon: 'mail-open-outline',
      title: 'Check Your Email',
      subtitle: `We sent a 6-digit code to\n${email.trim()}`,
    },
    newPassword: {
      icon: 'shield-checkmark-outline',
      title: 'New Password',
      subtitle: 'Create a strong new password for your account.',
    },
  };

  const { icon, title, subtitle } = stepMeta[step];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Background>
      <View style={styles.container}>

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>

        {/* Step Progress */}
        <View style={styles.stepsRow}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  isStepDone(i) && styles.stepDotDone,
                  step === s && styles.stepDotActive,
                ]}
              />
              {i < STEPS.length - 1 && (
                <View style={[styles.stepLine, isStepDone(i) && styles.stepLineDone]} />
              )}
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {/* ── STEP 1: Email ── */}
        {step === 'email' && (
          <View style={styles.form}>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.buttonText}>Send OTP</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.back()}
              disabled={isLoading}
            >
              <Ionicons name="arrow-back" size={16} color={Colors.primary} />
              <Text style={styles.linkText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === 'otp' && (
          <View style={styles.form}>
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { otpRefs.current[i] = r; }}
                  style={[styles.otpBox, !!digit && styles.otpBoxFilled]}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(v, i)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  editable={!isLoading}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.buttonText}>Verify OTP</Text>
              }
            </TouchableOpacity>

            <View style={styles.linkRow}>
              <Text style={styles.mutedText}>Didn't receive the code? </Text>
              <TouchableOpacity onPress={handleResend} disabled={isLoading}>
                <Text style={styles.linkText}>Resend</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 3: New Password ── */}
        {step === 'newPassword' && (
          <View style={styles.form}>
            {/* New Password */}
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor={Colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
                autoFocus
              />
              <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textLight}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={Colors.textLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowConfirm((prev) => !prev)}>
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textLight}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>Password must be at least 8 characters.</Text>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleUpdatePassword}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.buttonText}>Reset Password</Text>
              }
            </TouchableOpacity>
          </View>
        )}

      </View>
    </Background>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  android: {
    elevation: 3,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
  },

  // Back button
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...shadow,
  },

  // Step progress
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textLight,
  },
  stepDotActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
  },
  stepDotDone: {
    backgroundColor: Colors.primary,
  },
  stepLine: {
    width: 48,
    height: 2,
    backgroundColor: Colors.textLight,
    marginHorizontal: 6,
  },
  stepLineDone: {
    backgroundColor: Colors.primary,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },

  // Form
  form: {
    gap: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...shadow,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textDark,
  },

  // Button
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 56,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },

  // Links
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  mutedText: {
    color: Colors.textLight,
    fontSize: 14,
  },

  // OTP
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.white,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textDark,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow,
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
  },

  // Hint
  hint: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: -4,
  },
});