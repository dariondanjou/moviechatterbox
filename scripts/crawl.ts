import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import {
  movies, persons, genres, movieGenres, movieCast, movieCrew,
} from "../shared/schema";

// ─── Config ──────────────────────────────────────────────────────────────────
const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;
const TMDB = "https://api.themoviedb.org/3";
const OMDB = "http://www.omdbapi.com";
const IMG = "https://image.tmdb.org/t/p";

if (!TMDB_KEY) { console.error("TMDB_API_KEY missing from .env"); process.exit(1); }

const client = postgres(process.env.DATABASE_URL!, {
  prepare: process.env.DATABASE_URL?.includes("pooler") ? false : undefined,
});
const db = drizzle(client);

// ─── Rate Limiter ────────────────────────────────────────────────────────────
class RateLimiter {
  private timestamps: number[] = [];
  constructor(private maxRequests: number, private windowMs: number) {}

  async wait() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 100;
      await sleep(waitMs);
    }
    this.timestamps.push(Date.now());
  }
}

const tmdbLimiter = new RateLimiter(35, 10_000);
let omdbCallsToday = 0;
let omdbResetDate = new Date().toDateString();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string, table: "movies" | "persons"): Promise<string> {
  const t = table === "movies" ? movies : persons;
  const [existing] = await db.select({ id: t.id }).from(t).where(eq(t.slug, base)).limit(1);
  if (!existing) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    const [dup] = await db.select({ id: t.id }).from(t).where(eq(t.slug, candidate)).limit(1);
    if (!dup) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// ─── TMDB Fetch ──────────────────────────────────────────────────────────────
async function tmdbFetch<T>(path: string): Promise<T> {
  await tmdbLimiter.wait();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${TMDB}${path}${sep}api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "10", 10);
    console.log(`  TMDB rate limited, waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return tmdbFetch<T>(path);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json() as T;
}

// ─── OMDB Fetch ──────────────────────────────────────────────────────────────
async function omdbFetch(imdbId: string): Promise<any | null> {
  if (!OMDB_KEY) return null;
  // Reset daily counter
  const today = new Date().toDateString();
  if (today !== omdbResetDate) { omdbCallsToday = 0; omdbResetDate = today; }
  if (omdbCallsToday >= 950) return null; // Leave buffer

  try {
    omdbCallsToday++;
    const res = await fetch(`${OMDB}/?i=${imdbId}&apikey=${OMDB_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === "False") return null;
    return data;
  } catch { return null; }
}

// ─── Person Cache ────────────────────────────────────────────────────────────
const personCache = new Map<number, number>(); // tmdbId -> dbId

async function upsertPerson(tmdbPerson: {
  id: number; name: string; profile_path?: string | null;
  known_for_department?: string;
}, fetchDetails = false): Promise<number> {
  // Check cache
  const cached = personCache.get(tmdbPerson.id);
  if (cached) return cached;

  // Check DB by slug
  const slug = slugify(tmdbPerson.name);
  const [existing] = await db.select({ id: persons.id })
    .from(persons).where(eq(persons.slug, slug)).limit(1);

  if (existing) {
    personCache.set(tmdbPerson.id, existing.id);
    return existing.id;
  }

  // Only fetch full details for key people (directors, top cast) to save API calls
  let bio: string | null = null;
  let birthDate: string | null = null;
  let birthPlace: string | null = null;
  let imdbId: string | null = null;

  if (fetchDetails) {
    try {
      const detail = await tmdbFetch<any>(`/person/${tmdbPerson.id}`);
      bio = detail.biography || null;
      birthDate = detail.birthday || null;
      birthPlace = detail.place_of_birth || null;
      imdbId = detail.imdb_id || null;
    } catch { /* use basic data */ }
  }

  const finalSlug = await uniqueSlug(slug || `person-${tmdbPerson.id}`, "persons");
  const photoUrl = tmdbPerson.profile_path ? `${IMG}/w500${tmdbPerson.profile_path}` : null;

  const [inserted] = await db.insert(persons).values({
    name: tmdbPerson.name,
    slug: finalSlug,
    photoUrl,
    bio,
    birthDate,
    birthPlace,
    knownFor: tmdbPerson.known_for_department || null,
    imdbId,
  }).returning({ id: persons.id });

  personCache.set(tmdbPerson.id, inserted.id);
  return inserted.id;
}

