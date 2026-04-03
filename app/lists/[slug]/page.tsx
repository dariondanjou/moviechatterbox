"use client";
import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  List, GripVertical, Trash2, Pencil, Check, X, Share2, Copy, Plus,
  Film, Search, Mic, ExternalLink,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface ListItem {
  id: number;
  note: string | null;
  order: number | null;
  movieId: number;
  title: string;
  slug: string;
  year: number | null;
  posterUrl: string | null;
  imdbRating: number | null;
  runtime: number | null;
  synopsis: string | null;
}

function SortableItem({
  item, index, isOwner, onRemove, onUpdateNote,
}: {
  item: ListItem; index: number; isOwner: boolean;
  onRemove: (id: number) => void;
  onUpdateNote: (id: number, note: string) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note || "");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id, disabled: !isOwner,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-3 bg-card border border-border rounded-xl group hover:border-primary/30 transition-colors ${isDragging ? "shadow-xl ring-2 ring-primary/30" : ""}`}
    >
      {/* Drag handle */}
      {isOwner && (
        <button
          {...attributes}
          {...listeners}
          className="mt-3 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-5 h-5" />
        </button>
      )}

      {/* Number */}
      <div className="mt-3 w-7 text-right shrink-0">
        <span className="text-sm font-bold text-primary">{index + 1}.</span>
      </div>

      {/* Poster */}
      <Link href={`/movie/${item.slug}`} className="shrink-0">
        <img
          src={item.posterUrl || `https://via.placeholder.com/60x90/1a1a1a/ff6b35?text=?`}
          alt={item.title}
          className="w-14 h-20 object-cover rounded-lg hover:ring-2 hover:ring-primary/50 transition-all"
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 py-1">
        <Link href={`/movie/${item.slug}`} className="hover:text-primary transition-colors">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {item.title}
            {item.year && <span className="text-muted-foreground font-normal ml-1">({item.year})</span>}
          </h3>
        </Link>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {item.imdbRating && <span className="text-yellow-400 font-medium">{item.imdbRating}/10</span>}
          {item.runtime && <span>{item.runtime}m</span>}
        </div>

        {/* Note */}
        {editingNote && isOwner ? (
          <div className="flex items-center gap-1.5 mt-2">
            <Input
              value={noteValue}
              onChange={e => setNoteValue(e.target.value)}
              placeholder="Add a note..."
              className="h-7 text-xs bg-background"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") {
                  onUpdateNote(item.id, noteValue);
                  setEditingNote(false);
                }
                if (e.key === "Escape") {
                  setNoteValue(item.note || "");
                  setEditingNote(false);
                }
              }}
            />
            <button
              onClick={() => { onUpdateNote(item.id, noteValue); setEditingNote(false); }}
              className="text-green-500 hover:text-green-400"
            ><Check className="w-4 h-4" /></button>
            <button
              onClick={() => { setNoteValue(item.note || ""); setEditingNote(false); }}
              className="text-muted-foreground hover:text-foreground"
            ><X className="w-4 h-4" /></button>
          </div>
        ) : item.note ? (
          <p
            className={`text-xs text-muted-foreground mt-1.5 italic ${isOwner ? "cursor-pointer hover:text-foreground" : ""}`}
            onClick={() => isOwner && setEditingNote(true)}
          >
            "{item.note}"
          </p>
        ) : isOwner ? (
          <button
            onClick={() => setEditingNote(true)}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground mt-1.5 italic"
          >
            + add note
          </button>
        ) : null}
      </div>

      {/* Actions */}
      {isOwner && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
          <button
            onClick={() => setEditingNote(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="p-1.5 text-muted-foreground hover:text-red-400 rounded-md hover:bg-secondary"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ListDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: list, isLoading } = trpc.list.detail.useQuery({ slug });

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [addMovieOpen, setAddMovieOpen] = useState(false);
  const [movieSearch, setMovieSearch] = useState("");

  const { data: movieResults } = trpc.movie.search.useQuery(
    { q: movieSearch, limit: 8 },
    { enabled: movieSearch.length > 1 },
  );

  const updateList = trpc.list.update.useMutation({
    onSuccess: () => utils.list.detail.invalidate({ slug }),
  });

  const addItem = trpc.list.addItem.useMutation({
    onSuccess: () => {
      utils.list.detail.invalidate({ slug });
      toast.success("Movie added to list");
    },
  });

  const removeItem = trpc.list.removeItem.useMutation({
    onSuccess: () => {
      utils.list.detail.invalidate({ slug });
      toast.success("Removed from list");
    },
  });

  const updateItem = trpc.list.updateItem.useMutation({
    onSuccess: () => utils.list.detail.invalidate({ slug }),
  });

  const reorder = trpc.list.reorder.useMutation({
    onSuccess: () => utils.list.detail.invalidate({ slug }),
  });

  const createRoom = trpc.room.create.useMutation({
    onSuccess: (data) => {
      toast.success("Room created!");
      router.push(`/rooms/${data.slug}`);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !list) return;
    const items = list.items;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    reorder.mutate({ listId: list.id, itemIds: reordered.map(i => i.id) });
  }, [list, reorder]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/lists/${slug}`);
    toast.success("Link copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <List className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">List not found</h2>
          <p className="text-muted-foreground mb-6">This list may be private or doesn't exist.</p>
          <Link href="/profile"><Button>Back to Profile</Button></Link>
        </div>
      </div>
    );
  }

  const isOwner = list.isOwner;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-card to-background border-b border-border">
        <div className="container py-8">
          {/* Owner info */}
          {list.owner && (
            <div className="flex items-center gap-2 mb-4">
              <Avatar className="w-6 h-6">
                <AvatarImage src={list.owner.avatarUrl || undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {list.owner.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{list.owner.name}'s list</span>
            </div>
          )}

          {/* Title */}
          {editingTitle && isOwner ? (
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                className="text-2xl font-bold h-auto py-1 bg-background"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter" && titleValue.trim()) {
                    updateList.mutate({ listId: list.id, title: titleValue });
                    setEditingTitle(false);
                  }
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <button onClick={() => { updateList.mutate({ listId: list.id, title: titleValue }); setEditingTitle(false); }}>
                <Check className="w-5 h-5 text-green-500" />
              </button>
              <button onClick={() => setEditingTitle(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <h1
              className={`text-2xl sm:text-3xl font-bold text-foreground mb-2 ${isOwner ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
              onClick={() => { if (isOwner) { setTitleValue(list.title); setEditingTitle(true); } }}
            >
              {list.title}
              {isOwner && <Pencil className="w-4 h-4 inline ml-2 text-muted-foreground" />}
            </h1>
          )}

          {/* Description */}
          {editingDesc && isOwner ? (
            <div className="flex items-start gap-2 mb-4">
              <Input
                value={descValue}
                onChange={e => setDescValue(e.target.value)}
                placeholder="Add a description..."
                className="bg-background"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    updateList.mutate({ listId: list.id, description: descValue });
                    setEditingDesc(false);
                  }
                  if (e.key === "Escape") setEditingDesc(false);
                }}
              />
              <button onClick={() => { updateList.mutate({ listId: list.id, description: descValue }); setEditingDesc(false); }}>
                <Check className="w-5 h-5 text-green-500" />
              </button>
            </div>
          ) : list.description ? (
            <p
              className={`text-muted-foreground mb-4 ${isOwner ? "cursor-pointer hover:text-foreground" : ""}`}
              onClick={() => { if (isOwner) { setDescValue(list.description || ""); setEditingDesc(true); } }}
            >
              {list.description}
            </p>
          ) : isOwner ? (
            <button
              onClick={() => { setDescValue(""); setEditingDesc(true); }}
              className="text-sm text-muted-foreground/50 hover:text-muted-foreground mb-4 block"
            >
              + add description
            </button>
          ) : null}

          {/* Actions bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-2">
              {list.items.length} {list.items.length === 1 ? "film" : "films"}
            </span>

            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copy Link
            </Button>

            {isOwner && (
              <Dialog open={addMovieOpen} onOpenChange={setAddMovieOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Movie
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Movie to List</DialogTitle>
                  </DialogHeader>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={movieSearch}
                      onChange={e => setMovieSearch(e.target.value)}
                      placeholder="Search movies..."
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {movieResults?.movies?.map((m: any) => {
                      const alreadyAdded = list.items.some(i => i.movieId === m.id);
                      return (
                        <button
                          key={m.id}
                          disabled={alreadyAdded}
                          onClick={() => {
                            addItem.mutate({ listId: list.id, movieId: m.id });
                            setMovieSearch("");
                          }}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary"}`}
                        >
                          <img
                            src={m.posterUrl || `https://via.placeholder.com/32x48/1a1a1a/ff6b35?text=?`}
                            alt={m.title}
                            className="w-8 h-12 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{m.title}</div>
                            <div className="text-xs text-muted-foreground">{m.year}</div>
                          </div>
                          {alreadyAdded ? (
                            <span className="text-xs text-muted-foreground">Added</span>
                          ) : (
                            <Plus className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                    {movieSearch.length > 1 && !movieResults?.movies?.length && (
                      <p className="text-center text-sm text-muted-foreground py-6">No movies found</p>
                    )}
                    {movieSearch.length <= 1 && (
                      <p className="text-center text-sm text-muted-foreground py-6">Type to search...</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => createRoom.mutate({
                  name: `Talking about: ${list.title}`,
                  description: `Discussion about the list "${list.title}" — ${list.items.length} films`,
                  tags: ["list-discussion"],
                  relatedMovieId: list.items[0]?.movieId,
                })}
              >
                <Mic className="w-3.5 h-3.5" /> Start Room
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* List Items */}
      <div className="container py-6">
        {list.items.length === 0 ? (
          <div className="text-center py-16">
            <Film className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-2">This list is empty</h3>
            {isOwner && (
              <Button onClick={() => setAddMovieOpen(true)} className="mt-4 gap-1.5">
                <Plus className="w-4 h-4" /> Add your first movie
              </Button>
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={list.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 max-w-3xl">
                {list.items.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    isOwner={!!isOwner}
                    onRemove={(id) => removeItem.mutate({ itemId: id })}
                    onUpdateNote={(id, note) => updateItem.mutate({ itemId: id, note })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
