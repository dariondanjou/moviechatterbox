"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, MessageSquare, ThumbsUp, AlertTriangle, Lock } from "lucide-react";

export default function ThreadDetail() {
  const params = useParams();
  const slug = params.slug as string;
  const threadId = params.threadId as string;
  const { isAuthenticated } = useAuth();
  const [replyBody, setReplyBody] = useState("");

  const { data: thread, refetch } = trpc.thread.detail.useQuery(
    { threadId: parseInt(threadId!) },
    { enabled: !!threadId }
  );

  const reply = trpc.thread.reply.useMutation({
    onSuccess: () => {
      refetch();
      setReplyBody("");
      toast.success("Reply posted!");
    },
    onError: () => toast.error("Failed to post reply"),
  });

  if (!thread) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container py-6 max-w-3xl">
        {/* Back */}
        <Link href={`/movie/${slug}`}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="w-4 h-4" /> Back to Movie
          </Button>
        </Link>

        {/* Thread */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <Avatar className="w-10 h-10 shrink-0">
              <AvatarFallback className="bg-secondary text-sm font-bold">
                {(thread as any).userName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-semibold text-foreground">{(thread as any).userName || "Anonymous"}</div>
              <div className="text-xs text-muted-foreground">{new Date(thread.createdAt).toLocaleDateString()}</div>
            </div>
            {thread.pinned && <Badge variant="secondary" className="ml-auto text-xs">📌 Pinned</Badge>}
            {thread.locked && (
              <Badge variant="secondary" className="ml-auto text-xs gap-1">
                <Lock className="w-3 h-3" /> Locked
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground mb-3">{thread.title}</h1>
          <p className="text-muted-foreground leading-relaxed">{thread.body}</p>
          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-primary transition-colors">
              <ThumbsUp className="w-3.5 h-3.5" /> {thread.likes || 0} likes
            </button>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> {thread.replyCount || 0} replies
            </span>
          </div>
        </div>

        {/* Replies */}
        <div className="space-y-4 mb-6">
          {(thread as any).replies?.map((r: any) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3 mb-2">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-secondary text-xs font-bold">{r.userName?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-sm font-semibold text-foreground">{r.userName || "Anonymous"}</span>
                  <span className="text-xs text-muted-foreground ml-2">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-11">{r.body}</p>
              <div className="pl-11 mt-2">
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <ThumbsUp className="w-3 h-3" /> {r.likes || 0}
                </button>
              </div>
            </div>
          ))}

          {(!(thread as any).replies || (thread as any).replies.length === 0) && (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No replies yet. Start the conversation!</p>
            </div>
          )}
        </div>

        {/* Reply Form */}
        {!thread.locked ? (
          isAuthenticated ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Add a Reply</h3>
              <Textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Share your thoughts..."
                rows={3}
                className="bg-secondary border-border resize-none mb-3"
              />
              <Button
                onClick={() => reply.mutate({ threadId: parseInt(threadId!), body: replyBody })}
                disabled={replyBody.length < 1 || reply.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Post Reply
              </Button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-muted-foreground text-sm mb-3">Sign in to join the discussion</p>
              <Link href="/auth">
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          )
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">This thread is locked</p>
          </div>
        )}
      </div>
    </div>
  );
}
