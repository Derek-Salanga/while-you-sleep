import { NavigatorScreenParams } from '@react-navigation/native';

export interface Profile {
  id: string;
  display_name: string;
  timezone: string | null;
  created_at: string;
}

export interface Pair {
  id: string;
  user_a: string;
  user_b: string | null;
  invite_code: string;
  created_at: string;
}

export interface Clip {
  id: string;
  pair_id: string;
  sender_id: string;
  storage_path: string;
  duration_seconds: number | null;
  recorded_for_date: string; // YYYY-MM-DD, one clip per sender per day
  caption_text: string | null; // optional note alongside the daily question's video answer
  viewed_at: string | null;
  created_at: string;
}

export interface PairTrip {
  pair_id: string;
  target_date: string; // YYYY-MM-DD, the shared "next visit" date
  country_code: string | null; // ISO 3166-1 alpha-2, see src/data/countries.ts
  set_by: string;
  updated_at: string;
}

export interface PairAnniversary {
  pair_id: string;
  anniversary_date: string; // YYYY-MM-DD, the shared "together since" date
  set_by: string;
  updated_at: string;
}

// The Settings tab is a small stack, not a single screen, so Account
// settings pushes over it with the tab bar still visible.
export type SettingsStackParamList = {
  SettingsHome: undefined;
  AccountSettings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Timeline: undefined;
  MonthlySummary: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Pairing: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Record: undefined;
  // `queue`, when present, is the full ordered list of clip ids for a
  // sequential reel (Monthly Summary's "watch this month's clips") —
  // `clipId` is just queue[0] in that case. Absent for a normal
  // single-clip tap from Timeline.
  ClipView: { clipId: string; queue?: string[] };
};
