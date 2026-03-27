import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import MovieCard from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { Bookmark, Film } from "lucide-react";

export default function Watchlist() {
  const { isAuthenticated, loading } = useAuth();
  const { data: watchlist, isLoading } = trpc.watchlist.list.useQuery(undefined, { enabled: isAuthenticated });

  if (loading || isLoading) {
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
          <Bookmark className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Sign In to View Watchlist</h2>
          <p className="text-muted-foreground mb-6">Save movies to watch later and track your progress.</p>
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card/50">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">My Watchlist</h1>
            {watchlist && <span className="text-sm text-muted-foreground">({watchlist.length} movies)</span>}
          </div>
        </div>
      </div>

      <div className="container py-8">
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
          <div className="text-center py-20">
            <Bookmark className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Your watchlist is empty</h3>
            <p className="text-muted-foreground mb-6">Browse movies and click the bookmark icon to save them here</p>
            <Link href="/browse">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                <Film className="w-4 h-4" /> Browse Movies
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
