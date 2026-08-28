import React, { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Fraunces_600SemiBold,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PairingProvider } from '@/lib/PairingContext';
import RootNavigator from '@/navigation/RootNavigator';

// EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo's Metro
// config -- no app.json wiring needed, unlike SUPABASE_URL/ANON_KEY
// (see src/lib/supabase.ts) which predate that convention in this repo.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn });
}

// Stock defaults on purpose: staleTime 0 means a screen refetches when it
// remounts (which is how tab focus already works -- see unmountOnBlur in
// MainTabs), and the built-in retry-with-backoff covers the transient
// "JWT issued at future" error PairingContext used to hand-roll a retry for.
const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PairingProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </PairingProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default sentryDsn ? Sentry.wrap(App) : App;
