import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PairingProvider } from '@/lib/PairingContext';
import RootNavigator from '@/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <PairingProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </PairingProvider>
    </SafeAreaProvider>
  );
}
