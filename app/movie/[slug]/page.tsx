"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import MovieCard from "@/components/MovieCard";
import StarRating from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Star, Bookmark, BookmarkCheck, MessageSquare, Users, Clock, Globe,
  DollarSign, Film, ChevronLeft, AlertTriangle, ThumbsUp, Plus, Mic
} from "lucide-react";

export default function MovieDetail() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAuthenticated, user } = useAuth();
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [newThread, setNewThread] = useState({ title: "", body: "" });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showThreadForm, setShowThreadForm] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [optimisticWatchlisted, setOptimisticWatchlisted] = useState<boolean | null>(null);

  const { data: movie, isLoading } = trpc.movie.detail.useQuery({ slug: slug! }, { enabled: !!slug });
  const { data: reviews, refetch: refetchReviews } = trpc.review.list.useQuery(
    { movieId: movie?.id || 0 }, { enabled: !!movie?.id }
  );
  const { data: threads, refetch: refetchThreads } = trpc.thread.list.useQuery(
    { movieId: movie?.id || 0 }, { enabled: !!movie?.id }
  );
  const { data: myRating } = trpc.rating.myRating.useQuery(
    { movieId: movie?.id || 0 }, { enabled: !!movie?.id && isAuthenticated }
  );
  const { data: isWatchlisted } = trpc.watchlist.isWatchlisted.useQuery(
    { movieId: movie?.id || 0 }, { enabled: !!movie?.id && isAuthenticated }
  );

  const utils = trpc.useUtils();
  const upsertRating = trpc.rating.upsert.useMutation({
    onSuccess: () => {
      utils.rating.myRating.invalidate({ movieId: movie?.id });
      utils.movie.detail.invalidate({ slug: slug! });
      toast.success("Rating saved!");
    },
  });

  const createReview = trpc.review.create.useMutation({
    onSuccess: () => {
      refetchReviews();
      setShowReviewForm(false);
      setReviewTitle(""); setReviewBody(""); setSpoilers(false);
      toast.success("Review posted!");
    },
  });

  const createThread = trpc.thread.create.useMutation({
    onSuccess: () => {
      refetchThreads();
      setShowThreadForm(false);
      setNewThread({ title: "", body: "" });
      toast.success("Thread created!");
    },
  });

  const toggleWatchlist = trpc.watchlist.toggle.useMutation({
    onMutate: () => {
      const current = optimisticWatchlisted ?? isWatchlisted ?? false;
      setOptimisticWatchlisted(!current);
    },
    onSuccess: (data) => {
      setOptimisticWatchlisted(null);
      utils.watchlist.isWatchlisted.invalidate({ movieId: movie?.id });
      toast.success(data.added ? "Added to watchlist" : "Removed from watchlist");
    },
    onError: () => { setOptimisticWatchlisted(null); },
  });

  const watchlisted = optimisticWatchlisted ?? isWatchlisted ?? false;
  const currentRating = userRating || myRating?.rating || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-[50vh] skeleton" />
        <div className="container py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="skeleton h-80 rounded-xl" />
          <div className="md:col-span-2 space-y-4">
            <div className="skeleton h-10 rounded w-3/4" />
            <div className="skeleton h-4 rounded w-1/2" />
            <div className="skeleton h-24 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Movie Not Found</h2>
          <Link href="/browse"><Button variant="outline">Browse Movies</Button></Link>
        </div>
      </div>
    );
  }

  const getRtColor = (score?: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 75) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Backdrop */}
      <div className="relative h-[45vh] min-h-[300px] overflow-hidden">
        {movie.backdropUrl && (
          <img src={movie.backdropUrl} alt={movie.title} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 hero-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Back button */}
        <div className="absolute top-4 left-4">
          <Link href="/browse">
            <Button variant="ghost" size="sm" className="gap-1 text-white hover:bg-white/10">
              <ChevronLeft className="w-4 h-4" /> Browse
            </Button>
          </Link>
        </div>
      </div>

      <div className="container -mt-32 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr] gap-6 lg:gap-10">
          {/* Poster */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="w-44 md:w-full max-w-[260px] rounded-xl overflow-hidden shadow-2xl ring-2 ring-border">
              <img
                src={movie.posterUrl || `https://via.placeholder.com/260x390/1a1a1a/ff6b35?text=${encodeURIComponent(movie.title.charAt(0))}`}
                alt={movie.title}
                className="w-full aspect-[2/3] object-cover"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              {isAuthenticated ? (
                <Button
                  onClick={() => toggleWatchlist.mutate({ movieId: movie.id })}
                  variant={watchlisted ? "default" : "outline"}
                  className={`gap-2 w-full ${watchlisted ? "bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {watchlisted ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  {watchlisted ? "In Watchlist" : "Add to Watchlist"}
                </Button>
              ) : (
                <Button
                  onClick={() => { /* handled by auth modal */ }}
                  variant="outline"
                  className="gap-2 w-full border-border"
                >
                  <Bookmark className="w-4 h-4" /> Sign in to Save
                </Button>
              )}
            </div>

            {/* User Rating */}
            <div className="w-full max-w-[260px] bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium mb-2">Your Rating</div>
              {isAuthenticated ? (
                <div>
                  <StarRating
                    value={currentRating}
                    onChange={rating => {
                      setUserRating(rating);
                      upsertRating.mutate({ movieId: movie.id, rating });
                    }}
                    size="md"
                  />
                  {currentRating > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">{currentRating}/5 stars</div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { /* handled by auth modal */ }}
                  className="text-sm text-primary hover:underline"
                >
                  Sign in to rate
                </button>
              )}
            </div>

            {/* Ratings Summary */}
            <div className="w-full max-w-[260px] bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Ratings</div>
              {movie.imdbRating && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">IMDb</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-bold text-foreground">{movie.imdbRating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">/10</span>
                  </div>
                </div>
              )}
              {movie.rtScore && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Rotten Tomatoes</span>
                  <span className={`text-sm font-bold ${getRtColor(movie.rtScore)}`}>🍅 {movie.rtScore}%</span>
                </div>
              )}
              {movie.letterboxdRating && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Letterboxd</span>
                  <span className="text-sm font-bold text-green-400">★ {movie.letterboxdRating.toFixed(1)}</span>
                </div>
              )}
              {movie.avgUserRating && (
                <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
                  <span className="text-xs text-muted-foreground">MovieChatterbox</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-primary fill-primary" />
                    <span className="text-sm font-bold text-primary">{(movie.avgUserRating as number).toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({movie.ratingCount})</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div>
            {/* Title & Meta */}
            <div className="mb-6">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{movie.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                {movie.year && <span>{movie.year}</span>}
                {movie.runtime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                  </span>
                )}
                {movie.mpaaRating && (
                  <span className="px-2 py-0.5 rounded border border-border text-xs">{movie.mpaaRating}</span>
                )}
                {movie.language && (
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> {movie.language}
                  </span>
                )}
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-4">
                {movie.genres?.map((g: any) => (
                  <Link key={g.id} href={`/browse?genre=${g.slug}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors">
                      {g.name}
                    </Badge>
                  </Link>
                ))}
              </div>

              {/* Synopsis */}
              {movie.synopsis && (
                <p className="text-muted-foreground leading-relaxed">{movie.synopsis}</p>
              )}
            </div>

            {/* Crew Quick Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-card border border-border rounded-xl">
              {movie.crew?.filter((c: any) => c.job === "Director").slice(0, 1).map((c: any) => (
                <div key={c.id}>
                  <div className="text-xs text-muted-foreground mb-1">Director</div>
                  <Link href={`/person/${c.slug}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                    {c.name}
                  </Link>
                </div>
              ))}
              {movie.budget && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Budget
                  </div>
                  <div className="text-sm font-medium text-foreground">{movie.budget}</div>
                </div>
              )}
              {movie.boxOffice && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Box Office</div>
                  <div className="text-sm font-medium text-foreground">{movie.boxOffice}</div>
                </div>
              )}
              {movie.country && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Country</div>
                  <div className="text-sm font-medium text-foreground">{movie.country}</div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="cast">
              <TabsList className="bg-secondary border border-border mb-6">
                <TabsTrigger value="cast" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Cast
                </TabsTrigger>
                <TabsTrigger value="crew" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Crew
                </TabsTrigger>
                <TabsTrigger value="reviews" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Reviews {reviews?.total ? `(${reviews.total})` : ""}
                </TabsTrigger>
                <TabsTrigger value="discuss" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Discuss {threads?.total ? `(${threads.total})` : ""}
                </TabsTrigger>
              </TabsList>

              {/* Cast Tab */}
              <TabsContent value="cast">
                {movie.cast && movie.cast.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {movie.cast.map((c: any) => (
                      <Link key={c.id} href={`/person/${c.slug}`}>
                        <div className="group text-center">
                          <Avatar className="w-16 h-16 mx-auto mb-2 ring-2 ring-border group-hover:ring-primary transition-all">
                            <AvatarImage src={c.photoUrl || undefined} />
                            <AvatarFallback className="bg-secondary text-lg font-bold">{c.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{c.name}</div>
                          {c.character && <div className="text-xs text-muted-foreground line-clamp-1">{c.character}</div>}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No cast information available.</p>
                )}
              </TabsContent>

              {/* Crew Tab */}
              <TabsContent value="crew">
                {movie.crew && movie.crew.length > 0 ? (
                  <div className="space-y-3">
                    {movie.crew.map((c: any) => (
                      <div key={`${c.id}-${c.job}`} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={c.photoUrl || undefined} />
                          <AvatarFallback className="bg-secondary text-sm font-bold">{c.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <Link href={`/person/${c.slug}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                            {c.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{c.job} · {c.department}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No crew information available.</p>
                )}
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews">
                <div className="space-y-4">
                  {isAuthenticated && (
                    <div>
                      {!showReviewForm ? (
                        <Button
                          onClick={() => setShowReviewForm(true)}
                          variant="outline"
                          className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <Plus className="w-4 h-4" /> Write a Review
                        </Button>
                      ) : (
                        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                          <h3 className="font-semibold text-foreground">Write a Review</h3>
                          <Input
                            value={reviewTitle}
                            onChange={e => setReviewTitle(e.target.value)}
                            placeholder="Review title (optional)"
                            className="bg-secondary border-border"
                          />
                          <Textarea
                            value={reviewBody}
                            onChange={e => setReviewBody(e.target.value)}
                            placeholder="Share your thoughts..."
                            rows={4}
                            className="bg-secondary border-border resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="spoilers"
                              checked={spoilers}
                              onChange={e => setSpoilers(e.target.checked)}
                              className="rounded"
                            />
                            <label htmlFor="spoilers" className="text-sm text-muted-foreground cursor-pointer">
                              Contains spoilers
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => createReview.mutate({ movieId: movie.id, title: reviewTitle, body: reviewBody, containsSpoilers: spoilers })}
                              disabled={reviewBody.length < 10 || createReview.isPending}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              Post Review
                            </Button>
                            <Button variant="ghost" onClick={() => setShowReviewForm(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {reviews?.reviews.map((r: any) => (
                    <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={r.userAvatar || undefined} />
                          <AvatarFallback className="bg-secondary text-xs font-bold">{r.userName?.charAt(0) || "U"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{r.userName || "Anonymous"}</div>
                          <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</div>
                        </div>
                        {r.containsSpoilers && (
                          <Badge variant="destructive" className="ml-auto text-xs gap-1">
                            <AlertTriangle className="w-3 h-3" /> Spoilers
                          </Badge>
                        )}
                      </div>
                      {r.title && <h4 className="font-semibold text-foreground mb-1">{r.title}</h4>}
                      <p className="text-sm text-muted-foreground leading-relaxed">{r.body}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                          <ThumbsUp className="w-3.5 h-3.5" /> {r.likes || 0}
                        </button>
                      </div>
                    </div>
                  ))}

                  {(!reviews?.reviews || reviews.reviews.length === 0) && !showReviewForm && (
                    <div className="text-center py-8">
                      <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No reviews yet. Be the first!</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Discussion Tab */}
              <TabsContent value="discuss">
                <div className="space-y-4">
                  {isAuthenticated && (
                    <div>
                      {!showThreadForm ? (
                        <Button
                          onClick={() => setShowThreadForm(true)}
                          variant="outline"
                          className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <Plus className="w-4 h-4" /> Start a Discussion
                        </Button>
                      ) : (
                        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                          <h3 className="font-semibold text-foreground">Start a Discussion</h3>
                          <Input
                            value={newThread.title}
                            onChange={e => setNewThread(t => ({ ...t, title: e.target.value }))}
                            placeholder="Thread title..."
                            className="bg-secondary border-border"
                          />
                          <Textarea
                            value={newThread.body}
                            onChange={e => setNewThread(t => ({ ...t, body: e.target.value }))}
                            placeholder="What do you want to discuss?"
                            rows={3}
                            className="bg-secondary border-border resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => createThread.mutate({ movieId: movie.id, title: newThread.title, body: newThread.body })}
                              disabled={newThread.title.length < 3 || newThread.body.length < 10 || createThread.isPending}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              Post Thread
                            </Button>
                            <Button variant="ghost" onClick={() => setShowThreadForm(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {threads?.threads.map((t: any) => (
                    <Link key={t.id} href={`/movie/${slug}/thread/${t.id}`}>
                      <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-9 h-9 shrink-0">
                            <AvatarImage src={t.userAvatar || undefined} />
                            <AvatarFallback className="bg-secondary text-xs font-bold">{t.userName?.charAt(0) || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">{t.title}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{t.body}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> {t.replyCount} replies
                              </span>
                              <span className="flex items-center gap-1">
                                <ThumbsUp className="w-3 h-3" /> {t.likes}
                              </span>
                              <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {(!threads?.threads || threads.threads.length === 0) && !showThreadForm && (
                    <div className="text-center py-8">
                      <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No discussions yet. Start one!</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Related Movies */}
        {movie.relatedMovies && movie.relatedMovies.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-2 mb-5">
              <Film className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">More Like This</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3">
              {movie.relatedMovies.map((m: any) => (
                <MovieCard key={m.id} {...m} size="md" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
