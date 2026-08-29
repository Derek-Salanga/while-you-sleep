import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NavIcon from '@/components/NavIcon';
import { NavIconKey } from '@/theme/navIcons';
import { MainTabParamList, SettingsStackParamList } from '@/types';
import { colors } from '@/theme/colors';

import HomeScreen from '@/screens/HomeScreen';
import TimelineScreen from '@/screens/TimelineScreen';
import MonthlySummaryScreen from '@/screens/MonthlySummaryScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import AccountSettingsScreen from '@/screens/AccountSettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

// Nested inside the tab rather than pushed on the root stack so the tab bar
// stays visible. unmountOnBlur below tears the whole stack down on a tab
// switch, so it always reopens on SettingsHome -- which is what you want
// from a settings tab, not a resumed sub-screen.
function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsHome" component={SettingsScreen} />
      <SettingsStack.Screen
        name="AccountSettings"
        component={AccountSettingsScreen}
      />
    </SettingsStack.Navigator>
  );
}

// Icon-only tabs (tabBarShowLabel: false below) still need a spoken label
// for screen readers — without this it falls back to the raw route name
// (e.g. "MonthlySummary" read aloud).
const TAB_CONFIG: Record<
  keyof MainTabParamList,
  { icon: NavIconKey; accessibilityLabel: string }
> = {
  Home: { icon: 'home', accessibilityLabel: 'Home' },
  Timeline: { icon: 'timeline', accessibilityLabel: 'Timeline' },
  MonthlySummary: { icon: 'monthly', accessibilityLabel: 'Month' },
  Settings: { icon: 'settings', accessibilityLabel: 'Settings' },
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const config = TAB_CONFIG[route.name as keyof MainTabParamList];
        return {
          headerShown: false,
          // Safe because no screen holds unsaved state across a tab switch:
          // the react-query-backed ones (Timeline) refetch on remount, and
          // the rest still re-fetch on focus via useFocusEffect. Also keeps
          // a screen's native DateTimePicker instance from lingering in the
          // background when the user switches tabs.
          unmountOnBlur: true,
          tabBarShowLabel: false,
          tabBarAccessibilityLabel: config.accessibilityLabel,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarIcon: ({ color }) => (
            <NavIcon name={config.icon} color={color} size={26} />
          ),
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="MonthlySummary" component={MonthlySummaryScreen} />
      <Tab.Screen name="Settings" component={SettingsNavigator} />
    </Tab.Navigator>
  );
}
