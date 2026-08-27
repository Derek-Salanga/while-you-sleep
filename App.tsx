import React from 'react';
import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PairingProvider } from '@/lib/PairingContext';
import RootNavigator from '@/navigation/RootNavigator';

// EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo's Metro
// config -- no app.json wiring needed, unlike SUPABASE_URL/ANON_KEY
// (see src/lib/supabase.ts) which predate that convention in this repo.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn });
}

function App() {
  return (
    <SafeAreaProvider>
      <PairingProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </PairingProvider>
    </SafeAreaProvider>
  );
}

export default sentryDsn ? Sentry.wrap(App) : App;
