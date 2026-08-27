import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { formatDateString } from '@/lib/date';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { PairAnniversary } from '@/types';

export default function SettingsScreen() {
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();
  const [anniversary, setAnniversary] = useState<PairAnniversary | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const loadAnniversary = useCallback(async () => {
    if (!pair) return;
    const { data, error } = await supabase
      .from('pair_anniversary')
      .select('*')
      .eq('pair_id', pair.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load anniversary:', error.message);
      return;
    }
    setAnniversary(data);
  }, [pair]);

  useFocusEffect(
    useCallback(() => {
      loadAnniversary();
    }, [loadAnniversary])
  );

  const handleSaveAnniversary = async (date: Date) => {
    if (!pair || !session?.user) return;
    const { data, error } = await supabase
      .from('pair_anniversary')
      .upsert(
        { pair_id: pair.id, anniversary_date: formatDateString(date), set_by: session.user.id },
        { onConflict: 'pair_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to save anniversary:', error.message);
      return;
    }
    setAnniversary(data);
    if (Platform.OS !== 'ios') setPickerVisible(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Settings</Text>
      {session?.user.email && (
        <Text style={styles.email}>Signed in as {session.user.email}</Text>
      )}
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => setPickerVisible(true)}
      >
        <Text style={styles.rowLabel}>Anniversary</Text>
        <Text style={styles.rowValue}>
          {anniversary
            ? new Date(anniversary.anniversary_date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Not set'}
        </Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.pressed,
        ]}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <DateTimePicker
              value={anniversary ? new Date(anniversary.anniversary_date + 'T00:00:00') : new Date()}
              mode="date"
              maximumDate={new Date()}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, date) => date && handleSaveAnniversary(date)}
            />
            {Platform.OS === 'ios' && (
              <Pressable
                style={({ pressed }) => [styles.pickerClose, pressed && styles.pressed]}
                onPress={() => setPickerVisible(false)}
              >
                <Text style={styles.pickerCloseText}>Done</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
    marginBottom: 8,
  },
  email: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginBottom: 32,
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
  },
  signOutButton: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.error,
  },
  pressed: {
    opacity: 0.7,
  },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  pickerClose: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  pickerCloseText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.primary,
  },
});
