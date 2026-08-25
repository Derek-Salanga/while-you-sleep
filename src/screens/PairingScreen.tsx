import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

// Generates a short, human-friendly invite code, e.g. "SUNSET-42"
function generateInviteCode(): string {
  const words = ['SUNSET', 'HORIZON', 'MOONLIT', 'DAYBREAK', 'DUSK', 'DAWN'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${word}-${num}`;
}

export default function PairingScreen() {
  const { session, pair, refreshPair } = usePairing();
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  // If a pending invite already exists for this user (e.g. we created one,
  // then closed and reopened the app before our partner joined), show it
  // from persisted state rather than losing it on remount.
  const myCode =
    pair && !pair.user_b && pair.user_a === session?.user.id
      ? pair.invite_code
      : null;

  // Pick up a partner joining while we're sitting on the waiting screen.
  useFocusEffect(
    useCallback(() => {
      refreshPair();
    }, [refreshPair])
  );

  async function handleCreateInvite() {
    if (!session?.user) return;
    setBusy(true);
    try {
      const code = generateInviteCode();
      const { error } = await supabase.from('pairs').insert({
        user_a: session.user.id,
        user_b: null,
        invite_code: code,
      });
      if (error) throw error;
      await refreshPair();
    } catch (err: any) {
      Alert.alert('Could not create invite', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!session?.user || !inviteCode.trim()) return;
    setBusy(true);
    try {
      const { data: existingPair, error: findError } = await supabase
        .from('pairs')
        .select('*')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .is('user_b', null)
        .maybeSingle();

      if (findError) throw findError;
      if (!existingPair) {
        Alert.alert('Invite not found', 'Double-check the code and try again.');
        return;
      }

      const { error: updateError } = await supabase
        .from('pairs')
        .update({ user_b: session.user.id })
        .eq('id', existingPair.id);

      if (updateError) throw updateError;
      await refreshPair();
    } catch (err: any) {
      Alert.alert('Could not join', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>While You Sleep</Text>
      <Text style={styles.subtitle}>
        Pair with your partner to start sharing daily clips.
      </Text>

      {myCode ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your invite code</Text>
          <Text style={styles.code}>{myCode}</Text>
          <Text style={styles.helper}>
            Send this to your partner. Waiting for them to join…
          </Text>
        </View>
      ) : (
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={handleCreateInvite}
          disabled={busy}
        >
          <Text style={styles.primaryButtonText}>Create invite</Text>
        </Pressable>
      )}

      <Text style={styles.orDivider}>or</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter partner's invite code"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        value={inviteCode}
        onChangeText={setInviteCode}
      />
      <Pressable
        style={[styles.button, styles.secondaryButton]}
        onPress={handleJoin}
        disabled={busy || !inviteCode.trim()}
      >
        {busy ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.secondaryButtonText}>Join with code</Text>
        )}
      </Pressable>

      {/* Handy for testing both sides of a pairing on one device: sign
          out here, sign back in with a different email, and join the
          code above. Fine to keep for real use too — someone may want
          to switch accounts before they've paired. */}
      <Pressable
        style={styles.signOutLink}
        onPress={() => supabase.auth.signOut()}
        disabled={busy}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  code: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.primary,
    marginVertical: 8,
    letterSpacing: 1,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    textAlign: 'center',
  },
  orDivider: {
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    marginVertical: 16,
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
  secondaryButton: {
    backgroundColor: colors.secondaryTint,
    borderWidth: 1,
    borderColor: colors.secondaryDark,
  },
  secondaryButtonText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.ink,
    fontSize: fontSizes.md,
  },
  signOutLink: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
});
