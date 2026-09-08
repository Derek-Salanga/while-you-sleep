import React, { useCallback, useMemo, useState } from 'react';
import { Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import CrossoverHeart from '@/components/CrossoverHeart';
import {
  generateInviteCode,
  inviteExpiryISO,
  formatExpiry,
  INVITE_TTL_HOURS,
} from '@/lib/inviteCode';

export default function PairingScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair, refreshPair } = usePairing();
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  // If a pending invite already exists for this user (e.g. we created one,
  // then closed and reopened the app before our partner joined), show it
  // from persisted state rather than losing it on remount.
  const myPendingInvite =
    pair && !pair.user_b && pair.user_a === session?.user.id ? pair : null;
  const myCode = myPendingInvite?.invite_code ?? null;
  const expiryLabel = formatExpiry(myPendingInvite?.invite_expires_at ?? null);

  // Pick up a partner joining while we're sitting on the waiting screen.
  useFocusEffect(
    useCallback(() => {
      refreshPair();
    }, [refreshPair])
  );

  // Retries on the unique-constraint violation rather than surfacing raw
  // Postgres text. Collisions are vanishingly unlikely at 31^6, but the old
  // generator had no retry at all and a duplicate there was a dead end the
  // user could do nothing about.
  async function handleCreateInvite() {
    if (!session?.user) return;
    setBusy(true);
    try {
      let lastError: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error } = await supabase.from('pairs').insert({
          user_a: session.user.id,
          user_b: null,
          invite_code: generateInviteCode(),
          invite_expires_at: inviteExpiryISO(),
        });
        if (!error) {
          await refreshPair();
          return;
        }
        // 23505 = unique_violation. Anything else is a real failure.
        if (error.code !== '23505') throw error;
        lastError = error;
      }
      throw lastError;
    } catch (err: any) {
      Alert.alert('Could not create invite', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setBusy(true);
    try {
      let lastError: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error } = await supabase.rpc('regenerate_invite', {
          new_code: generateInviteCode(),
          ttl_hours: INVITE_TTL_HOURS,
        });
        if (!error) {
          await refreshPair();
          return;
        }
        if (error.code !== '23505') throw error;
        lastError = error;
      }
      throw lastError;
    } catch (err: any) {
      Alert.alert('Could not regenerate', err.message);
    } finally {
      setBusy(false);
    }
  }

  // Confirmed because the old code stops working the moment this runs, and
  // anyone already holding it just sees "not found".
  function confirmCancel() {
    Alert.alert(
      'Cancel this invite?',
      'The code stops working straight away. You can create a new one after.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel invite',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const { error } = await supabase.rpc('cancel_invite');
              if (error) throw error;
              await refreshPair();
            } catch (err: any) {
              Alert.alert('Could not cancel', err.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
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
          <CrossoverHeart size={64} />
          <Text style={styles.waitingHeadline}>
            Waiting for your other half
          </Text>
          <Text style={styles.cardLabel}>Your invite code</Text>
          <Text style={styles.code}>{myCode}</Text>
          {expiryLabel && <Text style={styles.expiry}>{expiryLabel}</Text>}
          <Text style={styles.helper}>
            Share this code with your partner. Once they join, you can both
            start sending daily clips.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.inviteAction,
              pressed && styles.pressed,
            ]}
            onPress={handleRegenerate}
            disabled={busy}
          >
            <Text style={styles.inviteActionText}>Get a new code</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.inviteAction,
              pressed && styles.pressed,
            ]}
            onPress={confirmCancel}
            disabled={busy}
          >
            <Text style={styles.inviteCancelText}>Cancel invite</Text>
          </Pressable>
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

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    expiry: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      marginBottom: 4,
    },
    inviteAction: {
      paddingVertical: 10,
    },
    inviteActionText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: t.accent,
    },
    inviteCancelText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: t.danger,
    },
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
    card: {
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
    },
    waitingHeadline: {
      fontFamily: fonts.display,
      fontSize: fontSizes.lg,
      color: t.textPrimary,
      textAlign: 'center',
      marginTop: 12,
      marginBottom: 12,
    },
    cardLabel: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
    },
    code: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.accent,
      marginVertical: 8,
      letterSpacing: 1,
    },
    helper: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      textAlign: 'center',
    },
    orDivider: {
      fontFamily: fonts.body,
      color: t.textMuted,
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
      color: t.textMuted,
    },
    pressed: {
      opacity: 0.7,
    },
  });
