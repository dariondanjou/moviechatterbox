"use client";
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalParticipant,
  RemoteParticipant,
  ParticipantEvent,
  ConnectionState,
  LocalTrackPublication,
  RemoteTrackPublication,
} from "livekit-client";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ActiveRoom {
  id: number;
  name: string;
  slug: string;
}

export interface RoomParticipantInfo {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
  audioLevel: number;
}

interface AudioRoomContextType {
  activeRoom: ActiveRoom | null;
  joinRoom: (room: ActiveRoom) => void;
  leaveRoom: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  isOnStage: boolean;
  setIsOnStage: (v: boolean) => void;
  handRaised: boolean;
  raiseHand: () => void;
  volume: number;
  setVolume: (v: number) => void;
  participants: RoomParticipantInfo[];
  connectionState: ConnectionState;
  livekitRoom: Room | null;
}

const AudioRoomContext = createContext<AudioRoomContextType>({
  activeRoom: null,
  joinRoom: () => {},
  leaveRoom: () => {},
  isMuted: false,
  toggleMute: () => {},
  isOnStage: false,
  setIsOnStage: () => {},
  handRaised: false,
  raiseHand: () => {},
  volume: 80,
  setVolume: () => {},
  participants: [],
  connectionState: ConnectionState.Disconnected,
  livekitRoom: null,
});

function getParticipantInfo(p: LocalParticipant | RemoteParticipant): RoomParticipantInfo {
  const audioTrack = p.getTrackPublications().find(
    (pub) => pub.track?.kind === Track.Kind.Audio
  );
  return {
    identity: p.identity,
    name: p.name || p.identity,
    isSpeaking: p.isSpeaking,
    isMuted: audioTrack ? audioTrack.isMuted : true,
    isLocal: p instanceof LocalParticipant,
    audioLevel: p.audioLevel || 0,
  };
}

