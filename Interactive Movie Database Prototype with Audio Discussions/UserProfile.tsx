import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import MovieCard from "@/components/MovieCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Star, Bookmark, MessageSquare, Film, Calendar, Award } from "lucide-react";

export default function UserProfile() {
  const { user, isAuthenticated, loading } = useAuth();

  const { data: watchlist } = trpc.watchlist.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myReviews } = trpc.review.myReviews.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myRatings } = trpc.rating.myRatings.useQuery(undefined, { enabled: isAuthenticated });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm">
          <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Sign In to View Profile</h2>
          <p className="text-muted-foreground mb-6">Track your movies, write reviews, and join discussions.</p>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => window.location.href = getLoginUrl()}
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const stats = [
    { icon: <Bookmark className="w-4 h-4" />, label: "Watchlist", value: watchlist?.length || 0 },
    { icon: <Star className="w-4 h-4" />, label: "Rated", value: myRatings?.length || 0 },
    { icon: <MessageSquare className="w-4 h-4" />, label: "Reviews", value: myReviews?.length || 0 },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-primary/10 via-card to-background border-b border-border">
        <div className="container py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="w-24 h-24 ring-4 ring-primary/30 shadow-xl">
              <AvatarImage src={(user as any).avatarUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                {user.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
              <p className="text-muted-foreground text-sm mb-3">{user.email}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Member since {new Date((user as any).createdAt || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-lg">
            {stats.map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
                  {s.icon}
                </div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Tabs defaultValue="watchlist">
          <TabsList className="bg-secondary border border-border mb-6">
            <TabsTrigger value="watchlist" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bookmark className="w-3.5 h-3.5" /> Watchlist
            </TabsTrigger>
            <TabsTrigger value="ratings" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Star className="w-3.5 h-3.5" /> Ratings
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageSquare className="w-3.5 h-3.5" /> Reviews
            </TabsTrigger>
          </TabsList>

          {/* Watchlist */}
          <TabsContent value="watchlist">
            {watchlist && watchlist.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {watchlist.map((item: any) => (
                  <MovieCard
                    key={item.movieId}
                    id={item.movieId}
                    title={item.title}
                    slug={item.slug}
                    year={item.year}
                    posterUrl={item.posterUrl}
                    imdbRating={item.imdbRating}
                    size="md"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Your watchlist is empty</h3>
                <p className="text-muted-foreground text-sm mb-4">Browse movies and add them to your watchlist</p>
                <Link href="/browse">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Browse Movies</Button>
                </Link>
              </div>
            )}
          </TabsContent>

          {/* Ratings */}
          <TabsContent value="ratings">
            {myRatings && myRatings.length > 0 ? (
              <div className="space-y-2">
                {myRatings.map((r: any) => (
                  <Link key={r.movieId} href={`/movie/${r.slug}`}>
                    <div className="flex items-center gap-4 p-3 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors">
                      <img
                        src={r.posterUrl || `https://via.placeholder.com/40x60/1a1a1a/ff6b35?text=?`}
                        alt={r.title}
                        className="w-10 h-14 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground">{r.title}</div>
                        <div className="text-xs text-muted-foreground">{r.year}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < r.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`}
                          />
                        ))}
                        <span className="text-sm font-bold text-foreground ml-1">{r.rating}/5</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Star className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No ratings yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Rate movies to track your opinions</p>
                <Link href="/browse">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Browse Movies</Button>
                </Link>
              </div>
            )}
          </TabsContent>

          {/* Reviews */}
          <TabsContent value="reviews">
            {myReviews && myReviews.length > 0 ? (
              <div className="space-y-4">
                {myReviews.map((r: any) => (
                  <Link key={r.id} href={`/movie/${r.movieSlug}`}>
                    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <img
                          src={r.posterUrl || `https://via.placeholder.com/40x60/1a1a1a/ff6b35?text=?`}
                          alt={r.movieTitle}
                          className="w-12 h-16 object-cover rounded shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-foreground mb-0.5">{r.movieTitle}</div>
                          {r.title && <div className="text-sm font-medium text-primary mb-1">"{r.title}"</div>}
                          <p className="text-xs text-muted-foreground line-clamp-2">{r.body}</p>
                          <div className="text-xs text-muted-foreground mt-2">{new Date(r.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No reviews yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Share your thoughts on movies you've watched</p>
                <Link href="/browse">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Browse Movies</Button>
                </Link>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
