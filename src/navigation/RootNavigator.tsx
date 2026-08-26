import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { usePairing } from '@/lib/PairingContext';
import { ensureDailyRemindersScheduled } from '@/lib/notifications';
import { navigationRef } from './navigationRef';
import { RootStackParamList } from '@/types';
import { colors } from '@/theme/colors';

import AuthScreen from '@/screens/AuthScreen';
import PairingScreen from '@/screens/PairingScreen';
import TimelineScreen from '@/screens/TimelineScreen';
import RecordScreen from '@/screens/RecordScreen';
import ClipViewScreen from '@/screens/ClipViewScreen';
import DailyQuestionScreen from '@/screens/DailyQuestionScreen';
import MonthlySummaryScreen from '@/screens/MonthlySummaryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, pair, loading } = usePairing();
  // A pair row exists as soon as one side creates an invite, with user_b
  // still null until the partner joins — that's not a completed pairing
  // yet, so route to Pairing until both sides are set.
  const isPaired = !!pair?.user_b;

  // Reminders reference "your partner", so only schedule them once a
  // pairing actually exists. Re-running this is cheap — it replaces the
  // existing scheduled requests by identifier rather than duplicating.
  useEffect(() => {
    if (isPaired) {
      ensureDailyRemindersScheduled().catch((err) =>
        console.error('Failed to schedule daily reminders:', err)
      );
    }
  }, [isPaired]);

  // Tapping either daily reminder should land you on Timeline, not
  // wherever the app happened to be left open — otherwise resuming from
  // a backgrounded DailyQuestion/Record screen reads as "the app dropped
  // me straight into recording/answering" rather than a deliberate entry
  // point.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      () => {
        if (navigationRef.isReady()) {
          try {
            navigationRef.navigate('Home');
          } catch (err) {
            // Not paired yet (no "Home" route mounted) — nothing to do,
            // the normal Auth -> Pairing -> Home gating already applies.
            console.error('Could not navigate home from notification:', err);
          }
        }
      }
    );
    return () => subscription.remove();
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !isPaired ? (
          <Stack.Screen name="Pairing" component={PairingScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={TimelineScreen} />
            <Stack.Screen
              name="Record"
              component={RecordScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="ClipView"
              component={ClipViewScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="DailyQuestion"
              component={DailyQuestionScreen}
            />
            <Stack.Screen
              name="MonthlySummary"
              component={MonthlySummaryScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
