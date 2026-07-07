import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { createAudioSession, type AudioSession } from '@/lib/audio-session';
import {
  fetchAudioToken,
  join,
  leave,
  setMuted as setMutedDb,
  type Chatterbox,
  type StageRole,
} from '@/lib/chatterbox';
import { emitSignal } from '@/lib/signals';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type AudioState = 'idle' | 'connecting' | 'connected' | 'error';

type AudioRoomState = {
  /** The Chatterbox whose audio this device is currently in, if any. */
  box: Chatterbox | null;
  role: StageRole | null;
  audioState: AudioState;
  muted: boolean;
  canSpeak: boolean;
  speaking: Set<string>;
  joinRoom: (box: Chatterbox) => Promise<void>;
  leaveRoom: () => Promise<void>;
  toggleMute: () => Promise<void>;
  reconnect: () => Promise<void>;
};

const AudioRoomContext = createContext<AudioRoomState>({
  box: null,
  role: null,
  audioState: 'idle',
  muted: true,
  canSpeak: false,
  speaking: new Set(),
  joinRoom: async () => {},
  leaveRoom: async () => {},
  toggleMute: async () => {},
  reconnect: async () => {},
});

export function useAudioRoom() {
  return useContext(AudioRoomContext);
}

/**
 * Owns the live audio session globally so navigating away from the room
 * screen never drops the call — the floating audio bar rides on this
 * (prototype phase 8; enables FR-2.4.6 browse-while-listening).
 */
export function AudioRoomProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const myId = session?.user.id;

  const [box, setBox] = useState<Chatterbox | null>(null);
  const [role, setRole] = useState<StageRole | null>(null);
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [muted, setMuted] = useState(true);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());

  const audioRef = useRef<AudioSession | null>(null);
  const boxRef = useRef<Chatterbox | null>(null);
  boxRef.current = box;
  const joinedAtRef = useRef<number | null>(null);

  const disconnectAudio = useCallback(async () => {
    const audio = audioRef.current;
    audioRef.current = null;
    setSpeaking(new Set());
    await audio?.disconnect().catch(() => {});
  }, []);

  const connectAudio = useCallback(async (boxId: string) => {
    await disconnectAudio();
    setAudioState('connecting');
    try {
      const { token, url } = await fetchAudioToken(boxId);
      const audio = createAudioSession({
        onActiveSpeakers: (ids) => setSpeaking(new Set(ids)),
        onDisconnected: () => setAudioState('idle'),
      });
      await audio.connect(url, token);
      audioRef.current = audio;
      setAudioState('connected');
    } catch {
      setAudioState('error'); // degrade to text (FR-2.1.5)
    }
  }, [disconnectAudio]);

  const leaveRoom = useCallback(async () => {
    const current = boxRef.current;
    // listening duration signal (FR-11.1)
    if (current && joinedAtRef.current) {
      emitSignal('box_listen', {
        boxId: current.id,
        entityType: current.entity_type,
        entityId: current.entity_id,
        value: Math.round((Date.now() - joinedAtRef.current) / 1000),
      });
    }
    joinedAtRef.current = null;
    setBox(null);
    setRole(null);
    setMuted(true);
    setAudioState('idle');
    await disconnectAudio();
    if (current) await leave(current.id).catch(() => {});
  }, [disconnectAudio]);

  const joinRoom = useCallback(
    async (next: Chatterbox) => {
      if (!myId) return;
      if (boxRef.current?.id === next.id) return; // already in it
      if (boxRef.current) await leaveRoom();
      const myRole: StageRole = next.host_id === myId ? 'host' : 'listener';
      setBox(next);
      setRole(myRole);
      setMuted(true);
      joinedAtRef.current = Date.now();
      emitSignal('box_join', {
        boxId: next.id,
        entityType: next.entity_type,
        entityId: next.entity_id,
        meta: { role: myRole },
      });
      await join(next.id, myRole).catch(() => {});
      await connectAudio(next.id);
    },
    [myId, leaveRoom, connectAudio],
  );

  const toggleMute = useCallback(async () => {
    const current = boxRef.current;
    if (!current) return;
    setMuted((m) => {
      const next = !m;
      audioRef.current?.setMicEnabled(!next).catch(() => {});
      setMutedDb(current.id, next).catch(() => {});
      if (!next) {
        emitSignal('box_speak', {
          boxId: current.id,
          entityType: current.entity_type,
          entityId: current.entity_id,
        });
      }
      return next;
    });
  }, []);

  const reconnect = useCallback(async () => {
    const current = boxRef.current;
    if (current) await connectAudio(current.id);
  }, [connectAudio]);

  // Watch my role (promotions/demotions -> re-mint token) and room status
  useEffect(() => {
    if (!box?.id || !myId) return;
    const channel = supabase
      .channel(`audio-room-${box.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mcb_participants',
          filter: `box_id=eq.${box.id}`,
        },
        (payload) => {
          const row = payload.new as {
            user_id: string;
            role: StageRole;
            muted: boolean;
            removed_at: string | null;
          };
          if (row.user_id !== myId) return;
          // Removed by the host (FR-5.1) → fully out, no rejoin
          if (row.removed_at) {
            leaveRoom();
            return;
          }
          if (row.role !== role) {
            setRole(row.role);
            setMuted(true);
            connectAudio(box.id);
            return;
          }
          // Host force-mute (FR-5.1): hard-cut the mic locally too
          if (row.muted) {
            setMuted((m) => {
              if (!m) audioRef.current?.setMicEnabled(false).catch(() => {});
              return true;
            });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mcb_chatterboxes',
          filter: `id=eq.${box.id}`,
        },
        (payload) => {
          const updated = payload.new as Chatterbox;
          if (updated.status === 'ended') {
            leaveRoom();
          } else {
            setBox(updated);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [box?.id, myId, role, connectAudio, leaveRoom]);

  // Signed out -> fully out
  useEffect(() => {
    if (!myId && boxRef.current) {
      leaveRoom();
    }
  }, [myId, leaveRoom]);

  const canSpeak = role === 'host' || role === 'speaker';

  return (
    <AudioRoomContext.Provider
      value={{
        box,
        role,
        audioState,
        muted,
        canSpeak,
        speaking,
        joinRoom,
        leaveRoom,
        toggleMute,
        reconnect,
      }}
    >
      {children}
    </AudioRoomContext.Provider>
  );
}
