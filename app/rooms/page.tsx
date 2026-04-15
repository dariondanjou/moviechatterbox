"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AudioRoomCard from "@/components/AudioRoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Mic, Radio, Users, Plus, Search, Headphones, Clock, Play } from "lucide-react";
import Link from "next/link";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function Rooms() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchQ, setSearchQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", tags: "" });
  const [tab, setTab] = useState<"live" | "past">("live");

  const { data: rooms, refetch } = trpc.room.list.useQuery();
  const { data: pastRooms } = trpc.room.pastRooms.useQuery(
    { limit: 30, offset: 0 },
    { enabled: tab === "past" }
  );

  const createRoom = trpc.room.create.useMutation({
    onSuccess: (data) => {
      setCreateOpen(false);
      setForm({ name: "", description: "", tags: "" });
      refetch();
      toast.success("Room created! Joining now...");
      router.push(`/rooms/${data.slug}`);
    },
    onError: () => toast.error("Failed to create room"),
  });

  const filteredRooms = rooms?.filter(r =>
    !searchQ || r.name.toLowerCase().includes(searchQ.toLowerCase())
  );

  const filteredPastRooms = pastRooms?.filter(r =>
    !searchQ || r.name.toLowerCase().includes(searchQ.toLowerCase())
  );

  const totalListeners = rooms?.reduce((sum, r) => sum + (r.listenerCount || 0), 0) || 0;
  const totalSpeakers = rooms?.reduce((sum, r) => sum + (r.speakerCount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-card to-background border-b border-border">
        <div className="container py-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Live Hallway</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Audio Rooms</h1>
              <p className="text-muted-foreground text-sm">
                Join live conversations about movies, directors, and actors
              </p>
            </div>

            {isAuthenticated ? (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shrink-0">
                    <Plus className="w-4 h-4" /> Start a Room
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-popover border-border max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Start an Audio Room</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                        Room Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Discussing The Dark Knight trilogy..."
                        className="bg-secondary border-border"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Must be related to a movie, cast, director, or actor</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Description</label>
                      <Textarea
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="What will you be discussing?"
                        rows={2}
                        className="bg-secondary border-border resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Tags (comma separated)</label>
                      <Input
                        value={form.tags}
                        onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                        placeholder="e.g. Christopher Nolan, Batman, Thriller"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <Button
                      onClick={() => createRoom.mutate({
                        name: form.name,
                        description: form.description,
                        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
                      })}
                      disabled={form.name.length < 3 || createRoom.isPending}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                    >
                      <Mic className="w-4 h-4" />
                      {createRoom.isPending ? "Creating..." : "Start Room"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shrink-0"
                onClick={() => router.push("/auth")}
              >
                <Plus className="w-4 h-4" /> Start a Room
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              <span className="text-foreground font-semibold">{rooms?.length || 0}</span>
              <span className="text-muted-foreground">rooms live</span>
            </div>
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground font-semibold">{totalListeners}</span>
              <span className="text-muted-foreground">listening</span>
            </div>
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground font-semibold">{totalSpeakers}</span>
              <span className="text-muted-foreground">speaking</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Tabs + Search */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center bg-secondary rounded-lg p-1">
            <button
              onClick={() => setTab("live")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "live" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                Live Now
                {rooms && rooms.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/20 text-primary">{rooms.length}</span>
                )}
              </span>
            </button>
            <button
              onClick={() => setTab("past")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "past" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Past Rooms
              </span>
            </button>
          </div>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search rooms..."
              className="pl-9 bg-secondary border-border"
            />
          </div>
        </div>

        {/* Live Rooms */}
        {tab === "live" && (
          <>
            {!rooms ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-40 rounded-xl" />
                ))}
              </div>
            ) : filteredRooms && filteredRooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.map(room => (
                  <AudioRoomCard key={room.id} {...room} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Radio className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchQ ? "No rooms match your search" : "No live rooms right now"}
                </h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {searchQ ? "Try a different search term" : "Be the first to start a conversation!"}
                </p>
                {isAuthenticated && !searchQ && (
                  <Button
                    onClick={() => setCreateOpen(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    <Plus className="w-4 h-4" /> Start a Room
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {/* Past Rooms */}
        {tab === "past" && (
          <>
            {!pastRooms ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-40 rounded-xl" />
                ))}
              </div>
            ) : filteredPastRooms && filteredPastRooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPastRooms.map(room => (
                  <Link key={room.id} href={`/rooms/${room.slug}`}>
                    <div className="group bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all hover:bg-card/80 cursor-pointer">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            room.recordingUrl
                              ? "bg-primary/10 border border-primary/30"
                              : "bg-secondary border border-border"
                          }`}>
                            {room.recordingUrl ? (
                              <Play className="w-5 h-5 text-primary" />
                            ) : (
                              <Radio className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                {room.endedAt ? timeAgo(room.endedAt) : timeAgo(room.createdAt)}
                              </span>
                              {room.recordingUrl && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                  Recording
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                              {room.name}
                            </h3>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {room.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{room.description}</p>
                      )}

                      {/* Tags */}
                      {(() => {
                        const tags: string[] = (() => { try { return JSON.parse(room.tags || "[]"); } catch { return []; } })();
                        return tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {room.recordingDuration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(room.recordingDuration)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {room.speakerCount || 0} spoke
                          </span>
                        </div>
                        {room.hostName && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-secondary overflow-hidden">
                              {room.hostAvatar
                                ? <img src={room.hostAvatar} alt={room.hostName} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">{room.hostName.charAt(0)}</div>
                              }
                            </div>
                            <span className="text-xs text-muted-foreground">{room.hostName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchQ ? "No past rooms match your search" : "No past rooms yet"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {searchQ ? "Try a different search term" : "Rooms will appear here after they end"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
