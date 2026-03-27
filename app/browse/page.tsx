"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import MovieCard from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, Film } from "lucide-react";

function BrowseInner() {
  const searchParams = useSearchParams();

  const [searchQ, setSearchQ] = useState(searchParams.get("q") || "");
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get("genre") || "");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"imdbRating"|"year"|"title"|"ratingCount">("imdbRating");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sync sort from URL
  useEffect(() => {
    const sort = searchParams.get("sort");
    if (sort === "trending" || sort === "top") setSortBy("imdbRating");
    if (sort === "year") setSortBy("year");
  }, []);

  const { data: genres } = trpc.genre.list.useQuery();
  const { data, isLoading } = trpc.movie.list.useQuery({
    page,
    limit: 24,
    search: searchQ || undefined,
    genre: selectedGenre || undefined,
    year: selectedYear ? parseInt(selectedYear) : undefined,
    minRating: minRating > 0 ? minRating : undefined,
    sortBy,
    sortDir,
  });

  const totalPages = data ? Math.ceil(data.total / 24) : 0;

  const activeFilters = [
    selectedGenre && { label: genres?.find(g => g.slug === selectedGenre)?.name || selectedGenre, clear: () => setSelectedGenre("") },
    selectedYear && { label: selectedYear, clear: () => setSelectedYear("") },
    minRating > 0 && { label: `⭐ ${minRating}+`, clear: () => setMinRating(0) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const years = Array.from({ length: 80 }, (_, i) => (2024 - i).toString());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-4">
            <Film className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Browse Movies</h1>
            {data && <span className="text-sm text-muted-foreground">({data.total.toLocaleString()} titles)</span>}
          </div>

          {/* Search + Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setPage(1); }}
                placeholder="Search movies..."
                className="pl-9 bg-secondary border-border"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select value={sortBy} onValueChange={v => { setSortBy(v as any); setPage(1); }}>
                <SelectTrigger className="w-40 bg-secondary border-border">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="imdbRating">IMDb Rating</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                  <SelectItem value="ratingCount">Most Rated</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortDir} onValueChange={v => { setSortDir(v as any); setPage(1); }}>
                <SelectTrigger className="w-32 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="desc">Highest First</SelectItem>
                  <SelectItem value="asc">Lowest First</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className={`gap-2 border-border ${filtersOpen ? "border-primary text-primary" : ""}`}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilters.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {activeFilters.length}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Expanded Filters */}
          {filtersOpen && (
            <div className="mt-4 p-4 bg-card border border-border rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-2 block">Genre</label>
                <Select value={selectedGenre} onValueChange={v => { setSelectedGenre(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="All Genres" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    <SelectItem value="all">All Genres</SelectItem>
                    {genres?.map(g => (
                      <SelectItem key={g.id} value={g.slug}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-2 block">Year</label>
                <Select value={selectedYear} onValueChange={v => { setSelectedYear(v === "any" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Any Year" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    <SelectItem value="any">Any Year</SelectItem>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-2 block">
                  Min IMDb Rating: {minRating > 0 ? minRating.toFixed(1) : "Any"}
                </label>
                <Slider
                  value={[minRating]}
                  onValueChange={([v]) => { setMinRating(v); setPage(1); }}
                  min={0} max={9} step={0.5}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {activeFilters.map(f => (
                <Badge
                  key={f.label}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
                  onClick={f.clear}
                >
                  {f.label} <X className="w-3 h-3" />
                </Badge>
              ))}
              <button
                onClick={() => { setSelectedGenre(""); setSelectedYear(""); setMinRating(0); setPage(1); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="container py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="skeleton rounded-lg aspect-[2/3]" />
                <div className="skeleton h-4 rounded w-3/4" />
                <div className="skeleton h-3 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : data?.movies.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No movies found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {data?.movies.map((m: any) => (
              <MovieCard key={m.id} {...m} size="md" />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="border-border"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 7) {
                if (page <= 4) pageNum = i + 1;
                else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                else pageNum = page - 3 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "outline"}
                  size="icon"
                  onClick={() => setPage(pageNum)}
                  className={page === pageNum ? "bg-primary text-primary-foreground" : "border-border"}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="icon"
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="border-border"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <span className="text-sm text-muted-foreground ml-2">
              Page {page} of {totalPages}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Browse() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BrowseInner />
    </Suspense>
  );
}
