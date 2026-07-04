import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Points at the existing production Supabase instance (FR-8.1, FR-8.2):
// same auth users, ratings, reviews, and watchlists as moviechatterbox.com.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env and fill in values.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Native persists sessions in AsyncStorage. On web, supabase-js's default
    // localStorage adapter is SSR-safe (AsyncStorage's web shim is not — it
    // breaks `expo export` static rendering under Node).
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    // Web needs URL detection for OAuth/magic-link redirects; native uses deep links.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
