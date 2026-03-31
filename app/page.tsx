"use client";
import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import MovieCard from "@/components/MovieCard";
import AudioRoomCard from "@/components/AudioRoomCard";
import { Button } from "@/components/ui/button";
import {
  Film, Star, Mic, ChevronRight, Play, Bookmark, TrendingUp, Award, Radio
} from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [heroIndex, setHeroIndex] = useState(0);

  const { data: featuredMovies } = trpc.movie.featured.useQuery();
  const { data: trendingMovies } = trpc.movie.trending.useQuery();
  const { data: topRatedMovies } = trpc.movie.topRated.useQuery();
  const { data: liveRooms } = trpc.room.list.useQuery();
  const { data: genres } = trpc.genre.list.useQuery();

  const heroMovie = featuredMovies?.[heroIndex];

  const GENRE_ICONS: Record<string, string> = {
    "Action": "💥", "Comedy": "😂", "Drama": "🎭", "Horror": "👻",
    "Sci-Fi": "🚀", "Romance": "❤️", "Animation": "🎨", "Thriller": "😱",
    "Documentary": "🎬", "Crime": "🔍", "Mystery": "🕵️", "Western": "🤠",
    "Musical": "🎵", "Fantasy": "🧙", "Biography": "📖", "History": "🏛️",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero Section ─────────────────────────────────────────────────────── */}
      {heroMovie ? (
        <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
          {/* Backdrop */}
          <div className="absolute inset-0">
            <img
              src={heroMovie.backdropUrl || heroMovie.posterUrl || ""}
              alt={heroMovie.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 hero-overlay" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>

          {/* Content */}
          <div className="relative h-full container flex flex-col justify-end pb-12">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Featured</span>
                {heroMovie.mpaaRating && (
                  <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">
                    {heroMovie.mpaaRating}
                  </span>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-3 leading-tight">
                {heroMovie.title}
              </h1>
              <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-white font-semibold">{heroMovie.imdbRating?.toFixed(1)}</span>
                  <span>IMDb</span>
                </span>
                {heroMovie.year && <span>{heroMovie.year}</span>}
              </div>
              {heroMovie.synopsis && (
                <p className="text-sm sm:text-base text-muted-foreground mb-6 line-clamp-3 max-w-xl">
                  {heroMovie.synopsis}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Link href={`/movie/${heroMovie.slug}`}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                    <Play className="w-4 h-4 fill-current" /> View Details
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative h-[50vh] min-h-[400px] flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="text-center">
            <Film className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-2">MovieChatterbox</h1>
            <p className="text-muted-foreground text-lg">Your place to discover, rate & chat about movies</p>
          </div>
        </section>
      )}

      {/* Trending Section */}
      {trendingMovies && trendingMovies.length > 0 && (
        <section className="container py-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Trending Now</h2>
            </div>
            <Link href="/browse?sort=trending" className="flex items-center gap-1 text-sm text-primary hover:underline">
              See all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3">
            {trendingMovies.map((m: any) => (
              <MovieCard key={m.id} {...m} size="md" />
            ))}
          </div>
        </section>
      )}

      {/* Top Rated Section */}
      {topRatedMovies && topRatedMovies.length > 0 && (
        <section className="container py-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Top Rated</h2>
            </div>
            <Link href="/browse?sort=top" className="flex items-center gap-1 text-sm text-primary hover:underline">
              See all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3">
            {topRatedMovies.map((m: any) => (
              <MovieCard key={m.id} {...m} size="md" />
            ))}
          </div>
        </section>
      )}

      {/* Live Rooms Section */}
      {liveRooms && liveRooms.length > 0 && (
        <section className="container py-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Live Audio Rooms</h2>
            </div>
            <Link href="/rooms" className="flex items-center gap-1 text-sm text-primary hover:underline">
              See all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveRooms.slice(0, 3).map((r: any) => (
              <AudioRoomCard key={r.id} {...r} />
            ))}
          </div>
        </section>
      )}

      {/* Browse by Genre */}
      {genres && genres.length > 0 && (
        <section className="container py-10">
          <div className="flex items-center gap-2 mb-5">
            <Film className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Browse by Genre</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {genres.map((g: any) => (
              <Link key={g.id} href={`/browse?genre=${g.slug}`}>
                <div className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                  <div className="text-2xl mb-1">{GENRE_ICONS[g.name] || "🎬"}</div>
                  <div className="text-sm font-medium text-foreground">{g.name}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
