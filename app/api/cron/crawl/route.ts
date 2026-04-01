import { NextResponse } from "next/server";
import { db } from "../../../../server/db";
import { eq } from "drizzle-orm";
import {
  movies, persons, genres, movieGenres, movieCast, movieCrew,
} from "../../../../shared/schema";

// Vercel cron can run this on a schedule
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const TMDB = "https://api.themoviedb.org/3";
const OMDB = "http://www.omdbapi.com";
const IMG = "https://image.tmdb.org/t/p";

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

async function tmdbFetch<T>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${TMDB}${path}${sep}api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return tmdbFetch<T>(path);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json() as T;
}

async function omdbFetch(imdbId: string): Promise<any | null> {
  if (!OMDB_KEY) return null;
  try {
    const res = await fetch(`${OMDB}/?i=${imdbId}&apikey=${OMDB_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.Response === "False" ? null : data;
  } catch { return null; }
}

const personCache = new Map<number, number>();
const genreCache = new Map<string, number>();

async function upsertPerson(tmdbPerson: {
  id: number; name: string; profile_path?: string | null;
  known_for_department?: string;
}, fetchDetails = false): Promise<number> {
  const cached = personCache.get(tmdbPerson.id);
  if (cached) return cached;

  const slug = slugify(tmdbPerson.name);
  const [existing] = await db.select({ id: persons.id })
    .from(persons).where(eq(persons.slug, slug)).limit(1);

  if (existing) {
    personCache.set(tmdbPerson.id, existing.id);
    return existing.id;
  }

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
    name: tmdbPerson.name, slug: finalSlug, photoUrl, bio, birthDate, birthPlace,
    knownFor: tmdbPerson.known_for_department || null, imdbId,
  }).returning({ id: persons.id });

  personCache.set(tmdbPerson.id, inserted.id);
  return inserted.id;
}

async function upsertGenre(name: string): Promise<number> {
  const cached = genreCache.get(name);
  if (cached) return cached;

  const slug = slugify(name);
  const [existing] = await db.select({ id: genres.id })
    .from(genres).where(eq(genres.slug, slug)).limit(1);

  if (existing) { genreCache.set(name, existing.id); return existing.id; }

  const [inserted] = await db.insert(genres).values({ name, slug }).returning({ id: genres.id });
  genreCache.set(name, inserted.id);
  return inserted.id;
}

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
  const detail = await tmdbFetch<TmdbMovie>(
    `/movie/${tmdbId}?append_to_response=credits,release_dates`
  );

  if (!detail.imdb_id) return false;

  const [existing] = await db.select({ id: movies.id })
    .from(movies).where(eq(movies.imdbId, detail.imdb_id)).limit(1);
  if (existing) return false;

  let mpaaRating: string | null = null;
  if (detail.release_dates?.results) {
    const us = detail.release_dates.results.find((r: any) => r.iso_3166_1 === "US");
    if (us?.release_dates?.length) {
      const cert = us.release_dates.find((d: any) => d.certification);
      mpaaRating = cert?.certification || null;
    }
  }

  const year = detail.release_date ? parseInt(detail.release_date.substring(0, 4), 10) : null;
  const baseSlug = slugify(detail.title);
  const movieSlug = year ? `${baseSlug}-${year}` : baseSlug;
  const finalSlug = await uniqueSlug(movieSlug, "movies");

  let status: "released" | "upcoming" | "in_production" = "released";
  if (detail.status === "Planned" || detail.status === "In Production" || detail.status === "Post Production") {
    status = "in_production";
  } else if (detail.status === "Upcoming") {
    status = "upcoming";
  }

  const formatMoney = (n?: number) => n && n > 0 ? `$${n.toLocaleString()}` : null;

  const [slugExists] = await db.select({ id: movies.id })
    .from(movies).where(eq(movies.slug, finalSlug)).limit(1);
  if (slugExists) return false;

  const [movie] = await db.insert(movies).values({
    title: detail.title, slug: finalSlug, year: year || undefined,
    releaseDate: detail.release_date || null, runtime: detail.runtime || null,
    synopsis: detail.overview || null,
    posterUrl: detail.poster_path ? `${IMG}/w500${detail.poster_path}` : null,
    backdropUrl: detail.backdrop_path ? `${IMG}/w1280${detail.backdrop_path}` : null,
    imdbId: detail.imdb_id,
    imdbRating: detail.vote_average ? Math.round(detail.vote_average * 10) / 10 : null,
    language: detail.original_language || null,
    country: detail.production_countries?.[0]?.name || null,
    budget: formatMoney(detail.budget), boxOffice: formatMoney(detail.revenue),
    mpaaRating, status,
  }).returning({ id: movies.id });

  const movieId = movie.id;

  if (detail.genres?.length) {
    for (const g of detail.genres) {
      const genreId = await upsertGenre(g.name);
      await db.insert(movieGenres).values({ movieId, genreId }).onConflictDoNothing();
    }
  }

  const castList = detail.credits?.cast?.slice(0, 20) || [];
  for (let i = 0; i < castList.length; i++) {
    const c = castList[i];
    try {
      const personId = await upsertPerson({
        id: c.id, name: c.name, profile_path: c.profile_path,
        known_for_department: c.known_for_department || "Acting",
      }, i < 3);
      await db.insert(movieCast).values({
        movieId, personId, character: c.character || null, order: i,
      });
    } catch (err: any) {
      if (!err.message?.includes("duplicate")) console.error(`Cast error: ${c.name}:`, err.message);
    }
  }

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
      }, c.job === "Director");
      await db.insert(movieCrew).values({
        movieId, personId, job: c.job, department: c.department || null,
      });
    } catch (err: any) {
      if (!err.message?.includes("duplicate")) console.error(`Crew error: ${c.name}:`, err.message);
    }
  }

  if (detail.imdb_id) {
    try {
      const omdb = await omdbFetch(detail.imdb_id);
      if (omdb) {
        const updates: any = {};
        if (omdb.imdbRating && omdb.imdbRating !== "N/A") updates.imdbRating = parseFloat(omdb.imdbRating);
        const rt = omdb.Ratings?.find((r: any) => r.Source === "Rotten Tomatoes");
        if (rt?.Value) updates.rtScore = parseInt(rt.Value.replace("%", ""), 10);
        if (!detail.revenue && omdb.BoxOffice && omdb.BoxOffice !== "N/A") updates.boxOffice = omdb.BoxOffice;
        if (Object.keys(updates).length > 0) {
          await db.update(movies).set(updates).where(eq(movies.id, movieId));
        }
      }
    } catch { /* optional */ }
  }

  return true;
}

export async function GET(request: Request) {
  // Verify cron secret (skip in development)
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!TMDB_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY not configured" }, { status: 500 });
  }

  const startTime = Date.now();
  const maxRuntime = 50_000; // 50s safety margin within 60s limit
  let added = 0;
  const errors: string[] = [];

  try {
    // 1. Crawl trending movies
    const trending = await tmdbFetch<{ results: { id: number }[] }>("/trending/movie/week");
    for (const m of trending.results) {
      if (Date.now() - startTime > maxRuntime) break;
      try {
        if (await processMovie(m.id)) added++;
      } catch (e: any) { errors.push(`trending ${m.id}: ${e.message}`); }
    }

    // 2. Now playing
    if (Date.now() - startTime < maxRuntime) {
      const nowPlaying = await tmdbFetch<{ results: { id: number }[] }>("/movie/now_playing");
      for (const m of nowPlaying.results) {
        if (Date.now() - startTime > maxRuntime) break;
        try {
          if (await processMovie(m.id)) added++;
        } catch (e: any) { errors.push(`now_playing ${m.id}: ${e.message}`); }
      }
    }

    // 3. Random discover page to catch new popular movies
    if (Date.now() - startTime < maxRuntime) {
      const page = Math.floor(Math.random() * 100) + 1;
      const discover = await tmdbFetch<{ results: { id: number }[] }>(
        `/discover/movie?sort_by=vote_count.desc&vote_count.gte=100&page=${page}`
      );
      for (const m of discover.results) {
        if (Date.now() - startTime > maxRuntime) break;
        try {
          if (await processMovie(m.id)) added++;
        } catch (e: any) { errors.push(`discover ${m.id}: ${e.message}`); }
      }
    }

    // 4. Popular movies page
    if (Date.now() - startTime < maxRuntime) {
      const page = Math.floor(Math.random() * 100) + 1;
      const popular = await tmdbFetch<{ results: { id: number }[] }>(
        `/discover/movie?sort_by=popularity.desc&page=${page}`
      );
      for (const m of popular.results) {
        if (Date.now() - startTime > maxRuntime) break;
        try {
          if (await processMovie(m.id)) added++;
        } catch (e: any) { errors.push(`popular ${m.id}: ${e.message}`); }
      }
    }
  } catch (e: any) {
    errors.push(`fatal: ${e.message}`);
  }

  return NextResponse.json({
    ok: true,
    moviesAdded: added,
    runtime: `${Math.round((Date.now() - startTime) / 1000)}s`,
    errors: errors.slice(0, 10),
  });
}
