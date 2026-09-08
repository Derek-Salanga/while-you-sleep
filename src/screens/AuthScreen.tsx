import React, { useMemo, useState } from 'react';
import {
  Text,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Stage = 'enterEmail' | 'enterCode';

export default function AuthScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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

  // Supabase collapses several distinct failures into verifyOtp's error, and
  // the raw string ("Token has expired or is invalid") makes an expired code
  // look like a mistyped one -- so people re-read a code that was never
  // wrong instead of tapping Resend.
  //
  // Matched on the message rather than a code because Supabase does not give
  // these distinct error codes on this endpoint. If a future version does,
  // switch to it; until then an unrecognised message falls through to the
  // generic branch rather than being guessed at.
  function describeVerifyError(message: string): {
    title: string;
    body: string;
  } {
    const m = message.toLowerCase();
    if (m.includes('expired')) {
      return {
        title: 'That code has expired',
        body: 'Codes are only good for a few minutes. Tap Resend code for a fresh one.',
      };
    }
    if (m.includes('rate limit') || m.includes('too many')) {
      return {
        title: 'Too many attempts',
        body: 'Wait a minute before trying again.',
      };
    }
    return { title: 'Invalid code', body: message };
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
      const { title, body } = describeVerifyError(err.message ?? '');
      Alert.alert(title, body);
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

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xxl,
      color: t.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textMuted,
      textAlign: 'center',
      marginBottom: 32,
    },
    linkButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    linkButtonText: {
      fontFamily: fonts.bodyMedium,
      color: t.accent,
      fontSize: fontSizes.sm,
    },
    pressed: {
      opacity: 0.7,
    },
  });
