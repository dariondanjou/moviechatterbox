// Base module for Metro platform resolution — real implementations live in
// audio-session.web.ts and audio-session.native.ts. This file exists so
// TypeScript has a canonical module; it is never bundled on web or native.

export type AudioSessionEvents = {
  /** LiveKit identities (= Supabase user ids) currently speaking. */
  onActiveSpeakers?: (identities: string[]) => void;
  onDisconnected?: () => void;
};

export type AudioSession = {
  connect(url: string, token: string): Promise<void>;
  setMicEnabled(enabled: boolean): Promise<void>;
  disconnect(): Promise<void>;
};

export function createAudioSession(_events: AudioSessionEvents): AudioSession {
  throw new Error('audio-session: no platform implementation resolved');
}
