import { useState } from "react";
import { Link } from "wouter";
import { Mic, MicOff, PhoneOff, Users, Hand, ChevronUp, ChevronDown, Volume2, Radio } from "lucide-react";
import { useAudioRoom } from "@/contexts/AudioRoomContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function FloatingAudioPlayer() {
  const { activeRoom, leaveRoom, isMuted, toggleMute, isOnStage, raiseHand, handRaised, volume, setVolume } = useAudioRoom();
  const [expanded, setExpanded] = useState(false);

  if (!activeRoom) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg">
      <div className="bg-[oklch(0.16_0_0)] border border-primary/40 rounded-2xl shadow-2xl overflow-hidden room-live-glow">
        {/* Expanded Panel */}
        {expanded && (
          <div className="px-4 pt-4 pb-2 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Now in Room</span>
              <Link href={`/rooms/${activeRoom.slug}`} className="text-xs text-primary hover:underline">
                View Room →
              </Link>
            </div>
            <div className="text-sm font-semibold text-foreground mb-3 line-clamp-1">{activeRoom.name}</div>

            {/* Volume */}
            <div className="flex items-center gap-3 mb-3">
              <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <Slider
                value={[volume]}
                onValueChange={([v]) => setVolume(v)}
                min={0} max={100} step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{volume}%</span>
            </div>

            {/* Stage indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isOnStage
                ? <><Mic className="w-3 h-3 text-primary" /><span className="text-primary">You're on stage</span></>
                : <><Users className="w-3 h-3" /><span>You're in the audience</span></>
              }
            </div>
          </div>
        )}

        {/* Main Bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Live indicator + room name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <Radio className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-primary font-bold uppercase tracking-wider">Live</div>
              <div className="text-sm font-medium text-foreground line-clamp-1">{activeRoom.name}</div>
            </div>
          </div>

          {/* Waveform (when unmuted on stage) */}
          {isOnStage && !isMuted && (
            <div className="flex items-end gap-0.5 h-6 shrink-0">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-1 bg-primary rounded-full waveform-bar" style={{ height: "100%" }} />
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Raise hand (audience only) */}
            {!isOnStage && (
              <button
                onClick={raiseHand}
                className={`p-2 rounded-full transition-colors ${
                  handRaised ? "bg-yellow-500/20 text-yellow-400" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
                title={handRaised ? "Lower hand" : "Raise hand"}
              >
                <Hand className="w-4 h-4" />
              </button>
            )}

            {/* Mute/Unmute (stage only) */}
            {isOnStage && (
              <button
                onClick={toggleMute}
                className={`p-2 rounded-full transition-colors ${
                  isMuted ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
                }`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Leave */}
            <button
              onClick={leaveRoom}
              className="p-2 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
              title="Leave room"
            >
              <PhoneOff className="w-4 h-4" />
            </button>

            {/* Expand/Collapse */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
