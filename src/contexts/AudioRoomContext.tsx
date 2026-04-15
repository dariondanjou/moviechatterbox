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
  joinRoom: (room: ActiveRoom, isHost?: boolean) => void;
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
  isRecording: boolean;
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
  isRecording: false,
});

function getParticipantInfo(p: LocalParticipant | RemoteParticipant): RoomParticipantInfo {
  const pubs = p.getTrackPublications();
  const micPub = pubs.find(
    (pub) => pub.source === Track.Source.Microphone || pub.track?.kind === Track.Kind.Audio
  );
  // isMuted = no mic track at all, or track exists but is muted
  const isMuted = !micPub || !micPub.track || micPub.isMuted || micPub.track.isMuted;
  return {
    identity: p.identity,
    name: p.name || p.identity,
    isSpeaking: p.isSpeaking,
    isMuted,
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

  const [isRecording, setIsRecording] = useState(false);

  const livekitRoomRef = useRef<Room | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const isHostRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Speaker timeline tracking — records who spoke when
  const speakerTimelineRef = useRef<Array<{ identity: string; name: string; start: number; end: number }>>([]);
  const activeSpeakersRef = useRef<Map<string, { name: string; startTime: number }>>(new Map());

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
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        updateParticipants();

        // Track speaker timeline for transcription
        if (!isHostRef.current || !recordingStartTimeRef.current) return;
        const now = (Date.now() - recordingStartTimeRef.current) / 1000;
        const currentSpeakerIds = new Set(speakers.map((s) => s.identity));

        // Close segments for speakers who stopped
        activeSpeakersRef.current.forEach((info, identity) => {
          if (!currentSpeakerIds.has(identity)) {
            speakerTimelineRef.current.push({
              identity,
              name: info.name,
              start: info.startTime,
              end: now,
            });
            activeSpeakersRef.current.delete(identity);
          }
        });

        // Open segments for new speakers
        speakers.forEach((s) => {
          if (!activeSpeakersRef.current.has(s.identity)) {
            activeSpeakersRef.current.set(s.identity, {
              name: s.name || s.identity,
              startTime: now,
            });
          }
        });
      });
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

  // Start recording all room audio (host only)
  const startRecording = useCallback(() => {
    const room = livekitRoomRef.current;
    if (!room) return;

    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const destination = ctx.createMediaStreamDestination();

      // Helper to connect a track to the mixer
      const connectTrack = (mediaStream: MediaStream) => {
        const source = ctx.createMediaStreamSource(mediaStream);
        source.connect(destination);
      };

      // Connect all existing remote audio tracks
      room.remoteParticipants.forEach((p) => {
        p.getTrackPublications().forEach((pub) => {
          if (pub.track?.kind === Track.Kind.Audio && pub.track?.mediaStreamTrack) {
            const ms = new MediaStream([pub.track.mediaStreamTrack]);
            connectTrack(ms);
          }
        });
      });

      // Connect local mic if publishing
      const localAudio = room.localParticipant.getTrackPublications().find(
        (pub) => pub.track?.kind === Track.Kind.Audio
      );
      if (localAudio?.track?.mediaStreamTrack) {
        const ms = new MediaStream([localAudio.track.mediaStreamTrack]);
        connectTrack(ms);
      }

      // Also connect new tracks as they arrive
      room.on(RoomEvent.TrackSubscribed, (_track, pub) => {
        if (pub.track?.kind === Track.Kind.Audio && pub.track?.mediaStreamTrack) {
          const ms = new MediaStream([pub.track.mediaStreamTrack]);
          connectTrack(ms);
        }
      });

      const recorder = new MediaRecorder(destination.stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.start(1000); // collect data every second
      mediaRecorderRef.current = recorder;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }, []);

  // Stop recording and upload
  const stopRecordingAndUpload = useCallback(async (roomId: number) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);

        // Close audio context
        audioContextRef.current?.close();
        audioContextRef.current = null;

        // Flush any still-active speakers into the timeline
        const endTime = duration;
        activeSpeakersRef.current.forEach((info, identity) => {
          speakerTimelineRef.current.push({
            identity,
            name: info.name,
            start: info.startTime,
            end: endTime,
          });
        });
        activeSpeakersRef.current.clear();

        const timeline = [...speakerTimelineRef.current];
        speakerTimelineRef.current = [];

        // Only upload if we have meaningful audio (> 5 seconds)
        if (duration < 5) {
          resolve();
          return;
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const formData = new FormData();
          formData.append("recording", blob, "recording.webm");
          formData.append("roomId", String(roomId));
          formData.append("duration", String(duration));
          formData.append("speakerTimeline", JSON.stringify(timeline));

          const res = await fetch("/api/recordings/upload", {
            method: "POST",
            headers: {
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: formData,
          });

          if (res.ok) {
            toast.success("Room recording saved!");
          } else {
            console.error("Recording upload failed:", await res.text());
          }
        } catch (err) {
          console.error("Recording upload error:", err);
        }
        resolve();
      };
      recorder.stop();
    });
  }, []);

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

  const joinRoom = useCallback((room: ActiveRoom, isHost = false) => {
    // Disconnect from any existing room first
    disconnectLiveKit();

    setActiveRoom(room);
    setIsMuted(true);
    setIsOnStageState(false);
    setHandRaised(false);
    isHostRef.current = isHost;
    joinMutation.mutate({ roomId: room.id });
    toast.success(`Joined "${room.name}"`);

    // Connect to LiveKit, then start recording if host
    connectToLiveKit(room.slug).then(() => {
      if (isHost && livekitRoomRef.current) {
        // Small delay to let tracks connect
        setTimeout(() => startRecording(), 2000);
      }
    });
  }, [joinMutation, connectToLiveKit, disconnectLiveKit, startRecording]);

  const leaveRoom = useCallback(async () => {
    if (activeRoom) {
      // If host is recording, stop and upload before leaving
      if (isHostRef.current && mediaRecorderRef.current) {
        toast.info("Saving recording...");
        await stopRecordingAndUpload(activeRoom.id);
      }
      leaveMutation.mutate({ roomId: activeRoom.id });
      toast.info(`Left "${activeRoom.name}"`);
    }
    disconnectLiveKit();
    setActiveRoom(null);
    setIsOnStageState(false);
    setHandRaised(false);
    setIsMuted(true);
    isHostRef.current = false;
  }, [activeRoom, leaveMutation, disconnectLiveKit, stopRecordingAndUpload]);

  const toggleMute = useCallback(async () => {
    const room = livekitRoomRef.current;
    if (room?.localParticipant) {
      const newMuted = !isMuted;
      // setMicrophoneEnabled(true) publishes mic, (false) unpublishes.
      // LiveKit automatically propagates this to all participants via
      // TrackMuted/TrackUnmuted/TrackSubscribed/TrackUnsubscribed events.
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      setIsMuted(newMuted);
      setTimeout(() => updateParticipants(), 300);
    } else {
      setIsMuted((prev) => !prev);
    }
  }, [isMuted, updateParticipants]);

  // When going on/off stage, enable/disable mic
  const setIsOnStage = useCallback(async (onStage: boolean) => {
    const room = livekitRoomRef.current;
    setIsOnStageState(onStage);

    if (room?.localParticipant) {
      if (onStage) {
        // Going on stage — publish mic but start muted
        // Enable mic so the track exists and other participants can see us on stage
        await room.localParticipant.setMicrophoneEnabled(true);
        // Immediately disable to start muted — user must click Unmute to speak
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMuted(true);
      } else {
        // Leaving stage — unpublish mic entirely
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMuted(true);
      }
      setTimeout(() => updateParticipants(), 200);
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
      isRecording,
    }}>
      {children}
    </AudioRoomContext.Provider>
  );
}

export function useAudioRoom() {
  return useContext(AudioRoomContext);
}
