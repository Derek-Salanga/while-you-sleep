import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import NavIcon from '@/components/NavIcon';
import { NavIconKey } from '@/theme/navIcons';
import { MainTabParamList } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

import HomeScreen from '@/screens/HomeScreen';
import TimelineScreen from '@/screens/TimelineScreen';
import MonthlySummaryScreen from '@/screens/MonthlySummaryScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, NavIconKey> = {
  Home: 'home',
  Timeline: 'timeline',
  MonthlySummary: 'monthly',
  Settings: 'settings',
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Timeline: 'Timeline',
  MonthlySummary: 'Month',
  Settings: 'Settings',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: TAB_LABELS[route.name as keyof MainTabParamList],
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: fontSizes.xs,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color }) => (
          <NavIcon
            name={TAB_ICONS[route.name as keyof MainTabParamList]}
            color={color}
            size={26}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="MonthlySummary" component={MonthlySummaryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
