import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

type Stage = 'enterEmail' | 'enterCode';

export default function AuthScreen() {
  const [stage, setStage] = useState<Stage>('enterEmail');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSendCode() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          // No emailRedirectTo — we're using the 6-digit code flow, not a
          // deep-linked magic link, so no URL scheme config is needed.
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setStage('enterCode');
    } catch (err: any) {
      Alert.alert('Could not send code', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !code.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmed,
        token: code.trim(),
        type: 'email',
      });
      if (error) throw error;
      // On success, PairingContext's onAuthStateChange listener picks up
      // the new session automatically — no manual navigation needed.
    } catch (err: any) {
      Alert.alert('Invalid code', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setCode('');
    await handleSendCode();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>While You Sleep</Text>
      <Text style={styles.subtitle}>
        {stage === 'enterEmail'
          ? 'Sign in with your email to get started.'
          : `Enter the code we sent to ${email.trim()}`}
      </Text>

      {stage === 'enterEmail' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={handleSendCode}
            disabled={busy || !email.trim()}
          >
            {busy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>Send code</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="123456"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={handleVerifyCode}
            disabled={busy || code.trim().length < 6}
          >
            {busy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>Verify & sign in</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={handleResend}
            disabled={busy}
          >
            <Text style={styles.linkButtonText}>Resend code</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={() => {
              setStage('enterEmail');
              setCode('');
            }}
            disabled={busy}
          >
            <Text style={styles.linkButtonText}>Use a different email</Text>
          </Pressable>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xxl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
    marginBottom: 16,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: fontSizes.lg,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
    fontSize: fontSizes.sm,
  },
});
