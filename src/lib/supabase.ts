import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl =
  (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const supabaseAnonKey =
  (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';

if (!supabaseUrl || supabaseUrl === 'SUPABASE_URL_HERE') {
  console.warn(
    'Supabase URL is not configured. Set it in app.json under expo.extra.supabaseUrl.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
