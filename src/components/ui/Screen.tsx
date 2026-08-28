import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

interface ScreenProps {
  children: React.ReactNode;
  padding: number;
  centered?: boolean;
  topInset?: boolean;
}

export default function Screen({
  children,
  padding,
  centered = false,
  topInset = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding,
        paddingTop: topInset ? insets.top + padding : padding,
        justifyContent: centered ? 'center' : undefined,
      }}
    >
      {children}
    </View>
  );
}
