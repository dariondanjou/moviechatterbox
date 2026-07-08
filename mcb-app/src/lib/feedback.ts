import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Recorded audio output per platform (expo-audio HIGH_QUALITY preset). */
export const AUDIO_MIME = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

async function readBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // web recorder yields a blob: URL
    const blob = await (await fetch(uri)).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () =>
        resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
      reader.readAsDataURL(blob);
    });
  }
  return await new File(uri).base64();
}

/**
 * Submit feedback (founder request 2026-07-08), as text, a voice note, or
 * both. Date/time, screen, platform, OS and app version are captured
 * automatically; the edge function stores the audio, transcribes it
 * (Deepgram), and AI-triages category/sentiment/summary server-side.
 */
export async function submitFeedback(
  input: { text?: string; audioUri?: string },
  route: string,
) {
  const audioBase64 = input.audioUri ? await readBase64(input.audioUri) : null;

  const { data, error } = await supabase.functions.invoke('mcb-feedback', {
    body: {
      body: input.text ?? null,
      audioBase64,
      audioMime: audioBase64 ? AUDIO_MIME : null,
      route,
      platform: Platform.OS,
      osVersion: Device.osVersion ?? null,
      appVersion: Constants.expoConfig?.version ?? null,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
