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
import MainTabs from './MainTabs';
import RecordScreen from '@/screens/RecordScreen';
import ClipViewScreen from '@/screens/ClipViewScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, pair, pairPending, loading } = usePairing();
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

  // Tapping the daily reminder should land you on the Home tab, not
  // wherever the app happened to be left open — otherwise resuming from
  // a backgrounded Record screen reads as "the app dropped me straight
  // into recording" rather than a deliberate entry point.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      () => {
        // No try/catch needed: react-navigation's navigate() doesn't
        // throw for an unmatched route — if the user isn't paired yet
        // (no "MainTabs" route mounted), it just no-ops, and the normal
        // Auth -> Pairing -> MainTabs gating already applies regardless.
        if (navigationRef.isReady()) {
          navigationRef.navigate('MainTabs', { screen: 'Home' });
        }
      }
    );
    return () => subscription.remove();
  }, []);

  // `loading` alone was not enough. It means only "the auth session hasn't
  // resolved yet" (AuthContext), so on a cold start with a stored session it
  // flipped false while the pair query was still in flight -- pair undefined,
  // isPaired false -- and an already-paired user got a flash of PairingScreen
  // before MainTabs swapped in. Hold the same spinner until the pair query
  // has actually settled. A user with no pair still lands on PairingScreen:
  // that query resolves to null, which is not pending.
  if (loading || (session && pairPending)) {
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
            <Stack.Screen name="MainTabs" component={MainTabs} />
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
