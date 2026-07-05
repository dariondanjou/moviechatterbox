import { Room, RoomEvent, type Participant } from 'livekit-client';

import type { AudioSession, AudioSessionEvents } from './audio-session';

export type { AudioSession, AudioSessionEvents } from './audio-session';

export function createAudioSession(events: AudioSessionEvents): AudioSession {
  const room = new Room();

  room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
    events.onActiveSpeakers?.(speakers.map((s) => s.identity));
  });
  room.on(RoomEvent.Disconnected, () => {
    events.onDisconnected?.();
  });

  return {
    async connect(url, token) {
      await room.connect(url, token);
    },
    async setMicEnabled(enabled) {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
    async disconnect() {
      await room.disconnect();
    },
  };
}
