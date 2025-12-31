import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Platform,
  ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Background, { Colors } from '../../../components/Background';
import { supabase } from '../../../lib/supabase';

const ForgotPassword = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'your-app://reset-password', // Configure this based on your app
      });

      if (error) {
        console.error('Password reset error:', error);
        throw error;
      }

      Alert.alert(
        'Success',
        'Password reset link has been sent to your email. Please check your inbox.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to send reset email. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Background>
      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            No worries! Enter your email address and we'll send you a link to reset your password.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons 
              name="mail-outline" 
              size={20} 
              color={Colors.textLight} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={Colors.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
              autoFocus
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.back()}
            disabled={isLoading}
            style={styles.backToLoginContainer}
          >
            <Ionicons name="arrow-back" size={16} color={Colors.primary} />
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Background>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textDark,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
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
  backToLoginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  backToLoginText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ForgotPassword;