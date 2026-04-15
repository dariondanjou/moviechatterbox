"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useAudioRoom, RoomParticipantInfo } from "@/contexts/AudioRoomContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ConnectionState } from "livekit-client";
import {
  Mic, MicOff, PhoneOff, Hand, Users, Radio, Film, User,
  ChevronLeft, Crown, Volume2, VolumeX, Share2, Flag, Wifi, WifiOff,
  Play, Pause, Clock, SkipBack, SkipForward
} from "lucide-react";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface TranscriptSegment {
  speaker: string;
  speakerName: string;
  text: string;
  start: number;
  end: number;
}

interface SpeakerTimelineEntry {
  identity: string;
  name: string;
  start: number;
  end: number;
}

// Assign consistent colors to speakers
const SPEAKER_COLORS = [
  "bg-primary/20 text-primary border-primary/40",
  "bg-green-500/20 text-green-400 border-green-500/40",
  "bg-purple-500/20 text-purple-400 border-purple-500/40",
  "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  "bg-pink-500/20 text-pink-400 border-pink-500/40",
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
];

const SPEAKER_DOT_COLORS = [
  "bg-primary", "bg-green-500", "bg-purple-500",
  "bg-yellow-500", "bg-pink-500", "bg-cyan-500",
];

function RecordingPlayer({
  url, duration, transcript, speakerTimeline,
}: {
  url: string;
  duration?: number | null;
  transcript?: TranscriptSegment[];
  speakerTimeline?: SpeakerTimelineEntry[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(true);

  // Build unique speaker list for color assignment
  const speakerMap = useMemo(() => {
    const map = new Map<string, number>();
    const segments = transcript || [];
    segments.forEach((seg) => {
      if (!map.has(seg.speaker)) {
        map.set(seg.speaker, map.size);
      }
    });
    // Also include speakers from timeline
    (speakerTimeline || []).forEach((seg) => {
      if (!map.has(seg.identity)) {
        map.set(seg.identity, map.size);
      }
    });
    return map;
  }, [transcript, speakerTimeline]);

  // Which speakers are "active" at the current playback time
  const activeSpeakers = useMemo(() => {
    const active = new Set<string>();
    (speakerTimeline || []).forEach((seg) => {
      if (currentTime >= seg.start && currentTime <= seg.end) {
        active.add(seg.identity);
      }
    });
    // Also check transcript segments
    (transcript || []).forEach((seg) => {
      if (currentTime >= seg.start && currentTime <= seg.end) {
        active.add(seg.speaker);
      }
    });
    return active;
  }, [currentTime, speakerTimeline, transcript]);

  // All unique speakers for the bubble row
  const allSpeakers = useMemo(() => {
    const seen = new Map<string, string>();
    (speakerTimeline || []).forEach((s) => {
      if (!seen.has(s.identity)) seen.set(s.identity, s.name);
    });
    (transcript || []).forEach((s) => {
      if (!seen.has(s.speaker)) seen.set(s.speaker, s.speakerName);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [speakerTimeline, transcript]);

  // Current transcript segment index
  const currentSegmentIndex = useMemo(() => {
    if (!transcript) return -1;
    return transcript.findIndex(
      (seg) => currentTime >= seg.start && currentTime <= seg.end
    );
  }, [currentTime, transcript]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) setTotalDuration(audio.duration);
    };
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Auto-scroll transcript to current segment
  useEffect(() => {
    if (currentSegmentIndex < 0 || !transcriptContainerRef.current) return;
    const el = transcriptContainerRef.current.children[currentSegmentIndex] as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSegmentIndex]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); } else { audio.play(); }
    setIsPlaying(!isPlaying);
  };

  const seek = (value: number[]) => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = value[0]; setCurrentTime(value[0]); }
  };

  const seekToTime = (time: number) => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = time; setCurrentTime(time); if (!isPlaying) { audio.play(); setIsPlaying(true); } }
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, totalDuration)); }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div className="space-y-4">
      {/* Player Card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <audio ref={audioRef} src={url} preload="metadata" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Room Recording</h2>
          </div>
          {transcript && transcript.length > 0 && (
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-xs text-primary hover:underline"
            >
              {showTranscript ? "Hide Transcript" : "Show Transcript"}
            </button>
          )}
        </div>

        {/* Active Speakers — mini bubbles showing who's talking now */}
        {allSpeakers.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {allSpeakers.map((s) => {
              const colorIdx = (speakerMap.get(s.id) || 0) % SPEAKER_COLORS.length;
              const isActive = activeSpeakers.has(s.id);
              const initials = s.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium transition-all ${
                    isActive
                      ? SPEAKER_COLORS[colorIdx]
                      : "bg-secondary/50 text-muted-foreground border-border opacity-50"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive ? SPEAKER_DOT_COLORS[colorIdx] + " text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {initials}
                  </div>
                  <span>{s.name.split(" ")[0]}</span>
                  {isActive && (
                    <div className="flex items-end gap-px h-3 ml-0.5">
                      {[1,2,3].map(i => (
                        <div key={i} className={`w-0.5 rounded-full waveform-bar ${SPEAKER_DOT_COLORS[colorIdx]}`} style={{ height: "100%" }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Speaker Activity Timeline Bar */}
        {speakerTimeline && speakerTimeline.length > 0 && totalDuration > 0 && (
          <div className="mb-3">
            <div className="relative h-6 bg-secondary rounded-lg overflow-hidden cursor-pointer" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              seekToTime(pct * totalDuration);
            }}>
              {speakerTimeline.map((seg, i) => {
                const colorIdx = (speakerMap.get(seg.identity) || 0) % SPEAKER_DOT_COLORS.length;
                const left = (seg.start / totalDuration) * 100;
                const width = Math.max(((seg.end - seg.start) / totalDuration) * 100, 0.3);
                return (
                  <div
                    key={i}
                    className={`absolute top-0 h-full ${SPEAKER_DOT_COLORS[colorIdx]} opacity-60 hover:opacity-100 transition-opacity`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${seg.name}: ${formatTime(seg.start)} - ${formatTime(seg.end)}`}
                  />
                );
              })}
              {/* Playhead */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white z-10"
                style={{ left: `${(currentTime / totalDuration) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {allSpeakers.map((s) => {
                const colorIdx = (speakerMap.get(s.id) || 0) % SPEAKER_DOT_COLORS.length;
                return (
                  <div key={s.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className={`w-2 h-2 rounded-full ${SPEAKER_DOT_COLORS[colorIdx]}`} />
                    <span>{s.name.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress Slider */}
        <div className="mb-4">
          <Slider
            value={[currentTime]}
            onValueChange={seek}
            min={0}
            max={totalDuration || 1}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
            <span className="text-xs text-muted-foreground">{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => skip(-15)} className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Back 15s">
            <SkipBack className="w-4 h-4" />
          </button>
          <button onClick={togglePlay} className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={() => skip(30)} className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Forward 30s">
            <SkipForward className="w-4 h-4" />
          </button>
          <button onClick={cycleSpeed} className="px-2.5 py-1 rounded-full bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors" title="Playback speed">
            {playbackRate}x
          </button>
        </div>
      </div>

      {/* Transcript */}
      {showTranscript && transcript && transcript.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Transcript</h2>
            <span className="text-xs text-muted-foreground ml-auto">{transcript.length} segments</span>
          </div>

          <div ref={transcriptContainerRef} className="space-y-3 max-h-96 overflow-y-auto pr-2 scroll-smooth">
            {transcript.map((seg, i) => {
              const colorIdx = (speakerMap.get(seg.speaker) || 0) % SPEAKER_COLORS.length;
              const isCurrent = i === currentSegmentIndex;
              const isPast = currentTime > seg.end;
              const initials = seg.speakerName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

              return (
                <div
                  key={i}
                  onClick={() => seekToTime(seg.start)}
                  className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    isCurrent
                      ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/20"
                      : isPast
                        ? "opacity-60 hover:opacity-100 hover:bg-secondary/50"
                        : "hover:bg-secondary/50"
                  }`}
                >
                  {/* Speaker avatar */}
                  <div className="shrink-0 pt-0.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                      isCurrent
                        ? SPEAKER_COLORS[colorIdx]
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>
                      {initials}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold ${
                        isCurrent ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {seg.speakerName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(seg.start)}
                      </span>
                      {isCurrent && (
                        <div className="flex items-end gap-px h-2.5 ml-1">
                          {[1,2,3].map(j => (
                            <div key={j} className="w-0.5 bg-primary rounded-full waveform-bar" style={{ height: "100%" }} />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      isCurrent ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {seg.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function UserBubble({ name, avatar, isMuted, isHost, handRaised, isSpeaking, audioLevel }: {
  name: string; avatar?: string | null; isMuted?: boolean; isHost?: boolean;
  handRaised?: boolean; isSpeaking?: boolean; audioLevel?: number;
}) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const ringScale = isSpeaking ? Math.min(1 + (audioLevel || 0) * 0.5, 1.15) : 1;

  return (
    <div className="flex flex-col items-center gap-1.5 w-16">
      <div className="relative">
        <Avatar
          className={`w-14 h-14 ring-2 transition-all ${
            isSpeaking ? "ring-primary ring-offset-2 ring-offset-background" : "ring-border"
          }`}
          style={{ transform: `scale(${ringScale})` }}
        >
          <AvatarImage src={avatar || undefined} />
          <AvatarFallback className="bg-secondary text-sm font-bold text-foreground">{initials}</AvatarFallback>
        </Avatar>
        {/* Speaking waveform */}
        {isSpeaking && !isMuted && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-3">
            {[1,2,3].map(i => (
              <div key={i} className="w-0.5 bg-primary rounded-full waveform-bar" style={{ height: "100%" }} />
            ))}
          </div>
        )}
        {/* Muted icon */}
        {isMuted && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}
        {/* Host crown */}
        {isHost && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
            <Crown className="w-3 h-3 text-black" />
          </div>
        )}
        {/* Raised hand */}
        {handRaised && (
          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-xs">
            ✋
          </div>
        )}
      </div>
      <span className="text-xs text-foreground text-center line-clamp-1 w-full">{name.split(" ")[0]}</span>
    </div>
  );
}

export default function RoomDetail() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const {
    activeRoom, joinRoom, leaveRoom,
    isMuted, toggleMute,
    isOnStage, setIsOnStage,
    handRaised, raiseHand,
    participants: livekitParticipants,
    connectionState,
  } = useAudioRoom();

  const { data: room, isLoading, refetch } = trpc.room.detail.useQuery(
    { slug: slug! },
    { enabled: !!slug, refetchInterval: 5000 }
  );

  const updateRoleMutation = trpc.room.updateRole.useMutation({
    onSuccess: () => refetch(),
  });

  const isCurrentRoom = activeRoom?.slug === slug;

  // Merge DB participants with LiveKit real-time state
  const { speakers, audience } = useMemo(() => {
    const dbParticipants = room?.participants || [];
    const speakerList: Array<{
      id: number; name: string; avatar: string | null;
      isMuted: boolean; isHost: boolean; isSpeaking: boolean;
      handRaised: boolean; audioLevel: number;
    }> = [];
    const audienceList: Array<{
      id: number; name: string; avatar: string | null;
      handRaised: boolean;
    }> = [];

    for (const p of dbParticipants) {
      // Try to match with LiveKit participant for real-time audio state
      const lkMatch = livekitParticipants.find(
        (lk) => lk.identity === `user-${p.id}` || lk.name === p.userName
      );

      if (p.role === "speaker" || p.role === "host") {
        speakerList.push({
          id: p.id,
          name: p.userName || "Unknown",
          avatar: p.userAvatar || null,
          isMuted: lkMatch ? lkMatch.isMuted : (p.isMuted ?? true),
          isHost: p.role === "host",
          isSpeaking: lkMatch ? lkMatch.isSpeaking : false,
          handRaised: false,
          audioLevel: lkMatch?.audioLevel || 0,
        });
      } else {
        audienceList.push({
          id: p.id,
          name: p.userName || "Unknown",
          avatar: p.userAvatar || null,
          handRaised: p.handRaised ?? false,
        });
      }
    }

    return { speakers: speakerList, audience: audienceList };
  }, [room?.participants, livekitParticipants]);

  const handleJoin = () => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    if (room) {
      joinRoom({ id: room.id, name: room.name, slug: room.slug });
    }
  };

  const handleLeave = () => {
    leaveRoom();
    router.push("/rooms");
  };

  const handleGoOnStage = () => {
    if (!room) return;
    setIsOnStage(true);
    updateRoleMutation.mutate({ roomId: room.id, role: "speaker" });
  };

  const handleGoToAudience = () => {
    if (!room) return;
    setIsOnStage(false);
    updateRoleMutation.mutate({ roomId: room.id, role: "listener" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Radio className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Room Not Found</h2>
          <Link href="/rooms"><Button variant="outline">Back to Hallway</Button></Link>
        </div>
      </div>
    );
  }

  const parsedTags: string[] = (() => {
    try { return JSON.parse(room.tags || "[]"); } catch { return []; }
  })();

  const isLive = room.isLive;
  const totalSpeakers = speakers.length + (isCurrentRoom && isOnStage ? 1 : 0);
  const totalAudience = audience.length + (isCurrentRoom && !isOnStage ? 1 : 0);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Back */}
      <div className="sticky top-16 z-40 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="container py-3 flex items-center justify-between">
          <Link href="/rooms">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" /> Hallway
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {isLive && isCurrentRoom && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
                {connectionState === ConnectionState.Connected ? (
                  <><Wifi className="w-3 h-3 text-green-500" /> Connected</>
                ) : connectionState === ConnectionState.Connecting ? (
                  <><Wifi className="w-3 h-3 text-yellow-500 animate-pulse" /> Connecting...</>
                ) : (
                  <><WifiOff className="w-3 h-3 text-muted-foreground" /> Audio off</>
                )}
              </span>
            )}
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Live</span>
              </>
            ) : (
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ended</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Flag className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Main Room */}
          <div>
            {/* Room Header */}
            <div className="bg-card border border-border rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Radio className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">{room.name}</h1>
                  {room.description && (
                    <p className="text-sm text-muted-foreground mt-1">{room.description}</p>
                  )}
                </div>
              </div>

              {/* Tags */}
              {parsedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {parsedTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs bg-primary/10 text-primary border border-primary/20">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {isLive ? (
                  <>
                    <span className="flex items-center gap-1">
                      <Mic className="w-3.5 h-3.5" /> {totalSpeakers} speaking
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {totalAudience + (room.listenerCount || 0)} listening
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Ended {room.endedAt ? new Date(room.endedAt).toLocaleDateString() : ""}
                    </span>
                    {room.recordingDuration && (
                      <span className="flex items-center gap-1">
                        <Play className="w-3.5 h-3.5" /> {formatTime(room.recordingDuration)} recording
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {(room.participants || []).length} participated
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Recording Player (past rooms) */}
            {!isLive && room.recordingUrl && (
              <div className="mb-6">
                <RecordingPlayer
                  url={room.recordingUrl}
                  duration={room.recordingDuration}
                  transcript={(() => { try { return JSON.parse(room.transcript || "[]"); } catch { return []; } })()}
                  speakerTimeline={(() => { try { return JSON.parse(room.speakerTimeline || "[]"); } catch { return []; } })()}
                />
              </div>
            )}

            {/* No recording message (past rooms without recording) */}
            {!isLive && !room.recordingUrl && (
              <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-center">
                <VolumeX className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No recording available for this room</p>
              </div>
            )}

            {/* Stage -- Speakers (only for live rooms) */}
            {isLive && (
              <div className="bg-card border border-border rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-5">
                  <Mic className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">On Stage</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                  {speakers.length === 0 && !isCurrentRoom && (
                    <p className="text-sm text-muted-foreground">No speakers yet — join and go on stage!</p>
                  )}
                  {speakers.map((s) => (
                    <UserBubble
                      key={s.id}
                      name={s.name}
                      avatar={s.avatar}
                      isMuted={s.isMuted}
                      isHost={s.isHost}
                      isSpeaking={s.isSpeaking}
                      audioLevel={s.audioLevel}
                    />
                  ))}
                  {/* Current user on stage */}
                  {isCurrentRoom && isOnStage && user && (
                    <UserBubble
                      name={user.name || "You"}
                      avatar={user.avatarUrl}
                      isMuted={isMuted}
                      isSpeaking={!isMuted}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Audience -- Listeners (only for live rooms) */}
            {isLive && (
              <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-5">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Audience</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                  {audience.length === 0 && !isCurrentRoom && (
                    <p className="text-sm text-muted-foreground">No listeners yet — be the first to join!</p>
                  )}
                  {audience.map(a => (
                    <UserBubble key={a.id} name={a.name} avatar={a.avatar} handRaised={a.handRaised} />
                  ))}
                  {/* Current user in audience */}
                  {isCurrentRoom && !isOnStage && user && (
                    <UserBubble name={user.name || "You"} avatar={user.avatarUrl} handRaised={handRaised} />
                  )}
                </div>
              </div>
            )}

            {/* Participants list (past rooms) */}
            {!isLive && (room.participants || []).length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-5">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Participants</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[...speakers, ...audience].map(p => (
                    <UserBubble key={p.id} name={p.name} avatar={p.avatar} />
                  ))}
                </div>
              </div>
            )}

            {/* Join/Leave Controls (live only) */}
            {isLive && <div className="bg-card border border-border rounded-2xl p-4">
              {!isCurrentRoom ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Join to listen and participate in this conversation
                  </div>
                  <Button
                    onClick={handleJoin}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    <Headphones className="w-4 h-4" /> Join Room
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {/* Mute/Unmute (stage only) */}
                    {isOnStage && (
                      <Button
                        onClick={toggleMute}
                        variant="outline"
                        className={`gap-2 ${isMuted ? "border-destructive text-destructive hover:bg-destructive/10" : "border-primary text-primary hover:bg-primary/10"}`}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        {isMuted ? "Unmute" : "Mute"}
                      </Button>
                    )}

                    {/* Raise hand (audience only) */}
                    {!isOnStage && (
                      <Button
                        onClick={raiseHand}
                        variant="outline"
                        className={`gap-2 ${handRaised ? "border-yellow-500 text-yellow-500 hover:bg-yellow-500/10" : "border-border"}`}
                      >
                        <Hand className="w-4 h-4" />
                        {handRaised ? "Lower Hand" : "Raise Hand"}
                      </Button>
                    )}

                    {/* Move to stage / audience */}
                    <Button
                      onClick={isOnStage ? handleGoToAudience : handleGoOnStage}
                      variant="outline"
                      className="gap-2 border-border text-muted-foreground hover:text-foreground"
                    >
                      {isOnStage ? <><Users className="w-4 h-4" /> Move to Audience</> : <><Mic className="w-4 h-4" /> Go on Stage</>}
                    </Button>
                  </div>

                  <Button
                    onClick={handleLeave}
                    variant="outline"
                    className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <PhoneOff className="w-4 h-4" /> Leave Quietly
                  </Button>
                </div>
              )}
            </div>}
          </div>

          {/* Sidebar -- Related Content */}
          <div className="space-y-4">
            {/* Related Movie */}
            {(room as any).relatedMovie && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Film className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Related Movie</span>
                </div>
                <Link href={`/movie/${(room as any).relatedMovie.slug}`}>
                  <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <img
                      src={(room as any).relatedMovie.posterUrl || `https://via.placeholder.com/48x72/1a1a1a/ff6b35?text=?`}
                      alt={(room as any).relatedMovie.title}
                      className="w-12 h-16 object-cover rounded"
                    />
                    <div>
                      <div className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                        {(room as any).relatedMovie.title}
                      </div>
                      <div className="text-xs text-muted-foreground">{(room as any).relatedMovie.year}</div>
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Related Person */}
            {(room as any).relatedPerson && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Related Person</span>
                </div>
                <Link href={`/person/${(room as any).relatedPerson.slug}`}>
                  <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={(room as any).relatedPerson.photoUrl || undefined} />
                      <AvatarFallback className="bg-secondary font-bold">
                        {(room as any).relatedPerson.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                        {(room as any).relatedPerson.name}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Related Links from room */}
            {(room as any).links && (room as any).links.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Film className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Also Mentioned</span>
                </div>
                <div className="space-y-2">
                  {(room as any).links.map((link: any) => (
                    <Link key={link.id} href={link.linkType === "movie" ? `/movie/${link.slug}` : `/person/${link.slug}`}>
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors">
                        {link.posterUrl
                          ? <img src={link.posterUrl} alt={link.title} className="w-8 h-10 object-cover rounded" />
                          : <Avatar className="w-8 h-8"><AvatarFallback className="bg-secondary text-xs">{link.title?.charAt(0)}</AvatarFallback></Avatar>
                        }
                        <div className="text-xs font-medium text-foreground hover:text-primary transition-colors line-clamp-1">{link.title}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Room Info */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Room Info</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Host</span>
                  <span className="text-foreground font-medium">{(room as any).hostName || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span className="text-foreground">{new Date(room.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Participants</span>
                  <span className="text-foreground">{(room.participants || []).length}</span>
                </div>
                {isLive && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Audio</span>
                    <span className={connectionState === ConnectionState.Connected ? "text-green-500 font-medium" : "text-muted-foreground"}>
                      {isCurrentRoom
                        ? connectionState === ConnectionState.Connected ? "Connected" : connectionState === ConnectionState.Connecting ? "Connecting..." : "Not connected"
                        : "Join to connect"
                      }
                    </span>
                  </div>
                )}
                {!isLive && room.endedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ended</span>
                    <span className="text-foreground">{new Date(room.endedAt).toLocaleDateString()}</span>
                  </div>
                )}
                {!isLive && room.recordingUrl && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recording</span>
                    <span className="text-green-500 font-medium">Available</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={isLive ? "text-primary font-medium" : "text-muted-foreground"}>
                    {isLive ? "Live" : "Ended"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Headphones({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}
