import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePairing } from '@/lib/PairingContext';
import { RootStackParamList } from '@/types';
import { colors } from '@/theme/colors';

import AuthScreen from '@/screens/AuthScreen';
import PairingScreen from '@/screens/PairingScreen';
import TimelineScreen from '@/screens/TimelineScreen';
import RecordScreen from '@/screens/RecordScreen';
import ClipViewScreen from '@/screens/ClipViewScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, pair, loading } = usePairing();
  // A pair row exists as soon as one side creates an invite, with user_b
  // still null until the partner joins — that's not a completed pairing
  // yet, so route to Pairing until both sides are set.
  const isPaired = !!pair?.user_b;

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
    <NavigationContainer>
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
