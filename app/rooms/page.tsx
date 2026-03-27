"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AudioRoomCard from "@/components/AudioRoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Mic, Radio, Users, Plus, Search, Headphones } from "lucide-react";

export default function Rooms() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchQ, setSearchQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", tags: "" });
  const [movieSearch, setMovieSearch] = useState("");

  const { data: rooms, refetch } = trpc.room.list.useQuery();
  const { data: movieResults } = trpc.movie.search.useQuery(
    { q: movieSearch, limit: 5 },
    { enabled: movieSearch.length > 1 }
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
                onClick={() => { /* handled by auth modal */ }}
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
        {/* Search */}
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search rooms..."
            className="pl-9 bg-secondary border-border"
          />
        </div>

        {/* Rooms Grid */}
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
      </div>
    </div>
  );
}
