import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Submit feedback (founder request 2026-07-08). Date/time, screen, platform,
 * OS and app version are captured automatically; the edge function AI-triages
 * category/sentiment/summary server-side.
 */
export async function submitFeedback(body: string, route: string) {
  const { data, error } = await supabase.functions.invoke('mcb-feedback', {
    body: {
      body,
      route,
      platform: Platform.OS,
      osVersion: Device.osVersion ?? null,
      appVersion: Constants.expoConfig?.version ?? null,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
