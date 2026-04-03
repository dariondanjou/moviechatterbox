"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { List, Plus, Film, Trash2, ExternalLink, Lock, Globe } from "lucide-react";

export default function ListsPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: myLists, isLoading } = trpc.list.myLists.useQuery(undefined, { enabled: isAuthenticated });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", isPublic: true });

  const createList = trpc.list.create.useMutation({
    onSuccess: (data) => {
      setCreateOpen(false);
      setForm({ title: "", description: "", isPublic: true });
      utils.list.myLists.invalidate();
      toast.success("List created!");
      router.push(`/lists/${data.slug}`);
    },
    onError: () => toast.error("Failed to create list"),
  });

  const deleteList = trpc.list.delete.useMutation({
    onSuccess: () => {
      utils.list.myLists.invalidate();
      toast.success("List deleted");
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm">
          <List className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Sign In to Create Lists</h2>
          <p className="text-muted-foreground mb-6">Create and share movie lists with the world.</p>
          <Button onClick={() => router.push("/auth")}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-card to-background border-b border-border">
        <div className="container py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Lists</h1>
              <p className="text-muted-foreground mt-1">Curate and share your movie collections</p>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1.5">
                  <Plus className="w-4 h-4" /> New List
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New List</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">List Name</label>
                    <Input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Top 10 Sci-Fi Films"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Description (optional)</label>
                    <Textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="What's this list about?"
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setForm(f => ({ ...f, isPublic: !f.isPublic }))}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {form.isPublic ? (
                        <><Globe className="w-4 h-4 text-green-500" /> Public — anyone with the link can view</>
                      ) : (
                        <><Lock className="w-4 h-4 text-yellow-500" /> Private — only you can view</>
                      )}
                    </button>
                  </div>
                  <Button
                    className="w-full"
                    disabled={!form.title.trim() || createList.isPending}
                    onClick={() => createList.mutate({
                      title: form.title, description: form.description || undefined, isPublic: form.isPublic,
                    })}
                  >
                    {createList.isPending ? "Creating..." : "Create List"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Lists grid */}
      <div className="container py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : myLists && myLists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myLists.map((list: any) => (
              <div
                key={list.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group relative"
              >
                <Link href={`/lists/${list.slug}`} className="block">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {list.title}
                    </h3>
                    {!list.isPublic && <Lock className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />}
                  </div>
                  {list.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{list.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Film className="w-3.5 h-3.5" /> {list.itemCount} films
                    </span>
                    <span>{new Date(list.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm("Delete this list?")) deleteList.mutate({ listId: list.id });
                  }}
                  className="absolute top-4 right-4 p-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 rounded-md hover:bg-secondary transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <List className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No lists yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first movie list to get started</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Create Your First List
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
