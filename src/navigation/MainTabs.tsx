import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import NavIcon from '@/components/NavIcon';
import { NavIconKey } from '@/theme/navIcons';
import { MainTabParamList } from '@/types';
import { colors } from '@/theme/colors';

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

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
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