// ─── Genre Cache ─────────────────────────────────────────────────────────────
const genreCache = new Map<string, number>();

async function upsertGenre(name: string): Promise<number> {
  const cached = genreCache.get(name);
  if (cached) return cached;

  const slug = slugify(name);
  const [existing] = await db.select({ id: genres.id })
    .from(genres).where(eq(genres.slug, slug)).limit(1);

  if (existing) {
    genreCache.set(name, existing.id);
    return existing.id;
  }

  const [inserted] = await db.insert(genres).values({ name, slug })
    .returning({ id: genres.id });

  genreCache.set(name, inserted.id);
  return inserted.id;
}

// ─── Process Single Movie ────────────────────────────────────────────────────
interface TmdbMovie {
  id: number; title: string; overview?: string; release_date?: string;
  runtime?: number; poster_path?: string | null; backdrop_path?: string | null;
  imdb_id?: string; vote_average?: number; original_language?: string;
  production_countries?: { iso_3166_1: string; name: string }[];
  budget?: number; revenue?: number; status?: string;
  genres?: { id: number; name: string }[];
  credits?: { cast: any[]; crew: any[] };
  release_dates?: { results: any[] };
}

async function processMovie(tmdbId: number): Promise<boolean> {
  // Fetch movie with credits and release dates in one call
  const detail = await tmdbFetch<TmdbMovie>(
    `/movie/${tmdbId}?append_to_response=credits,release_dates`
  );

  if (!detail.imdb_id) return false; // Skip movies without IMDB ID

  // Check if already in DB
  const [existing] = await db.select({ id: movies.id })
    .from(movies).where(eq(movies.imdbId, detail.imdb_id)).limit(1);
  if (existing) return false;

  // Extract MPAA rating
  let mpaaRating: string | null = null;
  if (detail.release_dates?.results) {
    const us = detail.release_dates.results.find(
      (r: any) => r.iso_3166_1 === "US"
    );
    if (us?.release_dates?.length) {
      const cert = us.release_dates.find((d: any) => d.certification);
      mpaaRating = cert?.certification || null;
    }
  }

  // Extract year
  const year = detail.release_date ? parseInt(detail.release_date.substring(0, 4), 10) : null;

  // Generate slug
  const baseSlug = slugify(detail.title);
  const movieSlug = year ? `${baseSlug}-${year}` : baseSlug;
  const finalSlug = await uniqueSlug(movieSlug, "movies");

  // Map status
  let status: "released" | "upcoming" | "in_production" = "released";
  if (detail.status === "Planned" || detail.status === "In Production" || detail.status === "Post Production") {
    status = "in_production";
  } else if (detail.status === "Upcoming") {
    status = "upcoming";
  }

  // Format budget/revenue
  const formatMoney = (n?: number) => n && n > 0 ? `$${n.toLocaleString()}` : null;

  // Check slug doesn't already exist (different movie, same title)
  const [slugExists] = await db.select({ id: movies.id })
    .from(movies).where(eq(movies.slug, finalSlug)).limit(1);
  if (slugExists) return false;

  // Insert movie
  const [movie] = await db.insert(movies).values({
    title: detail.title,
    slug: finalSlug,
    year: year || undefined,
    releaseDate: detail.release_date || null,
    runtime: detail.runtime || null,
    synopsis: detail.overview || null,
    posterUrl: detail.poster_path ? `${IMG}/w500${detail.poster_path}` : null,
    backdropUrl: detail.backdrop_path ? `${IMG}/w1280${detail.backdrop_path}` : null,
    imdbId: detail.imdb_id,
    imdbRating: detail.vote_average ? Math.round(detail.vote_average * 10) / 10 : null,
    language: detail.original_language || null,
    country: detail.production_countries?.[0]?.name || null,
    budget: formatMoney(detail.budget),
    boxOffice: formatMoney(detail.revenue),
    mpaaRating,
    status,
  }).returning({ id: movies.id });

  const movieId = movie.id;

  // Insert genres
  if (detail.genres?.length) {
    for (const g of detail.genres) {
      const genreId = await upsertGenre(g.name);
      await db.insert(movieGenres).values({ movieId, genreId }).onConflictDoNothing();
    }
  }

  // Insert cast (top 20, full details only for top 3)
  const castList = detail.credits?.cast?.slice(0, 20) || [];
  for (let i = 0; i < castList.length; i++) {
    const c = castList[i];
    try {
      const personId = await upsertPerson({
        id: c.id, name: c.name, profile_path: c.profile_path,
        known_for_department: c.known_for_department || "Acting",
      }, i < 3); // Fetch full bio only for top 3 billed
      await db.insert(movieCast).values({
        movieId, personId, character: c.character || null, order: i,
      });
    } catch (err: any) {
      if (!err.message?.includes("duplicate")) console.error(`  Cast error: ${c.name}:`, err.message);
    }
  }

  // Insert crew (key departments only, full details for directors)
  const keyJobs = new Set([
    "Director", "Writer", "Screenplay", "Story", "Producer", "Executive Producer",
    "Director of Photography", "Cinematographer", "Original Music Composer",
    "Composer", "Editor", "Production Design", "Costume Design",
  ]);
  const crewList = detail.credits?.crew?.filter((c: any) => keyJobs.has(c.job)) || [];
  const seenCrew = new Set<string>();

  for (const c of crewList) {
    const key = `${c.id}-${c.job}`;
    if (seenCrew.has(key)) continue;
    seenCrew.add(key);

    try {
      const personId = await upsertPerson({
        id: c.id, name: c.name, profile_path: c.profile_path,
        known_for_department: c.known_for_department || c.department,
      }, c.job === "Director"); // Full bio only for directors
      await db.insert(movieCrew).values({
        movieId, personId, job: c.job, department: c.department || null,
      });
    } catch (err: any) {
      if (!err.message?.includes("duplicate")) console.error(`  Crew error: ${c.name}:`, err.message);
    }
  }

  // OMDB enrichment for RT score and real IMDB rating
  if (detail.imdb_id) {
    try {
      const omdb = await omdbFetch(detail.imdb_id);
      if (omdb) {
        const updates: any = {};
        // Real IMDB rating
        if (omdb.imdbRating && omdb.imdbRating !== "N/A") {
          updates.imdbRating = parseFloat(omdb.imdbRating);
        }
        // Rotten Tomatoes score
        const rt = omdb.Ratings?.find((r: any) => r.Source === "Rotten Tomatoes");
        if (rt?.Value) {
          updates.rtScore = parseInt(rt.Value.replace("%", ""), 10);
        }
        // Box office from OMDB if we don't have it
        if (!detail.revenue && omdb.BoxOffice && omdb.BoxOffice !== "N/A") {
          updates.boxOffice = omdb.BoxOffice;
        }

        if (Object.keys(updates).length > 0) {
          await db.update(movies).set(updates).where(eq(movies.id, movieId));
        }
      }
    } catch { /* OMDB enrichment is optional */ }
  }

  return true;
}

