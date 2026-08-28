import React, { useState } from 'react';
import {
  Text,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

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
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen padding={24} centered>
        <Text style={styles.title}>While You Sleep</Text>
        <Text style={styles.subtitle}>
          {stage === 'enterEmail'
            ? 'Sign in with your email to get started.'
            : `Enter the code we sent to ${email.trim()}`}
        </Text>

        {stage === 'enterEmail' ? (
          <>
            <Input
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            <Button
              title="Send code"
              onPress={handleSendCode}
              loading={busy}
              disabled={busy || !email.trim()}
            />
          </>
        ) : (
          <>
            <Input
              centered
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            <Button
              title="Verify & sign in"
              onPress={handleVerifyCode}
              loading={busy}
              disabled={busy || code.trim().length < 6}
            />
            <Pressable
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
              ]}
              onPress={handleResend}
              disabled={busy}
            >
              <Text style={styles.linkButtonText}>Resend code</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
              ]}
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
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
    fontSize: fontSizes.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
