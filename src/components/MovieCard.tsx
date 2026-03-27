"use client";
import Link from "next/link";
import { Star, Bookmark, BookmarkCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState } from "react";

interface MovieCardProps {
  id: number;
  title: string;
  slug: string;
  year?: number | null;
  posterUrl?: string | null;
  imdbRating?: number | null;
  rtScore?: number | null;
  mpaaRating?: string | null;
  size?: "sm" | "md" | "lg";
  showWatchlist?: boolean;
}

export default function MovieCard({
  id, title, slug, year, posterUrl, imdbRating, rtScore, mpaaRating,
  size = "md", showWatchlist = true,
}: MovieCardProps) {
  const { isAuthenticated } = useAuth();
  const [optimisticWatchlisted, setOptimisticWatchlisted] = useState<boolean | null>(null);

  const { data: isWatchlisted } = trpc.watchlist.isWatchlisted.useQuery(
    { movieId: id },
    { enabled: isAuthenticated }
  );

  const utils = trpc.useUtils();
  const toggleWatchlist = trpc.watchlist.toggle.useMutation({
    onMutate: () => {
      const current = optimisticWatchlisted ?? isWatchlisted ?? false;
      setOptimisticWatchlisted(!current);
    },
    onSuccess: (data) => {
      setOptimisticWatchlisted(null);
      utils.watchlist.isWatchlisted.invalidate({ movieId: id });
      utils.watchlist.list.invalidate();
      toast.success(data.added ? "Added to watchlist" : "Removed from watchlist");
    },
    onError: () => {
      setOptimisticWatchlisted(null);
      toast.error("Failed to update watchlist");
    },
  });

  const watchlisted = optimisticWatchlisted ?? isWatchlisted ?? false;

  const sizeClasses = {
    sm: "w-28 min-w-28",
    md: "w-40 min-w-40",
    lg: "w-52 min-w-52",
  };

  const posterHeights = {
    sm: "h-40",
    md: "h-56",
    lg: "h-72",
  };

  const getRtColor = (score?: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 75) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className={`movie-card group relative ${sizeClasses[size]} flex flex-col`}>
      <Link href={`/movie/${slug}`} className="block">
        <div className={`relative ${posterHeights[size]} rounded-lg overflow-hidden bg-secondary`}>
          <img
            src={posterUrl || `https://via.placeholder.com/200x300/1a1a1a/ff6b35?text=${encodeURIComponent(title.charAt(0))}`}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Overlay on hover */}
          <div className="absolute inset-0 poster-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          {/* Rating badge */}
          {imdbRating && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/80 backdrop-blur-sm rounded px-1.5 py-0.5">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-bold text-white">{imdbRating.toFixed(1)}</span>
            </div>
          )}

          {/* RT Score */}
          {rtScore && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/80 backdrop-blur-sm rounded px-1.5 py-0.5">
              <span className="text-xs">🍅</span>
              <span className={`text-xs font-bold ${getRtColor(rtScore)}`}>{rtScore}%</span>
            </div>
          )}

          {/* MPAA Rating */}
          {mpaaRating && (
            <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm rounded px-1.5 py-0.5">
              <span className="text-xs text-muted-foreground font-medium">{mpaaRating}</span>
            </div>
          )}

          {/* Watchlist button */}
          {showWatchlist && isAuthenticated && (
            <button
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                toggleWatchlist.mutate({ movieId: id });
              }}
              className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/80"
            >
              {watchlisted
                ? <BookmarkCheck className="w-4 h-4 text-primary" />
                : <Bookmark className="w-4 h-4 text-white" />
              }
            </button>
          )}
        </div>
      </Link>

      <div className="mt-2 px-0.5">
        <Link href={`/movie/${slug}`}>
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors leading-tight">
            {title}
          </h3>
        </Link>
        {year && <p className="text-xs text-muted-foreground mt-0.5">{year}</p>}
      </div>
    </div>
  );
}