export function AudioRoomProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isOnStage, setIsOnStageState] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [volume, setVolumeState] = useState(80);
  const [participants, setParticipants] = useState<RoomParticipantInfo[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);

  const livekitRoomRef = useRef<Room | null>(null);

  const joinMutation = trpc.room.join.useMutation();
  const leaveMutation = trpc.room.leave.useMutation();
  const raiseHandMutation = trpc.room.raiseHand.useMutation();

  // Update participant list from LiveKit room state
  const updateParticipants = useCallback(() => {
    const room = livekitRoomRef.current;
    if (!room) {
      setParticipants([]);
      return;
    }
    const all: RoomParticipantInfo[] = [];
    // Local participant
    if (room.localParticipant) {
      all.push(getParticipantInfo(room.localParticipant));
    }
    // Remote participants
    room.remoteParticipants.forEach((p) => {
      all.push(getParticipantInfo(p));
    });
    setParticipants(all);
  }, []);

  // Connect to LiveKit room
  const connectToLiveKit = useCallback(async (roomSlug: string) => {
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) {
      console.warn("LiveKit URL not configured — running in UI-only mode");
      return;
    }

    try {
      // Get token from our API
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          roomSlug,
          userName: user?.name || "Anonymous",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to get LiveKit token:", err);
        toast.error("Could not connect to audio — running in listen-only mode");
        return;
      }

      const { token } = await res.json();

      // Create and connect room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Set up event listeners
      room.on(RoomEvent.ParticipantConnected, updateParticipants);
      room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.on(RoomEvent.TrackSubscribed, updateParticipants);
      room.on(RoomEvent.TrackUnsubscribed, updateParticipants);
      room.on(RoomEvent.TrackMuted, updateParticipants);
      room.on(RoomEvent.TrackUnmuted, updateParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, updateParticipants);
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        setConnectionState(state);
      });
      room.on(RoomEvent.Disconnected, () => {
        setConnectionState(ConnectionState.Disconnected);
      });

      await room.connect(livekitUrl, token);
      livekitRoomRef.current = room;
      setConnectionState(ConnectionState.Connected);
      updateParticipants();
    } catch (err) {
      console.error("LiveKit connection failed:", err);
      toast.error("Audio connection failed — you can still see the room");
    }
  }, [user, updateParticipants]);

  // Disconnect from LiveKit
  const disconnectLiveKit = useCallback(() => {
    const room = livekitRoomRef.current;
    if (room) {
      room.disconnect();
      livekitRoomRef.current = null;
    }
    setParticipants([]);
    setConnectionState(ConnectionState.Disconnected);
  }, []);

  const joinRoom = useCallback((room: ActiveRoom) => {
    // Disconnect from any existing room first
    disconnectLiveKit();

    setActiveRoom(room);
    setIsMuted(true);
    setIsOnStageState(false);
    setHandRaised(false);
    joinMutation.mutate({ roomId: room.id });
    toast.success(`Joined "${room.name}"`);

    // Connect to LiveKit
    connectToLiveKit(room.slug);
  }, [joinMutation, connectToLiveKit, disconnectLiveKit]);

  const leaveRoom = useCallback(() => {
    if (activeRoom) {
      leaveMutation.mutate({ roomId: activeRoom.id });
      toast.info(`Left "${activeRoom.name}"`);
    }
    disconnectLiveKit();
    setActiveRoom(null);
    setIsOnStageState(false);
    setHandRaised(false);
    setIsMuted(true);
  }, [activeRoom, leaveMutation, disconnectLiveKit]);

  const toggleMute = useCallback(async () => {
    const room = livekitRoomRef.current;
    if (room?.localParticipant) {
      const currentMuted = isMuted;
      if (currentMuted) {
        // Unmute — enable mic
        await room.localParticipant.setMicrophoneEnabled(true);
      } else {
        // Mute — disable mic
        await room.localParticipant.setMicrophoneEnabled(false);
      }
    }
    setIsMuted((prev) => !prev);
    updateParticipants();
  }, [isMuted, updateParticipants]);

  // When going on/off stage, enable/disable mic
  const setIsOnStage = useCallback(async (onStage: boolean) => {
    const room = livekitRoomRef.current;
    setIsOnStageState(onStage);

    if (room?.localParticipant) {
      if (onStage) {
        // Going on stage — enable mic then immediately mute
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMuted(true);
      } else {
        // Leaving stage — disable mic
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMuted(true);
      }
      updateParticipants();
    }
  }, [updateParticipants]);

  const raiseHand = useCallback(() => {
    if (!activeRoom) return;
    const newValue = !handRaised;
    setHandRaised(newValue);
    raiseHandMutation.mutate({ roomId: activeRoom.id, raised: newValue });
    if (newValue) toast.info("Hand raised — waiting to speak");
  }, [activeRoom, handRaised, raiseHandMutation]);

  // Volume control — adjust remote audio output
  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    const room = livekitRoomRef.current;
    if (room) {
      room.remoteParticipants.forEach((p) => {
        p.getTrackPublications().forEach((pub) => {
          if (pub.track?.kind === Track.Kind.Audio && pub.track?.mediaStreamTrack) {
            // Adjust volume via gain node if available, or fallback to audio element
            const audioElements = document.querySelectorAll("audio");
            audioElements.forEach((el) => {
              el.volume = v / 100;
            });
          }
        });
      });
    }
  }, []);

  // Refresh participants on a short interval for speaking indicators
  useEffect(() => {
    if (!livekitRoomRef.current) return;
    const interval = setInterval(updateParticipants, 500);
    return () => clearInterval(interval);
  }, [connectionState, updateParticipants]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectLiveKit();
    };
  }, [disconnectLiveKit]);

  return (
    <AudioRoomContext.Provider value={{
      activeRoom, joinRoom, leaveRoom,
      isMuted, toggleMute,
      isOnStage, setIsOnStage,
      handRaised, raiseHand,
      volume, setVolume,
      participants,
      connectionState,
      livekitRoom: livekitRoomRef.current,
    }}>
      {children}
    </AudioRoomContext.Provider>
  );
}

export function useAudioRoom() {
  return useContext(AudioRoomContext);
}
