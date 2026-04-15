"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useAudioRoom, RoomParticipantInfo } from "@/contexts/AudioRoomContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ConnectionState } from "livekit-client";
import {
  Mic, MicOff, PhoneOff, Hand, Users, Radio, Film, User,
  ChevronLeft, Crown, Volume2, VolumeX, Share2, Flag, Wifi, WifiOff
} from "lucide-react";

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
            {isCurrentRoom && (
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
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Live</span>
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
                <span className="flex items-center gap-1">
                  <Mic className="w-3.5 h-3.5" /> {totalSpeakers} speaking
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {totalAudience + (room.listenerCount || 0)} listening
                </span>
              </div>
            </div>

            {/* Stage -- Speakers */}
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

            {/* Audience -- Listeners */}
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

            {/* Join/Leave Controls */}
            <div className="bg-card border border-border rounded-2xl p-4">
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
            </div>
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Audio</span>
                  <span className={connectionState === ConnectionState.Connected ? "text-green-500 font-medium" : "text-muted-foreground"}>
                    {isCurrentRoom
                      ? connectionState === ConnectionState.Connected ? "Connected" : connectionState === ConnectionState.Connecting ? "Connecting..." : "Not connected"
                      : "Join to connect"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-primary font-medium">Live</span>
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
