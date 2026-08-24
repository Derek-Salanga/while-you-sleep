export interface Profile {
  id: string;
  display_name: string;
  timezone: string | null;
  created_at: string;
}

export interface Pair {
  id: string;
  user_a: string;
  user_b: string;
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
  viewed_at: string | null;
  created_at: string;
}

export type RootStackParamList = {
  Auth: undefined;
  Pairing: undefined;
  Home: undefined;
  Record: undefined;
  ClipView: { clipId: string };
  Timeline: undefined;
};
