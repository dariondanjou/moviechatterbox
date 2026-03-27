import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
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