// ─── Discover Pages ──────────────────────────────────────────────────────────
async function crawlDiscoverPage(page: number, sortBy: string): Promise<number[]> {
  const data = await tmdbFetch<{ results: { id: number }[]; total_pages: number }>(
    `/discover/movie?sort_by=${sortBy}&vote_count.gte=100&page=${page}`
  );
  return data.results.map(m => m.id);
}

async function crawlTrending(): Promise<number[]> {
  const data = await tmdbFetch<{ results: { id: number }[] }>(`/trending/movie/week`);
  return data.results.map(m => m.id);
}

async function crawlNowPlaying(): Promise<number[]> {
  const data = await tmdbFetch<{ results: { id: number }[] }>(`/movie/now_playing`);
  return data.results.map(m => m.id);
}

async function crawlTopRated(page: number): Promise<number[]> {
  const data = await tmdbFetch<{ results: { id: number }[] }>(`/movie/top_rated?page=${page}`);
  return data.results.map(m => m.id);
}

// ─── Process a batch of TMDB IDs ─────────────────────────────────────────────
async function processBatch(tmdbIds: number[], label: string): Promise<number> {
  let added = 0;
  for (const id of tmdbIds) {
    try {
      const wasNew = await processMovie(id);
      if (wasNew) added++;
    } catch (err: any) {
      console.error(`  Error processing TMDB ID ${id}:`, err.message);
    }
  }
  return added;
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
async function main() {
  console.log("🎬 MovieChatterbox Crawler started");
  console.log(`   TMDB API: ${TMDB_KEY ? "configured" : "MISSING"}`);
  console.log(`   OMDB API: ${OMDB_KEY ? "configured" : "not configured (optional)"}`);

  let totalMovies = 0;
  let totalPersons = 0;

  // Phase 1: Most voted movies of all time
  console.log("\n📊 Phase 1: Most voted movies (by vote count)");
  for (let page = 1; page <= 500; page++) {
    try {
      const ids = await crawlDiscoverPage(page, "vote_count.desc");
      if (ids.length === 0) break;
      const added = await processBatch(ids, `vote_count page ${page}`);
      totalMovies += added;
      console.log(`  [vote_count p${page}] +${added} movies (total: ${totalMovies})`);
      if (page % 10 === 0) await sleep(5_000);
      else await sleep(1_000);
    } catch (err: any) {
      console.error(`  Page ${page} error:`, err.message);
      await sleep(10_000);
    }
  }

  // Phase 2: Most popular movies
  console.log("\n🔥 Phase 2: Most popular movies");
  for (let page = 1; page <= 500; page++) {
    try {
      const ids = await crawlDiscoverPage(page, "popularity.desc");
      if (ids.length === 0) break;
      const added = await processBatch(ids, `popularity page ${page}`);
      totalMovies += added;
      console.log(`  [popularity p${page}] +${added} movies (total: ${totalMovies})`);
      if (page % 10 === 0) await sleep(5_000);
      else await sleep(1_000);
    } catch (err: any) {
      console.error(`  Page ${page} error:`, err.message);
      await sleep(10_000);
    }
  }

  // Phase 3: Top rated
  console.log("\n⭐ Phase 3: Top rated movies");
  for (let page = 1; page <= 500; page++) {
    try {
      const ids = await crawlTopRated(page);
      if (ids.length === 0) break;
      const added = await processBatch(ids, `top_rated page ${page}`);
      totalMovies += added;
      console.log(`  [top_rated p${page}] +${added} movies (total: ${totalMovies})`);
      if (page % 10 === 0) await sleep(5_000);
      else await sleep(1_000);
    } catch (err: any) {
      console.error(`  Page ${page} error:`, err.message);
      await sleep(10_000);
    }
  }

  // Phase 4: Continuous — trending + now playing, repeat forever
  console.log("\n🔄 Phase 4: Continuous crawl (trending + now playing)");
  let cycle = 0;
  while (true) {
    cycle++;
    console.log(`\n--- Continuous cycle ${cycle} ---`);

    try {
      const trending = await crawlTrending();
      const added1 = await processBatch(trending, "trending");
      console.log(`  [trending] +${added1} movies`);
    } catch (err: any) { console.error("  Trending error:", err.message); }

    await sleep(2_000);

    try {
      const nowPlaying = await crawlNowPlaying();
      const added2 = await processBatch(nowPlaying, "now_playing");
      console.log(`  [now_playing] +${added2} movies`);
    } catch (err: any) { console.error("  Now playing error:", err.message); }

    // Also re-crawl discover pages slowly to catch new additions
    const discoverPage = ((cycle - 1) % 100) + 1;
    try {
      const ids = await crawlDiscoverPage(discoverPage, "vote_count.desc");
      const added3 = await processBatch(ids, `re-crawl page ${discoverPage}`);
      if (added3 > 0) console.log(`  [re-crawl p${discoverPage}] +${added3} movies`);
    } catch { /* ignore */ }

    const pauseMinutes = 30;
    console.log(`  Sleeping ${pauseMinutes} minutes until next cycle...`);
    await sleep(pauseMinutes * 60 * 1000);
  }
}

main().catch(err => { console.error("Fatal error:", err); process.exit(1); });
