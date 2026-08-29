import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
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

export default function AccountSettingsScreen({ navigation }: any) {
  const { session } = usePairing();

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
  pressed: {
    opacity: 0.7,
  },
});
