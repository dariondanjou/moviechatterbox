"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ActiveRoom {
  id: number;
  name: string;
  slug: string;
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
});

export function AudioRoomProvider({ children }: { children: ReactNode }) {
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnStage, setIsOnStage] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [volume, setVolume] = useState(80);

  const joinMutation = trpc.room.join.useMutation();
  const leaveMutation = trpc.room.leave.useMutation();
  const raiseHandMutation = trpc.room.raiseHand.useMutation();

  const joinRoom = useCallback((room: ActiveRoom) => {
    setActiveRoom(room);
    setIsMuted(false);
    setIsOnStage(false);
    setHandRaised(false);
    joinMutation.mutate({ roomId: room.id });
    toast.success(`Joined "${room.name}"`);
  }, [joinMutation]);

  const leaveRoom = useCallback(() => {
    if (activeRoom) {
      leaveMutation.mutate({ roomId: activeRoom.id });
      toast.info(`Left "${activeRoom.name}"`);
    }
    setActiveRoom(null);
    setIsOnStage(false);
    setHandRaised(false);
  }, [activeRoom, leaveMutation]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const raiseHand = useCallback(() => {
    if (!activeRoom) return;
    const newValue = !handRaised;
    setHandRaised(newValue);
    raiseHandMutation.mutate({ roomId: activeRoom.id, raised: newValue });
    if (newValue) toast.info("Hand raised — waiting to speak");
  }, [activeRoom, handRaised, raiseHandMutation]);

  return (
    <AudioRoomContext.Provider value={{
      activeRoom, joinRoom, leaveRoom,
      isMuted, toggleMute,
      isOnStage, setIsOnStage,
      handRaised, raiseHand,
      volume, setVolume,
    }}>
      {children}
    </AudioRoomContext.Provider>
  );
}

export function useAudioRoom() {
  return useContext(AudioRoomContext);
}
