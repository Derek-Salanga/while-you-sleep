import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { unregisterPushToken } from '@/lib/notifications';
import { usePairing } from '@/lib/PairingContext';
import { usePartnerName } from '@/hooks/usePartnerName';
import { useBlockPartner, useDeleteAccount } from '@/hooks/mutations';
import { confirmBlockPartner } from '@/lib/blockPartner';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import BackLink from '@/components/ui/BackLink';

// Both live as plain Markdown in the public repo; GitHub renders them. Also
// the URLs to give App Store Connect. Swap for GitHub Pages URLs if one is
// set up later -- only these constants change.
const PRIVACY_POLICY_URL =
  'https://github.com/Derek-Salanga/while-you-sleep/blob/main/PRIVACY.md';
const TERMS_OF_USE_URL =
  'https://github.com/Derek-Salanga/while-you-sleep/blob/main/TERMS.md';

// Signing out drops the session, which unmounts this whole stack via
// RootNavigator's gate -- there's no undo and no confirmation elsewhere in
// the app, so it gets one here. Alert rather than a custom modal: the rest
// of this codebase already confirms with Alert (see handleSaveAnniversary),
// and Modal has a long crash history in this repo (docs/datepicker-debugging.md).
function confirmSignOut(userId: string | undefined) {
  Alert.alert('Sign out?', "You'll need your email code to get back in.", [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      // Awaited so a failure surfaces instead of silently leaving the user
      // signed in with a screen that looks like it worked.
      onPress: async () => {
        // Before signOut, not after: deleting the row needs the session's
        // JWT, since push_tokens_delete_own is scoped to auth.uid().
        if (userId) await unregisterPushToken(userId);
        const { error } = await supabase.auth.signOut();
        if (error) Alert.alert("Couldn't sign out", error.message);
      },
    },
  ]);
}

// Two chained alerts rather than a typed "DELETE" confirmation. Typed is
// the stronger pattern, but Alert.prompt is iOS-only in React Native, so
// the Android half would need a custom Modal -- and Modal is exactly what
// six rounds of device crashes came from here (docs/datepicker-debugging.md).
//
// The first alert names the consequence in full, including the partner by
// name, because the cascade takes their clips too and they get no warning
// of their own. The second exists so the destructive button can't be hit by
// muscle memory from the sign-out flow directly above it.
function confirmDeleteAccount(
  partnerName: string | null,
  onConfirm: () => void
) {
  const shared = partnerName
    ? `every clip you and ${partnerName} have shared`
    : 'every clip you have shared';

  Alert.alert(
    'Delete your account?',
    `This permanently deletes your account and ${shared} — including their copy. They will lose all of it too, and this cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Last chance', 'There is no way to get any of it back.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete forever',
              style: 'destructive',
              onPress: onConfirm,
            },
          ]),
      },
    ]
  );
}

export default function AccountSettingsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair } = usePairing();
  const partnerName = usePartnerName();
  const deleteAccount = useDeleteAccount();
  const blockPartner = useBlockPartner();

  return (
    <Screen padding={20} topInset>
      <BackLink label="Settings" />
      <Text style={styles.title}>Account</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Email</Text>
        <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="middle">
          {session?.user.email ?? '—'}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() =>
          Linking.openURL(PRIVACY_POLICY_URL).catch(() =>
            Alert.alert("Couldn't open the privacy policy")
          )
        }
        accessibilityRole="link"
      >
        <Text style={styles.rowLabel}>Privacy Policy</Text>
        <Text style={styles.rowValue}>›</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() =>
          Linking.openURL(TERMS_OF_USE_URL).catch(() =>
            Alert.alert("Couldn't open the terms of use")
          )
        }
        accessibilityRole="link"
      >
        <Text style={styles.rowLabel}>Terms of Use</Text>
        <Text style={styles.rowValue}>›</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
        onPress={() => confirmSignOut(session?.user.id)}
      >
        <Text style={styles.dangerText}>Sign out</Text>
      </Pressable>

      {/* Only shown once paired -- there's nobody to block before user_b is
          set, and block_partner() would just raise "Not paired". Above
          Delete account, same reasoning as the two delete-account alerts
          below: ending a pairing is one notch less destructive than wiping
          your own account, so it reads as the lighter option first. */}
      {!!pair?.user_b && (
        <Pressable
          style={({ pressed }) => [
            styles.dangerRow,
            styles.blockRow,
            pressed && styles.pressed,
          ]}
          disabled={blockPartner.isPending}
          onPress={() =>
            confirmBlockPartner(partnerName, () =>
              blockPartner.mutate(undefined, {
                // No success branch: a successful block deletes the pairs
                // row, ['pair'] is invalidated, and RootNavigator's isPaired
                // gate swaps this whole stack out for PairingScreen on its
                // own -- same shape as useDeleteAccount's onSuccess above.
                onError: (err) => Alert.alert("Couldn't block", err.message),
              })
            )
          }
        >
          {blockPartner.isPending ? (
            <ActivityIndicator color={t.danger} />
          ) : (
            <Text style={styles.dangerText}>
              Block {partnerName ?? 'your partner'}
            </Text>
          )}
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.dangerRow,
          styles.deleteRow,
          pressed && styles.pressed,
        ]}
        disabled={deleteAccount.isPending}
        onPress={() =>
          confirmDeleteAccount(partnerName, () =>
            deleteAccount.mutate(undefined, {
              // No success branch: deleting drops the session, so
              // RootNavigator swaps this whole stack out for AuthScreen on
              // its own. There is no screen left to show a message on.
              onError: (err) =>
                Alert.alert("Couldn't delete your account", err.message),
            })
          )
        }
      >
        {deleteAccount.isPending ? (
          <ActivityIndicator color={t.danger} />
        ) : (
          <Text style={styles.dangerText}>Delete account</Text>
        )}
      </Pressable>

      <Text style={styles.deleteNote}>
        Deleting your account also deletes the clips you and your partner have
        shared, including the videos themselves.
      </Text>
    </Screen>
  );
}

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
      marginBottom: 24,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 14,
      paddingHorizontal: 18,
      marginBottom: 16,
    },
    rowLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    rowValue: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      flexShrink: 1,
      marginLeft: 12,
      textAlign: 'right',
    },
    dangerRow: {
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 14,
      alignItems: 'center',
    },
    dangerText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.danger,
    },
    blockRow: {
      marginTop: 12,
    },
    deleteRow: {
      marginTop: 12,
    },
    deleteNote: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: t.textMuted,
      lineHeight: 17,
      marginTop: 12,
      paddingHorizontal: 4,
    },
    pressed: {
      opacity: 0.7,
    },
  });
