import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import MovieCard from "@/components/MovieCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Calendar, MapPin, Film, Star, Clapperboard } from "lucide-react";

export default function PersonProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: person, isLoading } = trpc.person.detail.useQuery({ slug: slug! }, { enabled: !!slug });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-10">
          <div className="flex gap-8">
            <div className="skeleton w-48 h-64 rounded-xl shrink-0" />
            <div className="flex-1 space-y-4">
              <div className="skeleton h-10 rounded w-1/2" />
              <div className="skeleton h-4 rounded w-1/3" />
              <div className="skeleton h-24 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Person Not Found</h2>
          <Link href="/browse"><Button variant="outline">Browse Movies</Button></Link>
        </div>
      </div>
    );
  }

  const actingCredits = (person as any).actingCredits || [];
  const crewCredits = (person as any).crewCredits || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header backdrop */}
      <div className="relative h-48 bg-gradient-to-br from-primary/10 to-background overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute top-4 left-4">
          <Link href="/browse">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
        </div>
      </div>

      <div className="container -mt-24 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
          {/* Photo */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <Avatar className="w-36 h-36 md:w-48 md:h-48 ring-4 ring-border shadow-2xl">
              <AvatarImage src={person.photoUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-secondary text-4xl font-bold text-foreground">
                {person.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>

            {/* Quick Stats */}
            <div className="w-full max-w-[200px] bg-card border border-border rounded-xl p-4 space-y-3">
              {person.birthDate && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                    <Calendar className="w-3 h-3" /> Born
                  </div>
                  <div className="text-sm text-foreground">{new Date(person.birthDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
                </div>
              )}
              {person.birthPlace && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                    <MapPin className="w-3 h-3" /> Birthplace
                  </div>
                  <div className="text-sm text-foreground">{person.birthPlace}</div>
                </div>
              )}
              {person.knownFor && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Known For</div>
                  <Badge variant="secondary" className="text-xs">{person.knownFor}</Badge>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Credits</div>
                <div className="text-sm font-semibold text-foreground">{actingCredits.length + crewCredits.length} films</div>
              </div>
            </div>
          </div>

          {/* Main Info */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{person.name}</h1>
            {person.knownFor && (
              <p className="text-primary font-medium mb-4">{person.knownFor}</p>
            )}
            {person.bio && (
              <p className="text-muted-foreground leading-relaxed mb-6 max-w-2xl">{person.bio}</p>
            )}

            {/* Tabs */}
            <Tabs defaultValue="acting">
              <TabsList className="bg-secondary border border-border mb-6">
                <TabsTrigger value="acting" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Star className="w-3.5 h-3.5" /> Acting ({actingCredits.length})
                </TabsTrigger>
                {crewCredits.length > 0 && (
                  <TabsTrigger value="crew" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Clapperboard className="w-3.5 h-3.5" /> Crew ({crewCredits.length})
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="acting">
                {actingCredits.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto pb-3">
                    {actingCredits.map((c: any) => (
                      <div key={c.movieId} className="shrink-0">
                        <MovieCard
                          id={c.movieId}
                          title={c.movieTitle}
                          slug={c.movieSlug}
                          year={c.movieYear}
                          posterUrl={c.moviePoster}
                          imdbRating={c.movieRating}
                          size="md"
                        />
                        {c.character && (
                          <p className="text-xs text-muted-foreground mt-1 text-center line-clamp-1">as {c.character}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No acting credits found.</p>
                )}
              </TabsContent>

              {crewCredits.length > 0 && (
                <TabsContent value="crew">
                  <div className="space-y-2">
                    {crewCredits.map((c: any) => (
                      <Link key={c.movieId} href={`/movie/${c.movieSlug}`}>
                        <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors">
                          <img
                            src={c.moviePoster || `https://via.placeholder.com/40x60/1a1a1a/ff6b35?text=?`}
                            alt={c.movieTitle}
                            className="w-10 h-14 object-cover rounded"
                          />
                          <div>
                            <div className="text-sm font-semibold text-foreground hover:text-primary transition-colors">{c.movieTitle}</div>
                            <div className="text-xs text-muted-foreground">{c.job} · {c.movieYear}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
