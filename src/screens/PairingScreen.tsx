import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { formatExpiry, INVITE_TTL_HOURS } from '@/lib/inviteCode';

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
  // Regenerating is Cancel + Create in one tap, so it earns a control only
  // where those two would read as giving up and starting over rather than
  // retrying -- which is exactly an expired code.
  const isExpired = expiryLabel === 'Expired';

  // Pick up a partner joining while we're sitting on the waiting screen.
  useFocusEffect(
    useCallback(() => {
      refreshPair();
    }, [refreshPair])
  );

  // Both of these hand the whole job to the server: it generates the code,
  // retries its own collisions, and never reports one back. The client used
  // to generate and retry, which meant a unique violation was visible to it
  // -- and a visible violation is an answer to "is this code live?", i.e. an
  // enumeration oracle. See the comments on pairs' policies in schema.sql.
  async function handleCreateInvite() {
    if (!session?.user) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('create_invite', {
        ttl_hours: INVITE_TTL_HOURS,
      });
      if (error) throw error;
      await refreshPair();
    } catch (err: any) {
      Alert.alert('Could not create invite', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('regenerate_invite', {
        ttl_hours: INVITE_TTL_HOURS,
      });
      if (error) throw error;
      await refreshPair();
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
      {/* Onboarding copy, so it goes once you're holding a code -- at that
          point you have already done the thing it explains. */}
      {!myCode && (
        <Text style={styles.subtitle}>
          Pair with your partner to start sharing daily clips.
        </Text>
      )}

      {myCode ? (
        <Card elevated style={styles.card}>
          <CrossoverHeart size={64} />
          <Text style={styles.waitingHeadline}>
            Waiting for your other half
          </Text>
          {/* No "Your invite code" label: nothing else on this screen is a
              large hyphenated string in the accent colour, and the headline
              above already says what is happening. */}
          <Text style={styles.code}>{myCode}</Text>
          {/* One line where there were three. The old helper -- "Share this
              code with your partner. Once they join, you can both start
              sending daily clips." -- restated the headline and then
              described the thing you had just done. */}
          <Text style={styles.expiry}>
            {isExpired
              ? 'This code has expired'
              : `Share this code${expiryLabel ? ` · ${expiryLabel.toLowerCase()}` : ''}`}
          </Text>
          {/* Side by side rather than stacked: they are a pair of choices
              about the same code, and two full-width rows made them read as
              two separate sections. */}
          <View style={styles.inviteActions}>
            {isExpired && (
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
            )}
            <Pressable
              style={({ pressed }) => [
                styles.inviteAction,
                pressed && styles.pressed,
              ]}
              onPress={confirmCancel}
              disabled={busy}
            >
              <Text style={styles.inviteCancelText}>Cancel</Text>
            </Pressable>
          </View>
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
    inviteActions: {
      flexDirection: 'row',
      gap: 20,
      marginTop: 4,
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
      // No marginBottom: the divider below owns the gap on both sides. With
      // both set, there was 40px above "or" and 16 below it, which read as
      // the divider belonging to the input rather than separating the two.
    },
    waitingHeadline: {
      fontFamily: fonts.display,
      fontSize: fontSizes.lg,
      color: t.textPrimary,
      textAlign: 'center',
      marginTop: 12,
      marginBottom: 12,
    },
    code: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.accent,
      marginVertical: 8,
      letterSpacing: 1,
    },
    orDivider: {
      fontFamily: fonts.body,
      color: t.textMuted,
      textAlign: 'center',
      marginVertical: 20,
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
