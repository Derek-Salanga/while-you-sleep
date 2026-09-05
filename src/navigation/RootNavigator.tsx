import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { usePairing } from '@/lib/PairingContext';
import {
  ensureDailyRemindersScheduled,
  registerPushToken,
} from '@/lib/notifications';
import { routeForNotification } from '@/lib/notificationRouting';
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

  // Both of these reference "your partner", so neither runs until a pairing
  // actually exists. Re-running is cheap: reminders replace by identifier
  // rather than duplicating, and the token upserts on (user_id, token).
  //
  // Sequenced, not parallel — ensureDailyRemindersScheduled is what prompts
  // for notification permission, and registerPushToken bails without it, so
  // firing them together would skip token registration on a first launch.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!isPaired || !userId) return;
    ensureDailyRemindersScheduled()
      .then(() => registerPushToken(userId))
      .catch((err) => console.error('Notification setup failed:', err));
  }, [isPaired, userId]);

  // Where a tap lands depends on which notification it was. The daily
  // reminder opens Home — resuming onto whatever screen the app was left on
  // reads as "the app dropped me straight into recording" rather than a
  // deliberate entry point. A partner-posted push opens Record, since that's
  // the screen that resolves the reveal, and a reaction opens the clip it
  // was left on, which is always one of yours and so always visible.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // No try/catch needed: react-navigation's navigate() doesn't
        // throw for an unmatched route — if the user isn't paired yet
        // (neither "MainTabs" nor "Record" is mounted), it just no-ops, and
        // the normal Auth -> Pairing -> MainTabs gating still applies.
        if (!navigationRef.isReady()) return;
        const destination = routeForNotification(
          response.notification.request.content.data
        );
        if (destination.screen === 'Record') {
          navigationRef.navigate('Record');
        } else if (destination.screen === 'ClipView') {
          navigationRef.navigate('ClipView', { clipId: destination.clipId });
        } else {
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
