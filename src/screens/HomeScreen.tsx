import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { todayDateString, formatDateString } from '@/lib/date';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { PairTrip } from '@/types';

function tripCountdownLabel(targetDate: string): string {
  const diffDays = Math.round(
    (new Date(targetDate + 'T00:00:00').getTime() -
      new Date(todayDateString() + 'T00:00:00').getTime()) /
      86400000
  );
  if (diffDays === 0) return 'Today';
  if (diffDays < 0) return `${-diffDays} days ago`;
  return `${diffDays} days`;
}

export default function HomeScreen({ navigation }: any) {
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();
  const [answeredToday, setAnsweredToday] = useState(false);
  const [trip, setTrip] = useState<PairTrip | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const loadQuestionStatus = useCallback(async () => {
    if (!pair || !session?.user) return;
    const { data, error } = await supabase
      .from('daily_answers')
      .select('id')
      .eq('pair_id', pair.id)
      .eq('user_id', session.user.id)
      .eq('answered_for_date', todayDateString())
      .maybeSingle();

    if (error) {
      console.error('Failed to load question status:', error.message);
      return;
    }
    setAnsweredToday(!!data);
  }, [pair, session]);

  const loadTrip = useCallback(async () => {
    if (!pair) return;
    const { data, error } = await supabase
      .from('pair_trips')
      .select('*')
      .eq('pair_id', pair.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load trip:', error.message);
      return;
    }
    setTrip(data);
  }, [pair]);

  useFocusEffect(
    useCallback(() => {
      loadQuestionStatus();
      loadTrip();
    }, [loadQuestionStatus, loadTrip])
  );

  const handleSaveTrip = async (date: Date) => {
    if (!pair || !session?.user) return;
    const { data, error } = await supabase
      .from('pair_trips')
      .upsert(
        { pair_id: pair.id, target_date: formatDateString(date), set_by: session.user.id },
        { onConflict: 'pair_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to save trip:', error.message);
      return;
    }
    setTrip(data);
    if (Platform.OS !== 'ios') setPickerVisible(false);
  };

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios' && event.type !== 'set') {
      setPickerVisible(false);
      return;
    }
    if (date) handleSaveTrip(date);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Home</Text>
      <Pressable
        style={({ pressed }) => [styles.entryCard, pressed && styles.pressed]}
        onPress={() => navigation.navigate('DailyQuestion')}
      >
        <Text style={styles.entryCardLabel}>Today's question</Text>
        {!answeredToday && <View style={styles.unwatchedDot} />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.entryCard, pressed && styles.pressed]}
        onPress={() => setPickerVisible(true)}
      >
        {trip ? (
          <View>
            <Text style={styles.tripCountdown}>{tripCountdownLabel(trip.target_date)}</Text>
            <Text style={styles.tripDate}>
              {new Date(trip.target_date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
        ) : (
          <Text style={styles.entryCardLabel}>Plan your next visit</Text>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.recordFab, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Record')}
      >
        <Text style={styles.recordFabText}>Record today's clip</Text>
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
              value={trip ? new Date(trip.target_date + 'T00:00:00') : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handlePickerChange}
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
    marginBottom: 16,
  },
  entryCard: {
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
  entryCardLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  tripCountdown: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  tripDate: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 2,
  },
  unwatchedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  recordFab: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  recordFabText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
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
