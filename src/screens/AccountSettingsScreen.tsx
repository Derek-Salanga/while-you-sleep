import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { usePartnerName } from '@/hooks/usePartnerName';
import { useDeleteAccount } from '@/hooks/mutations';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';

// Signing out drops the session, which unmounts this whole stack via
// RootNavigator's gate -- there's no undo and no confirmation elsewhere in
// the app, so it gets one here. Alert rather than a custom modal: the rest
// of this codebase already confirms with Alert (see handleSaveAnniversary),
// and Modal has a long crash history in this repo (docs/datepicker-debugging.md).
function confirmSignOut() {
  Alert.alert('Sign out?', "You'll need your email code to get back in.", [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      // Awaited so a failure surfaces instead of silently leaving the user
      // signed in with a screen that looks like it worked.
      onPress: async () => {
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

export default function AccountSettingsScreen({ navigation }: any) {
  const { session } = usePairing();
  const partnerName = usePartnerName();
  const deleteAccount = useDeleteAccount();

  return (
    <Screen padding={20} topInset>
      <Pressable
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back to Settings"
      >
        <Text style={styles.backText}>‹ Settings</Text>
      </Pressable>
      <Text style={styles.title}>Account</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Email</Text>
        <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="middle">
          {session?.user.email ?? '—'}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
        onPress={confirmSignOut}
      >
        <Text style={styles.dangerText}>Sign out</Text>
      </Pressable>

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
          <ActivityIndicator color={colors.error} />
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

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 4,
  },
  backText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  rowLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  rowValue: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    flexShrink: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  dangerRow: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.error,
  },
  deleteRow: {
    marginTop: 12,
  },
  deleteNote: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.muted,
    lineHeight: 17,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
