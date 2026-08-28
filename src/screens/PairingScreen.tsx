import React, { useCallback, useState } from 'react';
import { Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

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
      // Server-side lookup-and-claim by exact code (join_pair_by_code in
      // supabase/schema.sql) -- not a client SELECT+UPDATE, which would
      // need a policy exposing every open pair to every user just to find
      // one by code.
      const { error } = await supabase.rpc('join_pair_by_code', {
        code: inviteCode.trim().toUpperCase(),
      });
      if (error) throw error;
      await refreshPair();
    } catch (err: any) {
      Alert.alert('Could not join', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padding={24} centered>
      <Text style={styles.title}>While You Sleep</Text>
      <Text style={styles.subtitle}>
        Pair with your partner to start sharing daily clips.
      </Text>

      {myCode ? (
        <Card elevated style={styles.card}>
          <Text style={styles.cardLabel}>Your invite code</Text>
          <Text style={styles.code}>{myCode}</Text>
          <Text style={styles.helper}>
            Send this to your partner. Waiting for them to join…
          </Text>
        </Card>
      ) : (
        <Button
          title="Create invite"
          onPress={handleCreateInvite}
          disabled={busy}
        />
      )}

      <Text style={styles.orDivider}>or</Text>

      <Input
        placeholder="Enter partner's invite code"
        autoCapitalize="characters"
        value={inviteCode}
        onChangeText={setInviteCode}
      />
      <Button
        title="Join with code"
        onPress={handleJoin}
        variant="secondary"
        loading={busy}
        disabled={busy || !inviteCode.trim()}
      />

      {/* Handy for testing both sides of a pairing on one device: sign
          out here, sign back in with a different email, and join the
          code above. Fine to keep for real use too — someone may want
          to switch accounts before they've paired. */}
      <Pressable
        style={({ pressed }) => [styles.signOutLink, pressed && styles.pressed]}
        onPress={() => supabase.auth.signOut()}
        disabled={busy}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
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
  card: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
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
  pressed: {
    opacity: 0.7,
  },
});
